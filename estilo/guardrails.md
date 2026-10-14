# Guardrails

> Base: o guia "Signs of AI writing" do WikiProject AI Cleanup da Wikipedia, adaptado para ficção, mais os itens do autor.
> Cada item tem: **Faça** (a regra em forma positiva), **Errado** (o padrão proibido) e **Reescrita** (como corrigir).
> Itens marcados com `[script]` são apontados por `ferramentas/checa_tiques.py`. O script só aponta; quem decide a reescrita é o Claude (e o autor, em último caso).
> O autor acrescenta itens com o tempo. Ao acrescentar um item que dá para pegar por padrão de texto, atualize também `ferramentas/tiques.json`.

---

## 1. Contraste falso `[script]`

**Faça:** afirme direto o que é.
**Errado:** "Não era medo, era pavor." / "Não foi só uma briga; foi o fim." / "Não é sobre o dinheiro, é sobre respeito."
**Reescrita:** "Ele travou na porta e não conseguiu soltar a maçaneta." (mostre o pavor) / "Depois daquela briga, ela não voltou."

## 2. Trincas `[script]`

**Faça:** escolha um adjetivo, uma imagem, uma frase: a melhor.
**Errado:** "Silêncio. Escuridão. Medo." / "Era frio, úmido e escuro."
**Reescrita:** "A vela apagou e ninguém se mexeu." / "A parede suava."

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

(acrescentar aqui)
