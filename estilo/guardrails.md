# Guardrails

> Base: o guia "Signs of AI writing" do WikiProject AI Cleanup da Wikipedia, adaptado para ficção, mais os itens do autor.
> Cada item tem: **Faça** (a regra em forma positiva), **Errado** (o padrão proibido) e **Reescrita** (como corrigir).
> Itens marcados com `[script]` são apontados por `ferramentas/checa_tiques.py`. O script só aponta; quem decide a reescrita é o Claude (e o autor, em último caso).
> O autor acrescenta itens com o tempo. Ao acrescentar um item que dá para pegar por padrão de texto, atualize também `ferramentas/tiques.json`.

---

## 1. Contraste falso `[script]`

**Faça:** afirme direto o que é.
**Errado:** "Ele não era o mais bonito, era o mais incrível." / "Não era medo, era pavor." / "Não foi só uma briga; foi o fim." / "Não é sobre o dinheiro, é sobre respeito."
**Reescrita:** "Ele travou na porta e não conseguiu soltar a maçaneta." (mostre o pavor) / "Depois daquela briga, ela não voltou."

## 2. Trincas `[script]`

**Faça:** escolha um adjetivo, uma imagem, uma frase: a melhor.
**Errado:** "Silêncio. Escuridão. Medo." / "Era frio, úmido e escuro." / parágrafo picotado em frases de duas ou três palavras.
**Reescrita:** "A vela apagou e ninguém se mexeu." / "A parede suava." Mantenha a pontuação e o tamanho de frase dos capítulos oficiais.

## 3. Frase de efeito no fim do parágrafo ou da cena `[script, parcial]`

**Faça:** termine o parágrafo e a cena na ação ou na fala.
**Errado:** "...e fechou a porta. Algumas portas, afinal, não se abrem duas vezes." / "E nada seria como antes."
**Reescrita:** "...e fechou a porta. Do outro lado, a tranca correu."

## 4. Linguagem grandiosa `[script]`

**Faça:** mostre a mudança concreta, no gesto ou no objeto.
**Errado:** "Aquele dia marcaria para sempre sua vida." / "Algo mudou dentro dele." / "Sentia o peso do mundo nos ombros." / "Um testemunho de sua coragem."
**Reescrita:** "Nunca mais sentou naquele banco." / "Ele devolveu o anel sem olhar para ela."

## 5. Comparações empilhadas `[script]`

**Faça:** no máximo uma comparação por parágrafo, e só quando ela diz algo que a descrição direta não diz.
**Errado:** "Andava como se carregasse pedras, feito um velho, os olhos como dois poços."
**Reescrita:** "Andava curvado, parando a cada poste."

## 6. Emoção nomeada `[script, parcial]`

**Faça:** mostre a emoção pelo corpo, pela ação ou pela fala, de forma específica daquele personagem (ver a ficha).
**Errado:** "Sentiu uma onda de raiva." / "Uma pontada de tristeza o atingiu."
**Reescrita:** "Dobrou a carta em quatro, depois em oito, até não dobrar mais."

## 7. Clichês físicos `[script]`

**Faça:** use a reação física que só esse personagem teria, ou corte.
**Errado:** soltar o ar que nem sabia que prendia; coração martelando; arrepio na espinha; mandíbula travada; sorriso que não chega aos olhos; olhos que escurecem.
**Reescrita:** "Ela coçou a cicatriz do pulso, como fazia desde menina quando mentiam para ela." (se estiver na ficha)

## 8. Palavras-assinatura de IA `[script]`

**Faça:** use a palavra concreta e comum que o narrador usaria.
**Errado:** tapeçaria, sinfonia, dança de (sombras, luzes), ecoou, sussurrou/murmurou em excesso, "um misto de", "no fundo", vibrante, intrincado, crucial.
**Reescrita:** "As sombras se mexiam na parede." / "disse" na maior parte das falas; sussurro só quando o volume importa para a cena.

## 9. Conectivos de redação `[script]`

**Faça:** ligue as frases pela ordem dos acontecimentos; se precisar de conectivo, use o da fala comum ("mas", "e", "aí", "então").
**Errado:** "Além disso, a estrada estava fechada. No entanto, ele seguiu." / "De fato, vale ressaltar que..."
**Reescrita:** "A estrada estava fechada. Ele seguiu pelo mato."

## 10. Diálogo explicativo

**Faça:** cada personagem fala com a própria voz (ficha), interrompe, foge do assunto, responde torto. Informação que os dois já sabem não é dita; aparece na ação ou no subtexto.
**Errado:** "Como você sabe, irmão, nosso pai morreu há dez anos naquela enchente."
**Reescrita:** "— Você ainda tem medo de chuva? — Cala a boca."

## 11. Personagem terapeutizado `[script]`

**Faça:** o personagem fala com o vocabulário da época, do lugar e da ficha dele. Fala de autoajuda só se estiver na ficha.
**Errado:** "Preciso processar isso." / "Você ultrapassou meus limites." / "Isso é tóxico."
**Reescrita:** "Me deixa quieto um pouco." / "Na minha casa você não entra mais."

## 12. Conflito resolvido rápido demais

**Faça:** conflito custa. A desculpa demora, o acordo tem preço, o vilão age sem explicar o plano.
**Errado:** "— Me desculpa. — Tudo bem, eu entendo." / vilão narrando o plano para o herói.
**Reescrita:** a desculpa fica sem resposta até a cena seguinte; o plano aparece pelas consequências.

## 13. Simetria mecânica `[script, parcial]`

**Faça:** varie o tamanho dos parágrafos e a estrutura das cenas conforme o ritmo pede (respeitando as regras fixas do `estilo.md`).
**Errado:** todos os parágrafos com quatro frases; toda cena abrindo com descrição de clima e fechando com reflexão.
**Reescrita:** uma cena abre na fala; um parágrafo tem uma linha; outro se estende.

## 14. Travessão como aposto `[script]`

**Faça:** travessão só no diálogo (conforme o estilo). No meio da narração, use vírgula, dois-pontos ou ponto.
**Errado:** "Ela abriu a caixa — vazia, como temia — e sentou."
**Reescrita:** "Ela abriu a caixa. Vazia. Sentou." (cuidado com o item 2) / "Ela abriu a caixa, vazia, e sentou."

## 15. Gancho artificial `[script]`

**Faça:** termine o capítulo numa ação ou fala que já carrega a pergunta.
**Errado:** "Mal sabia ele o que o esperava." / "E então tudo mudou."
**Reescrita:** "Na mesa, ao lado da chave, havia uma segunda xícara, ainda quente."

---

## Itens sugeridos a partir do guia da Wikipedia (aguardando aprovação do autor)

> Aprove, ajuste ou corte. Enquanto não aprovados, os revisores tratam como aviso leve.

## 16. Sinônimos rotativos `[pendente]`

**Faça:** repita o nome ou use o pronome. Variação só quando muda o ponto de vista.
**Errado:** "Pedro entrou. O rapaz olhou em volta. O jovem sentou. O garoto pediu café."
**Reescrita:** "Pedro entrou, olhou em volta, sentou e pediu café."

## 17. Gerúndio de comentário `[pendente, script]`

**Faça:** deixe o leitor tirar a conclusão.
**Errado:** "Ela fechou a janela, mostrando que não queria conversa." / "..., simbolizando o fim de uma era."
**Reescrita:** "Ela fechou a janela."

## 18. Linguagem de folheto `[pendente, script]`

**Faça:** descreva o lugar pelo detalhe sensorial da ficha.
**Errado:** "A cidade vibrante, rica em história, com paisagens deslumbrantes."
**Reescrita:** "A cidade cheirava a peixe até o meio-dia."

---

## Itens do autor

## 19. Onomatopeia de quadrinho `[script]`

**Faça:** use onomatopeia só quando o som importa para a cena (impacto, passo, porta, objeto), uma por vez, integrada à frase.
**Errado:** "Toc, toc. Craaash! Bum. Pá." / onomatopeia em toda cena.
**Reescrita:** "Bateram duas vezes, toc, toc, e esperaram." / "A louça caiu inteira no chão da cozinha."

## 20. Repetição mecânica `[script, parcial]`

**Faça:** varie a estrutura das frases, as palavras e o jeito de mostrar cada emoção.
**Errado:** "Ele abriu a porta. Ele olhou o corredor. Ele chamou o irmão." / a mesma reação de medo ("as mãos tremeram") em três entradas seguidas.
**Reescrita:** "Abriu a porta e olhou o corredor antes de chamar o irmão." / cada emoção mostrada de um jeito novo, coerente com a ficha.

## 21. Voz igual para todos

**Faça:** cada personagem pensa e fala do seu jeito (ficha: Voz, Persona, "Como escreve no diário"), e a entrada mantém o estilo dos capítulos oficiais.
**Errado:** a Ynana e outro leitor escrevendo com o mesmo vocabulário, as mesmas piadas e o mesmo ritmo.
**Reescrita:** releia a ficha de quem escreve e a seção Voz de quem fala; ajuste vocabulário, tamanho de frase e o que cada um nota.

## 22. Repetição comparativa `[script]`

**Faça:** diga a ação uma vez, com o detalhe que importa.
**Errado:** "Amarelei às vezes, mas eu sempre amarelo." / "Entrei dentro do percurso, mas sempre entro." / "Vinculei o quadro, ou quando amarrei o sapato forte, ou quando…"
**Reescrita:** "Sempre amarelo quando o mar fica grosso." / "Entrei no percurso pelo mesmo lado de sempre." / conte um momento só, inteiro, em vez de empilhar alternativas com "ou quando".

## Não é tique: o jeito de escrever do autor

- Onomatopeia entre asteriscos no meio da ação (`*Chua*`, `*Zap*`): é método, não conta como excesso.
- Fala entre aspas com travessão dentro (`"— Olha mãe…" Disse…`), inclusive no meio da narração: é o formato de diálogo dos diários.

## 23. Palavra repetida `[script]`

**Faça:** depois de nomear uma coisa, deixe o leitor carregar: pronome, um detalhe, ou nada.
**Errado:** "Chegamos na Bruma de manhã. A Bruma estava fria e a Bruma cobria tudo. Na Bruma ninguém fala alto."
**Reescrita:** "Chegamos na Bruma de manhã. Estava fria e cobria tudo, até o cais; ali ninguém fala alto."

## 24. Parágrafo picado `[script]`

**Faça:** monte o parágrafo como um momento inteiro: o que aconteceu, a fala, a reação, a lembrança e o que se sente, juntos. É assim que os exemplos do autor escrevem (`estilo/escritas/`). Frase sozinha num parágrafo só na virada forte, e rara.
**Errado:** "Eu acordei cedo. / Eu desci a escada. / Eu vi meu pai na mesa. / Ele não olhou para mim." (cada frase um parágrafo)
**Reescrita:** "Acordei cedo e desci ainda com o cabelo cheio de nós, achando que ia escapar da mãe e do pente, mas quem estava na mesa era o pai, lendo as cartas da Trademerx, e ele nem levantou os olhos quando eu entrei."
Limite do script: mais de 2 parágrafos de uma frase seguidos, ou mais de 25% do capítulo (`ferramentas/tiques.json`).

## 25. Molde repetido `[script, parcial]`

**Faça:** varie a forma de um parágrafo para o outro: um abre na ação, outro na fala, outro numa lembrança ou num comentário de quem escreve; frases longas e curtas misturadas.
**Errado:** três parágrafos seguidos abrindo com "Eu…" ou "Então…"; seis frases seguidas do mesmo tamanho; todo parágrafo no mesmo esquema (ação curta + sentimento nomeado + frase de efeito).
**Reescrita:** troque a entrada de um dos parágrafos (comece pelo detalhe, pela fala ou pelo que ela lembrou), junte duas frases curtas numa longa e corte o fechamento que repete o esquema.
O script pega abertura repetida e ritmo monótono; o molde de cena (todo parágrafo com a mesma estrutura) fica com o revisor.

## 26. Advérbio que sobra `[script]`

**Faça:** deixe a palavra forte trabalhar sozinha. Se o verbo ou a fala já dizem o jeito, o advérbio sai.
**Errado:** "Calmamente, claro." / "Sussurrou baixinho." / "Gritou alto." / "Subi para cima." / "Entrei para dentro."
**Reescrita:** "Claro." / "Sussurrou." / "Gritou." / "Subi." / "Entrei."

## 27. Explicar o óbvio e frase de propaganda `[script, parcial]`

**Faça:** diga uma vez e confie no leitor. Se está alto, ele já sabe que está alto. Nada de vender a cena com superlativo nem com "não era X, era o maior Y".
**Errado:** "O som que descia das nuvens estava tão alto que machucava meu ouvido." / "Não era o som da nuvem, era o maior barulho de todos." / "O que significava que ela sabia."
**Reescrita:** "O som que descia das nuvens estava alto." / "O som descia das nuvens." / deixe o leitor concluir que ela sabia pelo que ela faz.
O script pega "tão X que", "que machucava/doía…", "a ponto de", "de tão…", "o maior … de todos" e "não era X, era o maior…"; o resto fica com o revisor.
