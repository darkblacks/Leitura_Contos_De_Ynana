package main

// Atualização dentro do app.
//
// Cada versão publicada na branch main do repositório traz dist/versao.json:
//
//	{"versao": "1.5.0", "sha256": "<hash do exe>", "notas": ["…"]}
//
// O app compara com a própria versão; se houver uma nova, a tela mostra o aviso.
// Ao atualizar: baixa dist/Escrivaninha.exe, confere o sha256, troca o próprio
// executável (renomeia o atual para .velho, põe o novo no lugar), inicia o novo na
// mesma porta e se encerra. A janela recarrega sozinha quando o novo responder.
// Só fala com o GitHub (raw.githubusercontent.com), e só para isso.

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Preenchidos no build (ldflags -X); os valores abaixo valem para builds de teste.
var (
	versao        = "0.0.0-dev"
	urlBaseUpdate = "https://raw.githubusercontent.com/darkblacks/Leitura_Contos_De_Ynana/main/"
	// Pergunta ao GitHub o commit atual da main, para baixar pelo endereço exato e
	// fugir do cache de alguns minutos do endereço ".../main/". Vazio desliga.
	urlRefMain = "https://api.github.com/repos/darkblacks/Leitura_Contos_De_Ynana/commits/main"
)

// baseDaVersao devolve o endereço base do commit atual da main (ou o da main, se falhar).
func baseDaVersao() string {
	if urlRefMain == "" {
		return urlBaseUpdate
	}
	req, _ := http.NewRequest("GET", urlRefMain, nil)
	req.Header.Set("Accept", "application/vnd.github.sha")
	req.Header.Set("User-Agent", "Escrivaninha/"+versao)
	cli := http.Client{Timeout: 5 * time.Second}
	r, err := cli.Do(req)
	if err != nil {
		return urlBaseUpdate
	}
	defer r.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(r.Body, 100))
	sha := strings.TrimSpace(string(b))
	if r.StatusCode != 200 || len(sha) != 40 {
		return urlBaseUpdate
	}
	return strings.TrimSuffix(urlBaseUpdate, "main/") + sha + "/"
}

type manifesto struct {
	base   string   // de onde veio (para baixar o exe do mesmo commit)
	Versao string   `json:"versao"`
	Sha256 string   `json:"sha256"`
	Notas  []string `json:"notas"`
}

var (
	cacheMu       sync.Mutex
	cacheManif    *manifesto
	cacheQuando   time.Time
	atualizando   bool
	portaEmUso    int
	clienteUpdate = &http.Client{Timeout: 90 * time.Second}
)

// maisNova compara "1.10.2" com "1.9.0" numericamente.
func maisNova(a, b string) bool {
	pa, pb := strings.Split(strings.SplitN(a, "-", 2)[0], "."), strings.Split(strings.SplitN(b, "-", 2)[0], ".")
	for i := 0; i < 3; i++ {
		var x, y int
		if i < len(pa) {
			x, _ = strconv.Atoi(pa[i])
		}
		if i < len(pb) {
			y, _ = strconv.Atoi(pb[i])
		}
		if x != y {
			return x > y
		}
	}
	return false
}

func buscarManifesto() (*manifesto, error) {
	cacheMu.Lock()
	defer cacheMu.Unlock()
	if cacheManif != nil && time.Since(cacheQuando) < 10*time.Minute {
		return cacheManif, nil
	}
	cli := http.Client{Timeout: 6 * time.Second}
	base := baseDaVersao()
	r, err := cli.Get(base + "dist/versao.json?t=" + strconv.FormatInt(time.Now().Unix(), 10))
	if err != nil {
		return nil, errors.New("sem internet para procurar atualização")
	}
	defer r.Body.Close()
	if r.StatusCode != 200 {
		return nil, fmt.Errorf("servidor de atualização respondeu %d", r.StatusCode)
	}
	var m manifesto
	if err := json.NewDecoder(io.LimitReader(r.Body, 64*1024)).Decode(&m); err != nil || m.Versao == "" {
		return nil, errors.New("arquivo de versão inválido")
	}
	m.base = base
	cacheManif, cacheQuando = &m, time.Now()
	return &m, nil
}

func statusAtualizacao() item {
	st := item{"atual": versao}
	m, err := buscarManifesto()
	if err != nil {
		st["erro"] = err.Error()
		return st
	}
	st["ultima"] = m.Versao
	st["disponivel"] = maisNova(m.Versao, versao)
	st["notas"] = m.Notas
	return st
}

// aplicarAtualizacao baixa, confere e troca o executável; depois reinicia.
func aplicarAtualizacao() error {
	cacheMu.Lock()
	if atualizando {
		cacheMu.Unlock()
		return errors.New("a atualização já está em andamento")
	}
	atualizando = true
	cacheMu.Unlock()
	falhou := func(err error) error {
		cacheMu.Lock()
		atualizando = false
		cacheMu.Unlock()
		logar("Atualização falhou: %v", err)
		return err
	}

	m, err := buscarManifesto()
	if err != nil {
		return falhou(err)
	}
	if !maisNova(m.Versao, versao) {
		return falhou(errors.New("já está na versão mais nova"))
	}
	exe, err := os.Executable()
	if err != nil {
		return falhou(err)
	}
	exe, _ = filepath.EvalSymlinks(exe)
	novo, velho := exe+".novo", strings.TrimSuffix(exe, filepath.Ext(exe))+".velho"+filepath.Ext(exe)

	r, err := clienteUpdate.Get(m.base + "dist/Escrivaninha.exe?v=" + m.Versao)
	if err != nil {
		return falhou(errors.New("não consegui baixar a versão nova"))
	}
	defer r.Body.Close()
	if r.StatusCode != 200 {
		return falhou(fmt.Errorf("download respondeu %d", r.StatusCode))
	}
	f, err := os.OpenFile(novo, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o755)
	if err != nil {
		return falhou(err)
	}
	h := sha256.New()
	_, err = io.Copy(io.MultiWriter(f, h), io.LimitReader(r.Body, 200*1024*1024))
	f.Close()
	if err != nil {
		os.Remove(novo)
		return falhou(errors.New("o download foi interrompido"))
	}
	if !strings.EqualFold(hex.EncodeToString(h.Sum(nil)), m.Sha256) {
		os.Remove(novo)
		return falhou(errors.New("o arquivo baixado veio corrompido; tente de novo"))
	}

	// Windows deixa renomear um exe em execução, mas não sobrescrever.
	os.Remove(velho)
	if err := os.Rename(exe, velho); err != nil {
		os.Remove(novo)
		return falhou(fmt.Errorf("não consegui trocar o programa: %w", err))
	}
	if err := os.Rename(novo, exe); err != nil {
		os.Rename(velho, exe)
		return falhou(fmt.Errorf("não consegui trocar o programa: %w", err))
	}
	logar("Atualizado de %s para %s; reiniciando.", versao, m.Versao)

	args := []string{"--porta", strconv.Itoa(portaEmUso), "--reiniciado"}
	if raiz != "" {
		args = append(args, "--pasta", raiz)
	}
	cmd := exec.Command(exe, args...)
	cmd.Dir = filepath.Dir(exe)
	if err := cmd.Start(); err != nil {
		os.Rename(exe, novo)
		os.Rename(velho, exe)
		return falhou(fmt.Errorf("não consegui abrir a versão nova: %w", err))
	}
	// Dá tempo da resposta chegar à tela e libera a porta para o novo processo.
	go func() {
		time.Sleep(800 * time.Millisecond)
		os.Exit(0)
	}()
	return nil
}

// limparRestos apaga o .velho/.novo de uma atualização anterior.
func limparRestos() {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	exe, _ = filepath.EvalSymlinks(exe)
	base := strings.TrimSuffix(exe, filepath.Ext(exe))
	for i := 0; i < 10; i++ {
		e1 := os.Remove(base + ".velho" + filepath.Ext(exe))
		os.Remove(exe + ".novo")
		if e1 == nil || os.IsNotExist(e1) {
			return
		}
		time.Sleep(500 * time.Millisecond) // o processo antigo ainda está saindo
	}
}

func rotasAtualizacao(mux *http.ServeMux) {
	mux.HandleFunc("/api/atualizacao", func(w http.ResponseWriter, r *http.Request) {
		responder(w, 200, statusAtualizacao())
	})
	mux.HandleFunc("/api/atualizar", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || !origemOK(r) {
			responder(w, 403, item{"erro": "não permitido"})
			return
		}
		if err := aplicarAtualizacao(); err != nil {
			responderErro(w, err)
			return
		}
		responder(w, 200, item{"ok": true})
	})
}
