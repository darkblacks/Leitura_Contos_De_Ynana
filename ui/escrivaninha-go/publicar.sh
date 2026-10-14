#!/bin/sh
# Publica uma versão nova da Escrivaninha para a atualização dentro do app.
#
#   1. Aumente o número em ui/escrivaninha-go/VERSAO (ex.: 1.5.0 -> 1.6.0).
#   2. ui/escrivaninha-go/publicar.sh "o que mudou" "outra mudança"
#   3. Faça commit e leve para a branch main: o app do autor lê
#      dist/versao.json da main e oferece o botão "Atualizar agora".
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
"$AQUI/build.sh"
VERSAO="$(tr -d " \n" < "$AQUI/VERSAO")"
SHA="$(sha256sum "$RAIZ/dist/Escrivaninha.exe" | cut -d' ' -f1)"
python3 - "$RAIZ/dist/versao.json" "$VERSAO" "$SHA" "$@" <<'PY'
import json, sys
destino, versao, sha, *notas = sys.argv[1:]
json.dump({"versao": versao, "sha256": sha, "notas": notas}, open(destino, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(destino, "a").write("\n")
PY
echo "dist/versao.json: v$VERSAO ($SHA)"
