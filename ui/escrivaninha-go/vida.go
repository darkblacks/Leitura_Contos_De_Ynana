package main

// Quando o programa encerra sozinho.
// A janela manda um "estou viva" a cada 10 s e um "tchau" quando fecha. Antes, 3 minutos sem
// sinal derrubavam tudo, e isso acontecia à toa: janela minimizada, Edge economizando energia,
// computador suspenso. Agora:
//   - fechar a janela (tchau sem novo sinal, ou o processo da janela que abrimos terminar) encerra;
//   - enquanto o processo da janela estiver aberto, silêncio não encerra nada;
//   - sem processo para vigiar, só um silêncio muito longo encerra;
//   - se o computador dormiu, o relógio do silêncio recomeça ao acordar.

import (
	"sync/atomic"
	"time"
)

var (
	ultimoSinal    atomic.Int64 // UnixNano do último /api/vivo
	ultimoTchau    atomic.Int64 // UnixNano do último /api/tchau
	janelaAberta   atomic.Bool  // o processo da janela que abrimos ainda está rodando
	janelaFechouEm atomic.Int64 // UnixNano de quando esse processo terminou
	inicioServer   = time.Now()
)

const (
	esperaPrimeiroSinal = 5 * time.Minute  // tempo para a janela abrir pela primeira vez
	silencioMaximo      = 45 * time.Minute // só quando não há processo da janela para vigiar
	carenciaTchau       = 15 * time.Second // recarregar a página manda tchau e logo um vivo
	intervaloChecagem   = 2 * time.Second
	saltoDeSono         = time.Minute // a checagem demorou isso tudo: o computador dormiu
)

func sinalDeVida() { ultimoSinal.Store(time.Now().UnixNano()) }
func despedida()   { ultimoTchau.Store(time.Now().UnixNano()) }

// vigiarJanela acompanha o processo da janela. Se ele durou pouco, o navegador só passou a
// janela para outro processo já aberto: aí não dá para vigiar, e vale o sinal de vida.
func vigiarJanela(esperar func() error) {
	janelaAberta.Store(true)
	ini := time.Now()
	go func() {
		defer func() { recover() }()
		esperar()
		janelaAberta.Store(false)
		if time.Since(ini) > 8*time.Second {
			janelaFechouEm.Store(time.Now().UnixNano())
		}
	}()
}

func esperarJanelaFechar() {
	antes := time.Now().Round(0) // relógio de parede: inclui o tempo dormindo
	for {
		time.Sleep(intervaloChecagem)
		agora := time.Now()
		if parede := time.Now().Round(0); parede.Sub(antes) > saltoDeSono {
			logar("O computador ficou parado por %s; continuo aberta.", parede.Sub(antes).Round(time.Second))
			sinalDeVida()
		}
		antes = time.Now().Round(0)
		vivo, tchau, fechou := ultimoSinal.Load(), ultimoTchau.Load(), janelaFechouEm.Load()
		if fechou > vivo && agora.Sub(time.Unix(0, fechou)) > carenciaTchau {
			logar("A janela foi fechada; encerrando.")
			return
		}
		if vivo == 0 {
			if !janelaAberta.Load() && agora.Sub(inicioServer) > esperaPrimeiroSinal {
				logar("A janela não abriu em %s; encerrando.", esperaPrimeiroSinal)
				return
			}
			continue
		}
		if tchau > vivo && agora.Sub(time.Unix(0, tchau)) > carenciaTchau {
			logar("Janela fechada; encerrando.")
			return
		}
		if !janelaAberta.Load() && agora.Sub(time.Unix(0, vivo)) > silencioMaximo {
			logar("Sem sinal da janela há %s; encerrando.", silencioMaximo)
			return
		}
	}
}
