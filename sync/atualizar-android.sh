#!/bin/sh
# Copia o leitor do celular (ui/static) para dentro do app Android (assets/leitor).
# Roda sozinho no publicar.sh; rode à mão se mudar ui/static e for gerar o app.
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"
DE="$AQUI/../ui/static"
PARA="$AQUI/EscrivaninhaAndroid/app/src/main/assets/leitor"
rm -rf "$PARA" && mkdir -p "$PARA/fontes"
for f in celular.html celular.js celular.css comum.js livro.js livro.css registro.js slots.js estilo.css temas.css fontes.css; do
  cp "$DE/$f" "$PARA/$f"
done
cp "$DE"/fontes/*.woff2 "$PARA/fontes/"
mkdir -p "$PARA/vendor" && cp "$DE"/vendor/* "$PARA/vendor/"
echo "leitor copiado para o app Android"
