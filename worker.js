/**
 * СтройСмета — безопасный прокси к Anthropic (Claude).
 *
 * Что делает:
 *  1. Прячет секретный ключ Anthropic (его НЕТ во фронтенде).
 *  2. Пропускает запросы ТОЛЬКО с разрешённых доменов (защита от чужих трат денег).
 *  3. Ограничивает модель и max_tokens (защита от дорогих запросов).
 *  4. Ограничивает размер тела запроса.
 *  5. Корректно отдаёт CORS и обрабатывает preflight (OPTIONS).
 *  6. Пробрасывает коды ошибок Anthropic (включая 429/503/529), которые умеет ловить приложение.
 *
 * Секреты (задаются командой `wrangler secret put`, НЕ в коде):
 *  - ANTHROPIC_API_KEY  — ключ из console.anthropic.com
 *
 * Переменные (в wrangler.toml, [vars]):
 *  - ALLOWED_ORIGINS    — список доменов через запятую, напр.
 *                         "https://stroismeta.vercel.app,http://localhost:3000"
 *  - ALLOWED_MODELS     — список моделей через запятую (необязательно)
 *  - MAX_TOKENS_CAP     — максимум max_tokens (необязательно, по умолчанию 4096)
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_BODY_BYTES = 8 * 1024 * 1024; // 8 МБ — хватает на фото в base64
const DEFAULT_MAX_TOKENS_CAP = 4096;
const DEFAULT_MODELS = ['claude-sonnet-4-20250514'];

function parseList(str, fallback) {
  if (!str) return fallback;
  return str.split(',').map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(origin, allowedOrigins) {
  const allow = allowedOrigins.includes(origin) ? origin : '';
  const h = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (allow) h['Access-Control-Allow-Origin'] = allow;
  return h;
}

function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = parseList(env.ALLOWED_ORIGINS, []);
    const cors = corsHeaders(origin, allowedOrigins);

    // --- Preflight ---
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // --- Только POST ---
    if (request.method !== 'POST') {
      return json({ error: { message: 'Method Not Allowed' } }, 405, cors);
    }

    // --- Проверка домена ---
    // Если список задан, а Origin не входит в него — отказ.
    if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
      return json({ error: { message: 'Origin not allowed' } }, 403, cors);
    }

    // --- Проверка наличия ключа ---
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: { message: 'Server is not configured (no API key)' } }, 500, cors);
    }

    // --- Ограничение размера и чтение тела ---
    const lenHeader = request.headers.get('Content-Length');
    if (lenHeader && Number(lenHeader) > MAX_BODY_BYTES) {
      return json({ error: { message: 'Payload too large' } }, 413, cors);
    }

    let payload;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) {
        return json({ error: { message: 'Payload too large' } }, 413, cors);
      }
      payload = JSON.parse(raw);
    } catch (e) {
      return json({ error: { message: 'Invalid JSON' } }, 400, cors);
    }

    // --- Валидация и нормализация полей (защита от дорогих/мусорных запросов) ---
    const allowedModels = parseList(env.ALLOWED_MODELS, DEFAULT_MODELS);
    if (!payload.model || !allowedModels.includes(payload.model)) {
      payload.model = allowedModels[0];
    }

    const cap = Number(env.MAX_TOKENS_CAP) || DEFAULT_MAX_TOKENS_CAP;
    const requested = Number(payload.max_tokens) || cap;
    payload.max_tokens = Math.min(Math.max(1, requested), cap);

    if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
      return json({ error: { message: 'messages is required' } }, 400, cors);
    }

    // --- Запрос к Anthropic ---
    let upstream;
    try {
      upstream = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      return json({ error: { message: 'Upstream request failed' } }, 502, cors);
    }

    // --- Проброс ответа с теми же кодами статуса + CORS ---
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        ...cors,
      },
    });
  },
};
