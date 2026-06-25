// Grava as env vars NEXT_PUBLIC no projeto Vercel (pra builds do GitHub funcionarem).
const TOKEN = process.env.VERCEL_TOKEN;
const h = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const teams = await (await fetch('https://api.vercel.com/v2/teams', { headers: h })).json();
const tid = ((teams.teams || []).find(t => t.slug === 'focabhs-projects') || {}).id;
const vars = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', value: 'https://kbxhzzzicyeexdbqdfnl.supabase.co' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: 'sb_publishable_ceCy9OdXKUGJvpgIWMZH4w_FqnsDGpC' },
];
for (const v of vars) {
  const r = await fetch(`https://api.vercel.com/v10/projects/match-night/env?upsert=true${tid ? `&teamId=${tid}` : ''}`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ key: v.key, value: v.value, type: 'plain', target: ['production', 'preview', 'development'] }),
  });
  const j = await r.json();
  console.log(`${v.key}: ${r.status} ${(j.error?.message) || 'ok'}`);
}
