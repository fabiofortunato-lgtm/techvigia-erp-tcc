# Build a partir da RAIZ do monorepo (o painel depende do package-lock.json
# e da configuração de workspaces do root):
#
#   docker build -f apps/web/Dockerfile -t scantech-web .
#
# Em execução, aponte para a API:
#
#   docker run -p 8080:80 -e API_URL=http://api:3000 scantech-web

FROM node:20-alpine AS builder
WORKDIR /app

# Copia só os manifestos primeiro: enquanto as dependências não mudarem,
# o Docker reaproveita a camada de instalação em cada build.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
# --include=dev nao e redundante: plataformas de deploy (Coolify, Heroku)
# injetam NODE_ENV=production no ambiente de build, e nesse caso o npm
# pula as devDependencies - que e onde vivem as ferramentas de build
# (Nest CLI, Vite, TypeScript). Sem isso o build falha com "not found".
RUN npm ci --workspace=apps/web --include-workspace-root --include=dev

COPY apps/web apps/web
RUN npm run build --workspace=apps/web

FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template

# A imagem oficial do nginx já processa /etc/nginx/templates/*.template com
# envsubst no start, substituindo ${API_URL}. Sem um valor padrão o nginx
# sobe com um proxy_pass vazio e falha - então o default aponta para o nome
# de serviço usado no compose.
ENV API_URL=http://api:3000
ENV DNS_RESOLVER=127.0.0.11
ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d

EXPOSE 80
