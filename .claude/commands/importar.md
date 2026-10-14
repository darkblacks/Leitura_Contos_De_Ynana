---
description: Lê entrada/ e referencias/ (textos e imagens) e pré-constrói fichas, história, escaleta e registro
---

Importe o material antigo de `entrada/` para o ambiente de escrita.

1. Liste os arquivos em `entrada/`, `referencias/textos/`, `referencias/imagens/` e `estilo/exemplos/` (ignore `LEIA-ME.md` e `.gitkeep`). Se tudo estiver vazio, avise e pare.
2. Leia `CLAUDE.md`, `biblia/historia.md`, os modelos `biblia/personagens/_modelo.md` e `biblia/lugares/_modelo.md`, e o que já existir em `biblia/`, `escaleta/` e `continuidade/`.
3. Leia cada arquivo de `entrada/` e classifique cada informação:
   - premissa, abertura, final, arcos, regras do mundo, linha do tempo, mapa → `biblia/historia.md`
   - personagem → `biblia/personagens/<nome>.md` (cria a partir do modelo ou completa a existente)
   - lugar → `biblia/lugares/<nome>.md`
   - planejamento de capítulos → `escaleta/escaleta.md` (status `aprovada` só se o material já for um plano fechado; senão `proposta`)
   - capítulo já escrito → `capitulos/cap-NN.md` **com o texto sem alteração nenhuma** e `status: editado` (é texto do autor, portanto cânone)
   - fato de continuidade → `continuidade/registro.md` com a origem (`[cap-NN]` ou `[entrada/arquivo]`)
   - entradas de diário que sirvam de modelo de forma ou tom → copie sem alterar para `estilo/exemplos/` e me avise
   - pistas de estilo → **não grave** regra em `estilo/estilo.md`; acrescente como `[DECIDIR]` na seção correspondente, com a pista como opção
4. **Contradições**: quando duas versões discordarem (idade, nome, ordem de eventos, geografia), não escolha. Junte todas numa lista e me pergunte, uma de cada vez, qual vale. Mostre as duas versões e de que arquivo vem cada uma.
5. Para cada capítulo importado, escreva o resumo em `continuidade/resumos.md` e extraia os fatos para o registro.
6. **Imagens** de `referencias/imagens/`: abra cada uma e registre só o que dá para ver (aparência, roupas, cores, arquitetura, clima, objetos) na ficha correspondente, citando a origem, ex.: `(ref: referencias/imagens/ynana-retrato.png)`. Não deduza personalidade nem história a partir de imagem. Se não souber de quem ou de onde é a imagem, pergunte.
7. **Capítulos oficiais** em `estilo/exemplos/`: identifique a forma (abertura e fechamento da entrada, diálogo, pensamento, parágrafos, tamanho) e escreva, ao lado de cada `[DECIDIR]` correspondente em `estilo/estilo.md`, uma linha `Proposta do Claude (pelos exemplos): ...` com o trecho que justifica. Não resolva o `[DECIDIR]`: quem decide é o autor.
8. Não apague nem mova nada de `entrada/`, `referencias/` ou `estilo/exemplos/`.
9. No fim, me mostre em poucas linhas: o que foi criado/atualizado, as contradições que ficaram pendentes, as lacunas (campos `(a definir)` importantes) e as pistas de estilo que você encontrou.
