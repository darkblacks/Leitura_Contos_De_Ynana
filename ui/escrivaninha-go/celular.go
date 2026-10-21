package main

// Celular: a Escrivaninha aberta também na rede Wi-Fi de casa, para o app do celular.
// Desligado por padrão; liga em Opções. O celular entra com um código de 6 dígitos e recebe
// um cookie (válido até o autor gerar um código novo). Só o próprio computador (127.0.0.1)
// liga, desliga ou troca o código. O sinal de vida do celular não conta: quem decide quando o
// programa fecha continua sendo a janela do computador.

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type configCelular struct {
	Ativo  bool   `json:"ativo"`
	Codigo string `json:"codigo"`
	Token  string `json:"token"`
	Porta  int    `json:"porta"`
}

type chaveCtx string

const (
	ctxRede            chaveCtx = "rede"
	portaCelularPadrao          = 8800
	cookieCelular               = "ynana_celular"
)

var (
	celMu       sync.Mutex
	celCfg      configCelular
	celSrv      *http.Server
	celRoteador http.Handler
	celErros    int
	celTrava    time.Time
)

func arquivoCelular() string {
	d, err := os.UserConfigDir()
	if err != nil {
		d = raiz
	}
	return filepath.Join(d, "ContosDeYnana", "celular.json")
}

func novoCodigoCelular() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(1000000))
	return fmt.Sprintf("%06d", n.Int64())
}

func novoTokenCelular() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func carregarCelular() {
	celMu.Lock()
	defer celMu.Unlock()
	if b, err := os.ReadFile(arquivoCelular()); err == nil {
		json.Unmarshal(b, &celCfg)
	}
	if len(celCfg.Codigo) != 6 {
		celCfg.Codigo = novoCodigoCelular()
	}
	if celCfg.Token == "" {
		celCfg.Token = novoTokenCelular()
	}
	if celCfg.Porta == 0 {
		celCfg.Porta = portaCelularPadrao
	}
}

func salvarCelular() {
	os.MkdirAll(filepath.Dir(arquivoCelular()), 0o755)
	b, _ := json.MarshalIndent(celCfg, "", "  ")
	os.WriteFile(arquivoCelular(), b, 0o600)
}

// iniciarCelular guarda o roteador e, se o autor deixou ligado, abre a porta da rede.
func iniciarCelular(roteador http.Handler) {
	celRoteador = roteador
	carregarCelular()
	celMu.Lock()
	ativo := celCfg.Ativo
	celMu.Unlock()
	if ativo {
		if err := ligarCelular(); err != nil {
			logar("Celular: não consegui abrir a rede (%v)", err)
		}
	}
}

func ligarCelular() error {
	celMu.Lock()
	defer celMu.Unlock()
	if celSrv != nil {
		return nil
	}
	var ln net.Listener
	var err error
	for p := celCfg.Porta; p < celCfg.Porta+20; p++ {
		if ln, err = net.Listen("tcp", fmt.Sprintf("0.0.0.0:%d", p)); err == nil {
			celCfg.Porta = p
			break
		}
	}
	if err != nil {
		return err
	}
	celSrv = &http.Server{Handler: http.HandlerFunc(portaoCelular), ReadHeaderTimeout: 15 * time.Second}
	go func(s *http.Server, l net.Listener) {
		if err := s.Serve(l); err != nil && err != http.ErrServerClosed {
			logar("Celular: a rede parou (%v)", err)
		}
	}(celSrv, ln)
	logar("Celular: aberta na rede, porta %d", celCfg.Porta)
	return nil
}

func desligarCelular() {
	celMu.Lock()
	defer celMu.Unlock()
	if celSrv != nil {
		celSrv.Close()
		celSrv = nil
		logar("Celular: rede fechada")
	}
}

// enderecosRede: os endereços IPv4 desta máquina na rede de casa (192.168…, 10…, 172.16–31…);
// se não houver nenhum desses, qualquer IPv4 que não seja o do próprio computador.
func enderecosRede() []string {
	out, outros := []string{}, []string{}
	ifs, _ := net.Interfaces()
	for _, it := range ifs {
		if it.Flags&net.FlagUp == 0 || it.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, _ := it.Addrs()
		for _, a := range addrs {
			ipn, ok := a.(*net.IPNet)
			if !ok {
				continue
			}
			if ip := ipn.IP.To4(); ip != nil && ip.IsPrivate() {
				out = append(out, ip.String())
			} else if ip != nil && !ip.IsLinkLocalUnicast() {
				outros = append(outros, ip.String())
			}
		}
	}
	if len(out) == 0 {
		return outros
	}
	return out
}

func veioDaRede(r *http.Request) bool {
	v, _ := r.Context().Value(ctxRede).(bool)
	return v
}

// portaoCelular: tudo que chega pela rede passa aqui. Sem o cookie certo, só a página do código.
func portaoCelular(w http.ResponseWriter, r *http.Request) {
	celMu.Lock()
	token, codigo, trava := celCfg.Token, celCfg.Codigo, celTrava
	celMu.Unlock()

	if r.URL.Path == "/celular" {
		c := strings.TrimSpace(r.URL.Query().Get("codigo"))
		if c == "" {
			paginaCodigoCelular(w, "")
			return
		}
		if time.Now().Before(trava) {
			paginaCodigoCelular(w, "Muitas tentativas erradas. Espere um minuto e tente de novo.")
			return
		}
		if subtle.ConstantTimeCompare([]byte(c), []byte(codigo)) == 1 {
			celMu.Lock()
			celErros = 0
			celMu.Unlock()
			http.SetCookie(w, &http.Cookie{Name: cookieCelular, Value: token, Path: "/", MaxAge: 400 * 24 * 3600, HttpOnly: true, SameSite: http.SameSiteLaxMode})
			http.Redirect(w, r, "/", http.StatusSeeOther)
			return
		}
		celMu.Lock()
		celErros++
		if celErros >= 5 {
			celErros = 0
			celTrava = time.Now().Add(time.Minute)
		}
		celMu.Unlock()
		paginaCodigoCelular(w, "Código errado. Confira em Opções › Celular, no computador.")
		return
	}

	ck, err := r.Cookie(cookieCelular)
	if err != nil || subtle.ConstantTimeCompare([]byte(ck.Value), []byte(token)) != 1 {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			responder(w, 401, item{"erro": "celular sem acesso: digite o código de Opções › Celular"})
			return
		}
		paginaCodigoCelular(w, "")
		return
	}
	switch r.URL.Path {
	case "/api/vivo", "/api/tchau":
		// o celular não decide quando o programa do computador fecha
		io.Copy(io.Discard, r.Body)
		responder(w, 200, item{"ok": true})
		return
	case "/api/celular":
		if r.Method != http.MethodGet {
			responder(w, 403, item{"erro": "só o computador muda o acesso do celular"})
			return
		}
		responder(w, 200, item{"disponivel": true, "pelaRede": true})
		return
	}
	celRoteador.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxRede, true)))
}

func paginaCodigoCelular(w http.ResponseWriter, aviso string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	fmt.Fprintf(w, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Contos de Ynana</title><style>
body{margin:0;font-family:system-ui,sans-serif;background:#f3f3f1;color:#141414;display:grid;place-items:center;min-height:100vh}
form{background:#fff;border:1px solid #e4e4e2;border-radius:12px;padding:24px;width:min(340px,90vw);box-shadow:0 8px 24px #00000012}
h1{font-size:20px;margin:0 0 6px}p{color:#555;font-size:14px;margin:0 0 14px}
input{width:100%%;box-sizing:border-box;font-size:28px;letter-spacing:8px;text-align:center;padding:10px;border:1px solid #cacac6;border-radius:8px}
button{margin-top:14px;width:100%%;padding:12px;font-size:16px;background:#c8102e;color:#fff;border:0;border-radius:8px}
.aviso{color:#c8102e;font-size:13px;margin-top:10px}</style></head><body>
<form action="/celular" method="get"><h1>Contos de Ynana</h1><p>Digite o código que aparece no computador, em Opções › Celular.</p>
<input name="codigo" inputmode="numeric" maxlength="6" autocomplete="one-time-code" autofocus>
<button>Entrar</button>%s</form></body></html>`, func() string {
		if aviso == "" {
			return ""
		}
		return `<div class="aviso">` + html.EscapeString(aviso) + `</div>`
	}())
}

// rotasCelular: o computador vê e muda o acesso do celular (Opções › Celular).
func rotasCelular(mux *http.ServeMux) {
	mux.HandleFunc("/api/celular", func(w http.ResponseWriter, r *http.Request) {
		if veioDaRede(r) {
			responder(w, 403, item{"erro": "só o computador muda o acesso do celular"})
			return
		}
		if r.Method == http.MethodPost {
			if !origemOK(r) {
				responder(w, 403, item{"erro": "origem não permitida"})
				return
			}
			var d struct {
				Acao string `json:"acao"`
			}
			json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&d)
			switch d.Acao {
			case "ligar":
				if err := ligarCelular(); err != nil {
					responderErro(w, fmt.Errorf("não consegui abrir a rede: %v", err))
					return
				}
				celMu.Lock()
				celCfg.Ativo = true
				salvarCelular()
				celMu.Unlock()
			case "desligar":
				desligarCelular()
				celMu.Lock()
				celCfg.Ativo = false
				salvarCelular()
				celMu.Unlock()
			case "novo-codigo":
				celMu.Lock()
				celCfg.Codigo, celCfg.Token = novoCodigoCelular(), novoTokenCelular()
				salvarCelular()
				celMu.Unlock()
			default:
				responderErro(w, fmt.Errorf("ação desconhecida"))
				return
			}
		}
		celMu.Lock()
		resp := item{"disponivel": true, "ativo": celSrv != nil, "porta": celCfg.Porta, "codigo": celCfg.Codigo, "enderecos": enderecosRede()}
		celMu.Unlock()
		responder(w, 200, resp)
	})
}
