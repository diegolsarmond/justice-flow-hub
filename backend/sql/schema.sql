-- public.area_atuacao definição

-- Drop table

-- DROP TABLE public.area_atuacao;

CREATE TABLE public.area_atuacao ( id serial4 NOT NULL, nome text NOT NULL, ativo bool DEFAULT true NOT NULL, datacriacao timestamp DEFAULT now() NOT NULL, idempresa int4 NULL, CONSTRAINT area_atuacao_pkey PRIMARY KEY (id));


-- public.asaas_charges definição

-- Drop table

-- DROP TABLE public.asaas_charges;

CREATE TABLE public.asaas_charges ( id bigserial NOT NULL, financial_flow_id text NOT NULL, cliente_id int4 NULL, integration_api_key_id int8 NULL, asaas_charge_id text NOT NULL, billing_type text NOT NULL, status text NOT NULL, due_date date NOT NULL, value numeric NOT NULL, invoice_url text NULL, pix_payload text NULL, pix_qr_code text NULL, boleto_url text NULL, card_last4 text NULL, card_brand text NULL, raw_response jsonb NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, credential_id int8 NULL, last_event text NULL, payload jsonb NULL, paid_at timestamptz NULL, CONSTRAINT asaas_charges_billing_type_check CHECK ((billing_type = ANY (ARRAY['PIX'::text, 'BOLETO'::text, 'CREDIT_CARD'::text]))), CONSTRAINT asaas_charges_pkey PRIMARY KEY (id), CONSTRAINT uq_asaas_charges_financial_flow UNIQUE (financial_flow_id));
CREATE INDEX idx_asaas_charges_asaas_charge_id ON public.asaas_charges USING btree (asaas_charge_id);
CREATE INDEX idx_asaas_charges_status ON public.asaas_charges USING btree (status);


-- public.asaas_credentials definição

-- Drop table

-- DROP TABLE public.asaas_credentials;

CREATE TABLE public.asaas_credentials ( id serial4 NOT NULL, integration_api_key_id int8 NULL, webhook_secret text NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, idempresa int8 NULL, CONSTRAINT asaas_credentials_integration_api_key_id_key UNIQUE (integration_api_key_id), CONSTRAINT asaas_credentials_pkey PRIMARY KEY (id));


-- public.asaas_customers definição

-- Drop table

-- DROP TABLE public.asaas_customers;

CREATE TABLE public.asaas_customers ( cliente_id int8 NOT NULL, integration_api_key_id int8 NOT NULL, asaas_customer_id text NULL, status text DEFAULT 'pending'::text NOT NULL, synced_at timestamptz NULL, last_payload jsonb NULL, CONSTRAINT asaas_customers_pkey PRIMARY KEY (cliente_id, integration_api_key_id));
CREATE UNIQUE INDEX uq_asaas_customers_cliente_integration ON public.asaas_customers USING btree (cliente_id, integration_api_key_id);


-- public.blog_posts definição

-- Drop table

-- DROP TABLE public.blog_posts;

CREATE TABLE public.blog_posts ( id uuid NOT NULL, title text NOT NULL, description text NOT NULL, "content" text NULL, author text NOT NULL, published_at timestamptz NOT NULL, read_time text NOT NULL, category int4 NOT NULL, image text NULL, slug text NOT NULL, tags _text DEFAULT '{}'::text[] NOT NULL, featured bool DEFAULT false NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT blog_posts_pkey PRIMARY KEY (id), CONSTRAINT blog_posts_slug_key UNIQUE (slug));
CREATE INDEX idx_blog_posts_published_at ON public.blog_posts USING btree (published_at DESC, created_at DESC);


-- public.categorias definição

-- Drop table

-- DROP TABLE public.categorias;

CREATE TABLE public.categorias ( id serial4 NOT NULL, nome text NOT NULL, ativo bool DEFAULT true NOT NULL, datacriacao timestamp DEFAULT now() NOT NULL, CONSTRAINT categorias_nome_key UNIQUE (nome), CONSTRAINT categorias_pkey PRIMARY KEY (id));
CREATE INDEX idx_categorias_nome ON public.categorias USING btree (nome);


-- public.categories definição

-- Drop table

-- DROP TABLE public.categories;

CREATE TABLE public.categories ( id serial4 NOT NULL, "name" text NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT categories_name_key UNIQUE (name), CONSTRAINT categories_pkey PRIMARY KEY (id));
CREATE INDEX idx_categories_name ON public.categories USING btree (name);


-- public.cliente_atributos definição

-- Drop table

-- DROP TABLE public.cliente_atributos;

CREATE TABLE public.cliente_atributos ( id bigserial NOT NULL, idclientes int8 NOT NULL, idtipodocumento int4 NOT NULL, valor text NOT NULL, datacadastro timetz DEFAULT now() NOT NULL, CONSTRAINT cliente_atributos_pk PRIMARY KEY (id));


-- public.cliente_documento definição

-- Drop table

-- DROP TABLE public.cliente_documento;

CREATE TABLE public.cliente_documento ( id serial4 NOT NULL, cliente_id int4 NOT NULL, tipo_documento_id int4 NOT NULL, nome_arquivo varchar(255) NOT NULL, arquivo_base64 text NOT NULL, data_upload timestamp DEFAULT now() NULL, CONSTRAINT cliente_documento_pkey PRIMARY KEY (id));


-- public.email_confirmation_tokens definição

-- Drop table

-- DROP TABLE public.email_confirmation_tokens;

CREATE TABLE public.email_confirmation_tokens ( id serial4 NOT NULL, user_id int4 NOT NULL, token_hash text NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT email_confirmation_tokens_pkey PRIMARY KEY (id), CONSTRAINT email_confirmation_tokens_token_hash_key UNIQUE (token_hash));
CREATE INDEX idx_email_confirmation_tokens_user_active ON public.email_confirmation_tokens USING btree (user_id);


-- public.empresas definição

-- Drop table

-- DROP TABLE public.empresas;

CREATE TABLE public.empresas ( id serial4 NOT NULL, nome_empresa text NOT NULL, cnpj varchar(18) NULL, telefone varchar NULL, email varchar NULL, plano int4 NULL, responsavel int4 NULL, ativo bool DEFAULT true NOT NULL, datacadastro timestamp DEFAULT now() NOT NULL, trial_started_at timestamptz NULL, trial_ends_at timestamptz NULL, current_period_start timestamptz NULL, current_period_end timestamptz NULL, grace_expires_at timestamptz NULL, subscription_cadence text DEFAULT 'monthly'::text NULL, subscription_trial_ends_at timestamptz NULL, subscription_current_period_ends_at timestamptz NULL, subscription_grace_period_ends_at timestamptz NULL, asaas_subscription_id text NULL, asaas_customer_id text NULL, subscription_status text DEFAULT 'inactive'::text NULL, subscription_pending_plan text NULL, CONSTRAINT empresas_cnpj_key UNIQUE (cnpj), CONSTRAINT empresas_pkey PRIMARY KEY (id), CONSTRAINT empresas_subscription_cadence_check CHECK ((subscription_cadence = ANY (ARRAY['monthly'::text, 'annual'::text]))), CONSTRAINT empresas_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['pending'::text, 'active'::text, 'grace'::text, 'inactive'::text, 'overdue'::text]))));


-- public.escritorios definição

-- Drop table

-- DROP TABLE public.escritorios;

CREATE TABLE public.escritorios ( id serial4 NOT NULL, nome text NOT NULL, empresa int4 NOT NULL, ativo bool DEFAULT true NOT NULL, datacriacao timestamp DEFAULT now() NOT NULL, CONSTRAINT escritorios_unique UNIQUE (id));


-- public.etiquetas definição

-- Drop table

-- DROP TABLE public.etiquetas;

CREATE TABLE public.etiquetas ( id serial4 NOT NULL, nome text NOT NULL, ativo bool DEFAULT true NOT NULL, datacriacao timestamp DEFAULT now() NOT NULL, exibe_pipeline bool DEFAULT true NOT NULL, ordem int4 NOT NULL, id_fluxo_trabalho int4 NOT NULL, idempresa int4 NULL, CONSTRAINT etiquetas_unique UNIQUE (id));


-- public.financial_flows definição

-- Drop table

-- DROP TABLE public.financial_flows;

CREATE TABLE public.financial_flows ( id uuid DEFAULT gen_random_uuid() NOT NULL, tipo text NOT NULL, conta_id uuid NULL, categoria_id uuid NULL, descricao text NULL, vencimento date NULL, pagamento date NULL, competencia text NULL, valor numeric NOT NULL, valor_pago numeric NULL, status text DEFAULT 'pendente'::text NULL, parcelas jsonb NULL, recorrente bool DEFAULT false NULL, anexos jsonb DEFAULT '[]'::jsonb NULL, created_by uuid NULL, created_at timestamptz DEFAULT now() NULL, updated_at timestamptz DEFAULT now() NULL, external_provider text NULL, external_reference_id text NULL, cliente_id int8 NULL, fornecedor_id int8 NULL, idempresa int4 NULL, empresa_id int8 NULL, empresa varchar NULL, CONSTRAINT financial_flows_pkey PRIMARY KEY (id));


-- public.fluxo_trabalho definição

-- Drop table

-- DROP TABLE public.fluxo_trabalho;

CREATE TABLE public.fluxo_trabalho ( id serial4 NOT NULL, nome text NOT NULL, ativo bool DEFAULT true NOT NULL, datacriacao timestamp DEFAULT now() NOT NULL, exibe_menu bool DEFAULT true NOT NULL, ordem int4 NULL, idempresa int4 NULL, CONSTRAINT fluxo_trabalho_unique UNIQUE (id));


-- public.fornecedores definição

-- Drop table

-- DROP TABLE public.fornecedores;

CREATE TABLE public.fornecedores ( id serial4 NOT NULL, nome text NOT NULL, tipo text NULL, documento text NULL, email text NULL, telefone text NULL, cep text NULL, rua text NULL, numero text NULL, complemento text NULL, bairro text NULL, cidade text NULL, uf text NULL, ativo bool DEFAULT true NOT NULL, idempresa int4 NULL, datacadastro timestamp DEFAULT now() NOT NULL, CONSTRAINT fornecedores_pkey PRIMARY KEY (id));
CREATE INDEX fornecedores_idempresa_idx ON public.fornecedores USING btree (idempresa);


-- public.integration_api_keys definição

-- Drop table

-- DROP TABLE public.integration_api_keys;

CREATE TABLE public.integration_api_keys ( id bigserial NOT NULL, provider text NOT NULL, url_api text NULL, key_value text NOT NULL, environment text NOT NULL, active bool DEFAULT true NOT NULL, last_used timestamptz NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, "global" bool DEFAULT false NOT NULL, idempresa int8 NULL, CONSTRAINT integration_api_keys_id_pk PRIMARY KEY (id));
CREATE INDEX idx_integration_api_keys_active ON public.integration_api_keys USING btree (active);
CREATE INDEX idx_integration_api_keys_provider ON public.integration_api_keys USING btree (provider);


-- public.integrations definição

-- Drop table

-- DROP TABLE public.integrations;

CREATE TABLE public.integrations ( id serial4 NOT NULL, instance_name varchar(150) NOT NULL, base_url text NOT NULL, "owner" varchar(20) NULL, "token" uuid NOT NULL, created_at timestamp DEFAULT now() NULL, updated_at timestamp DEFAULT now() NULL, CONSTRAINT integrations_pkey PRIMARY KEY (id), CONSTRAINT integrations_token_key UNIQUE (token));

-- Table Triggers

create trigger trg_update_integrations_timestamp before
update
    on
    public.integrations for each row execute function update_integrations_updated_at();


-- public.labels definição

-- Drop table

-- DROP TABLE public.labels;

CREATE TABLE public.labels ( id text DEFAULT gen_random_uuid() NOT NULL, "name" text NOT NULL, color text DEFAULT '#00a884'::text NOT NULL, company_id int8 NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT labels_pkey PRIMARY KEY (id));
CREATE INDEX idx_labels_company_id ON public.labels USING btree (company_id);


-- public.notification_preferences definição

-- Drop table

-- DROP TABLE public.notification_preferences;

CREATE TABLE public.notification_preferences ( user_id text NOT NULL, preferences jsonb NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id));


-- public.notifications definição

-- Drop table

-- DROP TABLE public.notifications;

CREATE TABLE public.notifications ( id bigserial NOT NULL, user_id text NOT NULL, category text NOT NULL, "type" text DEFAULT 'info'::text NOT NULL, title text NOT NULL, message text NOT NULL, metadata jsonb NULL, action_url text NULL, "read" bool DEFAULT false NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, read_at timestamptz NULL, CONSTRAINT notifications_pkey PRIMARY KEY (id), CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'error'::text]))));
CREATE INDEX idx_notifications_user_category ON public.notifications USING btree (user_id, category);
CREATE INDEX idx_notifications_user_created_at ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id);


-- public.oab_monitoradas definição

-- Drop table

-- DROP TABLE public.oab_monitoradas;

CREATE TABLE public.oab_monitoradas ( id bigserial NOT NULL, empresa_id int4 NOT NULL, usuario_id int4 NULL, tipo text NOT NULL, uf bpchar(2) NOT NULL, numero varchar(20) NOT NULL, dias_semana _int2 NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, sync_from date NULL, CONSTRAINT oab_monitoradas_pkey PRIMARY KEY (id));
CREATE UNIQUE INDEX oab_monitoradas_empresa_tipo_uf_numero_idx ON public.oab_monitoradas USING btree (empresa_id, tipo, uf, numero);


-- public.oportunidade_documentos definição

-- Drop table

-- DROP TABLE public.oportunidade_documentos;

CREATE TABLE public.oportunidade_documentos ( id serial4 NOT NULL, oportunidade_id int4 NOT NULL, template_id int4 NULL, title text NOT NULL, "content" text NOT NULL, variables jsonb DEFAULT '{}'::jsonb NOT NULL, created_at timestamp DEFAULT now() NOT NULL, CONSTRAINT oportunidade_documentos_pkey PRIMARY KEY (id));


-- public.oportunidade_envolvidos definição

-- Drop table

-- DROP TABLE public.oportunidade_envolvidos;

CREATE TABLE public.oportunidade_envolvidos ( id serial4 NOT NULL, oportunidade_id int4 NOT NULL, nome text NULL, documento text NULL, telefone text NULL, endereco text NULL, relacao text NULL, polo varchar NULL, CONSTRAINT oportunidade_envolvidos_pkey PRIMARY KEY (id));


-- public.oportunidade_faturamentos definição

-- Drop table

-- DROP TABLE public.oportunidade_faturamentos;

CREATE TABLE public.oportunidade_faturamentos ( id serial4 NOT NULL, oportunidade_id int4 NOT NULL, forma_pagamento text NOT NULL, condicao_pagamento text NULL, valor numeric(14, 2) NULL, parcelas int4 NULL, observacoes text NULL, data_faturamento timestamptz DEFAULT now() NULL, criado_em timestamptz DEFAULT now() NULL, CONSTRAINT oportunidade_faturamentos_pkey PRIMARY KEY (id));
CREATE INDEX idx_oportunidade_faturamentos_oportunidade ON public.oportunidade_faturamentos USING btree (oportunidade_id);


-- public.oportunidade_parcelas definição

-- Drop table

-- DROP TABLE public.oportunidade_parcelas;

CREATE TABLE public.oportunidade_parcelas ( id serial4 NOT NULL, oportunidade_id int4 NOT NULL, numero_parcela int4 NOT NULL, valor numeric(14, 2) NOT NULL, valor_pago numeric(14, 2) DEFAULT 0 NULL, status text DEFAULT 'pendente'::text NOT NULL, data_prevista date NULL, quitado_em timestamptz NULL, faturamento_id int4 NULL, criado_em timestamptz DEFAULT now() NULL, atualizado_em timestamptz DEFAULT now() NULL, idempresa int4 NULL, CONSTRAINT oportunidade_parcelas_pkey PRIMARY KEY (id));
CREATE INDEX idx_oportunidade_parcelas_status ON public.oportunidade_parcelas USING btree (oportunidade_id, status);
CREATE UNIQUE INDEX idx_oportunidade_parcelas_unique ON public.oportunidade_parcelas USING btree (oportunidade_id, numero_parcela);


-- public.oportunidade_sequence definição

-- Drop table

-- DROP TABLE public.oportunidade_sequence;

CREATE TABLE public.oportunidade_sequence ( empresa_id int4 NOT NULL, atual int4 NOT NULL, CONSTRAINT oportunidade_sequence_pkey PRIMARY KEY (empresa_id));


-- public.oportunidades definição

-- Drop table

-- DROP TABLE public.oportunidades;

CREATE TABLE public.oportunidades ( id serial4 NOT NULL, tipo_processo_id int4 NOT NULL, area_atuacao_id int4 NULL, responsavel_id int4 NULL, numero_processo_cnj text NULL, numero_protocolo text NULL, vara_ou_orgao text NULL, comarca text NULL, fase_id int4 NULL, etapa_id int4 NULL, prazo_proximo date NULL, status_id int4 NULL, solicitante_id int4 NULL, valor_causa numeric NULL, valor_honorarios numeric NULL, percentual_honorarios numeric NULL, forma_pagamento text NULL, contingenciamento text NULL, detalhes text NULL, documentos_anexados int4 NULL, criado_por int4 NULL, data_criacao timestamp DEFAULT now() NOT NULL, ultima_atualizacao timestamp DEFAULT now() NOT NULL, qtde_parcelas int4 NULL, idempresa int4 NULL, sequencial_empresa int4 NOT NULL, audiencia_data date NULL, audiencia_horario time NULL, audiencia_local text NULL, valor_entrada numeric NULL, CONSTRAINT oportunidades_pkey PRIMARY KEY (id));
CREATE UNIQUE INDEX idx_oportunidades_empresa_sequencial ON public.oportunidades USING btree (idempresa, sequencial_empresa);


-- public.ops_uaz_sse_tokens definição

-- Drop table

-- DROP TABLE public.ops_uaz_sse_tokens;

CREATE TABLE public.ops_uaz_sse_tokens ( credential_id text NOT NULL, sse_token text NOT NULL, sse_base_url text NULL, CONSTRAINT ops_uaz_sse_tokens_pkey PRIMARY KEY (credential_id));


-- public.password_reset_tokens definição

-- Drop table

-- DROP TABLE public.password_reset_tokens;

CREATE TABLE public.password_reset_tokens ( id serial4 NOT NULL, user_id int4 NOT NULL, token_hash text NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id), CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash));
CREATE INDEX idx_password_reset_tokens_user_active ON public.password_reset_tokens USING btree (user_id);


-- public.perfil_modulos definição

-- Drop table

-- DROP TABLE public.perfil_modulos;

CREATE TABLE public.perfil_modulos ( perfil_id int4 NOT NULL, modulo text NOT NULL, CONSTRAINT perfil_modulos_pkey PRIMARY KEY (perfil_id, modulo));


-- public.perfis definição

-- Drop table

-- DROP TABLE public.perfis;

CREATE TABLE public.perfis ( id serial4 NOT NULL, nome text NOT NULL, ativo bool DEFAULT true NOT NULL, datacriacao timestamp DEFAULT now() NOT NULL, idempresa int4 NULL, ver_todas_conversas bool DEFAULT true NOT NULL, CONSTRAINT perfis_unique UNIQUE (id));


-- public.planos definição

-- Drop table

-- DROP TABLE public.planos;

CREATE TABLE public.planos ( id serial4 NOT NULL, nome text NOT NULL, valor_mensal numeric(10, 2) NOT NULL, valor_anual numeric(10, 2) NOT NULL, limite_processos int4 NULL, limite_usuarios int4 NULL, recursos text NULL, modulos text NULL, limite_propostas int4 NULL, sincronizacao_processos_habilitada bool DEFAULT true NOT NULL, sincronizacao_processos_limite int4 NULL, ativo bool DEFAULT true NOT NULL, datacadastro timestamp DEFAULT now() NOT NULL, sincronizacao_processos_cota int4 NULL, max_propostas int4 NULL, limite_clientes int4 NULL, sincronizacao_intimacoes_habilitada bool NULL, sincronizacao_intimacoes_limite int4 NULL, limite_advogados_processos int4 NULL, limite_advogados_intimacao int4 NULL, CONSTRAINT planos_pkey PRIMARY KEY (id));

-- Column comments

COMMENT ON COLUMN public.planos.modulos IS 'Lista de módulos habilitados para o plano';
COMMENT ON COLUMN public.planos.sincronizacao_processos_habilitada IS 'Indica se a sincronização automática de processos está habilitada para o plano';
COMMENT ON COLUMN public.planos.sincronizacao_processos_limite IS 'Limite de processos para sincronização automática do plano';
COMMENT ON COLUMN public.planos.max_propostas IS 'Número máximo de propostas permitidas para o plano';


-- public.process_response definição

-- Drop table

-- DROP TABLE public.process_response;

CREATE TABLE public.process_response ( id bigserial NOT NULL, processo_id int4 NULL, process_sync_id int8 NULL, integration_api_key_id int4 NULL, delivery_id text NULL, "source" text DEFAULT 'webhook'::text NOT NULL, status_code int4 NULL, received_at timestamptz DEFAULT now() NOT NULL, payload jsonb DEFAULT '{}'::jsonb NOT NULL, headers jsonb NULL, error_message text NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT process_response_pkey PRIMARY KEY (id));
CREATE UNIQUE INDEX idx_process_response_delivery ON public.process_response USING btree (delivery_id);
CREATE INDEX idx_process_response_integration ON public.process_response USING btree (integration_api_key_id);
CREATE INDEX idx_process_response_processo ON public.process_response USING btree (processo_id);
CREATE INDEX idx_process_response_sync ON public.process_response USING btree (process_sync_id);


-- public.process_sync definição

-- Drop table

-- DROP TABLE public.process_sync;

CREATE TABLE public.process_sync ( id bigserial NOT NULL, processo_id int4 NULL, integration_api_key_id int4 NULL, remote_request_id text NULL, request_type text DEFAULT 'manual'::text NOT NULL, requested_by int4 NULL, requested_at timestamptz DEFAULT now() NOT NULL, request_payload jsonb DEFAULT '{}'::jsonb NOT NULL, request_headers jsonb NULL, status text DEFAULT 'pending'::text NOT NULL, status_reason text NULL, completed_at timestamptz NULL, metadata jsonb NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT process_sync_pkey PRIMARY KEY (id));
CREATE INDEX idx_process_sync_integration ON public.process_sync USING btree (integration_api_key_id);
CREATE INDEX idx_process_sync_processo ON public.process_sync USING btree (processo_id);
CREATE UNIQUE INDEX idx_process_sync_remote_request ON public.process_sync USING btree (remote_request_id);
CREATE INDEX idx_process_sync_status ON public.process_sync USING btree (status);

-- Table Triggers

create trigger trg_process_sync_updated_at before
update
    on
    public.process_sync for each row execute function set_process_sync_updated_at();


-- public.processo_advogados definição

-- Drop table

-- DROP TABLE public.processo_advogados;

CREATE TABLE public.processo_advogados ( id serial4 NOT NULL, processo_id int4 NULL, numero_cnj varchar NOT NULL, criado_em timestamp DEFAULT now() NOT NULL, atualizado_em timestamp NULL, representante_nome varchar NULL, representante_tipo varchar NULL, representante_situacao bool DEFAULT false NOT NULL, representante_cpf varchar NULL, oab_numero int4 NULL, oab_uf varchar NULL, representante_polo varchar NULL, CONSTRAINT processo_advogados_pkey PRIMARY KEY (id), CONSTRAINT processo_advogados_unique_1 UNIQUE (numero_cnj, representante_nome));
CREATE INDEX idx_processo_advogados_processo_id ON public.processo_advogados USING btree (processo_id);
CREATE INDEX idx_processo_advogados_usuario_id ON public.processo_advogados USING btree (numero_cnj);


-- public.processo_consultas_api definição

-- Drop table

-- DROP TABLE public.processo_consultas_api;

CREATE TABLE public.processo_consultas_api ( id serial4 NOT NULL, processo_id int4 NOT NULL, consultado_em timestamp DEFAULT now() NOT NULL, sucesso bool DEFAULT true NOT NULL, detalhes text NULL, CONSTRAINT processo_consultas_api_pkey PRIMARY KEY (id));
CREATE INDEX idx_processo_consultas_api_consultado_em ON public.processo_consultas_api USING btree (consultado_em);
CREATE INDEX idx_processo_consultas_api_processo_id ON public.processo_consultas_api USING btree (processo_id);


-- public.processos definição

-- Drop table

-- DROP TABLE public.processos;

CREATE TABLE public.processos ( id bigserial NOT NULL, cliente_id int4 NULL, numero_cnj varchar(30) NOT NULL, uf varchar(2) NULL, municipio varchar(255) NULL, orgao_julgador text NULL, situacao_processo_id int4 NULL, classe_judicial text NULL, assunto text NULL, jurisdicao text NULL, advogado_responsavel text NULL, data_distribuicao timestamp NULL, criado_em timestamp DEFAULT now() NOT NULL, atualizado_em timestamp DEFAULT now() NULL, idempresa int4 NULL, oportunidade_id int4 NULL, area_atuacao_id int4 NULL, tipo_processo_id int4 NULL, instancia varchar NULL, sistema_cnj_id int4 NULL, monitorar_processo bool DEFAULT false NOT NULL, envolvidos_id int4 NULL, descricao text NULL, setor_id int4 NULL, data_citacao date NULL, data_recebimento date NULL, data_arquivamento date NULL, data_encerramento date NULL, valoracao numeric NULL, ativo bool DEFAULT true NOT NULL, permite_peticionar bool DEFAULT true NOT NULL, grau varchar NOT NULL, justica_gratuita bool NULL, liminar bool NULL, nivel_sigilo int4 NULL, tramitacaoatual varchar NULL, cnj_norm text GENERATED ALWAYS AS (regexp_replace(numero_cnj::text, '\D'::text, ''::text, 'g'::text)) STORED NULL, nao_lido bool DEFAULT true NULL, idusuario_leitura int8 NULL, lido_em timestamptz NULL, polo varchar NULL, tipo_parte varchar NULL, nome_parte varchar NULL, tipo_pessoa varchar NULL, tipo_documento_parte varchar NULL, documento_numero_parte varchar NULL, sigilosa_parte bool NULL, oab_numero int4 NULL, oab_uf varchar NULL, CONSTRAINT processos_pkey PRIMARY KEY (id), CONSTRAINT processos_unique UNIQUE (numero_cnj, grau));
CREATE INDEX idx_processos_cliente_id ON public.processos USING btree (cliente_id);
CREATE INDEX idx_processos_cnj_norm ON public.processos USING btree (cnj_norm);
CREATE INDEX idx_processos_idempresa ON public.processos USING btree (idempresa) WHERE (idempresa IS NOT NULL);


-- public.quick_answers definição

-- Drop table

-- DROP TABLE public.quick_answers;

CREATE TABLE public.quick_answers ( id serial4 NOT NULL, empresa_id int4 NOT NULL, shortcut text NOT NULL, message text NOT NULL, media_url text NULL, media_type text NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT quick_answers_pkey PRIMARY KEY (id));
CREATE INDEX idx_quick_answers_empresa_id ON public.quick_answers USING btree (empresa_id);
CREATE INDEX idx_quick_answers_shortcut ON public.quick_answers USING btree (shortcut);


-- public.schema_migrations definição

-- Drop table

-- DROP TABLE public.schema_migrations;

CREATE TABLE public.schema_migrations ( id serial4 NOT NULL, "name" text NOT NULL, applied_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT schema_migrations_name_key UNIQUE (name), CONSTRAINT schema_migrations_pkey PRIMARY KEY (id));


-- public.sistema_cnj definição

-- Drop table

-- DROP TABLE public.sistema_cnj;

CREATE TABLE public.sistema_cnj ( id serial4 NOT NULL, nome varchar NOT NULL, CONSTRAINT sistema_cnj_pkey PRIMARY KEY (id));


-- public.situacao_cliente definição

-- Drop table

-- DROP TABLE public.situacao_cliente;

CREATE TABLE public.situacao_cliente ( id serial4 NOT NULL, nome text NOT NULL, ativo bool DEFAULT true NOT NULL, datacriacao timestamp DEFAULT now() NOT NULL, CONSTRAINT situacao_cliente_nome_key UNIQUE (nome), CONSTRAINT situacao_cliente_pkey PRIMARY KEY (id));


-- public.situacao_processo definição

-- Drop table

-- DROP TABLE public.situacao_processo;

CREATE TABLE public.situacao_processo ( id serial4 NOT NULL, nome text NOT NULL, ativo bool DEFAULT true NOT NULL, datacriacao timestamp DEFAULT now() NOT NULL, idempresa int4 NULL, CONSTRAINT situacao_processo_nome_key UNIQUE (nome), CONSTRAINT situacao_processo_pkey PRIMARY KEY (id));


-- public.situacao_proposta definição

-- Drop table

-- DROP TABLE public.situacao_proposta;

CREATE TABLE public.situacao_proposta ( id serial4 NOT NULL, nome text NOT NULL, ativo bool DEFAULT true NOT NULL, datacriacao timestamp DEFAULT now() NOT NULL, idempresa int4 NULL, CONSTRAINT situacao_proposta_nome_key UNIQUE (nome), CONSTRAINT situacao_proposta_pkey PRIMARY KEY (id));


-- public.support_request_attachments definição

-- Drop table

-- DROP TABLE public.support_request_attachments;

CREATE TABLE public.support_request_attachments ( id serial4 NOT NULL, message_id int4 NOT NULL, filename text NOT NULL, content_type text NULL, file_size int4 NULL, "data" bytea NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT support_request_attachments_pkey PRIMARY KEY (id));
CREATE INDEX idx_support_request_attachments_message ON public.support_request_attachments USING btree (message_id);


-- public.support_request_messages definição

-- Drop table

-- DROP TABLE public.support_request_messages;

CREATE TABLE public.support_request_messages ( id serial4 NOT NULL, support_request_id int4 NOT NULL, sender text NOT NULL, message text NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT support_request_messages_pkey PRIMARY KEY (id), CONSTRAINT support_request_messages_sender_check CHECK ((sender = ANY (ARRAY['requester'::text, 'support'::text]))));
CREATE INDEX idx_support_request_messages_created ON public.support_request_messages USING btree (created_at);
CREATE INDEX idx_support_request_messages_request ON public.support_request_messages USING btree (support_request_id);


-- public.support_requests definição

-- Drop table

-- DROP TABLE public.support_requests;

CREATE TABLE public.support_requests ( id serial4 NOT NULL, subject text NOT NULL, description text NOT NULL, status text DEFAULT 'open'::text NOT NULL, requester_name text NULL, requester_email text NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, requester_id int4 NULL, support_agent_id int4 NULL, support_agent_name text NULL, CONSTRAINT support_requests_pkey PRIMARY KEY (id), CONSTRAINT support_requests_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text]))));
CREATE INDEX idx_support_requests_created_at ON public.support_requests USING btree (created_at DESC);
CREATE INDEX idx_support_requests_requester ON public.support_requests USING btree (requester_id);
CREATE INDEX idx_support_requests_status ON public.support_requests USING btree (status);
CREATE INDEX idx_support_requests_support_agent ON public.support_requests USING btree (support_agent_id);


-- public.sync_audit definição

-- Drop table

-- DROP TABLE public.sync_audit;

CREATE TABLE public.sync_audit ( id bigserial NOT NULL, processo_id int4 NULL, process_sync_id int8 NULL, process_response_id int8 NULL, integration_api_key_id int4 NULL, event_type text NOT NULL, event_details jsonb DEFAULT '{}'::jsonb NOT NULL, observed_at timestamptz DEFAULT now() NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT sync_audit_pkey PRIMARY KEY (id));
CREATE INDEX idx_sync_audit_processo ON public.sync_audit USING btree (processo_id);
CREATE INDEX idx_sync_audit_response ON public.sync_audit USING btree (process_response_id);
CREATE INDEX idx_sync_audit_sync ON public.sync_audit USING btree (process_sync_id);


-- public.tags definição

-- Drop table

-- DROP TABLE public.tags;

CREATE TABLE public.tags ( id serial4 NOT NULL, "key" text NOT NULL, "label" text NOT NULL, example text NULL, group_name text NULL, CONSTRAINT tags_pkey PRIMARY KEY (id));


-- public.tarefas definição

-- Drop table

-- DROP TABLE public.tarefas;

CREATE TABLE public.tarefas ( id serial4 NOT NULL, id_oportunidades int4 NULL, titulo text NOT NULL, descricao text NULL, "data" date NOT NULL, hora time NULL, dia_inteiro bool DEFAULT false NULL, prioridade int4 NULL, mostrar_na_agenda bool DEFAULT true NULL, privada bool DEFAULT true NULL, recorrente bool DEFAULT false NULL, repetir_quantas_vezes int4 DEFAULT 1 NULL, repetir_cada_unidade text NULL, repetir_intervalo int4 DEFAULT 1 NULL, criado_em timestamp DEFAULT CURRENT_TIMESTAMP NULL, atualizado_em timestamp DEFAULT CURRENT_TIMESTAMP NULL, concluido bool DEFAULT false NOT NULL, ativo bool DEFAULT true NOT NULL, idempresa int4 NOT NULL, idusuario int4 NOT NULL, CONSTRAINT tarefas_pkey PRIMARY KEY (id), CONSTRAINT tarefas_prioridade_check CHECK (((prioridade >= 1) AND (prioridade <= 5))), CONSTRAINT tarefas_repetir_cada_unidade_check CHECK ((repetir_cada_unidade = ANY (ARRAY['Minutos'::text, 'Horas'::text, 'Dias'::text, 'Semanas'::text, 'Meses'::text]))));


-- public.tarefas_responsaveis definição

-- Drop table

-- DROP TABLE public.tarefas_responsaveis;

CREATE TABLE public.tarefas_responsaveis ( id_tarefa int4 NOT NULL, id_usuario int4 NOT NULL, CONSTRAINT tarefas_responsaveis_pkey PRIMARY KEY (id_tarefa, id_usuario));


-- public.templates definição

-- Drop table

-- DROP TABLE public.templates;

CREATE TABLE public.templates ( id serial4 NOT NULL, title text NOT NULL, "content" text NOT NULL, datacriacao timestamp DEFAULT now() NOT NULL, idempresa int4 NULL, idusuario int4 NULL, CONSTRAINT templates_unique UNIQUE (id));


-- public.tipo_documento definição

-- Drop table

-- DROP TABLE public.tipo_documento;

CREATE TABLE public.tipo_documento ( id serial4 NOT NULL, nome varchar(255) NOT NULL, ativo bool DEFAULT true NULL, datacriacao timestamp DEFAULT now() NULL, idempresa int4 NULL, CONSTRAINT tipo_documento_pkey PRIMARY KEY (id));


-- public.tipo_envolvimento definição

-- Drop table

-- DROP TABLE public.tipo_envolvimento;

CREATE TABLE public.tipo_envolvimento ( id serial4 NOT NULL, descricao text NOT NULL, CONSTRAINT tipo_envolvimento_pkey PRIMARY KEY (id));


-- public.tipo_evento definição

-- Drop table

-- DROP TABLE public.tipo_evento;

CREATE TABLE public.tipo_evento ( id serial4 NOT NULL, nome text NOT NULL, ativo bool DEFAULT true NOT NULL, datacriacao timestamp DEFAULT now() NOT NULL, agenda bool DEFAULT true NOT NULL, tarefa bool DEFAULT true NOT NULL, idempresa int4 NULL, CONSTRAINT tipo_evento_unique UNIQUE (id));


-- public.tipo_processo definição

-- Drop table

-- DROP TABLE public.tipo_processo;

CREATE TABLE public.tipo_processo ( id serial4 NOT NULL, nome text NOT NULL, ativo bool DEFAULT true NOT NULL, datacriacao timestamp DEFAULT now() NOT NULL, idempresa int4 NULL, idareaatuacao int4 NULL, CONSTRAINT tipo_processo_unique UNIQUE (id));


-- public.token_jusbr definição

-- Drop table

-- DROP TABLE public.token_jusbr;

CREATE TABLE public.token_jusbr ( id int4 GENERATED ALWAYS AS IDENTITY( INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE) NOT NULL, access_token text NULL, expires_in int4 NULL, refresh_expires_in int4 NULL, refresh_token text NULL, token_type varchar NULL, id_token text NOT NULL, "not-before-policy" int4 NULL, session_state varchar NULL, "scope" varchar NULL, expired bool NOT NULL, datatimerenewal timestamp NOT NULL, timestamp_expirate timestamp NULL, idusuario int4 NULL, CONSTRAINT token_jusbr_pk PRIMARY KEY (id));


-- public.trigger_anexos_processo definição

-- Drop table

-- DROP TABLE public.trigger_anexos_processo;

CREATE TABLE public.trigger_anexos_processo ( id int4 GENERATED ALWAYS AS IDENTITY( INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE) NOT NULL, numero_cnj varchar NULL, instancia_processo int4 NULL, sequencia varchar NULL, "nivelSigilo" varchar NULL, nome varchar NULL, tipo varchar NULL, "dataHoraJuntada" timestamptz NULL, "hrefBinario" varchar NULL, "hrefTexto" varchar NULL, tipo_arquivo varchar NULL, data_cadastro timestamp DEFAULT now() NOT NULL, extraido bool DEFAULT false NULL, data_erro timestamp NULL, cnj_norm text GENERATED ALWAYS AS (regexp_replace(numero_cnj::text, '\D'::text, ''::text, 'g'::text)) STORED NULL, CONSTRAINT trigger_anexos_processo_unique UNIQUE (numero_cnj, instancia_processo, sequencia, "dataHoraJuntada"));
CREATE INDEX idx_tap_cnj_norm ON public.trigger_anexos_processo USING btree (cnj_norm);
CREATE INDEX idx_tap_data ON public.trigger_anexos_processo USING btree ("dataHoraJuntada");
CREATE INDEX idx_tap_instancia ON public.trigger_anexos_processo USING btree (instancia_processo);


-- public.trigger_assuntos_processo definição

-- Drop table

-- DROP TABLE public.trigger_assuntos_processo;

CREATE TABLE public.trigger_assuntos_processo ( id int4 GENERATED ALWAYS AS IDENTITY( INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE) NOT NULL, numero_cnj varchar NULL, codigo_assunto varchar NULL, assunto varchar NULL, data_cadastro timestamp DEFAULT now() NOT NULL, CONSTRAINT assuntos_processo_pk PRIMARY KEY (id), CONSTRAINT trigger_assuntos_processo_unique UNIQUE (numero_cnj, codigo_assunto));


-- public.trigger_dados_processo definição

-- Drop table

-- DROP TABLE public.trigger_dados_processo;

CREATE TABLE public.trigger_dados_processo ( id int4 GENERATED ALWAYS AS IDENTITY( INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE) NOT NULL, id_requisicao uuid NULL, id_resposta uuid NULL, id_origem uuid NULL, numero_cnj varchar NULL, instancia int4 NULL, nome varchar NULL, area varchar NULL, estado varchar NULL, cidade varchar NULL, assunto text NULL, situacao varchar NULL, sigla_tribunal varchar NULL, orgao_julgador varchar NULL, data_distribuicao timestamptz NULL, justica_gratuita bool NULL, nivel_sigilo int4 NULL, justica varchar NULL, descricao_justica varchar NULL, valor numeric NULL, id_ultimo_andamento varchar NULL, data_cadastro timestamp DEFAULT now() NOT NULL, classificacao_principal_codigo varchar NULL, classificacao_principal_nome varchar NULL, CONSTRAINT processo_pkey PRIMARY KEY (id));


-- public.trigger_envolvidos_processo definição

-- Drop table

-- DROP TABLE public.trigger_envolvidos_processo;

CREATE TABLE public.trigger_envolvidos_processo ( numero_cnj varchar NOT NULL, nome varchar NULL, polo varchar NULL, tipo_pessoa varchar NULL, documento_principal varchar NULL, tipo_documento_principal varchar NULL, sigilosa bool NULL, data_cadastro timestamp DEFAULT now() NOT NULL, tipo_parte varchar NULL, grau varchar NULL, CONSTRAINT trigger_envolvidos_processo_unique UNIQUE (numero_cnj, documento_principal));


-- public.trigger_movimentacao_processo definição

-- Drop table

-- DROP TABLE public.trigger_movimentacao_processo;

CREATE TABLE public.trigger_movimentacao_processo ( id int4 GENERATED ALWAYS AS IDENTITY( INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE) NOT NULL, numero_cnj varchar NULL, instancia_processo int4 NULL, tipo_andamento varchar NULL, descricao text NULL, sigiloso bool DEFAULT false NULL, data_movimentacao timestamp NULL, data_cadastro timestamp DEFAULT now() NOT NULL, cnj_norm text GENERATED ALWAYS AS (regexp_replace(numero_cnj::text, '\D'::text, ''::text, 'g'::text)) STORED NULL, CONSTRAINT movimentacao_processo_pk PRIMARY KEY (id), CONSTRAINT trigger_movimentacao_processo_unique UNIQUE (numero_cnj, data_movimentacao), CONSTRAINT trigger_movimentacao_processo_unique_dm_nj UNIQUE (data_movimentacao, numero_cnj));
CREATE INDEX idx_tmp_cnj_norm ON public.trigger_movimentacao_processo USING btree (cnj_norm);
CREATE INDEX idx_tmp_data ON public.trigger_movimentacao_processo USING btree (data_movimentacao);
CREATE INDEX idx_tmp_instancia ON public.trigger_movimentacao_processo USING btree (instancia_processo);


-- public.trigger_sincronizar_processo definição

-- Drop table

-- DROP TABLE public.trigger_sincronizar_processo;

CREATE TABLE public.trigger_sincronizar_processo ( request_id uuid NOT NULL, on_demand bool NOT NULL, search_type varchar NOT NULL, search_key varchar NOT NULL, response_type varchar NOT NULL, with_attachments bool NOT NULL, user_id uuid NOT NULL, status varchar NOT NULL, created_at timestamp NOT NULL, updated_at timestamp NULL, CONSTRAINT requests_pk PRIMARY KEY (request_id));


-- public.uaz_credentials definição

-- Drop table

-- DROP TABLE public.uaz_credentials;

CREATE TABLE public.uaz_credentials ( id text NOT NULL, empresa_id int8 NULL, subdomain text NOT NULL, "token" text NOT NULL, status text NULL, webhook_id text NULL, webhook_url text NULL, qr_code text NULL, pair_code text NULL, profile_name text NULL, phone_number text NULL, connected bool DEFAULT false NOT NULL, sse_token text NULL, sse_base_url text NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT uaz_credentials_pkey_1 PRIMARY KEY (id));
CREATE INDEX idx_uaz_credentials_empresa ON public.uaz_credentials USING btree (empresa_id);
CREATE INDEX idx_uaz_credentials_empresa_id ON public.uaz_credentials USING btree (empresa_id);
CREATE INDEX idx_uaz_credentials_subdomain ON public.uaz_credentials USING btree (subdomain);


-- public.uazapi_chats definição

-- Drop table

-- DROP TABLE public.uazapi_chats;

CREATE TABLE public.uazapi_chats ( chat_id text NOT NULL, contact_id int8 NULL, integration_id text NULL, wa_unread_count int4 DEFAULT 0 NOT NULL, wa_archived bool DEFAULT false NOT NULL, wa_is_group bool DEFAULT false NOT NULL, wa_last_message_type text NULL, wa_last_message_sender text NULL, wa_last_message_timestamp timestamptz NULL, integration_token text NULL, contact_phone text NULL, contact_identifier text NULL, contact_name text NULL, pinned bool DEFAULT false NOT NULL, responsible_id int4 NULL, tags jsonb NULL, responsible_snapshot jsonb NULL, is_private bool DEFAULT false NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, status int4 DEFAULT 0 NOT NULL, lead_status varchar NULL, metadata json NULL, CONSTRAINT uazapi_chats_pkey_1 PRIMARY KEY (chat_id));
CREATE UNIQUE INDEX idx_uazapi_chats_chat_id_unique ON public.uazapi_chats USING btree (chat_id);
CREATE INDEX idx_uazapi_chats_contact ON public.uazapi_chats USING btree (contact_id);
CREATE INDEX idx_uazapi_chats_contact_id ON public.uazapi_chats USING btree (contact_id);
CREATE INDEX idx_uazapi_chats_contact_phone ON public.uazapi_chats USING btree (contact_phone);
CREATE INDEX idx_uazapi_chats_integration_token ON public.uazapi_chats USING btree (integration_token);


-- public.uazapi_contacts definição

-- Drop table

-- DROP TABLE public.uazapi_contacts;

CREATE TABLE public.uazapi_contacts ( id bigserial NOT NULL, phone text NOT NULL, "name" text NULL, full_name text NULL, wa_name text NULL, wa_contact_name text NULL, image text NULL, image_preview text NULL, is_blocked bool DEFAULT false NOT NULL, identifier text NULL, integration_token text NULL, client_id text NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT uazapi_contacts_phone_key_1 UNIQUE (phone), CONSTRAINT uazapi_contacts_pkey_1 PRIMARY KEY (id));
CREATE INDEX idx_uazapi_contacts_integration_token ON public.uazapi_contacts USING btree (integration_token);


-- public.uazapi_integrations definição

-- Drop table

-- DROP TABLE public.uazapi_integrations;

CREATE TABLE public.uazapi_integrations ( id serial4 NOT NULL, instance_name varchar(150) NOT NULL, base_url text NOT NULL, "owner" varchar(20) NULL, "token" uuid NOT NULL, created_at timestamp DEFAULT now() NULL, updated_at timestamp DEFAULT now() NULL, credential_id text NULL, CONSTRAINT uazapi_integrations_pkey_1 PRIMARY KEY (id), CONSTRAINT uazapi_integrations_token_key_1 UNIQUE (token));


-- public.uazapi_media definição

-- Drop table

-- DROP TABLE public.uazapi_media;

CREATE TABLE public.uazapi_media ( id uuid DEFAULT gen_random_uuid() NOT NULL, message_id text NOT NULL, credential_id text NULL, file_type text NULL, mime_type text NULL, original_name text NULL, local_path text NULL, public_url text NULL, size_bytes int8 NULL, metadata jsonb NULL, created_at timestamptz DEFAULT now() NULL, CONSTRAINT uazapi_media_pkey PRIMARY KEY (id));
CREATE INDEX idx_uazapi_media_message ON public.uazapi_media USING btree (message_id);


-- public.uazapi_message_media definição

-- Drop table

-- DROP TABLE public.uazapi_message_media;

CREATE TABLE public.uazapi_message_media ( message_id text NOT NULL, base64_data text NULL, mimetype text NULL, file_url text NULL, transcription text NULL, created_at timestamptz DEFAULT now() NULL, CONSTRAINT uazapi_message_media_pkey PRIMARY KEY (message_id));


-- public.uazapi_messages definição

-- Drop table

-- DROP TABLE public.uazapi_messages;

CREATE TABLE public.uazapi_messages ( message_id text NOT NULL, chat_id text NULL, sender text NULL, sender_name text NULL, "content" text NULL, message_type text NULL, media_type text NULL, from_me bool DEFAULT false NOT NULL, was_sent_by_api bool DEFAULT false NOT NULL, message_timestamp timestamp NULL, status text NULL, integration_token text NULL, contact_phone text NULL, "timestamp" timestamptz NULL, attachments jsonb NULL, raw_payload jsonb NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT uazapi_messages_pkey_1 PRIMARY KEY (message_id));
CREATE INDEX idx_uazapi_messages_chat ON public.uazapi_messages USING btree (chat_id);
CREATE INDEX idx_uazapi_messages_chat_id_1 ON public.uazapi_messages USING btree (chat_id);
CREATE INDEX idx_uazapi_messages_chat_timestamp ON public.uazapi_messages USING btree (chat_id, "timestamp" DESC NULLS LAST);
CREATE INDEX idx_uazapi_messages_contact_phone ON public.uazapi_messages USING btree (contact_phone);
CREATE INDEX idx_uazapi_messages_integration_token ON public.uazapi_messages USING btree (integration_token);


-- public.uazapi_webhook_events definição

-- Drop table

-- DROP TABLE public.uazapi_webhook_events;

CREATE TABLE public.uazapi_webhook_events ( event_id text NOT NULL, received_at timestamptz DEFAULT now() NULL, CONSTRAINT uazapi_webhook_events_pkey PRIMARY KEY (event_id));
CREATE INDEX idx_uazapi_webhook_events_date ON public.uazapi_webhook_events USING btree (received_at);


-- public.uazapi_webhooks definição

-- Drop table

-- DROP TABLE public.uazapi_webhooks;

CREATE TABLE public.uazapi_webhooks ( id text NOT NULL, instance_id text NOT NULL, url text NOT NULL, enabled bool DEFAULT true NOT NULL, events _text DEFAULT '{}'::text[] NOT NULL, exclude_messages _text DEFAULT '{}'::text[] NOT NULL, add_url_events bool DEFAULT false NOT NULL, add_url_types_messages bool DEFAULT false NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, credential_id varchar NULL, CONSTRAINT uazapi_webhooks_pkey PRIMARY KEY (id));
CREATE INDEX idx_uazapi_webhooks_credential ON public.uazapi_webhooks USING btree (credential_id);
CREATE INDEX idx_uazapi_webhooks_instance_id ON public.uazapi_webhooks USING btree (instance_id);


-- public.user_profile_audit_logs definição

-- Drop table

-- DROP TABLE public.user_profile_audit_logs;

CREATE TABLE public.user_profile_audit_logs ( id bigserial NOT NULL, user_id int4 NOT NULL, "action" text NOT NULL, description text NOT NULL, performed_by int4 NULL, performed_by_name text NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT user_profile_audit_logs_pkey PRIMARY KEY (id));
CREATE INDEX idx_user_profile_audit_logs_user_created ON public.user_profile_audit_logs USING btree (user_id, created_at DESC);


-- public.user_profile_sessions definição

-- Drop table

-- DROP TABLE public.user_profile_sessions;

CREATE TABLE public.user_profile_sessions ( id bigserial NOT NULL, user_id int4 NOT NULL, device text NOT NULL, "location" text NULL, last_activity timestamptz DEFAULT now() NOT NULL, is_active bool DEFAULT true NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, revoked_at timestamptz NULL, is_approved bool DEFAULT false NOT NULL, approved_at timestamptz NULL, CONSTRAINT user_profile_sessions_pkey PRIMARY KEY (id));
CREATE INDEX idx_user_profile_sessions_user_active ON public.user_profile_sessions USING btree (user_id, is_active, last_activity DESC);


-- public.user_profiles definição

-- Drop table

-- DROP TABLE public.user_profiles;

CREATE TABLE public.user_profiles ( user_id int4 NOT NULL, title text NULL, bio text NULL, office text NULL, oab_number text NULL, oab_uf text NULL, specialties _text DEFAULT ARRAY[]::text[] NOT NULL, hourly_rate numeric(12, 2) NULL, timezone text NULL, "language" text NULL, linkedin_url text NULL, website_url text NULL, address_street text NULL, address_city text NULL, address_state text NULL, address_zip text NULL, notifications_security_alerts bool DEFAULT true NOT NULL, notifications_agenda_reminders bool DEFAULT true NOT NULL, notifications_newsletter bool DEFAULT false NOT NULL, security_two_factor bool DEFAULT false NOT NULL, security_login_alerts bool DEFAULT false NOT NULL, security_device_approval bool DEFAULT false NOT NULL, avatar_url text NULL, member_since timestamptz NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, security_two_factor_secret text NULL, security_two_factor_activated_at timestamptz NULL, security_two_factor_backup_codes _text DEFAULT ARRAY[]::text[] NOT NULL, CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id));
CREATE INDEX idx_user_profiles_updated_at ON public.user_profiles USING btree (updated_at DESC);


-- public.usuarios definição

-- Drop table

-- DROP TABLE public.usuarios;

CREATE TABLE public.usuarios ( id serial4 NOT NULL, nome_completo text NOT NULL, cpf varchar NULL, email varchar NOT NULL, perfil int4 NOT NULL, empresa int4 NOT NULL, setor int4 NULL, oab varchar NULL, status bool DEFAULT true NOT NULL, senha varchar NULL, telefone varchar NULL, ultimo_login timestamp NULL, observacoes text NULL, datacriacao timestamp DEFAULT now() NOT NULL, must_change_password bool NULL, email_confirmed_at timestamp NULL, welcome_email_pending bool DEFAULT false NOT NULL, CONSTRAINT usuarios_email_key UNIQUE (email), CONSTRAINT usuarios_pkey PRIMARY KEY (id), CONSTRAINT usuarios_unique UNIQUE (cpf));


-- public.webhook_logs definição

-- Drop table

-- DROP TABLE public.webhook_logs;

CREATE TABLE public.webhook_logs ( id bigserial NOT NULL, instance_token varchar(255) NOT NULL, event_type varchar(50) NULL, payload jsonb NULL, received_at timestamp DEFAULT CURRENT_TIMESTAMP NULL, CONSTRAINT webhook_logs_pkey PRIMARY KEY (id));
CREATE INDEX idx_token ON public.webhook_logs USING btree (instance_token);


-- public.accounts definição

-- Drop table

-- DROP TABLE public.accounts;

CREATE TABLE public.accounts ( id uuid DEFAULT gen_random_uuid() NOT NULL, "name" text NOT NULL, bank text NULL, agency text NULL, "number" text NULL, currency text DEFAULT 'BRL'::text NULL, initial_balance numeric DEFAULT 0 NULL, created_by uuid NULL, created_at timestamptz DEFAULT now() NULL, idempresa int8 NULL, CONSTRAINT accounts_pkey PRIMARY KEY (id), CONSTRAINT accounts_empresas_fk FOREIGN KEY (idempresa) REFERENCES public.empresas(id));


-- public.agenda definição

-- Drop table

-- DROP TABLE public.agenda;

CREATE TABLE public.agenda ( id serial4 NOT NULL, titulo text NOT NULL, tipo int4 NULL, descricao text NULL, "data" date NOT NULL, hora_inicio time NULL, hora_fim time NULL, cliente int4 NULL, tipo_local varchar(10) NULL, "local" text NULL, lembrete bool DEFAULT false NULL, status int4 NULL, datacadastro timestamp DEFAULT now() NOT NULL, idempresa int4 NULL, idusuario int4 NULL, dataatualizacao timestamp NULL, id_tarefa int4 NULL, CONSTRAINT agenda_pkey PRIMARY KEY (id), CONSTRAINT agenda_tipo_local_check CHECK (((tipo_local)::text = ANY (ARRAY[('INTERNO'::character varying)::text, ('EXTERNO'::character varying)::text]))), CONSTRAINT agenda_tarefas_fk FOREIGN KEY (id_tarefa) REFERENCES public.tarefas(id));


-- public.clientes definição

-- Drop table

-- DROP TABLE public.clientes;

CREATE TABLE public.clientes ( id serial4 NOT NULL, nome varchar(500) NOT NULL, tipo int4 NOT NULL, documento varchar(20) NULL, email varchar NULL, telefone varchar NULL, cep varchar(9) NULL, rua text NULL, numero varchar(10) NULL, complemento text NULL, bairro text NULL, cidade text NULL, uf bpchar(2) NULL, ativo bool DEFAULT true NOT NULL, idempresa int4 NULL, datacadastro timestamp DEFAULT now() NOT NULL, idusuario int4 NULL, CONSTRAINT clientes_pkey PRIMARY KEY (id), CONSTRAINT clientes_unique_1 UNIQUE (nome, idempresa, documento), CONSTRAINT clientes_empresas_fk FOREIGN KEY (idempresa) REFERENCES public.empresas(id), CONSTRAINT clientes_usuarios_fk FOREIGN KEY (idusuario) REFERENCES public.usuarios(id));


-- public.integration_webhooks definição

-- Drop table

-- DROP TABLE public.integration_webhooks;

CREATE TABLE public.integration_webhooks ( id bigserial NOT NULL, "name" text NOT NULL, target_url text NOT NULL, events _text DEFAULT '{}'::text[] NOT NULL, secret text NOT NULL, active bool DEFAULT true NOT NULL, last_delivery timestamptz NULL, idempresa int8 NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT integration_webhooks_pkey PRIMARY KEY (id), CONSTRAINT integration_webhooks_idempresa_fkey FOREIGN KEY (idempresa) REFERENCES public.empresas(id) ON DELETE SET NULL);
CREATE INDEX idx_integration_webhooks_active ON public.integration_webhooks USING btree (active) WHERE (active IS TRUE);
CREATE INDEX idx_integration_webhooks_idempresa ON public.integration_webhooks USING btree (idempresa) WHERE (idempresa IS NOT NULL);

-- Table Triggers

create trigger trg_integration_webhooks_updated_at before
update
    on
    public.integration_webhooks for each row execute function set_integration_webhooks_updated_at();


-- public.intimacoes definição

-- Drop table

-- DROP TABLE public.intimacoes;

CREATE TABLE public.intimacoes ( id bigserial NOT NULL, "siglaTribunal" text DEFAULT 'projudi'::text NOT NULL, external_id text NOT NULL, numero_processo text NOT NULL, "nomeOrgao" text NULL, "tipoComunicacao" text NULL, texto text NULL, prazo timestamptz NULL, data_disponibilizacao date NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, meio varchar NULL, link text NULL, tipodocumento varchar NULL, nomeclasse varchar NULL, codigoclasse varchar NULL, numerocomunicacao varchar NULL, ativo bool DEFAULT true NOT NULL, hash varchar NULL, status varchar NULL, motivo_cancelamento varchar NULL, data_cancelamento timestamp NULL, destinatarios _text NULL, destinatarios_advogados _text NULL, idusuario int4 NULL, idempresa int4 NULL, nao_lida bool DEFAULT true NOT NULL, arquivada bool DEFAULT false NOT NULL, idusuario_leitura int8 NULL, lida_em timestamptz NULL, CONSTRAINT intimacoes_pkey PRIMARY KEY (id), CONSTRAINT intimacoes_unique UNIQUE (numero_processo, external_id), CONSTRAINT intimacoes_empresas_fk FOREIGN KEY (idempresa) REFERENCES public.empresas(id), CONSTRAINT intimacoes_usuarios_fk FOREIGN KEY (idusuario) REFERENCES public.usuarios(id));
CREATE UNIQUE INDEX idx_intimacoes_origem_external ON public.intimacoes USING btree ("siglaTribunal", external_id);
CREATE INDEX idx_intimacoes_prazo ON public.intimacoes USING btree (prazo);


-- public.chat_conversations definição

-- Drop table

-- DROP TABLE public.chat_conversations;

CREATE TABLE public.chat_conversations ( id text NOT NULL, contact_identifier text NOT NULL, contact_name text NULL, contact_avatar text NULL, short_status text NULL, description text NULL, pinned bool DEFAULT false NOT NULL, unread_count int4 DEFAULT 0 NOT NULL, last_message_id text NULL, last_message_preview text NULL, last_message_timestamp timestamptz NULL, last_message_sender text NULL, last_message_type text NULL, last_message_status text NULL, metadata jsonb NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, phone_number text NULL, responsible_id int4 NULL, responsible_snapshot jsonb NULL, tags jsonb NULL, client_name text NULL, is_linked_to_client bool DEFAULT false NOT NULL, custom_attributes jsonb NULL, is_private bool DEFAULT false NOT NULL, internal_notes jsonb NULL, client_id int4 NULL, credential_id text NULL, wa_chat_id text NULL, CONSTRAINT chat_conversations_pkey PRIMARY KEY (id), CONSTRAINT chat_conversations_client_fk FOREIGN KEY (client_id) REFERENCES public.clientes(id) ON DELETE SET NULL ON UPDATE CASCADE);
CREATE INDEX idx_chat_conversations_client ON public.chat_conversations USING btree (client_id);
CREATE UNIQUE INDEX idx_chat_conversations_credential_wa_chat ON public.chat_conversations USING btree (credential_id, wa_chat_id) WHERE ((credential_id IS NOT NULL) AND (wa_chat_id IS NOT NULL));
CREATE INDEX idx_chat_conversations_last_activity ON public.chat_conversations USING btree (last_message_timestamp DESC);

-- Table Triggers

create trigger trg_chat_conversations_updated_at before
update
    on
    public.chat_conversations for each row execute function set_chat_conversations_updated_at();


-- public.chat_messages definição

-- Drop table

-- DROP TABLE public.chat_messages;

CREATE TABLE public.chat_messages ( id text NOT NULL, conversation_id text NOT NULL, external_id text NULL, client_message_id text NULL, sender text NOT NULL, "content" text NOT NULL, message_type text NOT NULL, status text NOT NULL, "timestamp" timestamptz NOT NULL, attachments jsonb NULL, created_at timestamptz DEFAULT now() NOT NULL, deleted_at timestamptz NULL, deleted_by text NULL, reaction text NULL, CONSTRAINT chat_messages_pkey PRIMARY KEY (id), CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE CASCADE);
CREATE INDEX idx_chat_messages_conversation_created ON public.chat_messages USING btree (conversation_id, created_at DESC);


-- public.integration_webhook_deliveries definição

-- Drop table

-- DROP TABLE public.integration_webhook_deliveries;

CREATE TABLE public.integration_webhook_deliveries ( id bigserial NOT NULL, webhook_id int8 NOT NULL, empresa_id int8 NOT NULL, "event" text NOT NULL, body jsonb NOT NULL, occurred_at timestamptz NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, delivered_at timestamptz NULL, delivery_attempts int4 DEFAULT 0 NOT NULL, last_error text NULL, CONSTRAINT integration_webhook_deliveries_pkey PRIMARY KEY (id), CONSTRAINT integration_webhook_deliveries_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.integration_webhooks(id) ON DELETE CASCADE);
CREATE INDEX idx_integration_webhook_deliveries_empresa ON public.integration_webhook_deliveries USING btree (empresa_id);
CREATE INDEX idx_integration_webhook_deliveries_pending ON public.integration_webhook_deliveries USING btree (delivered_at) WHERE (delivered_at IS NULL);
