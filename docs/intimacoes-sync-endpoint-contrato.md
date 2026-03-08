# Contrato interno do endpoint `POST /intimacoes/sync`

Este documento descreve o contrato do endpoint interno usado pelo frontend para disparar a sincronização manual de intimações monitoradas por OAB.

## Objetivo

- Resolver automaticamente a `empresaId` do usuário autenticado.
- Buscar as OABs monitoradas em `oab_monitoradas` com `tipo = 'intimacoes'`.
- Acionar a Edge Function de sincronização para cada OAB monitorada.
- Consolidar o resultado e devolver payload compatível com o frontend.

## Endpoint

- **Método**: `POST`
- **URL**: `/api/intimacoes/sync`
- **Auth**: obrigatório (Bearer token)
- **Body**: vazio

## Resposta de sucesso (contrato frontend)

```json
{
  "triggered": true,
  "message": "Sincronização concluída para 2 OAB(s)."
}
```

### Sem OAB monitorada

```json
{
  "triggered": true,
  "message": "Sincronização concluída: nenhuma OAB monitorada para intimações foi encontrada."
}
```

### Lock ativo (evita sync paralela por empresa)

```json
{
  "triggered": false,
  "message": "Uma sincronização de intimações já está em andamento para esta empresa."
}
```

## Erros

### 401 - Não autorizado

```json
{
  "error": "Não autorizado."
}
```

### 400 - Empresa não encontrada para o usuário

```json
{
  "error": "Empresa do usuário não encontrada."
}
```

### 500 - Falha ao carregar OABs monitoradas

```json
{
  "error": "Não foi possível carregar as OABs monitoradas para sincronização."
}
```

### 500 - Falha inesperada de sincronização

```json
{
  "error": "Não foi possível sincronizar as intimações."
}
```

## Observações de implementação

- O backend usa lock lógico em memória por `empresaId`, com TTL de 5 minutos, para impedir sincronizações paralelas da mesma empresa.
- O payload de resposta mantém o formato consumido pelo frontend: `{ triggered: boolean, message?: string }`.
- O nome da Edge Function pode ser configurado por `INTIMACOES_SYNC_FUNCTION_NAME` (default: `sync-intimacoes-oab`).
