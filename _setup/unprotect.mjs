// Desliga a Vercel Deployment Protection do projeto match-night (deixa público).
// Token lido do env VERCEL_TOKEN (nunca gravado em arquivo).
const TOKEN = process.env.VERCEL_TOKEN;
if (!TOKEN) { console.error('VERCEL_TOKEN ausente'); process.exit(1); }
const h = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const teams = await (await fetch('https://api.vercel.com/v2/teams', { headers: h })).json();
const team = (teams.teams || []).find(t => t.slug === 'focabhs-projects') || (teams.teams || [])[0];
const q = team?.id ? `?teamId=${team.id}` : '';
const r = await fetch(`https://api.vercel.com/v9/projects/match-night${q}`, {
  method: 'PATCH', headers: h,
  body: JSON.stringify({ ssoProtection: null, passwordProtection: null }),
});
console.log('PATCH', r.status);
const j = await r.json();
console.log('sso=' + JSON.stringify(j.ssoProtection) + ' pwd=' + JSON.stringify(j.passwordProtection));
