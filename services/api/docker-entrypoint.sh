#!/bin/sh
set -e

# Aplica as migrations pendentes antes de subir a API.
#
# "migrate deploy" só aplica o que já está versionado em prisma/migrations -
# nunca gera migration nova, nunca apaga dado, e é seguro rodar em toda
# subida (o que já foi aplicado ele ignora). Sem isso, um deploy que traz
# uma migration nova sobe a API contra um banco com o schema antigo, e os
# erros aparecem espalhados, em runtime, na cara do usuário.
echo "Aplicando migrations..."
./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma

echo "Iniciando API..."
exec node dist/main
