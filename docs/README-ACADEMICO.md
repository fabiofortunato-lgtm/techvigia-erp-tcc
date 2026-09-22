# TechVigia ERP — Versão Acadêmica

**Trabalho apresentado para:** Faculdade Afya Unigranrio
**Curso:** Redes de Computadores
**Professor:** Miguel Gabriel Prazeres

> Esta é uma versão de demonstração, isolada e com dados fictícios, de um sistema real de
> gestão de manutenção de CFTV (câmeras de segurança) desenvolvido para uma empresa do setor.
> Nenhum dado real de clientes, funcionários ou credenciais aparece nesta cópia — ver a seção
> **"Diferenças entre a versão empresarial e a versão acadêmica"** para o detalhamento
> completo do que foi alterado.

---

## 1. Objetivo do sistema

O TechVigia ERP é um sistema completo de gestão para empresas prestadoras de serviço de
manutenção de CFTV (circuito fechado de televisão / câmeras de segurança) em condomínios e
empresas. Ele cobre o ciclo inteiro do serviço: desde o cadastro do cliente e dos
equipamentos instalados, até a abertura, execução em campo e conclusão formal (com
assinatura digital e PDF) de cada ordem de serviço.

## 2. Problema que o sistema resolve

Empresas de manutenção de CFTV tradicionalmente controlam sua operação por planilhas, papel
e mensagens de WhatsApp soltas — o que causa perda de histórico, dificuldade de saber quais
equipamentos já tiveram manutenção, técnicos sem visibilidade da agenda do dia, e nenhuma
maneira fácil de comprovar ao cliente que o serviço foi realizado.

O sistema resolve isso centralizando: cadastro de clientes e equipamentos, agenda de visitas,
checklist padronizado por tipo de manutenção, registro de peças trocadas, coleta de
assinatura digital do responsável no local, e geração automática de um PDF comprobatório —
tudo acessível tanto pelo técnico em campo (aplicativo) quanto pela administração (painel
web).

## 3. Público-alvo

- **Empresas prestadoras de serviço de manutenção de CFTV** (o caso de uso original)
- Por extensão, qualquer empresa de manutenção baseada em visitas técnicas recorrentes a
  múltiplos locais (controle de acesso, interfonia, redes, HVAC, etc.) — a estrutura de
  dados (cliente → equipamento → ordem de serviço → checklist) é genérica o suficiente para
  esses casos

## 4. Principais funcionalidades

- Autenticação com perfis distintos (Administrador, Gestor, Técnico)
- Cadastro de clientes/condomínios, com endereço, contatos e periodicidade de manutenção
  preventiva
- Cadastro de equipamentos por cliente (câmeras, DVR, nobreak, interfone, controle de
  acesso...), com número de série, patrimônio e controle de troca periódica de peças
- Abertura de ordens de serviço — preventivas (agendadas) ou corretivas (chamado avulso)
- **Modelo de checklist reutilizável** por tipo de manutenção — ao abrir uma OS, o checklist
  é preenchido automaticamente a partir do modelo cadastrado
- Check-in do técnico com captura de localização GPS
- Registro de peças trocadas durante o atendimento, com baixa automática de estoque
- Captura de fotos (antes/depois) e assinatura digital do responsável no local
- Geração automática de PDF comprobatório da visita, com envio por link curto
- **Geração automática de manutenções recorrentes**, respeitando a periodicidade cadastrada
  de cada cliente
- Dashboard com indicadores (OS abertas, em andamento, atrasadas, concluídas)
- Relatórios por técnico e por local de atendimento
- Controle de estoque de peças, com histórico de movimentação
- Aplicativo móvel (Android/iOS) para o técnico em campo, com fila de sincronização para
  funcionar mesmo com conexão instável

## 5. Tecnologias utilizadas

| Camada | Tecnologia |
|---|---|
| Backend | Node.js, NestJS, Prisma ORM |
| Banco de dados | PostgreSQL |
| Cache / fila de mensagens | Redis (via BullMQ) |
| Painel administrativo | React + Vite |
| Aplicativo móvel | React Native + Expo |
| Autenticação | JWT (token de acesso + renovação automática) |
| Geração de PDF | PDFKit |
| Containerização | Docker / docker-compose |
| Proxy reverso (produção) | Nginx |

## 6. Arquitetura do sistema

O projeto é um **monorepo** (várias aplicações num único repositório, compartilhando
configuração), organizado assim:

```
├── apps/
│   ├── web/       → Painel administrativo (React)
│   └── mobile/    → Aplicativo do técnico (React Native/Expo)
├── services/
│   └── api/       → Backend único (NestJS), consumido pelos dois clientes acima
├── packages/      → Código compartilhado entre as aplicações
└── infra/         → Configuração de Docker e Nginx
```

**Modelo cliente-servidor clássico**: tanto o painel web quanto o aplicativo móvel são
*clientes* independentes que conversam com a **mesma API REST**, via chamadas HTTP
autenticadas por token — nenhum dos dois acessa o banco de dados diretamente. Isso significa
que a API pode evoluir, ser hospedada em qualquer servidor, e atender múltiplos clientes
(web, Android, iOS) simultaneamente, cada um consumindo os mesmos endpoints.

A comunicação segue o padrão requisição/resposta sobre TCP/IP (HTTP), com o cliente enviando
um token JWT no cabeçalho `Authorization` de cada requisição para provar sua identidade — o
servidor não guarda estado de sessão, cada requisição é autenticada de forma independente
(característica REST/stateless).

## 7. Banco de dados

PostgreSQL, acessado via **Prisma ORM** (que gera o cliente de acesso a partir de um schema
declarativo — `services/api/prisma/schema.prisma`). O modelo tem 22 tabelas; as principais:

- `usuarios` — administradores, gestores e técnicos
- `condominios` — os clientes atendidos
- `equipamentos` — os aparelhos instalados em cada cliente
- `manutencoes` — as ordens de serviço (a entidade central do sistema)
- `checklist_itens` / `checklist_modelos` — os itens de vistoria de cada OS
- `pecas` / `itens_estoque` / `movimentacoes_estoque` — controle de peças e estoque
- `fotos` — fotos anexadas a cada OS
- `log_auditoria` — histórico de ações sensíveis, para rastreabilidade

O histórico de mudanças no banco é controlado por **migrations** (arquivos SQL versionados,
aplicados em sequência) — cada alteração de estrutura do banco é registrada e reproduzível.

## 8. Fluxo de funcionamento

O fluxo principal, do início ao fim de uma ordem de serviço:

```
Login → Dashboard → Seleciona Cliente → Abertura de OS → Agendamento
   → Técnico faz Check-in → Preenche Checklist → Registra Peças/Fotos
   → Coleta Assinatura → Sistema gera PDF → OS Concluída → Histórico/Relatório
```

## 9. Perfis de usuários

| Perfil | O que pode fazer |
|---|---|
| **Administrador** | Acesso total: cadastros, usuários, relatórios, configurações |
| **Gestor** | Acesso operacional: cadastros e acompanhamento, sem gestão de usuários |
| **Técnico** | Vê e executa apenas as OS atribuídas a ele mesmo, via aplicativo móvel |

## 10. Segurança

- Senhas nunca armazenadas em texto puro — usa **Argon2** (função de hash de senha moderna,
  resistente a ataques de força bruta)
- Autenticação por **JWT**: token de acesso de curta duração (15 minutos) + token de
  renovação de longa duração (7 dias), renovado automaticamente pelo aplicativo sem exigir
  novo login constante
- Toda credencial (senha do banco, chaves de assinatura de token) vem de variáveis de
  ambiente (`.env`) — nunca escrita diretamente no código-fonte
- Controle de acesso por perfil em cada rota da API (um técnico não consegue, via API, ver
  ou alterar dados de uma OS que não é sua)
- Log de auditoria para ações sensíveis (edição de OS já assinada, por exemplo)

## 11. Como executar a versão acadêmica

### Pré-requisitos
- Node.js 20 ou superior
- Docker e Docker Compose (para banco de dados e cache)

### Passo a passo

```bash
# 1. Instalar as dependências (na raiz do projeto)
npm install

# 2. Subir o banco de dados e o Redis (portas próprias, não colidem com nada)
docker compose -f infra/docker/docker-compose.yml up -d

# 3. Aplicar a estrutura do banco de dados
cd services/api
npx prisma migrate deploy

# 4. Popular o banco com os dados fictícios de demonstração
npm run seed

# 5. Rodar a API
npm run dev
```

Com a API rodando (`http://localhost:3000`), em outro terminal:

```bash
# Painel administrativo
cd apps/web
npm run dev
# Abre em http://localhost:5173
```

Para o aplicativo móvel (opcional, requer Expo Go no celular ou emulador):

```bash
cd apps/mobile
npx expo start
```

## 12. Como acessar o painel administrativo

Depois de rodar os passos acima, acesse **http://localhost:5173** no navegador e entre com
qualquer um dos usuários de demonstração abaixo.

## 13. Usuários de demonstração

Todos com a senha: **`Demo@123`**

| Perfil | E-mail |
|---|---|
| Administrador | `admin@techvigia-demo.com` |
| Gestor | `gestor@techvigia-demo.com` |
| Técnico | `joao.silva@techvigia-demo.com` |
| Técnico | `carlos.souza@techvigia-demo.com` |
| Técnico | `marcelo.oliveira@techvigia-demo.com` |
| Técnico | `rafael.santos@techvigia-demo.com` |

O banco já vem populado (via `npm run seed`) com 4 clientes fictícios e 11 ordens de serviço
em diferentes estágios (aberta, agendada, em atendimento, aguardando material, concluída e
cancelada) — prontas para navegar sem precisar cadastrar nada do zero antes da apresentação.

## 14. Deploy

Para fins de apresentação acadêmica, a execução **local** (passo 11) é suficiente e
recomendada. Caso deseje publicar num servidor, o projeto já inclui:

- `Dockerfile` para a API, pronta para build de imagem de container
- Configuração de Nginx (`infra/nginx/`) como proxy reverso, servindo o painel e
  redirecionando `/api` para o backend
- Suporte a variáveis de ambiente de produção via `.env` (nunca versionado)

---

## Diferenças entre a versão empresarial e a versão acadêmica

Esta cópia foi criada especificamente para apresentação em sala de aula, isolada do sistema
real usado pela empresa. As mudanças feitas:

| Item | Versão empresarial (real) | Versão acadêmica (esta cópia) |
|---|---|---|
| **Dados de clientes** | Condomínios e empresas reais, com CNPJ, endereço, contatos verdadeiros | 4 clientes fictícios (Condomínio Alpha, Empresa Beta, Comércio Central, Residencial Jardim), com CNPJs e endereços inventados |
| **Usuários** | Funcionários reais da empresa | 6 usuários fictícios (1 admin, 1 gestor, 4 técnicos com nomes inventados) |
| **Ordens de serviço** | Histórico real de atendimentos | 11 ordens de serviço fictícias, cobrindo todos os estágios do fluxo |
| **Banco de dados** | Servidor de produção, com anos de histórico real | Banco local próprio (`techvigia_academico`), em portas diferentes das padrão, sem nenhuma ligação com o banco real |
| **Credenciais (.env)** | Senhas e chaves reais de produção | Todos os segredos (JWT, senha de banco) gerados do zero, exclusivos desta cópia |
| **Identidade visual** | Marca e logotipo reais da empresa | Marca fictícia "TechVigia", com logotipo e ícone próprios, criados especificamente para esta demonstração |
| **Integrações externas** (WhatsApp, e-mail) | Conectadas a contas reais da empresa | Desligadas de propósito — o sistema já foi originalmente desenhado para funcionar sem elas (e-mail cai automaticamente numa conta de teste; WhatsApp é ignorado com um aviso, sem quebrar nada) |
| **Projeto na nuvem (Expo)** | Vinculado à conta real da empresa | Identificador removido — esta cópia não está associada a nenhuma conta na nuvem |
| **Logs internos de desenvolvimento** | Presentes no repositório original | Removidos desta cópia (não fazem parte do sistema em si, são anotações do processo de construção) |

**O que NÃO mudou** (a funcionalidade é a mesma, ponta a ponta): toda a estrutura de código,
o modelo de dados, os fluxos de checklist/assinatura/PDF, o controle de estoque, os
relatórios e o aplicativo móvel funcionam de forma **idêntica** à versão real — apenas
operando sobre dados de demonstração, em um ambiente totalmente isolado.
