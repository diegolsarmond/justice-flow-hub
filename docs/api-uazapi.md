# Documentação da API Uazapi (uazapiGO) para manutenção

Este documento orienta onde procurar no projeto quando for necessário dar manutenção na integração com a **API Uazapi** (uazapiGO - WhatsApp API v2.0). Use-o como referência para assistentes e desenvolvedores.

**Especificação OpenAPI (documentação completa da API)**: [`docs/uazapi-openapi-spec.yaml`](./uazapi-openapi-spec.yaml). Para visualizar a documentação interativa (endpoints, schemas, exemplos), carregue esse arquivo no [Swagger Editor](https://editor.swagger.io/) ou no Redoc.

---

## 1. Visão geral da API Uazapi

- **Nome**: uazapiGO - WhatsApp API (v2.0)
- **Especificação**: OpenAPI 3.1.0
- **Base URL**: `https://{subdomain}.uazapi.com` (ex.: `free`, `api` ou subdomínio customizado como `quantumtecnologia`)
- **Uso no projeto**: envio/recebimento de mensagens WhatsApp, gestão de instâncias, webhooks e sincronização com o backend JUS-Connect

### Onde está a especificação OpenAPI

- **Arquivo da spec no repositório**: [`docs/uazapi-openapi-spec.yaml`](./uazapi-openapi-spec.yaml) (OpenAPI 3.1.0).
- Para visualizar a documentação interativa (endpoints, schemas, exemplos), use uma ferramenta como [Swagger UI](https://swagger.io/tools/swagger-ui/) ou [Redoc](https://redocly.com/redoc/): carregue o arquivo `uazapi-openapi-spec.yaml` ou a URL local do arquivo.
- Os **paths**, **schemas** e **tags** descritos neste documento seguem essa especificação.

---

## 2. Autenticação

| Tipo            | Header      | Uso no projeto |
|-----------------|------------|----------------|
| **Token**       | `token`    | Chamadas por instância (status, enviar mensagem, chat/find, message/find, etc.). Usado pelo backend ao chamar a API com a credencial da instância. |
| **Admin token** | `admintoken` | Criação de instância, listar todas, configurar webhook global, atualizar campos admin. Usado em rotas administrativas. |

- Credenciais (subdomínio + token) vêm do banco (credenciais de chat) e são passadas para `uazApiService`.
- Base URL construída como: `https://${subdomain}.uazapi.com`.

---

## 3. Onde procurar no projeto (mapa de manutenção)

### 3.1 Backend principal (TypeScript) – integração com a API Uazapi

| O que fazer | Onde procurar |
|-------------|----------------|
| **Chamadas HTTP à API Uazapi** (instance/status, send/text, send/media, message/find, chat/find, webhook, etc.) | `backend/src/services/uazApiService.ts` |
| **Tratamento de erros da Uazapi** (401, 404, 429, mensagens amigáveis) | `backend/src/services/uazApiService.ts` (classe `UazApiError`, `resolveInstanceStatusErrorMessages` em `chatController`) |
| **Envio de mensagem (texto e mídia)** | `uazApiService.sendMessage()` → monta payload e chama `/send/text` ou `/send/media` |
| **Status da instância** | `uazApiService.fetchInstanceStatus()` → `GET/POST` em `/instance/status` |
| **Listar/buscar chats** | `uazApiService.fetchChats()` / `fetchChatById()` → `POST /chat/find` |
| **Buscar mensagens de um chat** | `uazApiService.fetchMessages()` → `POST /message/find` |
| **Editar mensagem** | `uazApiService.editMessage()` → `POST /message/edit` |
| **Configurar webhook da instância** | `uazApiService.configureWebhook()` → `POST /webhook` (admin) |
| **Criar/conectar/desconectar instância** | `uazApiService.initInstance()`, `connectInstance()`, `disconnectInstance()`, `disconnectInstanceWithCredential()` |
| **Construção da URL pública da instância** | `backend/src/controllers/chatController.ts` → `buildPublicInstanceServerUrl()` (retorna `https://{subdomain}.uazapi.com`) |

### 3.2 Rotas do backend que expõem ou repassam Uazapi

| Rota / funcionalidade | Arquivo | Observação |
|------------------------|---------|------------|
| Proxy **POST /message/find** | `backend/src/routes/chatRoutes.ts` → `findMessagesProxyHandler` | Repassa para Uazapi `POST /message/find` |
| Proxy **POST /chat/find** | `backend/src/routes/chatRoutes.ts` → `findChatsProxyHandler` | Repassa para Uazapi `POST /chat/find` |
| **POST /send/text** | `backend/src/routes/chatIntegrationRoutes.ts` → `sendTextMessageHandler` | Envio de texto via Uazapi |
| **POST /send/media** | `backend/src/routes/chatRoutes.ts` → `publicSendMediaHandler` | Envio de mídia via Uazapi |
| Status da instância (QR, conectado, etc.) | `backend/src/controllers/chatController.ts` | Usa `uazApiService.fetchInstanceStatus()` |

### 3.3 Recebimento de eventos (webhooks Uazapi)

| O que fazer | Onde procurar |
|-------------|----------------|
| **Controller que recebe webhooks da Uazapi** | `backend/src/controllers/uazWebhookController.ts` |
| **Processamento de eventos** (messages, connection, etc.) | `uazWebhookController` + `backend/src/services/chatService.ts` (normalização, persistência) |
| **Persistência em tabelas uazapi_*** | `chatService.ts` (e em `uazWebhookController`) – inserts/updates em `uazapi_chats`, `uazapi_contacts`, `uazapi_messages`, `uazapi_webhooks`, `uazapi_integrations` |
| **Serviço de eventos (SSE/duplicação)** | `backend/src/services/uazEventService.ts` (webhooks, eventos, tabela `uazapi_webhook_events`) |

### 3.4 Banco de dados (tabelas Uazapi)

| Tabela | Uso |
|--------|-----|
| `uazapi_integrations` | Integrações/credenciais (token, credential_id, base_url, etc.) |
| `uazapi_chats` | Chats/conversas (chat_id, integration_token, contact_*, wa_*, lead_*, etc.) |
| `uazapi_contacts` | Contatos (phone, identifier, name, integration_token, image, etc.) |
| `uazapi_messages` | Mensagens (message_id, chat_id, content, message_type, timestamp, status, etc.) |
| `uazapi_webhooks` | Configuração de webhooks por instância/credencial |
| `uazapi_webhook_events` | Controle de idempotência de eventos (event_id) |
| `uazapi_media` | Metadados de mídia (message_id, credential_id, public_url, etc.) |

- **Migrations**: `Uazapi/backend/migrations/` (SQL) e quaisquer migrations no backend principal que criem/alterem tabelas `uazapi_*`.

### 3.5 Backend legado (Uazapi em JS)

| O que fazer | Onde procurar |
|-------------|----------------|
| **Base URL e chamadas à API** | `Uazapi/backend/uazapiService.js` (`UAZAPI_BASE_URL`, `fetchRemoteInstances`, `configureInstanceWebhook`) |
| **Rotas que usam Uazapi** | `Uazapi/backend/routes/` (instances, webhooks, conversations, messages, contacts, media, integrations) |
| **Webhook receiver legado** | `backend/webhookService.js` (usa tabelas `uazapi_webhooks`, `uazapi_webhook_events`) |
| **Variável de ambiente** | `WA_API_BASE_URL` ou `UAZ_API_SUBDOMAIN` – base/subdomínio Uazapi (ex.: `https://quantumtecnologia.uazapi.com`) |

### 3.6 Frontend

| O que fazer | Onde procurar |
|-------------|----------------|
| **Chamadas à API do JUS-Connect que por sua vez usam Uazapi** | `frontend/src/features/chat/`, `Uazapi/services/api.ts` (ex.: `chat/find`, `message/find`, `send/text`, `send/media`) |
| **Exibição de status da instância (QR, conectado)** | Componentes de chat/credenciais que consomem status da API backend |

---

## 4. Tags da API (OpenAPI) e equivalência no código

Resumo das tags da especificação e onde cada grupo de endpoints é usado no projeto:

| Tag OpenAPI | Endpoints principais | Onde no projeto |
|-------------|-----------------------|------------------|
| **Admininstração** | `/instance/init`, `/instance/all`, `/instance/updateAdminFields`, `/globalwebhook` | `uazApiService` (init/connect/disconnect), `uazapiService.js` (instance/all), rotas admin |
| **Instancia** | `/instance/connect`, `/instance/disconnect`, `/instance/status`, `/instance/updateInstanceName`, `/instance/privacy`, `/instance/presence` | `uazApiService.ts` (status, connect, disconnect), `chatController` (status para UI) |
| **Enviar Mensagem** | `/send/text`, `/send/media`, `/send/contact`, `/send/location`, `/send/menu`, `/send/carousel`, `/send/status`, etc. | `uazApiService.sendMessage()` → `/send/text` ou `/send/media`; outros tipos podem ser adicionados no mesmo serviço |
| **Ações na mensagem e Buscar** | `/message/find`, `/message/download`, `/message/markread`, `/message/react`, `/message/delete`, `/message/edit` | `uazApiService.fetchMessages()` → `/message/find`; `editMessage()` → `/message/edit`; proxies em `chatRoutes.ts` |
| **Chats** | `/chat/find`, `/chat/delete`, `/chat/archive`, `/chat/read`, `/chat/mute`, `/chat/pin`, `/chat/editLead`, `/chat/details` | `uazApiService.fetchChats()`, `fetchChatById()` → `/chat/find`; `chat/details` pode ser usado para detalhes do chat |
| **Webhooks e SSE** | `/webhook` (GET/POST), `/sse` | `uazApiService.configureWebhook()`; `uazWebhookController` recebe; `uazEventService`; `webhookService.js` |
| **Contatos** | `/contacts`, `/contacts/list`, `/contact/add`, `/contact/remove`, `/chat/details`, `/chat/check` | Serviços de contatos e detalhes de chat que chamem Uazapi |
| **CRM** | `/chat/editLead`, `/instance/updateFieldsMap` | Lógica de leads em `chatService` e rotas de atualização de conversa |
| **Etiquetas** | `/chat/labels`, `/label/edit`, `/labels` | Se houver uso de labels na integração, procurar em rotas/serviços de chat |
| **Bloqueios** | `/chat/block`, `/chat/blocklist` | Implementar ou manter em `uazApiService` se necessário |
| **Grupos e Comunidades** | `/group/*`, `/community/*` | Ainda que a spec descreva, o uso atual pode ser limitado; procurar em `uazApiService` ou novas rotas |
| **Respostas Rápidas** | `/quickreply/edit`, `/quickreply/showall` | `Uazapi/backend/routes/quickAnswers.js` se existir |
| **Chatbot** | Vários (agentes, triggers, conhecimento, funções) | Específico da Uazapi; no JUS-Connect o foco é mensagens e chats |

---

## 5. Schemas principais (OpenAPI) e uso interno

- **Instance**: status da instância WhatsApp; mapeado para credenciais e status no backend (QR, conectado, etc.).
- **Message**: mensagens; persistidas em `uazapi_messages` e normalizadas em `chatService`.
- **Chat**: conversas; persistidas em `uazapi_chats`, campos wa_*, lead_*, etc.
- **Webhook**: configuração de webhook; persistida em `uazapi_webhooks` e usada ao configurar/atualizar webhook na Uazapi.
- **Contact / Label / Attendant / etc.**: conforme uso em rotas e serviços acima.

Ao alterar contratos (campos obrigatórios, novos campos), verificar:
- `backend/src/services/chatService.ts` (normalização e persistência),
- `backend/src/controllers/uazWebhookController.ts` (payload recebido),
- `backend/src/services/uazApiService.ts` (payloads enviados e respostas).

---

## 6. Variáveis de ambiente relevantes

| Variável | Uso |
|----------|-----|
| `WA_API_BASE_URL` | Base URL da API Uazapi (ex.: `https://quantumtecnologia.uazapi.com`) – usada no backend JS e em alguns pontos do TS. |
| `UAZ_API_SUBDOMAIN` | Alternativa como base (ex.: mesma URL). |
| `WA_SSE_BASE_URL` | URL do SSE, se diferente (ex.: `https://sse.uazapi.com/sse`). |

---

## 7. Checklist rápido para manutenção

1. **Erro ao enviar mensagem**: verificar `uazApiService.sendMessage()`, payload em `send/text` ou `send/media`, e credencial (subdomain + token).
2. **Erro ao listar conversas ou mensagens**: verificar `fetchChats()` / `fetchMessages()` e proxies `chat/find` e `message/find` em `chatRoutes.ts`.
3. **Webhook não recebendo eventos**: verificar URL configurada na Uazapi (`POST /webhook`), controller `uazWebhookController.ts` e tabela `uazapi_webhooks`.
4. **Status da instância (QR/conectado) incorreto**: verificar `fetchInstanceStatus()` em `uazApiService` e construção da URL (`subdomain.uazapi.com`).
5. **Dados desatualizados no app**: verificar persistência em `chatService.ts` (uazapi_chats, uazapi_messages, uazapi_contacts) e fluxo do webhook até a atualização dessas tabelas.
6. **Alteração na API Uazapi (novo path ou campo)**: atualizar `uazApiService.ts` e, se for webhook, `uazWebhookController.ts` e `chatService.ts`; atualizar esta documentação e a spec OpenAPI se mantida no repositório.

---

## 8. Referência rápida de paths (OpenAPI)

- **Instância**: `POST /instance/init`, `POST /instance/connect`, `POST /instance/disconnect`, `GET /instance/status`, `DELETE /instance`, `POST /instance/privacy`, `POST /instance/presence`, etc.
- **Mensagens**: `POST /send/text`, `POST /send/media`, `POST /message/find`, `POST /message/edit`, `POST /message/download`, `POST /message/markread`, `POST /message/react`, `POST /message/delete`.
- **Chats**: `POST /chat/find`, `POST /chat/details`, `POST /chat/editLead`, `POST /chat/read`, `POST /chat/archive`, `POST /chat/pin`, `POST /chat/mute`, `POST /chat/delete`, `POST /chat/block`, `GET /chat/blocklist`, `POST /chat/labels`.
- **Webhooks**: `GET /webhook`, `POST /webhook`; `GET /globalwebhook`, `POST /globalwebhook` (admin); `GET /sse`.
- **Contatos**: `GET /contacts`, `POST /contacts/list`, `POST /contact/add`, `POST /contact/remove`, `POST /chat/details`, `POST /chat/check`.
- **Outros**: grupos, comunidades, labels, respostas rápidas, chatbot, business, chamadas, etc. – consultar a especificação OpenAPI completa quando for necessário implementar ou alterar esses recursos.

Documentação criada para auxiliar assistentes e desenvolvedores na manutenção da integração com a API Uazapi. Para detalhes exatos de request/response, consulte a especificação OpenAPI no arquivo **[docs/uazapi-openapi-spec.yaml](./uazapi-openapi-spec.yaml)**.
