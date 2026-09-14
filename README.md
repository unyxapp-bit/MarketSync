# MarketSync

Plataforma web para montagem de escalas, acompanhamento de jornadas e validação operacional de conformidade para supermercados.

> A [especificação definitiva](docs/SOURCE_OF_TRUTH.md) é a fonte de verdade do produto. Toda nova implementação deve obedecer ao seu modelo canônico.

## Diretriz de dados e planejamento

Enquanto a integração mensal não estiver disponível, cada nova escala semanal será criada usando como base as escalas semanais já recebidas e registradas no sistema. Esse histórico é usado para calcular interjornada, dias consecutivos, folgas e rodízio de domingos.

Em uma etapa futura, será implantado o envio da escala mensal. Ela passará a ser uma fonte adicional de planejamento e cálculo das escalas semanais, permitindo antecipar folgas pré e pós-domingo, necessidades de cobertura e conflitos de jornada antes da publicação semanal.

## Execução local

```powershell
npm.cmd install
npm.cmd run dev
```

O app abre em `http://127.0.0.1:5173/`.
