// Aponta match-night-bh para o deployment de produção mais NOVO que está READY.
const TOKEN = process.env.VERCEL_TOKEN;
if (!TOKEN) { console.error('VERCEL_TOKEN ausente'); process.exit(1); }
const h = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const teams = await (await fetch('https://api.vercel.com/v2/teams', { headers: h })).json();
const tid = ((teams.teams || []).find(t => t.slug === 'focabhs-projects') || {}).id;
const q = `projectId=match-night&limit=15${tid ? `&teamId=${tid}` : ''}`;
const dep = await (await fetch(`https://api.vercel.com/v6/deployments?${q}`, { headers: h })).json();
const list = (dep.deployments || []).filter(d => d.target === 'production');
const ready = list.filter(d => d.readyState === 'READY' || d.state === 'READY');
console.log('PROD deployments:', list.map(d => `${d.uid?.slice(0,10)} ${d.readyState||d.state} ${new Date(d.created).toISOString()}`).join(' | '));
const newest = ready.sort((a, b) => b.created - a.created)[0];
if (!newest) { console.log('nenhum READY ainda (provavelmente buildando)'); process.exit(0); }
const a = await fetch(`https://api.vercel.com/v2/deployments/${newest.uid}/aliases${tid ? `?teamId=${tid}` : ''}`, {
  method: 'POST', headers: h, body: JSON.stringify({ alias: 'match-night-bh.vercel.app' }),
});
console.log('alias->', newest.url, a.status);
