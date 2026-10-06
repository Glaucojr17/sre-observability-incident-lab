#!/usr/bin/env bash
set -euo pipefail

for attempt in {1..30}; do
  if curl -fsS http://127.0.0.1:3000/health/ready >/dev/null &&
     curl -fsS http://127.0.0.1:9090/-/ready >/dev/null &&
     curl -fsS http://127.0.0.1:3001/api/health >/dev/null; then
    break
  fi
  if [[ "$attempt" == 30 ]]; then
    docker compose logs
    exit 1
  fi
  sleep 2
done

curl -fsS http://127.0.0.1:3000/checkout | grep -q accepted
curl -sS -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3000/checkout?mode=fail' | grep -q '^503$'
curl -fsS http://127.0.0.1:3000/metrics | grep -q 'lab_requests_total{route="/checkout",status="error"} 1'

for attempt in {1..12}; do
  if curl -fsS 'http://127.0.0.1:9090/api/v1/query?query=up%7Bjob%3D%22checkout-lab%22%7D' |
     python3 -c 'import json,sys; d=json.load(sys.stdin); assert any(x["value"][1]=="1" for x in d["data"]["result"])'; then
    echo 'API, métricas, scrape Prometheus e Grafana disponíveis.'
    exit 0
  fi
  sleep 2
done
echo 'Prometheus não coletou o alvo checkout-lab.' >&2
exit 1
