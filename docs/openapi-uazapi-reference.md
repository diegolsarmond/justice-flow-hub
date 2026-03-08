# Referência OpenAPI – API Uazapi (uazapiGO)

## Especificação

- **Arquivo**: [`docs/uazapi-openapi-spec.yaml`](./uazapi-openapi-spec.yaml)  
- **Versão OpenAPI**: 3.1.0  
- **Título**: uazapiGO - WhatsApp API (v2.0)  
- **Versão da API**: 1.0.0  

Para manutenção no código (onde está cada endpoint no projeto), use:

- **[api-uazapi.md](./api-uazapi.md)** – onde procurar no projeto (serviços, rotas, tabelas, webhooks).

## Como visualizar a documentação da API

Para ver a documentação interativa (endpoints, schemas, exemplos de request/response):

1. **Swagger UI**: use [Swagger Editor](https://editor.swagger.io/) ou instale o pacote `swagger-ui-express` e aponte para o arquivo `docs/uazapi-openapi-spec.yaml`.
2. **Redoc**: use [Redoc](https://redocly.com/redoc/) ou o pacote `redoc` e carregue o mesmo YAML.

Em ambos os casos, abra o arquivo **`docs/uazapi-openapi-spec.yaml`** (caminho a partir da raiz do repositório: `\docs\uazapi-openapi-spec.yaml`).

## Estrutura resumida da spec (para busca)

- **servers**: `https://{subdomain}.uazapi.com` (variável `subdomain`: ex. `free`, `api`).
- **security**: `token` (header) para endpoints por instância; `admintoken` (header) para admin.
- **tags principais**: Admininstração, Instancia, Proxy, Perfil, Enviar Mensagem, Ações na mensagem e Buscar, Chats, Contatos, Bloqueios, Etiquetas, Grupos e Comunidades, Respostas Rápidas, Webhooks e SSE, CRM, Chatbot, Integração Chatwoot, Business, Chamadas, Mensagem em massa.
- **schemas principais**: Instance, Webhook, Chat, Message, Label, Attendant, ChatbotTrigger, ChatbotAIAgent, ChatbotAIFunction, ChatbotAIKnowledge, MessageQueueFolder, QuickReply, Group, GroupParticipant, WebhookEvent.

Paths detalhados (request/response) estão no arquivo **[uazapi-openapi-spec.yaml](./uazapi-openapi-spec.yaml)**; o mapeamento **path → arquivo no projeto** está em [api-uazapi.md](./api-uazapi.md).
