# Fonte de verdade do produto

O documento **MarketSync — Especificação definitiva do produto e da plataforma**, versão 1.0, datado de 14 de setembro de 2026, é a fonte de verdade para produto, arquitetura, segurança, regras, modelo de dados e critérios de aceite deste repositório.

Arquivo de referência fornecido pelo responsável pelo produto:

- `C:\Users\Atlas\Downloads\MarketSync_Especificacao_Definitiva.docx`
- SHA-256: `3F699CEEDFD8C38A3DF5ADF8D88925447A39ED1B811579A9EB09268BB23A4169`

## Precedência

1. Instruções explícitas posteriores do responsável pelo produto.
2. Especificação definitiva versionada acima.
3. Decisões técnicas documentadas neste repositório.
4. Implementação existente.

Quando a implementação divergir da especificação, a implementação deve ser migrada ou a especificação deve receber uma nova versão aprovada. Não se deve preservar uma simplificação técnica apenas porque ela já existe.

## Decisões obrigatórias adotadas

- Escala planejada e ponto realizado são módulos separados.
- Uma escala publicada é imutável; correções criam uma nova versão.
- Cada dia suporta zero ou mais segmentos de trabalho; quatro horários fixos são apenas uma visualização padrão.
- Regras são versionadas por organização, vigência e escopo.
- Publicação depende de validação autoritativa e revisão exata.
- RLS deve isolar organização, loja, setor, função e estado da escala.
- A chave administrativa do Supabase nunca é exposta ao navegador.
