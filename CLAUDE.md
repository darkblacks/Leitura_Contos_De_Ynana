# Ambiente de escrita: Contos de Ynana

Este repositório é um ambiente de escrita de ficção. Eu (o autor) escrevo minhas histórias conversando com você ao longo do dia. Todo o estado da história vive em arquivos, para que eu possa dar `/clear` entre capítulos sem perder nada.

## Formato: os Contos de Ynana são um diário

- A história é um **diário**. Cada capítulo é uma ou mais entradas escritas em primeira pessoa por quem está com o diário: a Ynana ou outros leitores que escrevem nele.
- **O modelo de escrita vem dos exemplos do autor**, colocados em `estilo/exemplos/`. Eles valem mais que qualquer regra genérica.
- **Quem escreve muda o tom**, conforme a Persona e a Voz da ficha dele (seção "Como escreve no diário"). A estrutura da entrada é a mesma para todos; o que muda é o tom.
- Quem escreve só pode contar o que viu, ouviu ou ficou sabendo até a data da entrada. Não existe narrador que sabe tudo.

## Decisões em aberto

- Não faça entrevista no chat para decisões de estilo ou de formato. Registre a dúvida no arquivo certo como `[DECIDIR] pergunta (opções: ...)`, e o autor decide lá.
- Enquanto um `[DECIDIR]` estiver aberto, siga os exemplos em `estilo/exemplos/`. Se não houver exemplo que resolva, não invente regra: avise.
- `/estado` lista os `[DECIDIR]` abertos.

## Regras de custo

- Tudo roda nesta sessão do Claude Code, no meu plano de assinatura.
- Nunca crie scripts que chamem a API da Anthropic ou peçam chave de API.
- Scripts locais só fazem coisas mecânicas (busca por padrões, contagem, listagem), sem rede.
- Leia só o que a tarefa precisa. Fichas: só as dos personagens e lugares envolvidos. Capítulos antigos: use `continuidade/resumos.md` em vez de reler.

## Regras de convivência

1. **Meu texto é cânone.** Capítulo com `status: editado` nunca é reescrito por você. Se algo nele conflitar com o resto, você me avisa e eu decido.
2. **Nada de fato novo importante sem perguntar.** Morte, revelação, relação nova, regra do mundo: só se estiver na escaleta. Fora dela, pergunte antes.
3. **Detalhe menor pode ser criado, mas vira fato fixo.** Nome de rua, cor de objeto, prato servido: pode criar, e registra na ficha ou no `continuidade/registro.md` com o capítulo de origem.
4. **Português, direto e curto** na conversa. Arquivos da história também em português.
5. **Conversa não é gravação.** Quando eu só quiser conversar (ideias, dúvidas, "e se..."), converse normalmente sem mexer em arquivo nenhum, até eu pedir para gravar.
6. **Estilo é meu.** `estilo/estilo.md` só muda com minha aprovação explícita. Eu decido direto no arquivo (resolvendo os `[DECIDIR]`) ou pelos exemplos em `estilo/exemplos/`.
7. Em dúvida entre duas versões de um fato, pergunte. Não escolha sozinho.

## Mapa dos arquivos

| Caminho | Conteúdo |
|---|---|
| `biblia/historia.md` | Premissa, abertura (desfecho inicial), final, arcos, regras do mundo, linha do tempo |
| `biblia/personagens/<nome>.md` | Uma ficha por personagem (modelo em `_modelo.md`) |
| `biblia/lugares/<nome>.md` | Uma ficha por lugar (modelo em `_modelo.md`) |
| `estilo/estilo.md` | Como eu escrevo (definido por mim) |
| `estilo/exemplos/` | Exemplos de entradas do diário, colados pelo autor: o modelo de escrita |
| `estilo/guardrails.md` | Padrões proibidos e como reescrever cada um |
| `escaleta/escaleta.md` | Beats de cada capítulo |
| `continuidade/registro.md` | Fatos vigentes, curtos e verificáveis, com capítulo de origem |
| `continuidade/resumos.md` | Resumo curto de cada capítulo |
| `capitulos/cap-NN.md` | Capítulos, com cabeçalho de status |
| `ferramentas/checa_tiques.py` | Varredura mecânica dos guardrails |
| `ferramentas/tiques.json` | Listas e parâmetros usados pelo script |
| `entrada/` | Material antigo a importar |

## Convenções

- **Nomes de arquivo** de fichas: minúsculas, sem acento, hífen no lugar de espaço (`maria-do-carmo.md`). Arquivos que começam com `_` são modelos e não são fichas.
- **Links entre fichas**: `[Nome](../lugares/nome.md)`.
- **Capítulos**: `capitulos/cap-01.md`, `cap-02.md`... com este cabeçalho:

  ```
  ---
  status: rascunho
  capitulo: 1
  titulo:
  quando: (dia/hora na linha do tempo da história)
  quem_escreve: (Ynana ou outro leitor; link para a ficha)
  ---
  ```

- **Status** possíveis:
  - `rascunho`: escrito por você, ainda não revisado.
  - `revisado`: passou pelo loop de revisão do `/escrever`.
  - `editado`: eu mexi. Intocável para você. Só eu ponho esse status (ou você, quando eu pedir).
- **Fatos no registro**: sempre com origem, ex.: `- [cap-03] Ynana perdeu a faca no rio.` Quando um fato deixa de valer, risque (`~~...~~`) e acrescente o novo com a origem; não apague.
- **Separador de cena** dentro do capítulo: uma linha só com `* * *`.

## Fluxo de trabalho

1. Bíblia e estilo prontos (`/ficha`, exemplos em `estilo/exemplos/`, `[DECIDIR]` resolvidos, `/importar`).
2. `/escaleta N-M`: você propõe beats, eu aprovo.
3. `/escrever N` ou `/escrever N-M`: loop de escrita e revisão por capítulo.
4. Eu edito o capítulo e mudo para `status: editado`; depois rodo `/sincronizar N`.
5. `/revisar N` quando eu quiser só a lista de problemas.
6. `/estado` para saber onde estamos.
7. Entre capítulos eu posso dar `/clear`: tudo que importa está nos arquivos.

## Comandos e revisores

- Comandos em `.claude/commands/`: `/importar`, `/ficha`, `/escaleta`, `/escrever`, `/sincronizar`, `/revisar`, `/estado`.
- Subagentes em `.claude/agents/`: `revisor-continuidade` e `revisor-estilo`. Eles só listam problemas, nunca reescrevem. Chame-os passando apenas os caminhos dos arquivos necessários.
