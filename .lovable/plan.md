
# CRM Jurídico - Plano de Implementação

## Visão Geral
Sistema de gestão jurídica com design moderno e limpo, integrado à API do JUS.BR para sincronização automática de processos e intimações. Multi-usuário com controle de acesso por perfis (admin, advogado, estagiário).

---

## 1. Autenticação e Controle de Acesso
- Login com e-mail e senha via Supabase Auth
- Perfis de usuário: Admin, Advogado, Estagiário
- Cada advogado com seu número OAB e UF vinculados ao perfil
- Controle de permissões por perfil (quem pode editar, visualizar, etc.)

## 2. Dashboard Principal
- Visão geral com métricas: total de processos ativos, intimações pendentes, prazos próximos
- Gráficos de distribuição por tribunal, status e tipo de ação
- Lista de intimações recentes com destaque para prazos urgentes
- Acesso rápido aos módulos principais

## 3. Cadastro e Gestão de Processos
- Cadastro manual e sincronização automática via API JUS.BR
- Dados do processo: número, tribunal, vara, classe, assunto, valor da ação, grau, sigilo
- Partes envolvidas (polo ativo/passivo) com representantes e advogados
- Histórico de movimentações
- Filtros avançados por tribunal, status, cliente, advogado responsável
- Vinculação de processos a clientes cadastrados

## 4. Módulo de Intimações
- Consulta automática diária à API ComunicaPJE (`comunicaapi.pje.jus.br`)
- Listagem de intimações com filtros por data, tribunal, tipo e status
- Visualização completa do texto da intimação
- Marcação de status: Pendente, Lida, Respondida
- Alertas para novas intimações
- Vinculação automática com processos cadastrados pelo número

## 5. Cadastro de Clientes
- Dados pessoais/empresariais: nome, CPF/CNPJ, contatos
- Vinculação com processos
- Histórico de atendimentos e processos por cliente

## 6. Controle de Prazos
- Cálculo automático de prazos a partir das intimações
- Calendário visual com prazos e compromissos
- Alertas de prazos próximos do vencimento (3 dias, 1 dia, no dia)
- Status: Pendente, Em andamento, Cumprido, Vencido

## 7. Agenda e Tarefas
- Criação de tarefas vinculadas a processos ou avulsas
- Atribuição de tarefas a membros da equipe
- Visualização em lista e calendário
- Status e prioridade das tarefas

## 8. Integração com API JUS.BR (Backend)
- Edge function para armazenar e gerenciar tokens OAuth (access_token, refresh_token)
- Edge function para consulta de processos via API JUS.BR
- Edge function para consulta diária de intimações via ComunicaPJE
- Rotina agendada (cron) para sincronizar intimações automaticamente
- Refresh automático de tokens quando expirarem

## 9. Estrutura do Banco de Dados (Supabase)
- Tabelas: profiles, user_roles, clientes, processos, partes, intimações, prazos, tarefas, tokens_api
- RLS para isolamento de dados por escritório
- Triggers para criação automática de prazos a partir de intimações

## 10. Design e Layout
- Sidebar de navegação com ícones e labels
- Design moderno, limpo e minimalista com tons neutros e acentos de cor
- Tabelas responsivas com paginação
- Cards informativos no dashboard
- Modo claro (possibilidade de dark mode futuro)
