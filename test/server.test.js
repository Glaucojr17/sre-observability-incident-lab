const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { handler } = require('../src/server');

test('checkout contabiliza sucesso e falha, com buckets monotônicos e sem rota dinâmica', async (t) => {
  const server = http.createServer(handler).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  assert.equal((await fetch(`${base}/health/ready`)).status, 200);
  assert.equal((await fetch(`${base}/checkout`)).status, 200);
  assert.equal((await fetch(`${base}/checkout?mode=fail`)).status, 503);
  assert.equal((await fetch(`${base}/missing`)).status, 404);

  const body = await (await fetch(`${base}/metrics`)).text();
  assert.match(body, /lab_requests_total\{route="\/checkout",status="success"\} 1/);
  assert.match(body, /lab_requests_total\{route="\/checkout",status="error"\} 1/);
  assert.match(body, /lab_request_duration_seconds_bucket\{route="\/checkout",status="error",le="\+Inf"\} 1/);
  assert.doesNotMatch(body, /mode=/);
  for (const status of ['success', 'error']) {
    const values = [...body.matchAll(new RegExp(`bucket\\{route="/checkout",status="${status}",le="[^"]+"\\} (\\d+)`, 'g'))]
      .map((match) => Number(match[1]));
    assert.equal(values.length, 9);
    assert.deepEqual(values, [...values].sort((a, b) => a - b));
  }
});
