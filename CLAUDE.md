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
| `biblia/geografia.md` | **Geografia de Morcal**: a árvore de lugares (mundo › continente ou arquipélago › país › cidade › bairro › local). Diz o que fica dentro de quê |
| `biblia/lugares/<nome>.md` | Uma ficha por lugar, de qualquer nível (mundo, continente, arquipélago, país, cidade, bairro, local), com os traços próprios (modelo em `_modelo.md`) |
| `biblia/artefatos/<nome>.md` | Uma ficha por objeto importante: Synzoe, o diário… (modelo em `_modelo.md`) |
| `biblia/*/<nome>.png\|jpg\|webp` | **Foto de referência** da ficha: imagem com o mesmo nome, ao lado do `.md`. É a aparência canônica |
| `biblia/personagens/<nome>--<versao>.webp` | Imagem de uma versão de aparência (idade ou fase), citada no campo `Imagem:` da versão |
| `biblia/calendario.md` | Calendário de Albahara: meses (nome, dias, estação), semana, era, clima por região, festividades. Coluna "Proposta" não é cânone |
| `biblia/acontecimentos/<titulo>.md` | Um acontecimento por arquivo: quando, situação (planejado/confirmado/incerto), personagens, local, descrição, informações e **Nos capítulos** (onde cada parte é revelada) |
| `biblia/relacoes.md` | Relações entre personagens, vistas de um lado (`A → B`): título, papel, período, frase e indicadores de 1 a 5 |
| `biblia/sociedade.md` | Sociedade de Sylvarene: castas e bolhas usadas na seção Sociedade das fichas |
| `biblia/_versoes-antigas/` | Cópias de segurança feitas pela Escrivaninha antes de converter fichas. **Não são fonte**: não leia nem cite, a não ser que o autor peça |
| `estilo/estilo.md` | Como eu escrevo (definido por mim) |
| `estilo/exemplos/` | Exemplos de entradas do diário, colados pelo autor: o modelo de escrita |
| `estilo/guardrails.md` | Padrões proibidos e como reescrever cada um |
| `escaleta/escaleta.md` | Beats de cada capítulo |
| `continuidade/registro.md` | Fatos vigentes, curtos e verificáveis, com capítulo de origem |
| `continuidade/resumos.md` | Resumo curto de cada capítulo |
| `continuidade/notas-do-autor/cap-NN.md` | Notas do autor para reescrever o capítulo (novo contexto, fazer, não fazer, **manter**), escritas pela Escrivaninha |
| `capitulos/cap-NN.md` | Capítulos, com cabeçalho de status |
| `ferramentas/checa_tiques.py` | Varredura mecânica dos guardrails |
| `ferramentas/tiques.json` | Listas e parâmetros usados pelo script |
| `entrada/` | Material antigo a importar |
| `conversas/` | Histórico do chat da Escrivaninha (`atual.jsonl`) e a sessão do Claude Code em uso |
| `referencias/` | Textos e imagens de consulta sobre o universo (nunca apagados) |
| `ui/` | Escrivaninha: interface local para escrever e organizar (`abrir-escrivaninha.bat` ou `.sh`) |
| `dist/Escrivaninha.exe` | A mesma Escrivaninha num executável único para Windows; instala-se em `C:\Os_Contos_De_Ynana` (código em `ui/escrivaninha-go/`, gerar com `ui/escrivaninha-go/build.sh`) |

## Ficha de personagem

Seções, em linguagem natural (nada de atributos de RPG): Identidade (nome completo, nascimento no calendário de Albahara, origem) · Apelidos (cada um com quem usa) · Aparência (uma versão `###` por idade ou fase, com Período, Idade, Tipo — Humano, Meio-Híbrido ou Híbrido Completo —, Espécie, Imagem e a descrição) · Personalidade (pode ter `###` por fase) · Motivação (Objetivo, Medos e conflitos, Observações) · Sociedade (região, casta, bolha principal, outras bolhas, ocupação: família, profissão e riqueza são campos diferentes) · Segredos e conhecimento (Segredos, Sabe, Desconhece, Suspeita) · Voz no diário (Persona, Voz, Como escreve no diário) · Observações narrativas · Estado atual. As relações ficam em `biblia/relacoes.md`, não na ficha. Ficha no formato antigo (com "Nome / apelidos", "Ambição", "Opiniões"…) continua valendo; a Escrivaninha converte quando o autor pede.

## Geografia: cada lugar herda a cadeia

- Morcal (o mundo) tem 4 continentes e 7 arquipélagos principais; dentro deles, países; dentro dos países, cidades; dentro das cidades, bairros (e locais: casas, tavernas). A história se passa em Sylvarene, a ilha principal do arquipélago de Seravel, com cinco cidades: Grimward (norte), Vyrwyll (leste), Kalun (oeste), Faunbridge (centro) e Albahara (sul). Calumbres é um bairro de Albahara.
- **Herança**: uma cena num lugar tem os traços fortes dele e recebe os traços de toda a cadeia acima, lida em `biblia/geografia.md`. Ex.: cena em Calumbres = ficha de Calumbres + Albahara + Sylvarene + Seravel + Morcal. Quanto mais perto, mais forte; se dois níveis discordarem, vale o mais perto. Leia as fichas da cadeia inteira (é curta) antes de escrever a cena.
- Lugar novo entra na árvore, no nível certo, com aprovação do autor (regra 2) se for importante. Marcas `[autor]` são do autor; `[criado]` foram criadas pelo Claude a pedido dele e podem mudar.

## Inteligência narrativa (antes de escrever qualquer cena)

- **Data**: o `quando` do capítulo segue o calendário (`biblia/calendario.md`; se não existir, a seção Calendário de `biblia/historia.md`). Idade = data do capítulo − nascimento da ficha. Data, nascimento ou duração desconhecidos ficam `(a definir)` ou "por volta de": **nunca invente**; se a cena depender disso, pergunte.
- **Aparência**: use a versão da ficha que corresponde à idade ou fase do capítulo (e a imagem dela). Não misture versões.
- **Personalidade, motivação e relação** valem para o período do capítulo (`###` de fase na ficha; `Período` em `relacoes.md`). Traços e indicadores **orientam**, não são regra rígida: gente age fora do padrão quando a cena pede, desde que dê para entender por quê.
- **Quem sabe o quê**: um personagem só sabe o que está em "Sabe" da ficha, o que viu nos capítulos anteriores, ou o que um acontecimento marca como descoberto por ele (`Quem descobre` em "Nos capítulos") num capítulo anterior ou neste.
- **Controle de spoiler**: o leitor só sabe as informações de um acontecimento que aparecem em "Nos capítulos" com "Revelado a: leitor…" em capítulos de número menor. Acontecimento com data depois da data do capítulo ainda não aconteceu. A "Descrição" de um acontecimento é a verdade da história, não o que pode ser contado: não revele informação que ainda não foi revelada, nem dê pista forte dela, a não ser que a escaleta ou o autor peça.
- **Revelação antecipada**: se o autor pedir para revelar algo antes do previsto, confirme em uma frase ("isso revela X ao leitor no cap-NN; confirma?"); depois de confirmado, escreva e registre o vínculo em "Nos capítulos" do acontecimento (`### cap-NN · Menção / revelação`, Revelado a, Quem descobre, Informações, Trecho).
- **Depois de escrever**: para cada acontecimento que o capítulo mostra, lembra ou revela, acrescente o bloco em "Nos capítulos" com o trecho exato (copiado do capítulo, até 400 caracteres). Acontecimento novo importante só com aprovação (regra 2 de convivência); se aprovado, crie o arquivo a partir de `biblia/acontecimentos/_modelo.md` com situação `planejado` ou `incerto`.

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
- **Datas**: `10º dia de Tempestade de 1812`, `Tempestade de 1812`, `por volta de 1796`. Nome de mês que ainda é proposta não vale como cânone.
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

## Escrivaninha (interface)

- `ui/servidor.py` (Python puro, sem rede externa, só em 127.0.0.1) serve uma interface que lê e grava estes mesmos arquivos.
- `Escrivaninha.exe` é a mesma coisa em Go, sem precisar de Python. Na primeira execução copia para a pasta só os arquivos que ainda não existem: nunca sobrescreve texto do autor. `Escrivaninha.exe tiques <arquivo>` dá a mesma saída do `checa_tiques.py`.
- Ao mudar `ui/static/`, `ferramentas/checa_tiques.py` ou `ui/servidor.py`, mantenha `ui/escrivaninha-go/` igual e gere o exe de novo.
- O que o autor muda pela interface é texto dele: vale a regra 1. Capítulo editado lá vem marcado `editado`; depois o autor roda `/sincronizar N`.
- Decisões resolvidas pela interface viram `**Decidido:** pergunta → **resposta**` no arquivo. Trate como regra aprovada.

## Atualizações do app (Escrivaninha.exe)

- O desenvolvimento acontece numa branch de trabalho. **A branch `main` é o canal de atualização**: o app do autor lê `dist/versao.json` da `main` no GitHub e, se a versão for maior que a dele, mostra "Atualizar agora". Ele baixa `dist/Escrivaninha.exe`, confere o `sha256`, troca o próprio executável e reinicia sozinho. Só arquivos do sistema mudam; a história nunca.
- Para publicar: aumente `ui/escrivaninha-go/VERSAO`, rode `ui/escrivaninha-go/publicar.sh "o que mudou" …`, faça commit na branch de trabalho e leve para a `main` (o autor pediu esse fluxo). Nunca publique na `main` um exe que não passou nos testes.

## Conversa pela Escrivaninha

Quando a mensagem chega pelo chat da Escrivaninha (`Escrivaninha.exe` roda `claude -p` nesta pasta):
- O autor é usuário final, não programador. Responda em português, curto e direto, sem falar de arquivos técnicos, terminal ou comandos, a não ser que ele pergunte.
- **A primeira tela da Escrivaninha é este chat**, com o capítulo atual aberto ao lado. O autor dá o contexto em poucas palavras; **você** reúne o resto sozinho e **você mesmo escreve** o capítulo em `capitulos/cap-NN.md` (ele vê o texto surgindo enquanto você grava). Nunca peça ao autor algo que já está nos arquivos.
- Antes de escrever o capítulo N, reúna sem perguntar:
  1. **O que acontece**: os beats do capítulo N em `escaleta/escaleta.md`, mais o que o autor disse no chat (o pedido dele vale mais que a escaleta; se contradizer fato estabelecido, avise em uma frase).
  2. **O contexto do capítulo anterior**: `capitulos/cap-(N-1).md` inteiro (onde parou, tom, última cena) e `continuidade/resumos.md` para os anteriores.
  3. **Quem escreve**: a ficha dele (Persona, Voz, "Como escreve no diário") e a **foto** dele.
  4. **Os nomes**: as fichas de todos os personagens, lugares e artefatos citados nos beats ou no pedido, com as **fotos de referência** (abra as imagens: aparência, roupas e cores vêm delas, não da imaginação). Para personagem, a versão de aparência da idade do capítulo.
  5. **O mundo na data**: a cadeia de cada lugar da cena em `biblia/geografia.md` (e as fichas dessa cadeia), `biblia/calendario.md`, os acontecimentos ligados aos nomes e à data (`biblia/acontecimentos/`), as relações entre quem aparece (`biblia/relacoes.md`) e o que cada um sabe; siga "Inteligência narrativa".
  6. **As referências**: `referencias/` e `estilo/exemplos/` quando o capítulo tocar no que está lá; `continuidade/registro.md` sempre.
- Depois siga o fluxo do `/escrever` (script, revisores, continuidade).
- **Reescrita com notas**: quando o pedido vier da página do capítulo, ele traz o novo contexto, o que fazer, o que não fazer e o que manter (também em `continuidade/notas-do-autor/cap-NN.md`). Mude só o necessário para cumprir as notas; **o que está em "manter" fica exatamente como está**, nesta e nas próximas reescritas desse capítulo. Leia esse arquivo sempre que for mexer no capítulo N. Pedido "só este trecho" mexe só no trecho citado.
- **Tamanho: cada capítulo tem no mínimo 4.600 palavras.** Se ficar curto, aprofunde as cenas dos beats (sem enchimento, sem fato novo) até passar do mínimo.
- Para checar tiques sem Python: `.\Escrivaninha.exe tiques <arquivo>` (mesma saída do `checa_tiques.py`).
- Se faltar decisão do autor (escaleta não aprovada, `[DECIDIR]` que trava o capítulo), pergunte em uma frase e espere.

## Comandos e revisores

- Comandos em `.claude/commands/`: `/importar`, `/ficha`, `/escaleta`, `/escrever`, `/sincronizar`, `/revisar`, `/estado`.
- Subagentes em `.claude/agents/`: `revisor-continuidade` e `revisor-estilo`. Eles só listam problemas, nunca reescrevem. Chame-os passando apenas os caminhos dos arquivos necessários.
