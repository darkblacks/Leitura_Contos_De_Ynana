---
description: Monta os beats dos capítulos N a M para eu aprovar
argument-hint: <N> ou <N-M>
---

Escaleta dos capítulos: **$ARGUMENTS**

1. Leia: `CLAUDE.md`, `biblia/historia.md`, `escaleta/escaleta.md`, `continuidade/registro.md` e `continuidade/resumos.md`. Leia fichas só se precisar confirmar algo específico.
2. Se algum capítulo do intervalo já tiver beats `aprovada`, pergunte se é para refazer antes de mexer.
3. Para cada capítulo, proponha no formato do modelo em `escaleta/escaleta.md`:
   - quando (dia/hora), pov, lugares e presentes (com links para as fichas)
   - cenas
   - o que muda (estado, relação, posse, local)
   - o que o leitor descobre
   - pendências que planta e que paga (cruzar com "Promessas e pendências em aberto" do registro)
4. Respeite: os arcos e o final da `historia.md`, as regras do mundo, os tempos de deslocamento entre lugares e quem sabe o quê.
5. **Fato novo importante** (morte, revelação, relação nova, regra do mundo) que não esteja na bíblia: marque com `[NOVO, precisa de aprovação]` e me pergunte.
6. Grave no arquivo com `status: proposta` e me mostre um resumo curto de cada capítulo.
7. Só mude para `status: aprovada` quando eu aprovar. Ajuste o que eu pedir e mostre de novo.
