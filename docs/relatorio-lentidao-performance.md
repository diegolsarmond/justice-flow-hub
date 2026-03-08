# Relatório de Varredura de Lentidão - JUS Connect

**Data:** 01/02/2025  
**Objetivo:** Identificar possíveis causas de lentidão no sistema

---

## Resumo Executivo

Foram identificadas **7 áreas principais** com potencial de impacto em performance, concentradas em:

1. **Backend** – consultas SQL com subqueries correlacionadas
2. **Frontend** – ausência de virtualização em listas longas
3. **Chamadas de API** – múltiplas requisições sequenciais
4. **React** – re-renders e efeitos disparando com frequência

---

## 1. Backend: Subqueries Correlacionadas na Listagem de Conversas

**Local:** `backend/src/services/chatService.ts` (linhas ~2116–2124, 2162–2166, 2239–2243, 3646–3650)

**Problema:** A query que lista conversas executa **2 subqueries correlacionadas por linha** para buscar última mensagem e ID:

```sql
SELECT c.*, ...
  (SELECT content FROM uazapi_messages m WHERE m.chat_id = c.chat_id ORDER BY m.timestamp DESC LIMIT 1) as last_message_content_fetched,
  (SELECT message_id FROM uazapi_messages m WHERE m.chat_id = c.chat_id ORDER BY m.timestamp DESC LIMIT 1) as last_message_id_fetched
FROM uazapi_chats c
```

Para cada conversa (ex.: 50), são executadas **até 2 subqueries** em `uazapi_messages`, resultando em até 100+ acessos à tabela por listagem.

**Impacto:** Alto em cenários com muitas conversas.

**Recomendação:**
- Usar **LEFT JOIN LATERAL** ou **window functions** para obter última mensagem em uma única passada
- Ou usar os campos já mantidos em `uazapi_chats` (`wa_last_message_timestamp`, `wa_last_message_type`) para reduzir ou eliminar essas subqueries

---

## 2. Backend: Índice Inadequado em `uazapi_messages`

**Local:** `backend/sql/uazapi_tables.sql`, `chatService.ts` (linha ~3572)

**Problema:**
- Existe índice em `message_timestamp`: `idx_uazapi_messages_timestamp`
- A query usa `ORDER BY "timestamp" DESC` (coluna `timestamp` timestamptz)
- O índice não cobre a coluna usada na ordenação

**Recomendação:**
```sql
CREATE INDEX IF NOT EXISTS idx_uazapi_messages_chat_timestamp 
  ON uazapi_messages(chat_id, "timestamp" DESC NULLS LAST);
```

---

## 3. Frontend: Sem Virtualização na Lista de Mensagens

**Local:** `frontend/src/features/chat/components/MessageViewport.tsx` (linha ~224)

**Problema:** Todas as mensagens são renderizadas com `messages.map()`:

```tsx
{messages.map((message, index) => {
  // Cada mensagem gera vários elementos DOM
  return (...)
})}
```

Com centenas ou milhares de mensagens, isso gera:
- Muitos nós DOM
- Re-renders pesados
- Scroll lento

**Recomendação:** Usar virtualização (`@tanstack/react-virtual` ou `react-window`) para renderizar apenas mensagens visíveis.

---

## 4. Frontend: Duas Chamadas Sequenciais ao Carregar Mensagens Antigas

**Local:** `frontend/src/features/chat/hooks/useChatMessages.ts` (linhas 165–174)

**Problema:** `loadOlder` faz **2 chamadas sequenciais** por vez:

```ts
// 1ª chamada - sincroniza com provedor externo (Uazapi)
const syncResult = await syncConversationMessages(conversationId, { ... });

// 2ª chamada - busca mensagens no backend
const page = await findChatMessages({ ... });
```

O mesmo ocorre em `reload()` (linhas 136–139).

**Impacto:** Médio – dobra o tempo de resposta ao carregar mais mensagens ou ao abrir conversa.

**Recomendação:** Avaliar unificar sync + busca em um único endpoint ou executar em paralelo quando possível.

---

## 5. Frontend: Sugestões de Contato sem Debounce

**Local:** `frontend/src/features/chat/ChatPage.tsx` (linhas 1134–1173)

**Problema:** O `useEffect` que busca sugestões de contato depende de `searchValue`:

```tsx
useEffect(() => {
  if (!newConversationOpen) return;
  // ...
  await fetchContactSuggestions({ search: searchQuery });
  // ...
}, [newConversationOpen, pendingConversation, searchValue, whatsappStatus.sessionEntry]);
```

Cada alteração em `searchValue` dispara uma nova requisição.

**Recomendação:** Debounce de ~300–500 ms em `searchValue` antes de chamar a API.

---

## 6. ChatPage: Muitos useEffects e Re-renders

**Local:** `frontend/src/features/chat/ChatPage.tsx`

**Problema:** O componente possui mais de 15 `useEffect`s e diversos `useState`s, o que aumenta a chance de:
- Cadeias de atualizações
- Re-renders desnecessários

`handleRealtimeMessageCreated` depende de `messages`, que muda com frequência, podendo causar re-criações de callbacks e re-execuções.

**Recomendação:**
- Revisar dependências dos `useEffect`
- Memoizar callbacks com `useCallback` onde fizer sentido
- Considerar extrair lógica para hooks menores e mais focados

---

## 7. useChatMessages: Merge com `conversations` e `messages`

**Local:** `frontend/src/features/chat/ChatPage.tsx` (linhas 509–529)

**Problema:** O efeito que faz merge da `lastMessage` da conversa com as mensagens roda sempre que `conversations` ou `messages` mudam:

```tsx
useEffect(() => {
  // ...
  mergeMessage({ ... });
}, [conversations, mergeMessage, messages, selectedConversationId]);
```

`conversations` muda em eventos em tempo real (nova mensagem, digitação etc.), o que pode disparar esse merge com frequência.

**Recomendação:** Incluir verificações para evitar merge quando o conteúdo relevante não mudou (ex.: comparar IDs ou timestamps da última mensagem).

---

## Priorização

| # | Área                     | Impacto | Esforço | Prioridade |
|---|--------------------------|---------|---------|------------|
| 1 | Subqueries correlacionadas | Alto    | Médio   | 1          |
| 2 | Índice uazapi_messages   | Alto    | Baixo   | 1          |
| 3 | Virtualização de mensagens | Alto  | Alto    | 2          |
| 4 | Chamadas duplicadas loadOlder | Médio | Baixo  | 2          |
| 5 | Debounce sugestões       | Médio   | Baixo   | 2          |
| 6 | Revisão useEffect/callbacks | Médio | Médio | 3          |
| 7 | Merge otimizado          | Baixo   | Baixo   | 3          |

---

## Próximos Passos

1. **Imediato:** Criar índice em `(chat_id, "timestamp" DESC)` em `uazapi_messages`.
2. **Curto prazo:** Refatorar query de listagem de conversas (subqueries → JOIN LATERAL ou campos existentes).
3. **Médio prazo:** Introduzir virtualização na lista de mensagens.
4. **Opcional:** Debounce em sugestões de contato e revisão de useEffects no `ChatPage`.
