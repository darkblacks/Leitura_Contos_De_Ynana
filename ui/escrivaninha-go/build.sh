#!/bin/sh
# Gera dist/Escrivaninha.exe (Windows) com a interface e uma cópia da história embutidas.
# Uso: ui/escrivaninha-go/build.sh   (rodar de qualquer lugar)
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
rm -rf "$AQUI/embutido" && mkdir -p "$AQUI/embutido/projeto"
cd "$RAIZ"
tar --exclude=.git --exclude=./ui/escrivaninha-go --exclude=./dist --exclude=./sync --exclude='__pycache__' --exclude='*.pyc' \
    -cf - . | tar -xf - -C "$AQUI/embutido/projeto"
# Impressões (sha256) de todas as versões já publicadas dos arquivos da história.
# O app usa para atualizar só os arquivos que o autor nunca mexeu.
python3 - "$AQUI/embutido/anteriores.txt" <<'PY'
import hashlib, subprocess, sys
pastas = ["biblia", "escaleta", "estilo", "continuidade", "referencias/textos", "ferramentas/tiques.json"]
def git(*a):
    return subprocess.run(["git", *a], capture_output=True, check=True).stdout
vistos, linhas = set(), []
try:
    commits = git("rev-list", "HEAD", "--", *pastas).decode().split()
except Exception:
    commits = []
for c in commits:
    for l in git("ls-tree", "-r", c, "--", *pastas).decode("utf-8", "replace").splitlines():
        meta, caminho = l.split("\t", 1)
        blob = meta.split()[2]
        if (blob, caminho) in vistos:
            continue
        vistos.add((blob, caminho))
        linhas.append(hashlib.sha256(git("cat-file", "blob", blob)).hexdigest() + " " + caminho)
open(sys.argv[1], "w", encoding="utf-8").write("\n".join(sorted(linhas)) + "\n")
print(f"versões anteriores da história: {len(linhas)}")
PY
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
