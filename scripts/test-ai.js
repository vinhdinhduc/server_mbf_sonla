require('dotenv').config();
const { ProxyAgent, setGlobalDispatcher } = require('undici');

async function main() {
  const key = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
  const model = (process.env.AI_MODEL || 'gemini-2.5-flash').trim().replace(/^models\//, '');
  if (!key) throw new Error('Set GEMINI_API_KEY or AI_API_KEY in .env');
  if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY || process.env.HTTP_PROXY));
  const started = Date.now();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with OK.' }] }], generationConfig: { maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } } }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  const answer = (data.candidates?.[0]?.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
  console.log(JSON.stringify({ status: response.status, latency_ms: Date.now() - started, answer: answer.slice(0, 150), finishReason: data.candidates?.[0]?.finishReason }, null, 2));
  if (!response.ok) process.exitCode = 1;
}
main().catch((error) => { console.error(error.message, error.cause?.code || ''); process.exitCode = 1; });
