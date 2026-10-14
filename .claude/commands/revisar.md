---
description: Roda só a revisão (continuidade + estilo) num capítulo, sem reescrever
argument-hint: <N>
---

Revisar o capítulo **$ARGUMENTS** sem alterar nenhum arquivo.

1. Confirme que `capitulos/cap-NN.md` existe. Leia o cabeçalho e o pedido em `continuidade/notas-do-autor/cap-NN.md` (se houver) para saber quem, onde, quando e quais acontecimentos.
2. Rode `python3 ferramentas/checa_tiques.py capitulos/cap-NN.md --resumo` (no Windows sem Python: `.\Escrivaninha.exe tiques capitulos\cap-NN.md --resumo`).
3. Chame em paralelo, com contexto limpo e só os caminhos necessários:
   - `revisor-continuidade`: o capítulo, o pedido, a ficha de quem escreve, registro, resumos, fichas envolvidas, capítulo anterior, calendário, geografia, relações e acontecimentos escolhidos.
   - `revisor-estilo`: o capítulo, a escrita de quem escreve em `estilo/escritas/` (e a que ela herda), `estilo/estilo.md`, `estilo/guardrails.md`, a saída do script e as fichas de quem fala.
4. Junte as listas, sem repetir, por gravidade: **grave** (contradição, personagem sabendo o que não sabe, data que não bate), **médio** (fora da escrita de quem escreve), **leve** (tiques isolados).
5. Para cada item: trecho, o que foi violado e uma direção em uma linha. Não reescreva.
