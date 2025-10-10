# Testando os limites de requisições

Este guia explica como reproduzir e validar o comportamento dos limites de requisição (rate limit) implantados nas funções Supabase e como o front-end reage quando o limite é excedido.

## Como o limite está configurado hoje

- Cada função serverless define seu próprio limite. No caso de `toggleCustomerPaused`, o arquivo `supabase/functions/toggleCustomerPaused/index.ts` configura `max: 30` requisições por janela.
- A janela (`windowMs`) padrão é de 60 segundos.
- A chave do balde de limite usa uma combinação do IP do cliente e do token de autenticação atual (`getClientIp` + sufixo do bearer token). Isso garante que o limite seja **por usuário autenticado** e não global para todos os clientes.
- Quando o limite é atingido, a função responde com HTTP 429, inclui `retryAfterSeconds` em JSON e no header `Retry-After`, e o front exibe a mensagem amigável preparada em `src/shared/utils/errors.ts`.

## Cenário rápido para experimentar no front

1. Certifique-se de que o projeto web está rodando (`pnpm --filter alfred-webapp dev`) e que você está autenticado no dashboard.
2. Navegue até a aba **Tabela** e mantenha o filtro padrão para visualizar os clientes.
3. Escolha um cliente e clique em **Ativar/Desativar** repetidamente, tentando ultrapassar 30 alternâncias dentro de 60 segundos.
4. Abra o painel de rede do navegador (Chrome DevTools → aba *Network*) para observar as chamadas à função `toggleCustomerPaused`. Quando o código HTTP mudar para **429**, o front exibirá o aviso "Muitas requisições ao atualizar o status..." logo acima da tabela.
5. Depois que o tempo do `Retry-After` expirar, tente novamente; a função volta a responder `200` e o aviso some.

## Dica para acelerar um teste local

Se você quer provar o tratamento sem precisar chegar a 30 cliques:

1. Altere temporariamente o valor de `max` em `supabase/functions/toggleCustomerPaused/index.ts` para algo baixo (por exemplo, `max: 5`).
2. Rode `npx supabase functions serve toggleCustomerPaused --env-file ./supabase/.env` ou deploy para o ambiente desejado.
3. Repita o teste no front até bater o novo limite.
4. **Não esqueça de restaurar o valor original (`max: 30`) antes de fazer commit ou deploy.**

Esse mesmo padrão de teste vale para as demais funções; basta ajustar o limite temporariamente e observar a reação do front-end quando as respostas 429 aparecerem.
