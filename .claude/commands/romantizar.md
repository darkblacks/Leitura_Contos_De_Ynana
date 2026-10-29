---
description: Reescreve o capítulo N como um capítulo de livro de romance, no nosso jeito de escrever
argument-hint: <N> [voz de quem escreve | 3ª pessoa] [observação do autor]
---

Romantizar o capítulo: **$ARGUMENTS**

O autor quer o capítulo **mais real, mais parecido com um livro de verdade, no jeito dele**: o mesmo diário e a mesma voz, com a qualidade dos bons livros de fantasia (`estilo/romance.md`, seção 0). Você reescreve o próprio `capitulos/cap-NN.md`: mesma história, mesmos fatos, contada com a técnica de romance. A Escrivaninha já guardou o texto de antes em `continuidade/descartados/` (cópia de segurança; não precisa ler).

## Ler (só isto)
1. `estilo/romance.md` (a técnica) e, por cima dela, `estilo/estilo.md`, `estilo/guardrails.md` e a escrita de quem escreve o capítulo em `estilo/escritas/` (com a herança).
2. O capítulo `capitulos/cap-NN.md` **como está agora**, inteiro: é a fonte dos fatos.
3. As notas `continuidade/notas-do-autor/cap-NN.md` (pedido, "manter", "Tiques mantidos").
4. O capítulo anterior (para o tom e o ponto de vista seguirem), as fichas de quem aparece, do lugar e dos objetos (só o texto, sem abrir imagens), os acontecimentos do capítulo e `continuidade/registro.md`.

## Reescrever `capitulos/cap-NN.md`
- **Cabeçalho**: o mesmo (título, subtítulo, onde, quando, quem escreve); `status: rascunho`.
- **Voz**: a de quem escreve a entrada, em primeira pessoa, como na escrita dele (`estilo/escritas/`). Só use 3ª pessoa se o autor escolher.
- **Confiar no leitor** (`estilo/romance.md` §1): diga uma vez; sem advérbio que sobra ("Claro." e não "Calmamente, claro."), sem frase de propaganda ("o maior … de todos", "não era X, era…"), sem completar o óbvio ("alto", e não "tão alto que machucava meu ouvido"). Guardrails 26 e 27.
- **Fala de verdade, não contada** (guardrail 28): "Ela disse que me viu na festa" vira `"— Lembro de você na festa de gala."`. Todo "disse que", "perguntou se", "pediu para" de alguém que está na cena vira fala.
- **Diálogo no jeito do autor**: falas no meio do parágrafo, várias seguidas no mesmo parágrafo quando a troca é rápida; parágrafo só da fala quando é para dar ênfase.
- **Técnica** (`estilo/romance.md`): mostre as cenas que o texto só resumia (lugar, hora, quem está, o que cada um quer), diálogo com gesto e silêncio entre as falas, o comentário de quem escreve, apresentação de personagem por traços marcantes, detalhe concreto, ritmo que alterna cena lenta e rápida, fecho em imagem ou ação.
- **Nosso jeito por cima**: diálogo `"— Texto." Disse ela, …` (aspas com travessão dentro), onomatopeia entre asteriscos (`*TOC*`, `*CHUA*`, `*VUC*`) quando o som importa, parágrafo como momento inteiro, todos os guardrails.
- **Fatos**: só os do capítulo e da bíblia. Nada de morte, revelação, relação ou regra do mundo nova. Detalhe pequeno criado para a cena vira fato fixo e vai para `continuidade/registro.md` com `[cap-NN]`.
- **Quem sabe o quê** vale para o ponto de vista.
- O que estiver em **"manter"** nas notas continua no texto (a fala ou a imagem, ajustada só no necessário à forma de romance).
- **Tamanho**: pelo menos o tamanho de antes e o mínimo de 4.600 palavras.

## Conferir e registrar
1. `python3 ferramentas/checa_tiques.py capitulos/cap-NN.md` (no Windows sem Python: `.\Escrivaninha.exe tiques capitulos\cap-NN.md`); corrija só os trechos apontados.
2. `revisor-estilo` (com `estilo/romance.md`, a escrita de quem escreve, `estilo/estilo.md`, `estilo/guardrails.md` e a saída do script) e `revisor-continuidade` (como no `/escrever`). Corrija o que eles apontarem.
3. Atualize o trecho exato em "Nos capítulos" dos acontecimentos que o capítulo mostra, e `continuidade/resumos.md` se mudou algo.

No fim, diga em até 3 linhas: quantas palavras, e uma cena que ficou mostrada em vez de resumida.
