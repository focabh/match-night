// Runner SQL pro projeto do Match Night (schema mn_* isolado).
// Uso: $env:SB_PAT="..."; node _setup/run.mjs supabase/schema.sql
import { readFileSync } from 'fs';
const PAT = process.env.SB_PAT;
const REF = process.env.MN_REF || 'cxjugdwnzufyccbdkdpc'; // projeto host do schema mn_*
if (!PAT) { console.error('SB_PAT ausente'); process.exit(1); }
const file = process.argv[2];
const sql = file ? readFileSync(file, 'utf8') : process.argv[3];
const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
console.log('HTTP', r.status);
console.log((await r.text()).slice(0, 1500));
