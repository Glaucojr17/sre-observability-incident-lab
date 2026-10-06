# Observabilidade e resposta a incidente: checkout de laboratório

Um serviço de checkout mínimo para exercitar uma situação que aparece em operação: o cliente recebe erros, o monitoramento precisa distinguir falha da aplicação de falha da coleta, e a equipe precisa de um caminho para investigar. O repositório sobe API, Prometheus e Grafana com Docker Compose, expõe contadores e histograma de latência, provisiona um painel e testa uma regra de alerta. `scripts/smoke.sh` verifica HTTP e o scrape de verdade. **É um laboratório local, não um serviço produtivo nem experiência com Datadog ou ELK.**

## Executar

Requer Docker com Compose, Node 22+ para os testes locais, `curl` e Python 3 para o smoke test.

```bash
npm test
docker compose run --rm --no-deps --entrypoint promtool prometheus test rules /etc/prometheus/alert-tests.yml
docker compose up -d --build
bash scripts/smoke.sh
```

Abra [Grafana](http://127.0.0.1:3001/d/checkout-sre-lab) (acesso anônimo somente na porta local) e [alvos do Prometheus](http://127.0.0.1:9090/targets). Para encerrar: `docker compose down -v`. Todas as portas são publicadas em `127.0.0.1`; não exponha esta configuração em uma rede pública.

## O que observar

| Sinal | Fonte | Pergunta operacional |
| --- | --- | --- |
| `lab_requests_total` | `/metrics`, rótulos `route` e `status` | Qual a taxa de sucesso e erro? |
| `lab_request_duration_seconds` | Histograma Prometheus | A latência p95 cresceu? |
| `up{job="checkout-lab"}` | Scrape do Prometheus | A coleta está funcionando? |
| `CheckoutElevatedErrors` | Regra Prometheus | Erros acima de 5% por 30 s? |

O exemplo evita rotular métricas com IDs de requisição, URLs inteiras ou usuários para conter cardinalidade. A aplicação mantém observações em memória: reiniciar o contêiner zera os contadores e não representa persistência de dados. O histograma armazena cada observação em memória, adequado só a este laboratório de carga pequena; num serviço real eu usaria uma biblioteca de instrumentação com agregação limitada e tratamento de sinais de encerramento.

O [runbook de incidente](docs/INCIDENTE.md) contém comandos de injeção, consultas, hipótese de causa e recuperação. Os [testes de regras](prometheus/alert-tests.yml) exercitam estado saudável e alerta disparado. O workflow valida a API, as regras, o Compose e sobe o stack para checar scrape. Não há pager ou envio de alertas a terceiros.

## Decisões e próximos passos

- API sem dependências externas para destacar instrumentação e resposta, em vez de esconder o fluxo numa aplicação grande.
- O endpoint `/checkout?mode=fail` injeta 503 de forma controlada; apenas localhost recebe portas publicadas.
- Dashboard e datasource versionados permitem recriar a visualização sem configuração manual.
- O alerta curto mostra uma condição operacional, enquanto SLO de 30 dias e orçamento de erro estão documentados no runbook. Uma evolução incluiria instrumentação com OpenTelemetry, traces correlacionados, métricas de saturação e alertas de burn rate.
