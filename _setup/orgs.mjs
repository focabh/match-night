// Lista orgs + projetos da conta (pra criar o projeto dedicado do Match Night)
const PAT = process.env.SB_PAT;
if (!PAT) { console.error('SB_PAT ausente'); process.exit(1); }
const h = { Authorization: `Bearer ${PAT}` };
const orgs = await (await fetch('https://api.supabase.com/v1/organizations', { headers: h })).json();
const projs = await (await fetch('https://api.supabase.com/v1/projects', { headers: h })).json();
console.log('ORGS=' + JSON.stringify(orgs));
console.log('PROJECTS=' + JSON.stringify((Array.isArray(projs)?projs:[]).map(p => ({ id: p.id, name: p.name, org: p.organization_id, region: p.region, status: p.status }))));
