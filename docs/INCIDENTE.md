# Runbook: erro elevado no checkout

## Sinais iniciais

O alerta `CheckoutElevatedErrors` entra em `pending` quando a proporção de respostas 503 supera 5% numa janela de um minuto, e em `firing` após 30 segundos adicionais acima do limiar. Confira o painel `Checkout | confiabilidade`, a série `up{job="checkout-lab"}` e as métricas brutas. Uma ausência de scrape é diferente de ausência de erro; este laboratório não tem alerta para alvo indisponível.

## Reproduzir e investigar

1. `docker compose up -d --build` e `bash scripts/smoke.sh`.
2. Gere tráfego: `for i in {1..20}; do curl -s -o /dev/null http://127.0.0.1:3000/checkout; done`.
3. Injete a falha: `for i in {1..20}; do curl -s -o /dev/null 'http://127.0.0.1:3000/checkout?mode=fail'; done`.
4. Abra `http://127.0.0.1:3001/d/checkout-sre-lab` e `http://127.0.0.1:9090/alerts`. Aguarde pelo menos um scrape e duas avaliações; com tráfego que cessa, `rate[1m]` tende a zero e o alerta pode deixar de disparar. Para observar `firing`, continue enviando falhas por mais de 90 segundos.
5. Compare `sum(rate(lab_requests_total{status="error"}[1m]))` com o total; verifique se `up` é 1, se a latência p95 mudou e se os logs mostram reinício. Neste cenário, o 503 é causado pelo parâmetro de simulação, não por uma dependência externa.

## Resposta e aprendizado

Interrompa a injeção de falha, confirme que chamadas normais voltaram a 200 e acompanhe a janela até o alerta resolver. Num serviço real, registre início, impacto, mudanças recentes, hipótese e evidências; reduza o impacto antes de tentar uma correção definitiva, comunique responsáveis e faça um postmortem sem culpados. O endpoint de falha existe apenas para o laboratório e não deve ser publicado em produção.

O SLO ilustrativo é 99,9% de sucesso de checkout em 30 dias, para requisições válidas. O orçamento de erro seria 0,1% das requisições nessa janela, por exemplo, 1.000 erros em 1.000.000 de requisições. O alerta de 5% em um minuto é um sinal rápido, não uma política completa de burn rate nem medição mensal do SLO. Em produção, defina janelas de curto e longo prazo, alertas de ausência de tráfego e disponibilidade do próprio monitoramento.
