# Ambiente de escrita: Contos de Ynana

Este repositório é um ambiente de escrita de ficção. Eu (o autor) escrevo minhas histórias conversando com você ao longo do dia. Todo o estado da história vive em arquivos, para que eu possa dar `/clear` entre capítulos sem perder nada.

## Formato: os Contos de Ynana são uma leitura de diários

- A história é um **diário**. Cada capítulo é uma entrada escrita em primeira pessoa por quem está com o diário: a Ynana ou outros leitores que escrevem nele.
- **Cabeçalho fixo de todo capítulo** (igual para todos, não muda por escritor), montado com os dados do cabeçalho do arquivo:
  ```
  NOME DO CAPÍTULO - NOME DE QUEM ESTÁ ESCREVENDO
  subtítulo pequeno - Local onde se passa - Data
  ```
  A Escrivaninha mostra esse cabeçalho no topo. O texto do capítulo não o repete.
- **Como cada um escreve** fica em `estilo/escritas/<nome>.md`: persona, exemplos de persona, e quatro jeitos de escrever com "Como" e "Exemplos" (escrita comum, diálogo, ação, diálogo com ação), mais o que é "Importante". Um escritor pode **herdar** de outro (`Herda de:`): o que estiver vazio vem de lá. A da Ynana é a escrita base. Os exemplos valem mais que qualquer regra genérica.
- Quem escreve só pode contar o que viu, ouviu ou ficou sabendo até a data da entrada. Não existe narrador que sabe tudo.

## Sem roteiro pronto

- Não há escaleta. **O autor diz, na hora do pedido, o nome do capítulo, quem escreve, onde, quando, quais acontecimentos entram e o que acontece.** O pedido fica salvo em `continuidade/notas-do-autor/cap-NN.md` (seção "Pedido").
- Os acontecimentos vêm de `biblia/acontecimentos/`, organizados em ciclos (`biblia/ciclos.md`). **A data do capítulo tem que bater com a dos acontecimentos escolhidos**; se não bater, avise em uma frase antes de escrever.
- `escaleta/` e `biblia/historia.md` são material antigo de consulta; não são roteiro.

## Dúvidas

- Quando faltar uma decisão do autor que trava a escrita, pergunte no chat em uma frase, com opções. Não crie `[DECIDIR]` novos. Os `[DECIDIR]` e `**Decidido:**` que já existem nos arquivos continuam valendo como estão.
- Detalhe pequeno que não trava: siga os exemplos da escrita de quem escreve.

## Regras de custo

- Tudo roda nesta sessão do Claude Code, no meu plano de assinatura.
- Nunca crie scripts que chamem a API da Anthropic ou peçam chave de API.
- Scripts locais só fazem coisas mecânicas (busca por padrões, contagem, listagem), sem rede.
- Leia só o que a tarefa precisa. Fichas: só as dos personagens e lugares envolvidos. Capítulos antigos: use `continuidade/resumos.md` em vez de reler.

## Regras de convivência

1. **Meu texto é cânone.** Capítulo com `status: editado` nunca é reescrito por você, a não ser que eu peça (botões "Ajustar" e "Do zero"). Se algo nele conflitar com o resto, você me avisa e eu decido.
2. **Nada de fato novo importante sem perguntar.** Morte, revelação, relação nova, regra do mundo: só se estiver no meu pedido ou nos acontecimentos. Fora disso, pergunte antes.
3. **Detalhe menor pode ser criado, mas vira fato fixo.** Nome de rua, cor de objeto, prato servido: pode criar, e registra na ficha ou no `continuidade/registro.md` com o capítulo de origem.
4. **Português, direto e curto** na conversa. Arquivos da história também em português.
5. **Conversa não é gravação.** Quando eu só quiser conversar (ideias, dúvidas, "e se..."), converse normalmente sem mexer em arquivo nenhum, até eu pedir para gravar.
6. **Estilo é meu.** `estilo/escritas/` e `estilo/estilo.md` só mudam com minha aprovação explícita.
7. Em dúvida entre duas versões de um fato, pergunte. Não escolha sozinho.

## Mapa dos arquivos

| Caminho | Conteúdo |
|---|---|
| `capitulos/cap-NN.md` | Capítulos, com o cabeçalho (status, título, subtítulo, onde, quando, quem escreve) |
| `continuidade/notas-do-autor/cap-NN.md` | O **pedido** do capítulo e as notas de ajuste (contexto, fazer, não fazer, **manter**) |
| `continuidade/descartados/` | Textos tirados da folha com "Reescrever do zero". Não são fonte: não leia nem aproveite |
| `continuidade/registro.md`, `resumos.md` | Sua memória interna: fatos vigentes com capítulo de origem e o resumo de cada capítulo. O autor não vê; mantenha em dia |
| `estilo/escritas/<nome>.md` | A escrita de cada escritor (persona, jeitos de escrever com exemplos, importante, herança) |
| `estilo/estilo.md`, `estilo/guardrails.md` | Regras gerais para todos e padrões proibidos |
| `estilo/romance.md` | **Técnica de romance**: o jeito do autor (mesma voz do diário, falas no meio do parágrafo, fala sozinha só para ênfase) com a qualidade de livro de fantasia (confiar no leitor, detalhe certo, cena mostrada, fecho seco). Usada pelo botão **📖 Romantizar** em Capítulos (ou `/romantizar N`), que reescreve o próprio capítulo (o texto de antes fica em `continuidade/descartados/`), e também no `/escrever`; nunca copiar obra nenhuma |
| `biblia/personagens/<nome>.md` | Uma ficha por personagem (modelo em `_modelo.md`) |
| `biblia/familias/<nome>.md` | Uma ficha por família: casta, empresa, descrição e **Membros** (cada um com pai, mãe e cônjuge: daí sai a árvore genealógica) |
| `biblia/empresas/<nome>.md` | Uma ficha por empresa: ramo, sede, família, casta, descrição e **Pessoas** (com o papel de cada uma); a logo é a imagem com o mesmo nome |
| `biblia/parlamento.md` | **Parlamento de Sylvarene**: as cadeiras: **federais** (Senhor Supremo, General de Sylvarene, as 6 da Távola Redonda — sempre 6 — e outros que o autor criar) e **municipais** (em cada cidade, Barão, Ministro da Milícia e outros que o autor criar), uma versão por ano (`## 1812`); cada versão vale até a próxima |
| `biblia/relacoes.md` | Relações entre personagens (`A → B`: o que B é para A — pai, filha, namorado, amigo, rival…; período; frase; indicadores de 1 a 5) |
| `biblia/geografia.md` | **Geografia de Morcal**: a árvore de lugares (mundo › continente ou arquipélago › país › cidade › bairro › local) |
| `biblia/lugares/<nome>.md` | Uma ficha por lugar, de qualquer nível, com os traços próprios |
| `biblia/artefatos/<nome>.md` | Uma ficha por objeto importante |
| `biblia/*/<nome>.png\|jpg\|webp` | **Foto de referência** da ficha (a principal). `<nome>--<qualquer>.webp` são imagens extras da mesma ficha (outras vistas do lugar, versões de aparência) |
| `biblia/acontecimentos/<titulo>.md` | Um acontecimento por arquivo: quando, ciclo, situação, personagens, local, descrição, informações e **Nos capítulos** |
| `biblia/ciclos.md` | Os ciclos (fases) da história, com período e resumo |
| `biblia/calendario.md` | Calendário de Albahara: o calendário humano com outros nomes de mês, e os **feriados e festivais** (repetem todo ano) |
| `biblia/sociedade.md` | Sociedade de Sylvarene: castas e bolhas |
| `ferramentas/checa_tiques.py`, `tiques.json` | Varredura mecânica dos guardrails |
| `conversas/` | Histórico do chat da Escrivaninha e a sessão em uso |
| `referencias/`, `estilo/exemplos/`, `escaleta/`, `biblia/historia.md`, `entrada/` | Material antigo de consulta (nunca apagado) |
| `ui/` | Escrivaninha: interface local (`abrir-escrivaninha.bat` ou `.sh`) |
| `dist/Escrivaninha.exe` | A Escrivaninha num executável para Windows; instala-se em `C:\Os_Contos_De_Ynana` (código em `ui/escrivaninha-go/`) |
| `sync/EscrivaninhaAndroid/` | **App do celular** (projeto Android Studio): **Ler minhas histórias** (o leitor `ui/static/celular.html`, copiado para `assets/leitor` por `sync/atualizar-android.sh`: baixa um slot, lê, edita à mão, salva no slot, exporta) ou abre a Escrivaninha do computador pelo Wi-Fi, com código (Opções › Celular). O GitHub monta o APK (`.github/workflows/android.yml`, Releases › "App do celular"). Não vai para dentro do exe |
| `copias/`, `exportados/` | Cópias de segurança feitas ao carregar um slot (as 10 últimas) e os livros exportados em PDF e Word. Ficam só no computador do autor |

## Ficha de personagem

Seções, em linguagem natural (nada de atributos de RPG): Identidade · Apelidos (cada um com quem usa) · Aparência (uma versão `###` por idade ou fase, com Período, Idade, Tipo, Espécie, Imagem e a descrição) · Personalidade · Motivação · Sociedade · Segredos e conhecimento · Voz no diário · Observações narrativas · Estado atual. Família, amores, amizades e inimizades ficam em `biblia/relacoes.md`, não na ficha.

## Formato padrão das fichas

Toda ficha de personagem, lugar e artefato segue o mesmo formato, para ler e editar sem confusão:
- `# Nome` no topo; depois, se houver, uma linha `>` curta (ex.: onde o lugar fica).
- **Só o que está no modelo.** Não existe ficha antiga nem versão antiga: seção que não existe no modelo não entra na ficha.
- As seções `##` do `_modelo.md` da pasta, **na ordem do modelo** e com o mesmo nome.
- Dados em campos `- Campo: valor`, com os nomes de campo do modelo. Lista de vários itens: subitens recuados com dois espaços.
- O que não se sabe: `(a definir)`. Seção sem nada: só `(a definir)`.
- Sem texto de instrução nem exemplo do modelo dentro da ficha (as instruções ficam no `_modelo.md`).
- Ao escrever numa ficha, mantenha esse formato: preencha o campo que já existe em vez de criar outro parecido.
- A Escrivaninha tem o botão **Padronizar** (Personagens, Lugares, Artefatos): deixa só as seções e campos do modelo, com o que o autor escreveu nos campos; o resto sai, sem cópia.
- **✨ Preencher com o Claude** (ficha de personagem, ou `/preencher`): o autor diz em poucas palavras o que imagina e o Claude preenche, olhando a imagem e o contexto. Aqui pode inventar (marca `[criado]`), seguindo `.claude/commands/preencher.md`: não mexe em Voz no diário, família, empresa e cargo; na Sociedade só completa o vazio.

## O que é local e o que precisa de internet

- **Local (funciona sem internet):** o programa, todas as telas, capítulos, fichas, famílias, castas, empresas, parlamento, acontecimentos, calendário, estilo, a checagem de tiques e as fontes.
- **Precisa de internet:** a conversa com o Claude (escrever, ajustar, revisar, canonizar, descrever imagens), a procura de atualização e as vozes naturais do "Ouvir" (sem internet, ele usa a voz do computador).
- **Celular**: o app Android é uma janela para a Escrivaninha do computador, pelo Wi-Fi de casa; precisa do computador ligado com a Escrivaninha aberta e o acesso ligado em Opções › Celular (código de 6 números). Desligado por padrão; só o computador liga, desliga e troca o código.
- **Slots online** (Opções › Slots online, e no celular): 4 slots no Back4App do autor (ID do app e REST API Key coladas no aparelho, nunca no chat). Salvar guarda a história inteira (capítulos, bíblia, continuidade, estilo); carregar troca a do aparelho e guarda a de antes em `copias/`. Precisa de internet.
- **Exportar** (Capítulos › ⇩ Exportar, ou no capítulo): livro com capa e um capítulo por página, com o cabeçalho do diário, em **PDF** (A5, igual ao app, gerado pelo Edge sem janela) ou **Word** (.docx). Sai em `exportados/`. Funciona sem internet.
- Uma parte online que falha não derruba o resto: o chat mostra o erro e guarda a mensagem; a atualização só não aparece; o programa continua aberto.

## Dinâmicas de personagem

- Família (`biblia/familias/`), casta (ficha › Sociedade; se faltar, a da família), empresa (`biblia/empresas/`) e profissão (ficha › Sociedade › Ocupação) definem as dinâmicas: quem deve a quem, quem compete com quem, quem trata quem como igual. Use ao escrever cenas com mais de uma pessoa. Nem todo personagem tem tudo preenchido: o que faltar, não invente.
- **Cargos públicos**: quem ocupa uma cadeira na data do capítulo é quem está na versão de `biblia/parlamento.md` com o ano mais alto que não passa do ano do capítulo. Cadeira `(vago)` está vaga; não invente ocupante.
- Parentesco da árvore (pai, mãe, cônjuge) é fato; o sentimento entre as pessoas fica em `biblia/relacoes.md`.

## Imagens: descrever pelo que se vê

- Lugares, personagens (por versão de aparência) e artefatos podem ter várias imagens. Quando o autor pedir "descrever pela imagem" (ou `/descrever`), abra as imagens e escreva só o que dá para ver, marcando com `[img]`. Não apague nem mude o que o autor escreveu (`[autor]`); acrescente.
- **Ao escrever, ajustar ou revisar capítulo, não abra imagens**: use só as descrições das fichas (gasta muito menos). Aparência, roupas, cores e arquitetura vêm dessas descrições, não da imaginação. Se a descrição de alguém que aparece estiver vazia, avise o autor que dá para usar "Descrever pela imagem".

## Canonizar: o capítulo vira acontecimento

- Quando o autor gosta de um capítulo ("♥ Gostei" ou `/canonizar N`), o que aconteceu nele vai para `biblia/acontecimentos/`, resumido e confirmado, com: data, ciclo, personagens, local, **Origem** (`cap-NN`), **Função na história** (apresentar personagens, dar abertura, virada, plantar ou pagar pista, aprofundar relação… ou **dar volume (filler)** quando não muda nada) e **Onde estava cada um** (onde estava e o que fazia cada personagem presente).
- Cada acontecimento da história principal (num ciclo) tem **três partes filhas**: **Onde estava cada um** (por personagem), **Mudanças nos lugares** e **Mudanças nos objetos** (estado, com quem está, onde está). Uma mudança vale da data do acontecimento até outra mudança da mesma coisa.
- **Estado vigente**: antes de escrever uma cena, para cada lugar e objeto que aparece, procure a última mudança registrada antes da data do capítulo (`grep` pelo nome em `biblia/acontecimentos/`). Ex.: se o Synzoe ficou verde no cap-03 e voltou ao normal no cap-06, no cap-05 ele está verde; se o sofá velho foi jogado fora, ele não está mais na Mansão.
- **Antes de escrever um capítulo, leia os acontecimentos canonizados** do ciclo e dos personagens envolvidos, em vez de reler capítulos antigos: é ali que estão onde cada um estava e o que já aconteceu. Isso evita furos (alguém em dois lugares, algo esquecido).

## Geografia: cada lugar herda a cadeia

- Morcal (o mundo) tem 4 continentes e 7 arquipélagos principais; dentro deles, países; dentro dos países, cidades; dentro das cidades, bairros (e locais: casas, tavernas). A história se passa em Sylvarene, a ilha principal do arquipélago de Seravel, com cinco cidades: Grimward (norte), Vyrwyll (leste), Kalun (oeste), Faunbridge (centro) e Albahara (sul). Calumbres é um bairro de Albahara.
- **Herança**: uma cena num lugar tem os traços fortes dele e recebe os traços de toda a cadeia acima (`biblia/geografia.md`). Quanto mais perto, mais forte; se dois níveis discordarem, vale o mais perto.
- Marcas `[autor]` são do autor; `[criado]` foram criadas pelo Claude a pedido dele e podem mudar.

## Inteligência narrativa (antes de escrever qualquer cena)

- **Data**: o `quando` segue `biblia/calendario.md` (meses com outros nomes, mesmos dias do calendário humano). Idade = data do capítulo − nascimento da ficha. Desconhecido fica `(a definir)` ou "por volta de": **nunca invente**.
- **Feriados e festivais**: se a data do capítulo cair num deles (seção "Feriados e festivais" do calendário), a cena sente isso (ruas, comida, sinos, folga, multidão), mesmo que o autor não tenha lembrado. Não invente feriado novo.
- **Aparência**: use a versão da ficha da idade ou fase do capítulo (e a imagem dela).
- **Personalidade, motivação e relação** valem para o período do capítulo. Traços e indicadores **orientam**, não são regra rígida.
- **Quem sabe o quê**: um personagem só sabe o que está em "Sabe" da ficha, o que viu nos capítulos anteriores, ou o que um acontecimento marca como descoberto por ele ("Quem descobre" em "Nos capítulos").
- **Controle de spoiler**: o leitor só sabe as informações de um acontecimento reveladas em capítulos de número menor. Acontecimento com data depois da do capítulo ainda não aconteceu. A "Descrição" de um acontecimento é a verdade da história, não o que pode ser contado.
- **Revelação antecipada**: se o autor pedir, confirme em uma frase; depois registre o vínculo em "Nos capítulos".
- **Depois de escrever**: para cada acontecimento que o capítulo mostra, lembra ou revela, acrescente o bloco em "Nos capítulos" com o trecho exato (até 400 caracteres).

## Convenções

- **Nomes de arquivo** de fichas: minúsculas, sem acento, hífen no lugar de espaço. Arquivos que começam com `_` são modelos.
- **Links entre fichas**: `[Nome](../lugares/nome.md)`.
- **Cabeçalho do capítulo** (`capitulos/cap-NN.md`):
  ```
  ---
  status: rascunho
  capitulo: 1
  titulo:
  subtitulo:
  onde: (link para a ficha do lugar)
  quando: (12º dia de Tempestade de 1812)
  quem_escreve: (link para a ficha)
  ---
  ```
- **Status**: `rascunho` (escrito por você), `revisado` (passou pela revisão), `editado` (o autor mexeu; intocável sem pedido dele).
- **Datas**: `10º dia de Tempestade de 1812`, `Tempestade de 1812`, `por volta de 1796`. Nome de mês que ainda é proposta não vale como cânone.
- **Fatos no registro**: sempre com origem (`- [cap-03] …`). Fato que deixa de valer: risque e acrescente o novo.
- **Separador de cena**: uma linha só com `* * *`.

## Escrivaninha (interface)

- `ui/servidor.py` (Python puro, só em 127.0.0.1) serve uma interface que lê e grava estes mesmos arquivos. `Escrivaninha.exe` é a mesma coisa em Go. `Escrivaninha.exe tiques <arquivo>` dá a mesma saída do `checa_tiques.py`.
- Ao mudar `ui/static/`, `ferramentas/checa_tiques.py` ou `ui/servidor.py`, mantenha `ui/escrivaninha-go/` igual e gere o exe de novo.
- O que o autor muda pela interface é texto dele: vale a regra 1.
- Telas: Escrever com o Claude (chat + folha), Capítulos, Personagens (fichas, relações, famílias, castas, empresas, parlamento), Lugares, Artefatos, Acontecimentos (por ciclo), Calendário (meses e eventos), Estilo (escritores), Comandos, Opções (cores, leitura, slots online, celular).

## Atualizações do app (Escrivaninha.exe)

- O desenvolvimento acontece numa branch de trabalho. **A branch `main` é o canal de atualização**: o app do autor lê `dist/versao.json` da `main` no GitHub e, se a versão for maior, mostra "Atualizar agora". Ele baixa o exe, confere o `sha256`, troca o próprio executável e reinicia. Arquivos do sistema são atualizados; arquivos da história só quando estão exatamente como uma versão que já veio no app (o autor nunca mexeu).
- Para publicar: aumente `ui/escrivaninha-go/VERSAO`, rode `ui/escrivaninha-go/publicar.sh "o que mudou" …`, faça commit na branch de trabalho e leve para a `main`. Nunca publique na `main` um exe que não passou nos testes.

## Conversa pela Escrivaninha

Quando a mensagem chega pelo chat da Escrivaninha (`Escrivaninha.exe` roda `claude -p` nesta pasta):
- O autor é usuário final, não programador. Responda em português, curto e direto, sem falar de arquivos técnicos, terminal ou comandos, a não ser que ele pergunte.
- **A primeira tela é este chat**, com o capítulo atual aberto ao lado. **Você mesmo escreve** o capítulo em `capitulos/cap-NN.md` (ele vê o texto surgindo). Nunca peça ao autor algo que já está nos arquivos.
- Antes de escrever o capítulo N, reúna sem perguntar:
  1. **O pedido**: o que o autor disse no chat e a seção "Pedido" de `continuidade/notas-do-autor/cap-NN.md` (título, subtítulo, quem escreve, onde, quando, acontecimentos, o que acontece, tom).
  2. **O capítulo anterior** inteiro; para os de antes, os **acontecimentos canonizados** (onde estava cada um, função) e `continuidade/resumos.md`.
  3. **Quem escreve**: a escrita dele em `estilo/escritas/` (com a herança) e a ficha (só o texto; não abra imagens).
  4. **Os nomes**: as fichas de quem aparece, dos lugares e artefatos (só as descrições).
  5. **O mundo na data**: a cadeia do lugar em `biblia/geografia.md`, o calendário (feriados na data), os acontecimentos escolhidos e o ciclo deles, as relações entre quem aparece; siga "Inteligência narrativa".
  6. `continuidade/registro.md` sempre.
- Depois siga o fluxo do `/escrever` (script, revisores, registro), sem narrar a parte interna para o autor.
- **Ajustar**: o pedido traz o novo contexto, o que fazer, o que não fazer e o que manter (também nas notas do capítulo). Mude só o necessário; **o que está em "manter" fica exatamente como está**, nesta e nas próximas vezes. "Só este trecho" mexe só no trecho citado.
- **Do zero**: o texto antigo foi guardado em `continuidade/descartados/`; não leia nem aproveite nada dele. Escreva tudo de novo a partir do pedido.
- **Tamanho: cada capítulo tem no mínimo 4.600 palavras** (ou o que o pedido disser, se for mais).
- Para checar tiques sem Python: `.\Escrivaninha.exe tiques <arquivo>`.

## Comandos e revisores

- Comandos em `.claude/commands/` (também usáveis no chat da Escrivaninha, digitando `/`): `/escrever`, `/revisar`, `/sincronizar`, `/canonizar`, `/ficha`, `/descrever`, `/preencher`, `/romantizar`, `/estado`.
- **Tiques**: o script agrupa os achados por classe (Comparação e contraste, Ritmo e repetição, Vocabulário artificial, Exagero e efeito, Emoção e corpo, Formato). O jeito de escrever do autor não é tique: onomatopeia entre asteriscos (`*Chua*`) e fala entre aspas com travessão (`"— …" Disse…`). Repetição comparativa ("amarelei às vezes, mas eu sempre amarelo"; "… ou quando …") é tique (guardrail 22), e palavra repetida demais em poucos parágrafos também. **Parágrafo é um momento inteiro** (guardrails 24 e 25): o que aconteceu, a fala, a reação, a lembrança e o que se sente juntos, como nos exemplos da escrita; o script aponta parágrafos picados (mais de 2 de uma frase seguidos, ou mais de 25% do capítulo), parágrafos seguidos com a mesma abertura e ritmo monótono. **Confiar no leitor** (guardrails 26 e 27): sem advérbio que sobra ("Claro.", não "Calmamente, claro."), sem frase de propaganda ("o maior … de todos", "não era X, era o maior…") e sem completar o óbvio ("estava alto", não "tão alto que machucava meu ouvido"). O script aponta a **frase** onde o tique está. Tiques que o autor marcou como **manter** ficam na seção "Tiques mantidos" das notas do capítulo: não corrija esses, nem aponte de novo na revisão.
- Subagentes em `.claude/agents/`: `revisor-continuidade` e `revisor-estilo`. Eles só listam problemas, nunca reescrevem.
