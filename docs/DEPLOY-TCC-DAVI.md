# Deploy da versão acadêmica (TCC) — instruções para o Davi

Projeto separado e isolado do ambiente de produção real da ScantechRio - banco, rede e
volumes próprios, sem nenhuma ligação com o sistema em produção.

## 1. No Coolify

**New Resource → Docker Compose** (mesmo fluxo já usado no projeto real), apontando pro
arquivo:

```
infra/docker/docker-compose.coolify.yml
```

## 2. Variáveis de ambiente a configurar no Coolify

```
POSTGRES_PASSWORD=8d6bbc6c4746b0dc016c4a9cb5d0d2e8
JWT_SECRET=1d843d222c4d442267c222a943aaa00277e8ef003d55c7a0
JWT_REFRESH_SECRET=3b455a9b635995b62443ee86d4228be33218c1a7c8d10415
PUBLIC_URL=https://SUBSTITUIR-PELO-DOMINIO-DO-TCC
```

`PUBLIC_URL` deve ser o domínio/subdomínio que o Coolify for gerar ou que você configurar
pra esse projeto (ex.: `https://tcc-fabio.algumacoisa.com.br`) — só depois que o domínio
existir. Pode subir a primeira vez com um valor provisório e ajustar depois, se precisar.

## 3. Depois do primeiro deploy — aplicar o banco e os dados de demonstração

No shell do container `api` (mesmo padrão de sempre):

```bash
npx prisma migrate deploy
npm run seed
```

Isso cria a estrutura do banco e popula com os dados fictícios de demonstração (condomínios,
técnicos, ordens de serviço em vários estágios).

## 4. Testar

Acessar o domínio configurado, logar com:

- `admin@techvigia-demo.com` / `Demo@123`

## Observações

- Nenhuma integração externa real (WhatsApp, e-mail, S3) está configurada — de propósito. O
  sistema já lida bem com isso sem quebrar nada (e-mail cai numa conta de teste automática).
- Esse compose builda as imagens direto do Dockerfile de cada serviço (não usa imagem
  pré-publicada) — o primeiro deploy demora um pouco mais por isso.
