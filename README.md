# Quantum Jud Document Templates

Este repositório contém um módulo simples de CRUD de Templates de Documentos com editor rich text, painel de tags e geração de documentos via API.

## Backend

Antes de iniciar qualquer setup, valide se os erros atuais estão relacionados à migração de PostgreSQL legado para Supabase. O bloco **Diagnóstico rápido (pós-migração)** abaixo foi pensado exatamente para essa triagem.

### Convenção de scripts SQL

- Migrações oficiais/versionadas de produção: `supabase/migrations/`.
- Scripts operacionais/manuais: `backend/sql/`.

> Exemplo de script manual de vínculo auth: `backend/sql/supabase_auth_user_link.sql`.

### Setup (PostgreSQL legado)

Use este modo apenas para ambientes antigos que ainda não foram migrados para Supabase.

```bash
cd backend
npm install
# configure PostgreSQL e execute o script de tabelas
psql -f sql/templates.sql
psql -f sql/intimacoes.sql
npm run dev
```

### Setup (Supabase - produção atual)

Use este fluxo como padrão para produção e novos ambientes.

```bash
cd backend
npm install
# aplique os scripts obrigatórios no banco Supabase
psql "$DATABASE_URL" -f sql/supabase_auth_empresa_fix.sql
# execute a migração de modulos apenas em bases pré-migração (_text)
MODULOS_TYPE=$(psql "$DATABASE_URL" -t -A -c "SELECT udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='planos' AND column_name='modulos';")
if [ "$MODULOS_TYPE" = "_text" ]; then
  psql "$DATABASE_URL" -f sql/fix-planos-modulos-to-jsonb.sql
else
  echo "Pulando fix-planos-modulos-to-jsonb.sql (planos.modulos já está em tipo: ${MODULOS_TYPE:-desconhecido})"
fi
npm run dev
```

### Variáveis de ambiente (backend/API)

#### Obrigatórias para subir backend/API

> Sem estas variáveis o backend não inicializa.

| Variável | Finalidade |
| --- | --- |
| `SUPABASE_URL` | URL do projeto Supabase utilizada pelo client do backend. |
| `SUPABASE_ANON_KEY` | Chave pública usada em operações que exigem contexto anon/auth padrão. |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave administrativa usada por serviços internos do backend. |

#### Opcionais (somente para scripts SQL manuais)

| Variável | Quando usar |
| --- | --- |
| `DATABASE_URL` | Apenas para rodar comandos `psql` manuais (migrações pontuais, inspeções e scripts operacionais). |

### Setup (PostgreSQL legado - apenas referência histórica)

Use este modo somente em ambientes antigos ainda não migrados. Não é o fluxo padrão atual.

```bash
cd backend
npm install
# configure PostgreSQL e execute o script de tabelas
psql -f sql/templates.sql
psql -f sql/intimacoes.sql
npm run dev
```

#### Checklist obrigatório (Supabase)

- [ ] Executar `backend/sql/supabase_auth_empresa_fix.sql`.
- [ ] Verificar o tipo atual de `planos.modulos`.
- [ ] Executar `backend/sql/fix-planos-modulos-to-jsonb.sql` **somente** quando `planos.modulos` ainda for `_text` (pré-migração).
- [ ] Validar se `usuarios.auth_user_id` está preenchido e consistente com `auth.users.id`.
- [ ] Validar policies RLS para cada tabela crítica (ex.: `usuarios`, `processos`, `planos`, `document_templates`, `clientes`).

### Compatibilidade de colunas (legado x Supabase)

Após a migração para Supabase, parte do schema ficou com nomes mistos de FK de empresa.
Para evitar falhas de leitura/gravação em tabelas legadas, considere a matriz abaixo:

| Contexto | Coluna legado | Coluna nova | Regra de compatibilidade |
| --- | --- | --- | --- |
| `usuarios` | `empresa` | `empresa_id` | Ler com fallback `COALESCE(empresa, empresa_id)` e manter ambas sincronizadas quando possível. |
| `perfis` | `idempresa` | `empresa_id` | Ler com fallback entre as duas e preencher ambas em inserts de compatibilidade. |
| Demais entidades legadas | `idempresa` | (varia) | Em CRUD genérico, permitir múltiplas colunas candidatas de empresa para filtro por tenant. |

Se o erro começou após a migração, valide primeiro divergência entre essas colunas antes de investigar regras de negócio.

### Diagnóstico rápido de erro pós-migração

Checklist inicial (antes de investigar regras de negócio):

- [ ] O backend falha na inicialização se faltar qualquer variável `SUPABASE_*` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- [ ] Definir apenas `DATABASE_URL` **não** resolve a inicialização da API.
- [ ] Se o erro começou após migração, valide primeiro variáveis de ambiente e consistência de colunas (`empresa`, `empresa_id`, `idempresa`).

### Diagnóstico rápido (pós-migração)

> Execute os comandos abaixo no banco Supabase para identificar sintomas comuns após migração.

1. **Usuários sem vínculo auth (`usuarios.auth_user_id`)**

```sql
SELECT u.id, u.email, u.auth_user_id
FROM public.usuarios u
LEFT JOIN auth.users au ON au.id = u.auth_user_id
WHERE u.auth_user_id IS NULL OR au.id IS NULL;
```

2. **Perfis sem módulos**

```sql
SELECT p.id, p.nome, p.modulos
FROM public.planos p
WHERE p.modulos IS NULL
   OR (
     jsonb_typeof(p.modulos::jsonb) = 'array'
     AND jsonb_array_length(p.modulos::jsonb) = 0
   );
```

3. **Tipo atual de `planos.modulos`**

```sql
SELECT table_schema, table_name, column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'planos'
  AND column_name = 'modulos';
```

4. **Tabelas com RLS habilitado sem policy ativa**

```sql
SELECT n.nspname AS schema_name,
       c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND c.relrowsecurity = true
  AND NOT EXISTS (
    SELECT 1
    FROM pg_policy p
    WHERE p.polrelid = c.oid
  )
ORDER BY 1, 2;
```

### Rollback seguro das alterações de schema

> Faça backup/snapshot antes de qualquer rollback em produção.

1. **Rollback de `supabase_auth_empresa_fix.sql` (quando aplicável)**
   - Se o script adicionou colunas/constraints, remova **somente** os objetos criados por ele.
   - Se o script atualizou dados de vínculo auth, restaure via backup lógico pré-migração.
   - Procedimento recomendado:
     1. Criar snapshot/backup.
     2. Reverter DDL em transação (`BEGIN`/`ROLLBACK` em homologação, depois `COMMIT` em produção).
     3. Revalidar consulta de usuários sem vínculo auth.

2. **Rollback de `fix-planos-modulos-to-jsonb.sql` (quando aplicável)**
   - Este script altera tipagem/conteúdo de `planos.modulos`; antes de aplicar, salve backup da coluna.
   - Exemplo de backup preventivo:

```sql
CREATE SCHEMA IF NOT EXISTS cold_archive;

CREATE TABLE IF NOT EXISTS cold_archive.planos_modulos_backup_yyyymmddhh24miss AS
SELECT id, modulos, now() AS backup_at
FROM public.planos;
```

   - Evite tabela de backup permanente no `public`; use snapshot datado no schema `cold_archive`.
   - Em rollback, restaurar os valores a partir do snapshot em `cold_archive` e reverter o tipo da coluna apenas se o legado exigir.
   - Procedimento recomendado:
     1. `BEGIN`.
     2. `UPDATE public.planos p SET modulos = b.modulos FROM cold_archive.planos_modulos_backup_yyyymmddhh24miss b WHERE b.id = p.id;`
     3. Reverter tipagem (se necessário) com `ALTER TABLE` compatível com o ambiente legado.
     4. Validar novamente tipo de `planos.modulos` e perfis sem módulos.
     5. `COMMIT`.


### Governança e limpeza de tabelas legadas (`trigger_*` e backups)

Para ambientes Supabase, use a migration `supabase/migrations/20260218121500_governanca_legacy_trigger_backup_cleanup.sql` para:

1. Identificar referências em jobs/funções/rotinas (`governance.v_legacy_objects_references`).
2. Verificar atividade de leitura/escrita (`governance.v_legacy_table_activity`).
3. Confirmar pré-check da migração Postgres -> Supabase (`governance.v_supabase_planos_modulos_tipo`).
4. Exportar snapshot para `cold_archive` e registrar auditoria (`governance.legacy_cleanup_audit`).
5. Aplicar `DROP TABLE` em lote com proteção transacional e bloqueio de dependências.
6. Impedir novas tabelas de backup permanentes em `public` via event trigger de governança.

### Migração Supabase: `planos.modulos` para `jsonb`

Após a migração de Postgres para Supabase, valide se erros de leitura de planos vêm do tipo da coluna `public.planos.modulos` (ex.: retorno em formato string como `{"a","b"}` ou `"[\"a\",\"b\"]"`).

1. No **Supabase SQL Editor**, execute:

```sql
-- arquivo de referência no repositório
-- backend/sql/fix-planos-modulos-to-jsonb.sql

ALTER TABLE public.planos ADD COLUMN IF NOT EXISTS modulos_jsonb jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'planos'
      AND column_name = 'modulos'
      AND udt_name = '_text'
  ) THEN
    EXECUTE $sql$
      UPDATE public.planos
      SET modulos_jsonb = COALESCE((
        SELECT jsonb_agg(elem)
        FROM unnest(modulos) AS elem
      ), '[]'::jsonb)
      WHERE modulos_jsonb IS NULL
    $sql$;
  END IF;
END
$$;

UPDATE public.planos
SET modulos_jsonb = '[]'::jsonb
WHERE modulos_jsonb IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'planos'
      AND column_name = 'modulos'
      AND udt_name = '_text'
  ) THEN
    ALTER TABLE public.planos DROP COLUMN modulos;
    ALTER TABLE public.planos RENAME COLUMN modulos_jsonb TO modulos;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'planos'
      AND column_name = 'modulos'
      AND udt_name = 'jsonb'
  ) THEN
    ALTER TABLE public.planos DROP COLUMN IF EXISTS modulos_jsonb;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'planos'
      AND column_name = 'modulos_jsonb'
      AND udt_name = 'jsonb'
  ) THEN
    ALTER TABLE public.planos RENAME COLUMN modulos_jsonb TO modulos;
  END IF;
END
$$;

ALTER TABLE public.planos ALTER COLUMN modulos SET DEFAULT '[]'::jsonb;
UPDATE public.planos SET modulos = '[]'::jsonb WHERE modulos IS NULL;
```

2. Query de verificação pós-migração:

```sql
select id, jsonb_typeof(modulos), jsonb_array_length(modulos) from public.planos;
```

#### Local esperado do `.env` (dev e build/start)

- **`npm run dev` (executado em `backend/`)**: o backend procura primeiro `../.env` (raiz do repositório).
- **`npm run start` (após `npm run build`)**: o backend também tenta primeiro o `.env` da raiz via `process.cwd()`.
- Se não encontrar na raiz, o bootstrap tenta caminhos de fallback usados no build (`backend/.env` e resoluções relativas a `dist/`).
- No boot, o backend escreve no log o caminho efetivamente carregado para facilitar validação em produção (sem imprimir valores de variáveis).

### Segredo do token de autenticação

O backend **não inicia** sem um segredo explícito para assinar os tokens JWT. Defina a variável
`AUTH_TOKEN_SECRET` (ou uma das alternativas `JWT_SECRET`/`TOKEN_SECRET`) com um valor forte e único
antes de executar `npm run dev` ou publicar o serviço. Em ambientes de contêiner/Docker, exporte a
variável na orquestração (Compose, Kubernetes, etc.) para evitar subir instâncias com segredos
padrão.

### Limite padrão de payloads JSON

As rotas autenticadas agora utilizam limite padrão de 1 MB para requisições JSON e `application/x-www-form-urlencoded`.
Os endpoints `POST /api/support/:id/messages` e `POST /api/clientes/:clienteId/documentos` continuam aceitando
cargas de até 50 MB por receberem anexos em Base64. Ajuste integrações que enviam arquivos em JSON para utilizar
os caminhos dedicados ou o fluxo de upload multipart (`POST /api/uploads`).

### Endpoint `GET /api/clientes/ativos/total`

Após a migração para Supabase, o endpoint `GET /api/clientes/ativos/total` deve retornar um payload
simples para uso em métricas:

```json
{ "total": 42 }
```

Contrato atual:

- Consulta em `clientes` com `count: 'exact'`;
- Filtro obrigatório `idempresa = empresa do usuário autenticado`;
- Filtro obrigatório `ativo = true`;
- Sem paginação (`data`, `page`, `limit` e `totalPages` não fazem parte dessa resposta);
- O endpoint `GET /api/clientes` continua dedicado à listagem paginada normal.

### Integração com notificações do PJE

Para habilitar o agendamento automático de webhooks com o PJE, defina as
seguintes variáveis de ambiente antes de iniciar o backend:

| Variável              | Descrição                                                                 |
| --------------------- | ------------------------------------------------------------------------- |
| `PJE_CLIENT_ID`       | Identificador do cliente cadastrado no PJE para obter o token OAuth2.     |
| `PJE_CLIENT_SECRET`   | Segredo associado ao cliente, utilizado na geração do token de acesso.    |
| `PJE_WEBHOOK_URL`     | URL pública do seu backend que receberá as notificações enviadas pelo PJE. |

Com esses valores configurados, o serviço agenda rotinas para renovar tokens
expirados e revalidar a assinatura do webhook automaticamente.

### Integração com Asaas

Para consumir a API de cobranças do Asaas por meio das credenciais gerenciadas
em `integration_api_keys`:

1. Execute novamente o script `psql -f sql/integration_api_keys.sql` para
   garantir a presença da coluna `url_api` e do provedor `asaas` no `CHECK`.
2. Cadastre uma chave com `provider` igual a `asaas` (via API ou tela de
   configurações) informando o token de acesso do Asaas.
3. Se o campo `url_api` não for preenchido, o backend assumirá automaticamente
   os endpoints padrão:
   - Produção: `https://api.asaas.com/api/v3`
   - Homologação: `https://sandbox.asaas.com/api/v3`
4. Utilize o endpoint `POST /api/integrations/providers/asaas/validate` para
   testar a conexão após o cadastro da chave.

Não são necessárias variáveis de ambiente adicionais além das credenciais
registradas na tabela.

### Supabase: RLS obrigatório para multi-tenant

Na migração de PostgreSQL para Supabase, um erro comum é manter tabelas multi-tenant
sem Row Level Security (RLS). Isso permite leitura/escrita cruzada entre empresas
quando o frontend usa chave `anon` com usuário autenticado.

Para corrigir, execute:

```bash
psql "$DATABASE_URL" -f backend/sql/supabase_rls_policies.sql
```

O script:

1. Cria a função helper `public.current_empresa_id()` com base em
   `public.usuarios.auth_user_id -> auth.users.id`.
2. Faz diagnóstico pós-migração (`usuarios.auth_user_id` nulo) e orienta rodar
   `backend/sql/supabase_auth_empresa_fix.sql` quando necessário.
3. Habilita e força RLS nas tabelas multi-tenant usadas por
   `createCrudController` em `backend/src/routes/`.
4. Cria políticas `SELECT/INSERT/UPDATE/DELETE` com `USING` e `WITH CHECK`
   usando a coluna real de empresa (`idempresa` ou `empresa`) de cada tabela.
5. Para tabelas globais (`planos`, `categorias`, `situacao_cliente`,
   `tipo_envolvimento`, `notifications`, `support_requests`), aplica leitura para
   `authenticated` e escrita apenas para `service_role`.
6. Em `empresas`, aplica leitura restrita à empresa do usuário
   (`id = public.current_empresa_id()`) e escrita só por `service_role`.

#### Mapeamento das tabelas CRUD e escopo RLS

| Tabela (`createCrudController`) | Tipo | Coluna para policy |
| --- | --- | --- |
| `area_atuacao` | multi-tenant | `idempresa` |
| `perfis` | multi-tenant | `idempresa` |
| `situacao_processo` | multi-tenant | `idempresa` |
| `situacao_proposta` | multi-tenant | `idempresa` |
| `etiquetas` | multi-tenant | `idempresa` |
| `escritorios` | multi-tenant | `empresa` |
| `tipo_processo` | multi-tenant | `idempresa` |
| `tipo_evento` | multi-tenant | `idempresa` |
| `tipo_documento` | multi-tenant | `idempresa` |
| `fornecedores` | multi-tenant | `idempresa` |
| `fluxo_trabalho` | multi-tenant | `idempresa` |
| `templates` | multi-tenant | `idempresa` |
| `tarefas` | multi-tenant | `idempresa` |
| `agenda` | multi-tenant | `idempresa` |
| `intimacoes` | multi-tenant | `idempresa` |
| `usuarios` | multi-tenant | `empresa` |
| `clientes` | multi-tenant | `idempresa` |
| `oportunidades` | multi-tenant | `idempresa` |
| `processos` | multi-tenant | `idempresa` |
| `planos` | global | sem coluna de empresa |
| `categorias` | global | sem coluna de empresa |
| `situacao_cliente` | global | sem coluna de empresa |
| `tipo_envolvimento` | global | sem coluna de empresa |
| `notifications` | global | sem coluna de empresa |
| `support_requests` | global | sem coluna de empresa |
| `empresas` | global restrita ao tenant do usuário | `id` (comparado com `current_empresa_id()`) |

#### Checklist de validação RLS pós-deploy

- [ ] Rodar `backend/sql/supabase_auth_empresa_fix.sql` em bases migradas se o diagnóstico indicar `auth_user_id` nulo.
- [ ] Rodar `backend/sql/supabase_rls_policies.sql` no projeto Supabase correto.
- [ ] Confirmar `current_empresa_id()` retornando empresa para usuário autenticado de teste.
- [ ] Confirmar `SELECT` em tabela multi-tenant retorna apenas registros da própria empresa.
- [ ] Confirmar `INSERT/UPDATE/DELETE` multi-tenant bloqueiam `idempresa/empresa` divergente.
- [ ] Confirmar tabelas globais aceitam `SELECT` por `authenticated` e rejeitam escrita sem `service_role`.
- [ ] Confirmar tabela `empresas` só retorna a empresa do usuário autenticado.
- [ ] Revisar no painel Supabase se todas as tabelas mapeadas estão com RLS `enabled` + `forced`.

Após rodar, valide o estado de RLS com a consulta final do próprio script.

### Estrutura de sincronização de processos

Os eventos de requisição e resposta das sincronizações são persistidos automaticamente
pelas novas tabelas:

- `process_sync`: fila de solicitações abertas pelo CRM. Depende de
  `public.processos(id)`, `public.integration_api_keys(id)` e opcionalmente
  `public.usuarios(id)`.
- `process_response`: armazenamentos de webhooks e callbacks recebidos. Possui
  FKs para `process_sync`, `processos` e `integration_api_keys`.
- `sync_audit`: trilha de auditoria consolidada que referencia as duas tabelas
  anteriores e mantém metadados do evento.

> 💡 Execute `psql -f sql/process_sync.sql`, `psql -f sql/process_response.sql`
> e `psql -f sql/sync_audit.sql` em bancos legados antes de iniciar o backend
> para garantir a criação idempotente da estrutura.

### Monitoramento de OABs

Os números de OAB monitorados por empresa são persistidos na tabela
`oab_monitoradas`. O backend garante a criação automática dessa
estrutura ao iniciar e a utiliza para listar e cadastrar OABs vinculadas às
rotinas de intimações. 【F:backend/src/services/oabMonitorService.ts†L21-L125】

Para relacionar processos existentes, é possível criar um histórico inicial
preenchendo `process_sync` manualmente. Exemplo:


Após a inserção, o próximo webhook será associado ao registro via
`remote_request_id` ou pelo número do processo.

### Agendamento automático de intimações (Supabase)

> **Provisionamento oficial por migration.** A rotina de agendamento automático
> de intimações é aplicada pela migration
> `supabase/migrations/20260219140000_intimacoes_scheduler.sql`. O script manual
> `backend/sql/supabase_intimacoes_scheduler.sql` permanece como referência
> operacional e fallback, mas **não precisa mais ser executado manualmente** em
> ambientes que acompanham o fluxo de migrações.

#### Pré-requisitos

Antes de aplicar (ou logo após a migration rodar), valide os pré-requisitos:

```sql
select * from public.check_intimacoes_scheduler_prereqs();
```

Se algum item retornar `ok = false`:

1. Extensões faltantes (`pg_cron`, `pg_net`): habilite-as em **Database > Extensions** no painel Supabase.
2. Parâmetros ausentes: configure em **Database > Settings > Parameters**:
   - `app.settings.supabase_url` = `https://<project-ref>.supabase.co`
   - `app.settings.service_role_key` = `<service-role-key>`

#### O que a migration cria

- Extensões `pg_cron` e `pg_net` (idempotente);
- Tabela de auditoria `public.sync_intimacoes_log` (status, duração, erro e contadores);
- Função `public.orquestrar_sync_intimacoes_oab(...)` que:
  - lê `public.oab_monitoradas` com `tipo='intimacoes'`;
  - respeita filtro por `dias_semana` quando preenchido;
  - usa `sync_from` por OAB e fallback configurável (`p_fallback_days`) para janela de datas;
  - chama a Edge Function `sync-intimacoes-oab` para cada OAB monitorada;
  - evita execução concorrente (advisory lock), melhorando idempotência operacional;
- Helpers de agendamento:
  - `public.configurar_agendamento_sync_intimacoes(...)`
  - `public.pausar_agendamento_sync_intimacoes()`;
- Job padrão `sync-intimacoes-oab-job` agendado a cada 30 minutos via `cron.schedule`.

#### Exemplos de uso

```sql
-- Reconfigurar para a cada 2 horas:
select public.configurar_agendamento_sync_intimacoes('0 */2 * * *');

-- Reconfigurar para a cada 15 minutos:
select public.configurar_agendamento_sync_intimacoes('*/15 * * * *');

-- Pausar temporariamente:
select public.pausar_agendamento_sync_intimacoes();

-- Verificar que o job existe no pg_cron:
select * from cron.job where jobname = 'sync-intimacoes-oab-job';

-- Ver últimos logs de execução:
select *
from public.sync_intimacoes_log
order by started_at desc
limit 20;
```

#### Endpoint manual (fallback)

O endpoint `POST /api/intimacoes/sync` continua disponível como gatilho sob
demanda. Use-o para forçar sincronização imediata ou como fallback operacional
caso o pg_cron precise ser desativado temporariamente.

> ℹ️ Idempotência de dados: a migration também reforça unicidade em `intimacoes`
> por `(idempresa, "siglaTribunal", external_id)`, prevenindo duplicidades em
> rodadas repetidas.

## Frontend

```bash
cd frontend
npm install
# opcional: export VITE_API_URL=http://localhost:3001/api
npm run dev
```

Após iniciar, acesse o frontend em `http://localhost:5173` e utilize o menu **Documentos** para gerenciar templates.

## Integração com cobranças Asaas

### Variáveis de ambiente

Configure as seguintes variáveis antes de iniciar o backend. Utilize o arquivo [`.env.example`](./.env.example) como referência:

| Variável               | Descrição                                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ASAAS_API_URL`        | URL base da API. Utilize `https://sandbox.asaas.com/api/v3` no ambiente de testes.                                                                  |
| `ASAAS_ACCESS_TOKEN`   | Token pessoal ou de aplicação gerado no painel do Asaas (`Configurações > Integrações > API`).                                                       |
| `ASAAS_WEBHOOK_SECRET` | Segredo configurado no webhook para validar a assinatura `x-asaas-signature`.                                                                       |
| `ASAAS_ENVIRONMENT`    | Ambiente utilizado ao consumir a API. Aceita `homologacao` (padrão) ou os aliases de produção `producao`, `produção`, `production`, `prod` e `live`. |

### SMTP para envio de e-mails

Para que o fluxo de confirmação de cadastro funcione, defina as credenciais do servidor SMTP utilizado pela sua organização:

| Variável                    | Descrição |
| --------------------------- | --------- |
| `SMTP_HOST`                 | Hostname do servidor SMTP (ex.: `smtp.seuprovedor.com`). |
| `SMTP_PORT`                 | Porta utilizada na conexão (`587` para STARTTLS, `465` para TLS direto). |
| `SMTP_SECURE`               | Informe `true` quando o servidor exige TLS direto na conexão (porta 465). Para STARTTLS utilize `false`. |
| `SMTP_REJECT_UNAUTHORIZED`  | Mantenha `true` para validar o certificado. Ajuste para `false` apenas em ambientes de teste com certificados autoassinados. |
| `SMTP_USER` e `SMTP_PASSWORD` | Credenciais válidas no servidor SMTP. |
| `SMTP_FROM`                 | **Obrigatório.** Endereço remetente padrão (deve corresponder a um endereço autorizado pelo servidor). |
| `SMTP_FROM_NAME`            | Nome exibido no remetente dos e-mails (opcional). |

> 💡 Defina as mesmas chaves no ambiente de build do frontend caso ele consuma endpoints intermediários (`VITE_API_URL`).

### Como obter o token de acesso
1. Acesse o painel do Asaas com um usuário administrador.
2. Navegue até **Configurações > Integrações > API**.
3. Gere um token para o ambiente desejado (produção ou sandbox) e copie-o imediatamente.
4. Armazene o valor no cofre corporativo e preencha `ASAAS_ACCESS_TOKEN` no arquivo `.env` do backend.

### Configuração de webhooks
1. Em **Configurações > Integrações > Webhooks**, crie uma nova assinatura apontando para `https://<sua-api>/api/asaas/webhooks`.
2. Ative ao menos os eventos `CUSTOMER_CREATED`, `CUSTOMER_UPDATED`, `PAYMENT_CREATED`, `PAYMENT_CONFIRMED` e `PAYMENT_FAILED`.
3. Informe um segredo forte (32+ caracteres) e replique o valor em `ASAAS_WEBHOOK_SECRET`.
4. Utilize o botão **Enviar teste** do Asaas para confirmar que o endpoint retorna `200 OK`.

#### Eventos disponíveis

- `cliente.criado` — enviado quando um cliente é cadastrado no CRM.
- `cliente.atualizado` — emitido ao atualizar dados cadastrais de um cliente existente.
- `processo.movimentado` — publicado após registrar uma nova movimentação em processos acompanhados.
- `oab.processo.incluida` — gerado ao cadastrar ou atualizar uma OAB monitorada para processos.
- `oab.intimacao.incluida` — disparado quando uma OAB passa a ser monitorada para intimações.
- `tarefa.concluida` — entregue quando tarefas são finalizadas pela equipe.
- `financeiro.lancamento` — notifica integrações sobre criação ou alteração de lançamentos financeiros.

### Fluxo recomendado de cobrança
1. **Sincronize o cliente**: o CRM envia `externalId`, `name`, `email` e `cpfCnpj` para `/api/asaas/customers`. O cadastro só é criado caso o cliente esteja previamente sincronizado localmente.
2. **Gere a cobrança**: a API chama `/api/asaas/payments` informando `customerExternalId`, tipo (`PIX`, `BOLETO`, `CREDIT_CARD`) e valores.
3. **Acompanhe o status**: o webhook do Asaas atualiza as tabelas internas com o novo estado do pagamento (recebido, vencido ou cancelado).
4. **Notifique o cliente**: ao confirmar o pagamento via webhook, envie recibo ou libere o serviço contratado.

### Limitações conhecidas
- É obrigatório que o cliente exista e esteja sincronizado no Asaas antes de gerar cobranças; caso contrário, a API responde `404 customer not found`.
- As cobranças PIX expiram após 24 horas no ambiente padrão; use o campo `dueDate` para aumentar o prazo quando aplicável.
- O webhook precisa estar acessível publicamente; em ambientes locais utilize um túnel (ngrok, Cloudflare) ou o endpoint `/api/asaas/webhooks/mock` para simular eventos.

### Ferramentas de teste
- Utilize a coleção [docs/asaas.postman_collection.json](./docs/asaas.postman_collection.json) no Postman ou Bruno para executar o fluxo fim a fim (cliente → cobrança PIX → webhook simulado).
- Para rodar scripts customizados, adicione testes end-to-end no diretório `backend/tests` consumindo os mesmos endpoints descritos acima.

### Webhook da Uazapi (WhatsApp)
1. Cadastre uma chave em `integration_api_keys` com `provider = 'uazapi'` e defina `key_value` como o token que será validado no webhook.
2. Copie o `id` gerado para essa chave. Ele será utilizado como `credentialId` nas chamadas da Uazapi.
3. No painel da Uazapi, configure a URL pública do backend apontando para `https://<sua-api>/api/webhooks/uaz`, que é o endpoint único para todas as credenciais.
4. Inclua o `credentialId` e o token na chamada. A forma mais simples é adicionar `?credentialId=<id>&token=<token>` na URL ou enviar o token no cabeçalho `Authorization: Bearer <token>` e o `credentialId` em `X-Credential-Id`. O `handleUazWebhook` aceita ambos os parâmetros tanto via querystring quanto por cabeçalhos ou payload, então os tokens enviados diretamente pelo painel da Uazapi são reconhecidos automaticamente.
5. Ative o webhook no painel da Uazapi para que eventos de mensagens e status sejam encaminhados diretamente ao backend.

O endpoint rejeita requisições sem credenciais válidas e processa automaticamente as mensagens recebidas, anexos e atualizações de status relacionadas às conversas vinculadas à credencial.

### Credenciais padrão/fallback da Uazapi

Ambientes novos podem carregar imediatamente o envio de mensagens, sincronização, QR Code e webhooks definindo as variáveis abaixo no `.env`. Elas alimentam o stub `chatCredentialStub` utilizado pelo backend sempre que não existir registro na tabela `uaz_credentials`.

| Variável                | Descrição |
| ----------------------- | --------- |
| `UAZ_API_SUBDOMAIN`     | Subdomínio informado pela Uazapi para montar o endpoint (`https://<subdomínio>.uazapi.com`). |
| `UAZ_API_TOKEN`         | Token de acesso utilizado nas chamadas `message/send`, `message/find` e `instance/qr-code`. |
| `UAZ_API_CREDENTIAL_ID` | Opcional. Identificador exibido no CRM para associar conversas ao stub (padrão `uaz-default`). |
| `ADMIN_TOKEN_UAZAPI`    | Token administrativo fornecido pela Uazapi para operações de manutenção (utilize o mesmo valor cadastrado no painel). |
| `UAZ_SSE_URL`           | URL base consumida pelo cliente SSE interno; o backend normaliza automaticamente para o endpoint `/sse`. |
| `UAZ_SSE_TOKEN`         | Token de autenticação exigido pelo endpoint `/sse` para abrir o stream de eventos. |
| `UAZ_SSE_ENABLED`       | Opcional. Mantém o serviço SSE ativo por padrão (`true`). Defina `false` para não iniciar o consumidor interno. |

Alias aceitos para a URL: `UAZ_SSE_BASE_URL`, `UAZ_SSE_SERVER_URL` e `UAZ_API_SSE_URL`. Para o token também são válidas as variáveis `UAZ_API_SSE_TOKEN` e `UAZ_EVENT_TOKEN`.

> 💡 O backend tenta primeiro localizar a credencial no banco. Quando não encontra, reutiliza automaticamente os valores acima para evitar erros `404` em ambientes recém-provisionados.

### Provisionamento dos tokens SSE da Uazapi

1. Reúna `credentialId`, `sseToken` e, se existir, a `baseUrl` específica de cada instância diretamente no painel administrativo da Uazapi ou utilizando a planilha compartilhada no cofre seguro da equipe. Salve tudo em um arquivo CSV local chamado `uaz_sse_tokens.csv` com o cabeçalho `credential_id,sse_token,sse_base_url`.
2. Execute `psql "$DATABASE_URL" -f backend/sql/uaz_credentials_sse_tokens.sql` para criar a tabela auxiliar `ops_uaz_sse_tokens` (caso ainda não exista) e preencher `https://sse.uazapi.com` como base padrão em registros que estejam nulos.
3. Carregue os dados coletados para a tabela auxiliar com `psql "$DATABASE_URL" -c "\copy ops_uaz_sse_tokens (credential_id,sse_token,sse_base_url) FROM 'uaz_sse_tokens.csv' WITH CSV HEADER"`. O arquivo deve permanecer fora do repositório e dentro do cofre seguro.
4. Execute novamente `psql "$DATABASE_URL" -f backend/sql/uaz_credentials_sse_tokens.sql` para aplicar os tokens em `uaz_credentials`. O script usa os valores da tabela auxiliar, mantém `https://sse.uazapi.com` como fallback para `sse_base_url` e limpa `ops_uaz_sse_tokens` ao final.
5. Repita o fluxo sempre que um ambiente novo precisar receber tokens SSE. Basta atualizar o CSV com as credenciais necessárias e repetir os passos 2 a 4.

### Documentação da API Uazapi (manutenção)

- **Onde procurar no código**: [docs/api-uazapi.md](./docs/api-uazapi.md) – serviços, rotas, webhooks, tabelas e checklist de manutenção.
- **Especificação OpenAPI**: [docs/uazapi-openapi-spec.yaml](./docs/uazapi-openapi-spec.yaml) – spec completa (endpoints, schemas, exemplos). Para visualizar a documentação interativa, carregue esse arquivo no [Swagger Editor](https://editor.swagger.io/) ou no Redoc.
- **Referência à spec**: [docs/openapi-uazapi-reference.md](./docs/openapi-uazapi-reference.md).
- **Contrato interno de agenda**: [docs/agenda-endpoint-contrato.md](./docs/agenda-endpoint-contrato.md) – define `/api/agendas` como rota preferível no frontend, mantendo compatibilidade com `/api/agendamentos`.

## Produção

### Backend

```bash
cd backend
npm run build
# O backend carrega o .env da raiz. Defina SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.
npm start
```

`DATABASE_URL` no `.env` da raiz é opcional e deve ser usado para scripts `psql` manuais.
Ele não substitui as variáveis obrigatórias `SUPABASE_*` para subir a API.

Após a migração para Supabase, a sincronização deve ser feita exclusivamente por
Edge Functions. Configure no backend os nomes das funções:

- `INTIMACOES_SYNC_FUNCTION_NAME` (padrão: `sync-intimacoes-oab`)
- `PROCESSOS_SYNC_FUNCTION_NAME` (padrão: `sync-processos-pdpj`)


As variáveis legadas de webhook (`URL_WEBHOOK_SINCRONIZAR*`) não são necessárias
no fluxo atual.

### Checklist pós-migração de secrets (Edge Functions)

Para que as funções de sincronização operem corretamente, cadastre os seguintes secrets no painel do Supabase (Edge Functions > Secrets) ou via CLI:

| Secret | Obrigatório? | Descrição |
| --- | --- | --- |
| `SUPABASE_URL` | Sim | URL do projeto (ex.: `https://<ref>.supabase.co`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Chave `service_role` para operações admin no banco. |
| `PDPJ_TOKEN` ou `PDPJ_BEARER_TOKEN` | Sim | Token de acesso à API do PDPJ (Portal de Serviços). |

> ⚠️ **Importante**: Em caso de múltiplos ambientes (dev, homologação, producao), certifique-se de replicar esses secrets em **cada projeto Supabase correspondente**. A falta deles resultará em erro 500 intermitente na função `sync-processos-pdpj`.

### Frontend

```bash
cd frontend
npm run build
# os arquivos ficarão disponíveis em ./frontend/dist
```

Se a pasta `frontend/dist` estiver presente, o backend servirá automaticamente
o frontend estático, inclusive na imagem Docker fornecida. Caso prefira usar
um servidor HTTP dedicado (Caddy, Nginx, etc.), basta apontar o `root` para
`./frontend/dist`.

## Chat no Supabase: schema canônico

Após a migração para Supabase, o módulo de chat deve usar somente a stack canônica:

- `public.conversations`
- `public.messages`
- `public.message_attachments`

As tabelas legadas (`chat_conversations` e `uazapi_conversations`) não devem ser reintroduzidas.
Veja o racional, mapeamento de uso no código e plano de descomissionamento em:

- [docs/chat-schema-canonico.md](./docs/chat-schema-canonico.md)
