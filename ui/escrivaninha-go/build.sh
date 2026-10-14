#!/bin/sh
# Gera dist/Escrivaninha.exe (Windows) com a interface e uma cópia da história embutidas.
# Uso: ui/escrivaninha-go/build.sh   (rodar de qualquer lugar)
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
rm -rf "$AQUI/embutido" && mkdir -p "$AQUI/embutido/projeto"
cd "$RAIZ"
tar --exclude=.git --exclude=./ui/escrivaninha-go --exclude=./dist --exclude='__pycache__' --exclude='*.pyc' \
    -cf - . | tar -xf - -C "$AQUI/embutido/projeto"
cd "$AQUI"
if gofmt -l . | grep -v embutido; then echo "rode gofmt -w nos arquivos acima"; exit 1; fi
go vet ./...
mkdir -p "$RAIZ/dist"
VERSAO="$(tr -d " \n" < "$AQUI/VERSAO")"
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -H=windowsgui -X main.versao=$VERSAO" -o "$RAIZ/dist/Escrivaninha.exe" .
echo "pronto: v$VERSAO $RAIZ/dist/Escrivaninha.exe ($(du -h "$RAIZ/dist/Escrivaninha.exe" | cut -f1))"
if [ -n "$LINUX_TESTE" ]; then
  go build -ldflags "-X main.versao=$VERSAO ${LDFLAGS_TESTE:-}" -o "$LINUX_TESTE" . && echo "teste linux: $LINUX_TESTE"
fi
