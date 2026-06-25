// READ-ONLY: estado dos deploys + pra onde o alias de produção aponta. Não escreve nada.
const TOKEN = process.env.VERCEL_TOKEN;
const h = { Authorization: `Bearer ${TOKEN}` };
const teams = await (await fetch('https://api.vercel.com/v2/teams', { headers: h })).json();
const tid = ((teams.teams || []).find(t => t.slug === 'focabhs-projects') || {}).id;
const dep = await (await fetch(`https://api.vercel.com/v6/deployments?projectId=match-night&limit=8${tid ? `&teamId=${tid}` : ''}`, { headers: h })).json();
console.log('Deployments (novo→antigo):');
for (const d of (dep.deployments || [])) {
  const src = d.meta?.githubCommitSha ? `git ${d.meta.githubCommitSha.slice(0,7)}` : 'cli';
  console.log(`  ${(d.readyState || d.state).padEnd(8)} ${src.padEnd(12)} ${new Date(d.created).toISOString()} ${d.url}`);
}
// alias atual
const al = await (await fetch(`https://api.vercel.com/v4/aliases/match-night-bh.vercel.app${tid ? `?teamId=${tid}` : ''}`, { headers: h })).json();
console.log('alias match-night-bh ->', al.deployment?.url || al.error?.message || JSON.stringify(al).slice(0,120));
