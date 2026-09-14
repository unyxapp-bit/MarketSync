# Baseline de implementação

O protótipo inicial usa `schedule_weeks` e `shifts` com quatro horários. Ele permanece somente como fonte de migração dos dados já importados.

A construção nova segue o modelo canônico da especificação:

1. `schedules` e `schedule_versions` para ciclo e snapshots imutáveis.
2. `schedule_entries` e `shift_segments` para dias e períodos variáveis.
3. `rule_sets`, `rules`, `validation_runs` e `violations` para conformidade reproduzível.
4. `approvals`, `publications`, `notifications` e `acknowledgements` para governança e portal.

Nenhuma nova funcionalidade de edição deve depender do modelo legado após a migração da grade.
