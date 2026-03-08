# Contrato do endpoint de agenda (compatibilidade `/agendas`)

Este documento descreve o contrato dos endpoints de agenda e os aliases compatíveis:

- `GET /api/agendas` (**preferível para o frontend atual**)
- `GET /api/agendas/:id` (**preferível para o frontend atual**)
- `POST /api/agendas` (**preferível para o frontend atual**)
- `PUT /api/agendas/:id` (**preferível para o frontend atual**)
- `DELETE /api/agendas/:id` (**preferível para o frontend atual**)

## Compatibilidade retroativa

Os endpoints legados continuam ativos:

- `GET /api/agendamentos`
- `GET /api/agendamentos/:id`
- `POST /api/agendamentos`
- `PUT /api/agendamentos/:id`
- `DELETE /api/agendamentos/:id`

Todos os aliases acima apontam para os mesmos handlers do `agendaController` (`list`, `getById`, `create`, `update`, `remove`), sem duplicação de lógica.
