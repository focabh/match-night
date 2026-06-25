# Match Night — match por evento via QR Code

App **standalone** (independente do Bora) de match local e **temporário por evento**.
Bar cria evento → gera QR → pessoas escaneiam, criam perfil rápido, veem quem está
**naquele evento**, curtem/passam, dão match. **Acabou o evento, expira tudo.**

> Reaproveita os *conceitos* do Matchmaker (perfil, swipe, match, bloqueio, denúncia,
> isolamento por evento), mas **não depende de nada do Bora**: repo próprio, schema
> próprio (`mn_*`), client próprio. Portável pro Lovable (React/Next puro).

## Stack
- **Next.js 14** (App Router, TypeScript) + **Tailwind** + **framer-motion** (swipe).
- **Supabase** (Postgres) — toda a lógica em **RPCs `security definer`** (`mn_*`),
  RLS ligada sem policies (acesso só via RPC). Auth do MVP = **uuid anônimo** no
  `localStorage` (sem login). QR via `qrcode`.

## Rodar local
```bash
npm install
cp .env.example .env.local   # preencha URL + anon key do Supabase
npm run dev                  # http://localhost:3000
```

## Banco
- Schema completo + RPCs: [`supabase/schema.sql`](supabase/schema.sql). Aplique no seu
  projeto Supabase (SQL editor ou `node _setup/run.mjs supabase/schema.sql` com `SB_PAT`/`MN_REF`).
- **Hospedagem atual (MVP):** schema `mn_*` isolado dentro do projeto Supabase de UAT
  do Bora (tabelas próprias, RLS travada, zero toque nas tabelas do Bora). Para um
  **projeto Supabase dedicado**, crie um projeto novo, rode o `schema.sql` e troque as
  2 linhas do `.env.local`. Nada mais muda.

### Tabelas (todas escopadas por `event_id`)
`mn_venues, mn_events, mn_users` (identidade base reusável), `mn_participants`
(participação temporária + **snapshots**), `mn_likes, mn_matches, mn_reports,
mn_blocks, mn_config`.

### RPCs principais
`mn_event_public` (landing), `mn_join_event` (cria identidade + participação, valida
18+/campos/consent/evento ativo), `mn_my_participation`, `mn_deck`, `mn_swipe`
(like/pass + match recíproco), `mn_matches_list`, `mn_block`, `mn_report`,
`mn_leave_event`, `mn_expire_events` (cron), `mn_admin_*` (create/list/end/stats).

## Rotas
**Público:** `/` (entrar por código) · `/join/[code]` (landing + 18+) ·
`/event/[code]/register` · `/event/[code]/deck` · `/event/[code]/matches`.
**Admin:** `/admin` (login por chave → lista/criar/QR/encerrar/stats).

## Admin (MVP)
Chave compartilhada em `mn_config.admin_key` (default `mn-admin-2026` — **trocar**).
Entre em `/admin`, crie o evento, mostre o QR no balcão. Limitação conhecida: auth de
admin é por chave única (hardenar com login real depois).

## Variáveis de ambiente
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Isolamento / regras críticas (no banco)
Toda RPC valida **evento ativo** (`status='active'` e `now()` na janela) e filtra por
`event_id`; deck exclui self/já-vistos/bloqueios/denúncias e cruza gênero↔interesse;
match só com reciprocidade no mesmo evento; ao encerrar/expirar, `mn_expire_events`
marca evento/participantes/matches como `ended/expired` → deck, swipe, matches e join
ficam bloqueados.

## Limitações conhecidas (MVP) / próximos passos
- **Foto** por URL + "foto de teste" (upload real via Supabase Storage = próximo passo).
- **Chat** fora do MVP (V2): por ora, revela Instagram nos matches.
- **Auth** anônima por `localStorage` (uuid passado às RPCs) — suficiente pro bar;
  endurecer com Supabase Anonymous Auth (JWT → RLS por `auth.uid()`) depois.
- Agendar `mn_expire_events()` via pg_cron (a cada minuto) pra encerrar por horário
  sem depender de acesso; hoje o `mn_is_live` já trata `now() >= ends_at` em tempo real.
