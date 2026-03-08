# Chat no Supabase: stack canônica e descomissionamento das tabelas legadas

## Contexto
Após a migração de Postgres para Supabase, havia risco de manter duas "stacks" de schema para chat:

- legado: `chat_conversations` (e derivados), eventualmente `uazapi_conversations`;
- canônico: `conversations` + `messages` + `message_attachments`.

Este documento formaliza a decisão e evita reintrodução de tabelas duplicadas.

## 1) Mapeamento real de uso no código (backend/frontend)

### Tabela `conversations` (ativa)
A tabela `public.conversations` é usada diretamente nas Edge Functions do fluxo de chat:

- listagem/sincronização de conversas (`uazapi-proxy/handlers/chats*.ts`);
- envio/leitura/edição de mensagens com atualização de conversa (`uazapi-proxy/handlers/messages.ts`);
- ingestão de webhook UAZAPI (`uazapi-webhook/index.ts`).

### Tabela `chat_conversations` (legada)
`chat_conversations` aparece apenas em SQL legado/compatibilidade de schema, sem uso direto no backend/frontend atuais.

### Tabela `uazapi_conversations` (legada)
Não há uso em código de aplicação atual; quando existir em bases antigas, deve ser tratada como legado e migrada para `conversations`.

## 2) Fluxo ativo em produção (Supabase)

1. **Frontend** consome `/api/conversations` e `/api/conversations/:id/messages`.
2. **Backend Express** (`chatRoutes`) atua como proxy autenticado para Edge Function `uazapi-proxy`.
3. **Edge Functions** leem/escrevem no schema canônico (`conversations`, `messages`, `message_attachments`).
4. **Webhook UAZAPI** atualiza/insere dados de conversa e mensagem no mesmo schema canônico.

Resumo: o caminho ativo já está centrado em **Supabase + `conversations`** (não nas tabelas legadas).

## 3) Decisão canônica

A stack oficial de chat passa a ser:

- `public.conversations`
- `public.messages`
- `public.message_attachments`

As tabelas legadas (`chat_conversations`, `uazapi_conversations` e dependentes legados) ficam proibidas para escrita e devem ser removidas após migração de dados.

## 4) Migração e limpeza aplicadas

A migração `supabase/migrations/20260218120000_chat_canonical_cleanup.sql` executa:

1. Migração complementar de dados remanescentes de `chat_conversations` e `uazapi_conversations` para `conversations`.
2. Gatilhos de bloqueio para impedir escrita legada durante a janela de validação.
3. Remoção de FKs dependentes das tabelas legadas.
4. `DROP TABLE`/`DROP VIEW` das tabelas legadas não canônicas.

## 5) Regra para mudanças futuras

- Qualquer evolução de chat deve ocorrer **somente** na stack canônica.
- É proibido criar novas tabelas paralelas para conversas.
- Compatibilidade com legados deve ser feita por transformação no ingest/proxy, nunca por duplicação de tabela principal.
