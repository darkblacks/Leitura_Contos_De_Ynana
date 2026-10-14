# Estilo

> Definido pelo autor. Ele decide **aqui no arquivo**: resolve cada `[DECIDIR]` apagando a marca e deixando a resposta.
> O modelo de escrita vem dos exemplos em `estilo/exemplos/`. Onde este arquivo e os exemplos divergirem, valem os exemplos, e o Claude avisa da divergência.
> Regra aprovada fica no formato:
>
> **Regra:** instrução precisa e verificável.
> **Exemplo:** trecho tirado de `estilo/exemplos/` ou aprovado pelo autor.

## Diretrizes do autor (aprovadas)

Vindas da tabela de diretrizes do autor. Valem para toda entrada, de qualquer autor.

| Elemento | Regra |
|---|---|
| Comparações | Evitar construções comparativas repetitivas ou previsíveis, como "Ele não era o mais bonito, era o mais incrível". Preferir descrições naturais, específicas e originais. (guardrails 1 e 5) |
| Pensamentos | Usar a mesma convenção dos capítulos oficiais (ver "Formato de pensamento" abaixo). |
| Pontuação | Respeitar a pontuação e a divisão de parágrafos do estilo original, sem fragmentar o texto com frases curtas em excesso. (guardrail 2) |
| Onomatopeias | Usar quando fizerem sentido para a cena (impactos, passos, portas, objetos), sem exagerar nem transformar a prosa em história em quadrinhos. (guardrail 19) |
| Repetições | Evitar repetir estruturas de frase, palavras e descrições de emoção de forma mecânica. (guardrails 13 e 20) |
| Voz narrativa | Preservar a voz dos personagens e o estilo dos capítulos oficiais, sem fazer todos os personagens pensarem ou falarem da mesma forma. |

**Capítulos oficiais** = os textos do autor já publicados na plataforma. Eles ficam em `estilo/exemplos/` e são a referência de pontuação, parágrafos, pensamento e voz.

## Formato geral: diário

**Regra:** a história é um diário. Cada capítulo é composto de entradas escritas em primeira pessoa por quem está com o diário.
**Regra:** o modelo de escrita das entradas segue os exemplos em `estilo/exemplos/`.
**Regra:** quem escreve só conta o que viu, ouviu ou ficou sabendo até a data da entrada.

- [DECIDIR] Um capítulo = uma entrada, ou um capítulo pode ter várias entradas? (opções: uma por capítulo / várias por capítulo / livre)
  - *Proposta do Claude (pelos exemplos):* várias. A versão antiga junta, num mesmo capítulo, a moldura no presente, um recorte de jornal e várias seções com título ("O Início", "O Naufrágio e O Caos da Tempestade", "A Chegada em Albahara").
- [DECIDIR] Como cada entrada abre? (opções: data / data e local / saudação ao diário / sem cabeçalho / como nos exemplos)
  - *Proposta do Claude (pelos exemplos):* data e local, depois título e autoria, em linhas separadas: "12º dia de Metal de 1813, Escritório da Trademerx, Albahara, Sylvaréne" / "O Início" / "Por Ynana".
- [DECIDIR] Como cada entrada fecha? (opções: assinatura / nada / como nos exemplos)
  - *Proposta do Claude (pelos exemplos):* sem assinatura no fim; a seção termina na última ação ou fala.

## Quem escreve

**Regra:** o diário pode ser escrito pela Ynana ou por outros leitores. Cada entrada tem um único autor, indicado no cabeçalho do capítulo (`quem_escreve`).
**Regra:** a estrutura da entrada é a mesma para todos; o que muda com quem escreve é o tom, conforme Persona, Voz e "Como escreve no diário" da ficha.

- [DECIDIR] Quando outro leitor escreve, ele sabe que a Ynana (ou alguém) escreveu antes? Ele comenta as entradas anteriores? (opções: sim / não / depende do personagem)
- [DECIDIR] Fica marcado na página que mudou quem escreve? (opções: assinatura / nome no cabeçalho / o leitor percebe só pelo tom / como nos exemplos)
  - *Proposta do Claude (pelos exemplos):* nome no cabeçalho, com a linha "Por <nome>" (o jornal usa "Por Erack do Arauto de Albahara").

## Tempo verbal

- [DECIDIR] Passado (conta o que aconteceu no dia) ou presente (escreve enquanto acontece)? Ou misto, como em diário real? (opções: passado / presente / misto / como nos exemplos)
  - *Proposta do Claude (pelos exemplos):* passado, em primeira pessoa ("O mar sempre foi minha casa... Eu tinha 16 anos"). A moldura (Ynana adulta no camarim) também está no passado.

## Formato de diálogo

Em diário, a fala dos outros chega pela memória de quem escreve.

- [DECIDIR] Falas dos outros aparecem como? (opções: travessão / aspas / discurso indireto, "ela disse que..." / como nos exemplos)
  - *Proposta do Claude (pelos exemplos):* travessão, com a fala do narrador separada por travessão: "— Vai ler de novo? — perguntou uma voz baixa...". Citações e jornal entre aspas.

## Formato de pensamento

**Regra:** usar a convenção dos capítulos oficiais (`estilo/exemplos/`).

- [DECIDIR] Qual é a convenção dos capítulos oficiais? (opções: entre travessões / em itálico / integrado à narração). O Claude identifica nos exemplos e propõe aqui; o autor confirma.
  - *Proposta do Claude (pelos exemplos):* integrado à narração, sem marca: "Eu sabia que todos estavam errados." / "O que Malcolm estava realmente fazendo? E por quê?". Não há itálico nem travessão para pensamento.

## Estrutura de parágrafos e pontuação

**Regra:** respeitar a pontuação e a divisão de parágrafos dos capítulos oficiais, sem fragmentar o texto com frases curtas em excesso.

- [DECIDIR] Há número fixo de parágrafos por entrada ou por bloco? Se sim, quantos? (vai também para `paragrafos_por_bloco` em `ferramentas/tiques.json`)
  - *Proposta do Claude (pelos exemplos):* sem número fixo. Parágrafos de narração com 2 a 6 frases; frases de uma linha soltas só em momentos de virada ("Eu sabia que todos estavam errados.", "Derrubei o chá.").

## Onomatopeias

**Regra:** só quando fizerem sentido para a cena (impactos, passos, portas, objetos). Poucas por capítulo; nunca em sequência, como em quadrinhos.
Limite usado pelo script: `max_onomatopeias_por_capitulo` em `ferramentas/tiques.json` (hoje 4).

## Tamanho

- [DECIDIR] Tamanho de uma entrada e de um capítulo (em palavras ou parágrafos).
  - *Proposta do Claude (pelos exemplos):* cada seção da versão antiga tem de 900 a 2.000 palavras. Para o Arco 1 novo (11 capítulos), 2.000 a 3.000 palavras por capítulo dariam 22 a 33 mil palavras no arco.

## Ritmo

(a definir pelos exemplos)

## Vocabulário

Registro (formal, coloquial), regionalismos, palavras preferidas e evitadas. O registro base pode variar por quem escreve (ver fichas).

(a definir pelos exemplos)

## Trechos de referência

Ficam em `estilo/exemplos/`, sem alteração.

## Parâmetros para o script

Quando uma regra acima puder ser checada mecanicamente, o valor vai em `ferramentas/tiques.json`.

- [DECIDIR] O travessão fica só para diálogo, como está no guardrail 14? Se as falas vierem com aspas ou em discurso indireto, o travessão some de vez do texto. (opções: só em diálogo / proibido / livre)
  - *Proposta do Claude (pelos exemplos):* os exemplos usam travessão também no meio da narração ("Trazia nas mãos uma bandeja com chá e algo mais — algo que me paralisou por um instante."). Se isso vale, o guardrail 14 precisa mudar para "travessão de aposto com moderação", e eu desligo `travessao_so_em_dialogo` no script.
