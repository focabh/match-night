// Seta uma env var no projeto Vercel a partir do process.env (não grava segredo em disco).
// Uso: $env:VERCEL_TOKEN=...; $env:ENV_KEY='GOOGLE_PLACES_API_KEY'; $env:ENV_VALUE='...'; node _setup/set_env.mjs
const TOKEN = process.env.VERCEL_TOKEN;
const KEY = process.env.ENV_KEY;
const VALUE = process.env.ENV_VALUE;
const TYPE = process.env.ENV_TYPE || 'encrypted';
if (!TOKEN || !KEY || !VALUE) { console.error('faltam VERCEL_TOKEN/ENV_KEY/ENV_VALUE'); process.exit(1); }
const h = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const teams = await (await fetch('https://api.vercel.com/v2/teams', { headers: h })).json();
const tid = ((teams.teams || []).find(t => t.slug === 'focabhs-projects') || {}).id;
const r = await fetch(`https://api.vercel.com/v10/projects/match-night/env?upsert=true${tid ? `&teamId=${tid}` : ''}`, {
  method: 'POST', headers: h,
  body: JSON.stringify({ key: KEY, value: VALUE, type: TYPE, target: ['production', 'preview', 'development'] }),
});
const j = await r.json();
console.log(`${KEY}: ${r.status} ${(j.error?.message) || 'ok'}`);
