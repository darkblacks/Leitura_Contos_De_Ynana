---
description: Roda só a revisão (continuidade + estilo) num capítulo, sem reescrever
argument-hint: <N>
---

Revisar o capítulo **$ARGUMENTS** sem alterar nenhum arquivo.

1. Confirme que `capitulos/cap-NN.md` existe. Leia só o cabeçalho e os beats do capítulo em `escaleta/escaleta.md` para saber quem e quais lugares aparecem.
2. Rode `python3 ferramentas/checa_tiques.py capitulos/cap-NN.md --resumo` (no Windows sem Python: `.\Escrivaninha.exe tiques capitulos\cap-NN.md --resumo`).
3. Chame em paralelo, com contexto limpo e só os caminhos necessários:
   - `revisor-continuidade`: o capítulo, a ficha de quem escreve, `continuidade/registro.md`, `continuidade/resumos.md`, os beats, as fichas envolvidas e o capítulo anterior (se existir).
   - `revisor-estilo`: o capítulo, `estilo/estilo.md`, `estilo/guardrails.md`, `estilo/exemplos/`, a saída do script, a ficha de quem escreve e as fichas dos personagens citados com fala.
4. Junte as duas listas numa só, sem repetir, ordenada por gravidade: **grave** (contradição, personagem sabendo o que não sabe, desvio da escaleta), **médio** (regra do estilo, voz fora da ficha), **leve** (tiques isolados).
5. Para cada item: linha, trecho, regra ou fato violado, e uma sugestão de direção em uma linha (não a reescrita pronta).
6. Não reescreva. Se o capítulo estiver `editado`, lembre que a decisão é minha.
