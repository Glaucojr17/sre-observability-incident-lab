const http = require('node:http');
const { performance } = require('node:perf_hooks');

const bounds = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1];
const observations = { success: [], error: [] };
const counts = { success: 0, error: 0 };
const sums = { success: 0, error: 0 };

function metrics() {
  const lines = [
    '# HELP lab_requests_total Requisicoes ao checkout classificadas por resultado.',
    '# TYPE lab_requests_total counter',
  ];
  for (const status of ['success', 'error']) {
    lines.push(`lab_requests_total{route="/checkout",status="${status}"} ${counts[status]}`);
  }
  lines.push('# HELP lab_request_duration_seconds Duracao das requisicoes ao checkout.', '# TYPE lab_request_duration_seconds histogram');
  for (const status of ['success', 'error']) {
    const label = `route="/checkout",status="${status}"`;
    for (const bound of bounds) {
      const count = observations[status].filter((value) => value <= bound).length;
      lines.push(`lab_request_duration_seconds_bucket{${label},le="${bound}"} ${count}`);
    }
    lines.push(`lab_request_duration_seconds_bucket{${label},le="+Inf"} ${counts[status]}`);
    lines.push(`lab_request_duration_seconds_sum{${label}} ${sums[status]}`);
    lines.push(`lab_request_duration_seconds_count{${label}} ${counts[status]}`);
  }
  return `${lines.join('\n')}\n`;
}

function handler(req, res) {
  const started = performance.now();
  const url = new URL(req.url, 'http://localhost');
  const send = (code, body, contentType = 'application/json') => {
    res.writeHead(code, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
    res.end(body);
  };

  if (req.method === 'GET' && url.pathname === '/metrics') {
    return send(200, metrics(), 'text/plain; version=0.0.4; charset=utf-8');
  }
  if (req.method === 'GET' && ['/health/live', '/health/ready'].includes(url.pathname)) {
    return send(200, JSON.stringify({ status: 'ok' }));
  }
  if (req.method === 'GET' && url.pathname === '/checkout') {
    const failed = url.searchParams.get('mode') === 'fail';
    const status = failed ? 'error' : 'success';
    const duration = (performance.now() - started) / 1000;
    counts[status] += 1;
    sums[status] += duration;
    observations[status].push(duration);
    return send(failed ? 503 : 200, JSON.stringify({ result: failed ? 'unavailable' : 'accepted' }));
  }
  return send(404, JSON.stringify({ error: 'not_found' }));
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  http.createServer(handler).listen(port, '0.0.0.0', () => {
    process.stdout.write(JSON.stringify({ event: 'listening', port }) + '\n');
  });
}

module.exports = { handler };
