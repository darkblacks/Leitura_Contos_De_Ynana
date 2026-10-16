---
description: Cria ou completa uma ficha de personagem ou lugar, me entrevistando
argument-hint: <nome>
---

Ficha para: **$ARGUMENTS**

1. Converta o nome para nome de arquivo (minúsculas, sem acento, hífen no lugar de espaço).
2. Procure em `biblia/personagens/` e `biblia/lugares/`. Se não existir e não estiver claro se é personagem ou lugar, pergunte.
3. Leia o modelo correspondente (`_modelo.md`), a ficha existente (se houver), `biblia/historia.md` e `continuidade/registro.md` (só as partes que mencionam esse nome; use busca).
4. Me entreviste **uma pergunta de cada vez**, só sobre os campos vazios ou `(a definir)`. Perguntas concretas, com opções quando ajudar. Exemplos:
   - Personagem: "Quando a Ynana está com raiva, ela grita, some ou fica gentil demais?" / "Que palavra ela usa que ninguém mais usa?" / "O que ela pensa do porto?"
   - Lugar: "Quanto tempo leva a pé daqui até a vila?" / "Que cheiro a pessoa sente ao entrar?" / "Quem nunca pisa ali, e por quê?"
5. Grave cada resposta na ficha assim que eu responder (para não perder se eu parar no meio). Mantenha as minhas palavras sempre que possível.
6. Relação com outra pessoa vai para `biblia/relacoes.md` (bloco `## [A](personagens/a.md) → [B](personagens/b.md)` com Título, Papel, Período, Frase e indicadores de 1 a 5 só se eu disser), não para a ficha. Opinião sobre lugar ou objeto vai em Observações narrativas, com link. Se a ficha do alvo não existir, crie-a vazia a partir do modelo e me avise.
   Aparência: uma versão `###` por idade ou fase. Nascimento e datas no calendário de Albahara; se eu não souber, fica `(a definir)` ou "por volta de". Casta e bolha vêm de `biblia/sociedade.md`.
   Siga o **formato padrão das fichas** (CLAUDE.md): seções e campos do modelo, na ordem do modelo, `- Campo: valor`, `(a definir)` no que falta, sem texto de instrução.
   Ficha fora do padrão (ou no formato antigo): não reorganize por conta própria; a Escrivaninha padroniza (com cópia de segurança) quando eu clicar em "Padronizar".
7. Lugar: ponha na árvore de `biblia/geografia.md` (dentro de quê fica e o nível: mundo, continente, arquipélago, país, cidade, bairro, local). Na ficha vão só os traços próprios; o resto vem da cadeia acima. Conexões: confira com as fichas dos lugares ligados; se não baterem, pergunte qual vale e atualize os dois lados.
8. Se eu disser "chega" ou "depois", pare e diga quais campos ficaram vazios.
