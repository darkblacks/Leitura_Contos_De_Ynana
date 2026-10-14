---
description: Depois que eu editar um capítulo, atualiza registro, resumos e fichas a partir da minha versão
argument-hint: <N>
---

Sincronizar o capítulo **$ARGUMENTS** com a minha edição.

Minha versão é cânone. Você não altera uma palavra do capítulo.

1. Leia `capitulos/cap-NN.md` inteiro, `continuidade/registro.md`, `continuidade/resumos.md`, o pedido em `continuidade/notas-do-autor/cap-NN.md`, e as fichas de quem aparece no capítulo.
2. Compare o capítulo com o que o registro e o resumo diziam dele (fatos `[cap-NN]`). Liste as diferenças: fatos novos, fatos que mudaram, fatos que sumiram.
3. Atualize a partir da minha versão:
   - `continuidade/registro.md` (risque o que deixou de valer, acrescente o novo com `[cap-NN]`)
   - o resumo do capítulo em `continuidade/resumos.md`
   - "Estado atual" e demais campos afetados nas fichas
   - os blocos de "Nos capítulos" dos acontecimentos (`biblia/acontecimentos/`) que citam este capítulo: se o trecho vinculado mudou ou sumiu na minha edição, me avise (não troque o trecho sozinho)
   - se o cabeçalho ainda não estiver `status: editado`, mude para `editado`
4. Verifique se a minha edição criou contradição com:
   - capítulos seguintes já escritos (use os resumos e o registro; abra o capítulo só se precisar citar o trecho)
   - acontecimentos e datas (`biblia/acontecimentos/`, `biblia/ciclos.md`)
   - pendências em aberto (alguma ficou órfã, alguma foi paga antes da hora?)
5. Me avise em poucas linhas: o que mudou no registro e cada contradição encontrada, com o trecho e onde ela bate. **Não corrija** capítulos por conta própria; me pergunte.
