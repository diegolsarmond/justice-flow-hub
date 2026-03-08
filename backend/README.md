# Backend - Operações e manutenção

## Diagnóstico antes de qualquer correção

Após a migração de PostgreSQL legado para Supabase, valide primeiro se a falha é de consistência pós-migração (ex.: `usuarios.auth_user_id`, perfis sem módulos, colunas de empresa divergentes) antes de alterar código de runtime.

## Scripts de manutenção

Scripts utilitários que não fazem parte do runtime foram movidos para `backend/scripts/maintenance/`.

> Execute a partir da raiz do repositório (`/workspace/quantumjud2.0`).

- Diagnóstico completo de usuários:
  - `npx tsx backend/scripts/maintenance/diagnose-user.ts`
- Checagem de consistência geral:
  - `npx tsx backend/scripts/maintenance/check-data-consistency.ts`
- Correções de dados pós-migração:
  - `npx tsx backend/scripts/maintenance/fix-data.ts`
- Correções avançadas de migração/vínculo Auth ↔ DB:
  - `npx tsx backend/scripts/maintenance/fix-migration.ts`

## Arquivos removidos

Foram removidos scripts obsoletos e saídas temporárias que não pertencem ao runtime do backend:

- Scripts: `debug-db.ts`, `debug-db-isolated.ts`
- Saídas temporárias: `diagnose-output*.txt`, `consistency-report.txt`, `fix-output.txt`
