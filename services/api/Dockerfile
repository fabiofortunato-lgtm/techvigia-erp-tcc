# Build a partir da RAIZ do monorepo - o package-lock.json que garante o
# build reprodutível fica lá, não aqui dentro:
#
#   docker build -f services/api/Dockerfile -t scantech-api .

FROM node:20-alpine AS builder
WORKDIR /app

# O Prisma precisa do OpenSSL para escolher e carregar a query engine certa.
# Sem ele, o generate cai no engine de openssl-1.1.x e o container morre no
# start com "Error loading shared library libssl.so.1.1".
RUN apk add --no-cache openssl

# Manifestos primeiro: enquanto as dependências não mudarem, o Docker
# reaproveita a camada de instalação.
COPY package.json package-lock.json ./
COPY services/api/package.json services/api/
COPY services/api/prisma services/api/prisma

# npm ci, não npm install: instala exatamente as versões registradas no
# package-lock.json. Com npm install, uma dependência que lançasse versão
# nova entre dois builds entrava sozinha na imagem - o build de hoje podia
# não ser o mesmo de ontem, sem nenhuma mudança no código.
# --include=dev nao e redundante: plataformas de deploy (Coolify, Heroku)
# injetam NODE_ENV=production no ambiente de build, e nesse caso o npm
# pula as devDependencies - que e onde vivem as ferramentas de build
# (Nest CLI, Vite, TypeScript). Sem isso o build falha com "not found".
RUN npm ci --workspace=services/api --include-workspace-root --include=dev

COPY services/api services/api
RUN npm run generate --workspace=services/api
RUN npm run build --workspace=services/api

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/api/node_modules ./services/api/node_modules
COPY --from=builder /app/services/api/dist ./dist
COPY --from=builder /app/services/api/prisma ./prisma
COPY --from=builder /app/services/api/assets ./assets
COPY services/api/docker-entrypoint.sh ./docker-entrypoint.sh

EXPOSE 3000

# O entrypoint aplica as migrations pendentes e só então sobe a API.
CMD ["./docker-entrypoint.sh"]
