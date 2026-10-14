---
description: Escreve, revisa e registra os capítulos N (ou N a M), em sequência
argument-hint: <N> ou <N-M>
---

Escrever os capítulos: **$ARGUMENTS** (um por vez, em ordem).

Antes de começar, para cada capítulo do intervalo:
- Se a escaleta dele não estiver `aprovada`, pare e me avise.
- Se `capitulos/cap-NN.md` já existir com `status: editado`, **não toque**: avise e pule.
- Se existir como `rascunho` ou `revisado`, pergunte se é para reescrever.

## Loop por capítulo

1. **Ler** (só isto):
   - `CLAUDE.md`, `estilo/estilo.md`, `estilo/guardrails.md`
   - os exemplos em `estilo/exemplos/` (o modelo de escrita), dando preferência aos de quem escreve este capítulo
   - a ficha de quem escreve (Persona, Voz, "Como escreve no diário"), sempre
   - os beats do capítulo em `escaleta/escaleta.md`
   - `continuidade/registro.md` e `continuidade/resumos.md`
   - o capítulo anterior inteiro (`cap-(N-1).md`), se existir
   - só as fichas dos personagens e lugares que aparecem nos beats

2. **Escrever** `capitulos/cap-NN.md` (número com dois dígitos) com o cabeçalho:
   ```
   ---
   status: rascunho
   capitulo: N
   titulo:
   quando:
   quem_escreve:
   ---
   ```
   É uma entrada de diário em primeira pessoa: siga a forma dos exemplos e o `estilo.md`, com o tom de quem escreve, e os beats na ordem. Quem escreve só conta o que sabe até a data da entrada. Se um `[DECIDIR]` do estilo afetar o capítulo e os exemplos não resolverem, pare e avise. Detalhe menor inventado: anote para registrar no passo 6. Fato novo importante fora da escaleta: não invente; pare e pergunte.

3. **Script**: rode `python3 ferramentas/checa_tiques.py capitulos/cap-NN.md` (no Windows sem Python: `.\Escrivaninha.exe tiques capitulos\cap-NN.md`, mesma saída) e guarde a saída num arquivo temporário do scratchpad (ou cole no pedido ao revisor).

4. **Revisores** (podem rodar em paralelo, cada um com contexto limpo). Passe só os caminhos dos arquivos necessários:
   - `revisor-continuidade`: o capítulo, a ficha de quem escreve, `continuidade/registro.md`, `continuidade/resumos.md`, os beats do capítulo, as fichas envolvidas e o capítulo anterior.
   - `revisor-estilo`: o capítulo, `estilo/estilo.md`, `estilo/guardrails.md`, `estilo/exemplos/`, a saída do script, a ficha de quem escreve e as fichas dos personagens citados com fala.

5. **Reescrever só os trechos apontados.** Não mexa no resto. Se discordar de um apontamento (falso positivo do script, por exemplo), mantenha e anote o motivo para o relatório final.

6. **Atualizar a continuidade**:
   - `continuidade/registro.md`: novos fatos com `[cap-NN]`, fatos superados riscados, linha do tempo, pendências plantadas e pagas, detalhes criados.
   - `continuidade/resumos.md`: resumo do capítulo (até 5 linhas).
   - "Estado atual" das fichas de quem aparece; detalhes de lugar criados vão para a ficha do lugar.
   - Mude o cabeçalho para `status: revisado`.

7. **Furo grave → parar.** Se um revisor apontar contradição com fato estabelecido, personagem sabendo o que não sabe, ou desvio da escaleta que afeta capítulos seguintes, e não der para corrigir só no trecho sem mudar a história: pare, me explique em poucas linhas com as citações e espere eu decidir antes de seguir para o próximo capítulo.

8. **Relatório** (poucas linhas): o que aconteceu no capítulo, o que foi corrigido na revisão, o que ficou como estava e por quê, detalhes novos que viraram fato fixo.

Entre um capítulo e outro, não reaproveite impressões da memória da conversa: releia o registro atualizado.
