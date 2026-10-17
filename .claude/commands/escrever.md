---
description: Escreve, revisa e registra o capítulo N, a partir do pedido do autor
argument-hint: <N>
---

Escrever o capítulo **$ARGUMENTS**.

Não existe roteiro pronto: o que acontece vem do **pedido do autor** (no chat ou salvo em `continuidade/notas-do-autor/cap-NN.md`, seção "Pedido": título, subtítulo, quem escreve, onde, quando, acontecimentos, o que acontece, tom). Se não houver pedido nem dá para entender o que acontece, pergunte em uma frase.

- Se `capitulos/cap-NN.md` já existir com texto e `status: editado`, não toque sem o autor pedir explicitamente.

## Loop

1. **Ler** (só isto). Se a mensagem trouxer a **Ficha técnica** montada pela Escrivaninha (data, ciclo, quem é quem, família, casta, empresa, cargo, relações, lugar, estado vigente, com os caminhos), comece por ela: ela diz exatamente quais arquivos abrir.
   - o pedido e as notas do capítulo (`continuidade/notas-do-autor/cap-NN.md`), inclusive o que está em "manter" e em "Tiques mantidos"
   - **a escrita de quem escreve**: `estilo/escritas/<nome>.md` e, se ela herda de outra, a de cima também (o que estiver vazio vem de lá); `estilo/estilo.md` (regras gerais) e `estilo/guardrails.md`
   - a ficha de quem escreve (a versão de aparência da idade); **não abra imagens**, use só as descrições
   - o capítulo anterior inteiro (`cap-(N-1).md`), se existir; para os de antes, os **acontecimentos canonizados** (`biblia/acontecimentos/`: onde estava cada um, função) e `continuidade/resumos.md`; `continuidade/registro.md`
   - as fichas dos personagens, lugares e artefatos do pedido (só o texto). Em cada personagem use: a **versão de aparência** da idade ou fase na data, a idade (data − nascimento), Personalidade, Motivação, Segredos e conhecimento ("Sabe" e "Desconhece" limitam o que ele pode dizer), Voz e Estado atual
   - as **dinâmicas** de quem aparece: família e árvore (`biblia/familias/`), casta e bolha (ficha › Sociedade, ou a da família; `biblia/sociedade.md`), empresa e papel (`biblia/empresas/`), ocupação, e o **cargo público na data** (`biblia/parlamento.md`, versão do ano mais alto que não passa do ano do capítulo). Elas decidem quem trata quem como igual, quem obedece, quem desconfia, como cada um fala com o outro
   - para o lugar da cena, a cadeia dele em `biblia/geografia.md` e as fichas dessa cadeia
   - o **estado vigente** de cada lugar e objeto da cena: a última linha de "Mudanças nos lugares/objetos" antes da data do capítulo (busque o nome em `biblia/acontecimentos/`)
   - os acontecimentos escolhidos (`biblia/acontecimentos/`) e o ciclo deles (`biblia/ciclos.md`); `biblia/relacoes.md` entre quem aparece
   - `biblia/calendario.md`: o nome do mês e os **feriados e festivais** que caem na data do capítulo (se cair, a cena pode e deve sentir isso)

2. **Escrever** `capitulos/cap-NN.md`. O cabeçalho (frontmatter) já vem preenchido pela Escrivaninha; se não vier, crie:
   ```
   ---
   status: rascunho
   capitulo: N
   titulo:
   subtitulo:
   onde:
   quando:
   quem_escreve:
   ---
   ```
   Esses dados formam o **cabeçalho fixo** de todo capítulo (`TÍTULO - QUEM ESCREVE` / `subtítulo - local - data`), que a Escrivaninha mostra no topo. Não repita o cabeçalho no texto. O texto é uma entrada de diário em primeira pessoa, **do jeito da escrita de quem escreve** (escrita comum, diálogo, ação, diálogo com ação, com os exemplos dela). Quem escreve só conta o que sabe até a data. A data do capítulo tem que bater com a dos acontecimentos escolhidos; se não bater, avise antes de escrever. Fato novo importante fora do pedido: pergunte. **Mínimo de 4.600 palavras** (ou o tamanho do pedido): aprofunde as cenas, sem enchimento e sem fato novo.

3. **Script**: `python3 ferramentas/checa_tiques.py capitulos/cap-NN.md` (no Windows sem Python: `.\Escrivaninha.exe tiques capitulos\cap-NN.md`).

4. **Revisores** (em paralelo, contexto limpo, só os caminhos):
   - `revisor-continuidade`: o capítulo, as notas do capítulo (pedido), a ficha de quem escreve, registro, resumos, fichas envolvidas, capítulo anterior, `biblia/calendario.md`, `biblia/geografia.md`, `biblia/relacoes.md`, `biblia/parlamento.md`, as famílias e empresas de quem aparece e os acontecimentos escolhidos.
   - `revisor-estilo`: o capítulo, a escrita de quem escreve (e a que ela herda), `estilo/estilo.md`, `estilo/guardrails.md`, a saída do script, as notas do capítulo ("Tiques mantidos") e as fichas de quem fala.

5. **Corrigir só os trechos apontados.** Discordou de um apontamento: mantenha e anote o motivo.

6. **Registrar** (sem falar disso com o autor, a não ser que ele pergunte):
   - `continuidade/registro.md` (fatos novos com `[cap-NN]`) e `continuidade/resumos.md` (até 5 linhas)
   - "Estado atual" das fichas de quem aparece
   - em cada acontecimento mostrado, lembrado ou revelado: bloco `### cap-NN · <Acontece neste capítulo | Lembrança / flashback | Menção / revelação>` em "Nos capítulos", com Revelado a, Quem descobre, Informações e o Trecho exato
   - cabeçalho para `status: revisado`

7. **Relatório** curto: o que aconteceu no capítulo, o que foi corrigido, detalhes novos que viraram fato fixo.
