---
description: Lê o material em entrada/ e distribui nas fichas, história, escaleta e registro
---

Importe o material antigo de `entrada/` para o ambiente de escrita.

1. Liste os arquivos em `entrada/` (ignore `LEIA-ME.md`). Se estiver vazia, avise e pare.
2. Leia `CLAUDE.md`, `biblia/historia.md`, os modelos `biblia/personagens/_modelo.md` e `biblia/lugares/_modelo.md`, e o que já existir em `biblia/`, `escaleta/` e `continuidade/`.
3. Leia cada arquivo de `entrada/` e classifique cada informação:
   - premissa, abertura, final, arcos, regras do mundo, linha do tempo, mapa → `biblia/historia.md`
   - personagem → `biblia/personagens/<nome>.md` (cria a partir do modelo ou completa a existente)
   - lugar → `biblia/lugares/<nome>.md`
   - planejamento de capítulos → `escaleta/escaleta.md` (status `aprovada` só se o material já for um plano fechado; senão `proposta`)
   - capítulo já escrito → `capitulos/cap-NN.md` **com o texto sem alteração nenhuma** e `status: editado` (é texto do autor, portanto cânone)
   - fato de continuidade → `continuidade/registro.md` com a origem (`[cap-NN]` ou `[entrada/arquivo]`)
   - pistas de estilo (como o autor escreve) → **não grave** em `estilo/estilo.md`; anote para usar na entrevista de estilo
4. **Contradições**: quando duas versões discordarem (idade, nome, ordem de eventos, geografia), não escolha. Junte todas numa lista e me pergunte, uma de cada vez, qual vale. Mostre as duas versões e de que arquivo vem cada uma.
5. Para cada capítulo importado, escreva o resumo em `continuidade/resumos.md` e extraia os fatos para o registro.
6. Não apague nada de `entrada/`.
7. No fim, me mostre em poucas linhas: o que foi criado/atualizado, as contradições que ficaram pendentes, as lacunas (campos `(a definir)` importantes) e as pistas de estilo que você encontrou.
