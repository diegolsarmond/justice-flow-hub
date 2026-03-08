# Contrato do endpoint de usuários (pós-migração para Supabase)

Este documento descreve o contrato normalizado dos endpoints:

- `GET /api/usuarios`
- `GET /api/usuarios/empresa` (alias legado)
- `GET /api/get_api_usuarios_empresa` (alias legado)
- `GET /api/usuarios/:id`
- `POST /api/usuarios`
- `PUT /api/usuarios/:id`

## Contexto da migração

Na migração de Postgres legado para Supabase, parte da base passou a expor pares de colunas equivalentes, como:

- `empresa` e `empresa_id`
- `perfil` e `perfil_id`
- `status` e `ativo`

Para reduzir impacto em clientes antigos/novos, os endpoints de usuários agora aceitam e retornam os pares de forma consistente.

## Campos retornados

Os endpoints de listagem e detalhe retornam os campos abaixo (quando disponíveis no registro):

- `id`
- `nome_completo`
- `cpf`
- `email`
- `perfil`
- `perfil_id`
- `empresa`
- `empresa_id`
- `setor`
- `oab`
- `status`
- `ativo`
- `telefone`
- `ultimo_login`
- `datacriacao`
- `auth_user_id`
- `must_change_password`

## Regras de normalização

### Entrada (POST/PUT)

Ao criar/atualizar usuário, o backend normaliza os pares:

- Se vier `empresa` **ou** `empresa_id`, grava ambos com o mesmo valor.
- Se vier `perfil` **ou** `perfil_id`, grava ambos com o mesmo valor.
- Se vier `status` **ou** `ativo`, grava ambos com o mesmo valor booleano.

### Saída (GET/POST/PUT)

A resposta também é normalizada para manter os pares sincronizados:

- `empresa` e `empresa_id`
- `perfil` e `perfil_id`
- `status` e `ativo`

## Filtro por empresa

O filtro por empresa (escopo do usuário autenticado) considera as duas colunas:

- coluna principal: `empresa`
- coluna alternativa: `empresa_id`

Assim, o registro continua visível no tenant correto mesmo quando apenas `empresa_id` estiver populada na base migrada.

## Compatibilidade de aliases legados

Os endpoints legados:

- `/api/usuarios/empresa`
- `/api/get_api_usuarios_empresa`

apontam para a mesma listagem e **mantêm a mesma saída normalizada** de `/api/usuarios`.
