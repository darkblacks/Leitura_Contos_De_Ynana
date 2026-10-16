---
description: Preenche uma ficha de personagem a partir de poucas palavras do autor, da imagem e do contexto (família, casta, empresa, cargo)
argument-hint: <caminho da ficha> e a ideia do autor
---

O autor quer ajuda para **criar** um personagem: ele diz em poucas palavras o que imagina, e você preenche a ficha. Aqui você **pode inventar** (é ficção), desde que combine com o que já existe.

Pedido: $ARGUMENTS

## Leia antes (só o necessário)
1. A ficha do personagem (o caminho está no pedido) e `biblia/personagens/_modelo.md`.
2. As imagens do personagem citadas no pedido: olhe para a aparência (rosto, cabelo, roupa, postura, espécie, idade aparente).
3. O contexto: a família dele em `biblia/familias/`, a empresa em `biblia/empresas/` (com o papel), o cargo em `biblia/parlamento.md`, as castas e bolhas em `biblia/sociedade.md`, o que outros dizem dele em `biblia/relacoes.md`, e os acontecimentos que o citam (busque o nome em `biblia/acontecimentos/`).
4. A seção **Sociedade** da ficha: o que estiver preenchido lá é base para tudo (casta, bolha, ocupação dizem como ele vive e fala).

## O que você preenche
- **Personalidade, Motivação e Apelidos**: pode escrever e reescrever, a partir da ideia do autor e do contexto.
- **Relações**: crie ou ajuste em `biblia/relacoes.md` (bloco `## [Ele](personagens/x.md) → [Outro](personagens/y.md)` com Título, Papel, Período, Frase e indicadores de 1 a 5), só com personagens que têm ficha e que fazem sentido pelo contexto (família, empresa, cargo, casta).
- **Sociedade**: complete só os campos vazios. Se a casta estiver vazia, escolha uma de `biblia/sociedade.md` (Alta Elite, Média Elite, Povão…) que combine com a família, a empresa, o cargo e a imagem, e uma bolha dessa casta.
- **Aparência**: na versão que já existe, complete os campos vazios (Idade aparente, Tipo, Espécie) e escreva os traços em linguagem natural pelo que dá para ver na imagem, um por linha.
- **Identidade, Segredos e conhecimento, Observações narrativas, Estado atual**: complete os campos vazios. Datas no calendário de Albahara; se for estimativa, "por volta de".

## O que você não mexe
- **Voz no diário** (Persona, Voz, Como escreve no diário): não toque.
- **Família, empresa e cargo**: não mude `biblia/familias/`, `biblia/empresas/` nem `biblia/parlamento.md`, nem diga na ficha algo que os contradiga.
- **Sociedade**: o que já está preenchido fica como está.
- O que o autor escreveu nos campos (marcas `[autor]` ou texto sem marca que não seja `(a definir)`): não apague nem contradiga; acrescente ao lado se precisar.

## Como escrever
- Siga o **formato padrão das fichas** (CLAUDE.md): só as seções e campos do modelo, `- Campo: valor`, linguagem natural, sem texto de instrução.
- Marque tudo que você inventou com `[criado]`; o que veio da imagem, com `[img]`.
- Frases curtas e concretas, que ajudem a escrever cenas (manias, contradições, o que quer e o que teme), nada de lista genérica de adjetivos.
- Nada de morte, revelação grande ou regra do mundo nova: isso continua sendo decisão do autor.

No fim, diga em até 4 linhas o que criou (casta, jeito, o que quer, uma relação), em português simples.
