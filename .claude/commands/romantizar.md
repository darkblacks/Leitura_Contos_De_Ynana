---
description: Transforma a entrada do diário do capítulo N num capítulo de romance (livro), no nosso jeito de escrever
argument-hint: <N> [3ª pessoa | 1ª pessoa] [observação do autor]
---

Romantizar o capítulo: **$ARGUMENTS**

O diário continua sendo o cânone. O romance é **outra versão** do mesmo capítulo, contada como livro: mesma história, mesmos fatos, com cenas, diálogo e ritmo de romance.

## Ler (só isto)
1. `estilo/romance.md` (a técnica) e, por cima dela, `estilo/estilo.md`, `estilo/guardrails.md` e a escrita de quem escreve o capítulo em `estilo/escritas/` (com a herança).
2. O capítulo do diário `capitulos/cap-NN.md` inteiro e as notas `continuidade/notas-do-autor/cap-NN.md` (pedido, "manter", "Tiques mantidos", "Romance" se houver).
3. A versão de romance anterior, `romance/cap-(N-1).md`, se existir (para manter o tom e o ponto de vista entre capítulos).
4. As fichas de quem aparece, do lugar e dos objetos (só o texto, sem abrir imagens), os acontecimentos do capítulo e `continuidade/registro.md`.

## Escrever `romance/cap-NN.md`
- Cabeçalho:
  ```
  ---
  status: rascunho
  capitulo: N
  titulo: (o do diário)
  origem: capitulos/cap-NN.md
  narrador: (3ª pessoa · ponto de vista de … | 1ª pessoa · …)
  ---
  ```
- **Narrador**: o que o autor escolheu; se não disse, **3ª pessoa no passado, colada em quem escreve a entrada**. Troca de ponto de vista só em troca de cena (`* * *`).
- **Fatos**: só os do diário (e do que ele lembra). Mostre o que o diário conta: a cena, o lugar, quem falou, o que ficou sem dizer. Nada de morte, revelação, relação ou regra do mundo nova. Detalhe pequeno criado vira fato fixo: registre em `continuidade/registro.md` como `- [cap-NN romance] …`.
- **Quem sabe o quê** continua valendo para o ponto de vista.
- **Nosso jeito por cima**: diálogo `"— Texto." Disse ela, …` (aspas com travessão dentro), onomatopeia entre asteriscos (`*TOC*`, `*CHUA*`, `*VUC*`) quando o som importa, parágrafo como momento inteiro, guardrails.
- **Tamanho**: pelo menos o tamanho do capítulo do diário (o romance mostra o que o diário resumia, sem encher).
- O que estiver em "manter" nas notas: se for uma fala ou imagem, ela aparece no romance também.

## Conferir e corrigir
1. `python3 ferramentas/checa_tiques.py romance/cap-NN.md` (no Windows sem Python: `.\Escrivaninha.exe tiques romance\cap-NN.md`); corrija só os trechos apontados.
2. `revisor-estilo` com o romance, `estilo/romance.md`, a escrita de quem escreve, `estilo/estilo.md`, `estilo/guardrails.md` e a saída do script. Corrija o que ele apontar.

## Não mexer
- `capitulos/cap-NN.md` (o diário) **não muda**.
- Se o romance já existir com `status: editado`, não reescreva sem o autor pedir.

No fim, diga em até 3 linhas: o narrador escolhido, quantas palavras, e um detalhe que o romance mostrou que o diário só contava.
