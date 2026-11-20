import { Readable } from 'node:stream';

const HOP_BY_HOP = new Set(['connection', 'content-length', 'host', 'keep-alive', 'transfer-encoding', 'upgrade']);

export default async function handler(request, response) {
  const backend = process.env.MARCUS_BACKEND_URL?.replace(/\/$/, '');
  const apiKey = process.env.MARCUS_API_KEY;
  if (!backend || !apiKey) {
    return response.status(503).json({ error: 'Marcus backend is not configured' });
  }

  const rawPath = request.query.path;
  const path = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath || '');
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(request.query)) {
    if (key === 'path') continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) query.append(key, String(item));
    }
  }
  const target = `${backend}/${path}${query.size ? `?${query}` : ''}`;
  const headers = new Headers();
  for (const name of ['accept', 'content-type', 'last-event-id']) {
    const value = request.headers[name];
    if (value) headers.set(name, Array.isArray(value) ? value.join(',') : value);
  }
  headers.set('x-api-key', apiKey);

  const method = request.method || 'GET';
  let body;
  if (!['GET', 'HEAD'].includes(method)) {
    body = typeof request.body === 'string' || Buffer.isBuffer(request.body)
      ? request.body
      : JSON.stringify(request.body ?? {});
  }

  try {
    const upstream = await fetch(target, { method, headers, body, redirect: 'manual' });
    response.status(upstream.status);
    upstream.headers.forEach((value, name) => {
      if (!HOP_BY_HOP.has(name.toLowerCase())) response.setHeader(name, value);
    });
    if (!upstream.body) return response.end();
    Readable.fromWeb(upstream.body).pipe(response);
  } catch {
    response.status(502).json({ error: 'Marcus backend is unreachable' });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '2mb' } }, maxDuration: 300 };
