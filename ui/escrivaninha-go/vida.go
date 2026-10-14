package main

// A janela da interface manda um "estou viva" a cada 10 s e um "tchau" quando fecha.
// O programa encerra sozinho quando a janela some, sem caixas de mensagem.

import (
	"sync/atomic"
	"time"
)

var (
	ultimoSinal  atomic.Int64 // UnixNano do último /api/vivo
	ultimoTchau  atomic.Int64 // UnixNano do último /api/tchau
	inicioServer = time.Now()
)

const (
	esperaPrimeiroSinal = 2 * time.Minute  // tempo para a janela abrir pela primeira vez
	silencioMaximo      = 3 * time.Minute  // janela minimizada manda sinal mais devagar
	carenciaTchau       = 15 * time.Second // recarregar a página manda tchau e logo um vivo
	intervaloChecagem   = 2 * time.Second
)

func sinalDeVida() { ultimoSinal.Store(time.Now().UnixNano()) }
func despedida()   { ultimoTchau.Store(time.Now().UnixNano()) }

func esperarJanelaFechar() {
	for {
		time.Sleep(intervaloChecagem)
		agora := time.Now()
		vivo, tchau := ultimoSinal.Load(), ultimoTchau.Load()
		if vivo == 0 {
			if agora.Sub(inicioServer) > esperaPrimeiroSinal {
				logar("A janela não abriu em %s; encerrando.", esperaPrimeiroSinal)
				return
			}
			continue
		}
		if tchau > vivo && agora.Sub(time.Unix(0, tchau)) > carenciaTchau {
			logar("Janela fechada; encerrando.")
			return
		}
		if agora.Sub(time.Unix(0, vivo)) > silencioMaximo {
			logar("Sem sinal da janela há %s; encerrando.", silencioMaximo)
			return
		}
	}
}
