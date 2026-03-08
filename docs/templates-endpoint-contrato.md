# Contrato de endpoints de Templates/Documentos

Este documento descreve o contrato dos endpoints usados por `frontend/src/lib/templates.ts` para evitar falhas silenciosas no frontend durante a migração de banco para Supabase.

## Diagnóstico de migração (Postgres -> Supabase)

- O módulo de templates no backend já utiliza cliente Supabase (`createUserClient`/`supabaseAdmin`) e **não** usa conexão Postgres direta.
- Caso ocorra indisponibilidade (tabela ausente, policy RLS, timeout, erro interno), os endpoints de geração retornam fallback explícito com status HTTP `503` e mensagem padronizada `FEATURE_UNAVAILABLE`.

## Endpoints

### `GET /tags`

Retorna tags para preenchimento de placeholders no editor.

#### Response `200`

```json
[
  {
    "id": 1,
    "key": "cliente.nome",
    "label": "Nome do cliente",
    "example": "Maria Oliveira",
    "group_name": "cliente"
  }
]
```

#### Fallback

- Se a consulta em `template_tags` falhar ou vier vazia, o backend retorna uma lista default com a mesma estrutura.
- Mantém `200` para compatibilidade com `fetchTags()` no frontend.

---

### `POST /templates/:id/generate`

Usado por `generateWithAI(id)` (hoje como geração básica por template).

#### Request

- Sem body obrigatório.

#### Response `200`

```json
{
  "content": "<p>HTML do template</p>"
}
```

#### Errors

- `404` quando template não é encontrado:

```json
{ "error": "Template não encontrado." }
```

- `503` fallback explícito quando funcionalidade está indisponível:

```json
{
  "status": "fallback",
  "message": "FEATURE_UNAVAILABLE: endpoint em fallback temporário para templates/documentos.",
  "content": ""
}
```

---

### `POST /documents/generate`

Usado por `generateDocument(templateId, values)` para aplicar placeholders no conteúdo HTML.

#### Request

```json
{
  "templateId": 123,
  "values": {
    "cliente.nome": "Maria Oliveira",
    "processo.numero": "5001234-56.2024.8.26.0100"
  }
}
```

#### Response `200`

```json
{
  "content": "<p>Conteúdo com placeholders preenchidos</p>"
}
```

#### Errors

- `400` para `templateId` inválido:

```json
{ "error": "templateId inválido." }
```

- `404` quando template não é encontrado:

```json
{ "error": "Template não encontrado." }
```

- `503` fallback explícito:

```json
{
  "status": "fallback",
  "message": "FEATURE_UNAVAILABLE: endpoint em fallback temporário para templates/documentos.",
  "content": ""
}
```

---

### `GET /templates/:id/export`

Usado por `exportTemplatePdf(id)`.

#### Response `200`

- `Content-Type: application/pdf`
- Body binário com PDF do template.

#### Errors

- `404` quando template não é encontrado:

```json
{ "error": "Template não encontrado." }
```

- `503` fallback explícito:

```json
{
  "status": "fallback",
  "message": "FEATURE_UNAVAILABLE: endpoint em fallback temporário para templates/documentos."
}
```

## Observação de compatibilidade com o frontend

- `fetchTags()` espera array de `Tag`.
- `generateWithAI()` e `generateDocument()` esperam campo `content` na resposta JSON.
- `exportTemplatePdf()` espera `response.ok` e blob PDF; em erro, o frontend já lança exceção.
