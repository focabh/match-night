// Cria o projeto Supabase dedicado do Match Night e imprime ref + db_pass.
import { writeFileSync } from 'fs';
const PAT = process.env.SB_PAT;
const ORG = 'ziyumwscsuihsxgeufxc'; // WTC org
const h = { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' };
// senha forte alfanumérica (sem chars que quebram URL)
const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
let pass = '';
for (let i = 0; i < 28; i++) pass += chars[Math.floor((globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * chars.length)];
const body = { name: 'match-night', organization_id: ORG, region: 'sa-east-1', db_pass: pass, plan: 'free' };
const r = await fetch('https://api.supabase.com/v1/projects', { method: 'POST', headers: h, body: JSON.stringify(body) });
const txt = await r.text();
console.log('HTTP', r.status);
console.log(txt.slice(0, 800));
if (r.ok) {
  const p = JSON.parse(txt);
  writeFileSync('_setup/project.json', JSON.stringify({ ref: p.id, db_pass: pass, region: 'sa-east-1', org: ORG }, null, 2));
  console.log('SAVED ref=' + p.id);
}
