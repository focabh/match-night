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

## 🍸 Como rodar um teste real em bar
Passo a passo pra um teste controlado (10–20 pessoas). App: **https://match-night-bh.vercel.app**

### 1. Criar o evento (admin / bar)
1. Abra **`/admin`** → entre com a chave admin (`mn_config.admin_key`, default `mn-admin-2026`).
2. **+ Novo evento** → nome (ex.: "Sexta Solteira"), bar/local, descrição, **duração**
   (ex.: 4h). Clique **Criar e ativar** → o evento já nasce `active`.

### 2. Gerar e expor o QR
3. No card do evento → **QR** (mostra o QR) e **baixar QR** (PNG) / **copiar link**.
4. Imprima o QR (ou ponha numa TV/tablet no balcão). O link é `…/join/<código>`.
   - Teste antes: escaneie você mesmo e confirme que abre a landing do evento.

### 3. Fluxo do usuário (o que a galera faz)
5. Pessoa **escaneia o QR** → landing do evento → marca **+18** → **Entrar na noite**.
6. **Cadastro rápido:** foto (tira na hora), nome, nascimento, gênero, quem quer ver,
   uma frase, intenção da noite → **Entrar na noite**.
7. **Deck:** curte (❤ / arrasta pra direita) ou passa (✕ / esquerda); toca na foto pra
   ampliar; ⋯ pra denunciar/bloquear.
8. **Match** quando os dois se curtem → aparece em **💜 Matches** (mostra o Instagram).
9. Quem quiser sair: **Sair** (some do deck e dos matches).

> Dica de massa crítica: peça pra ~10–20 pessoas entrarem **no começo**, pra o deck já
> ter gente. Combine um gênero/intenção variados pra gerar matches.

### 4. Encerrar o evento (acabou a noite)
Qualquer um destes encerra a experiência:
- **Manual:** `/admin` → card do evento → **encerrar** (imediato), **ou**
- **Por horário:** ao passar do `ends_at`, o evento é tratado como encerrado **na hora**
  (não depende de cron).
- **Limpar status** (opcional, p/ stats): `/admin` → **Expirar vencidos** (roda
  `mn_expire_events()` sob demanda — sem job recorrente no UAT).

### 5. Validar que "morreu tudo"
Depois de encerrar, confirme (ver `docs/EXPIRATION-TEST.md`):
- Abrir o **QR/link antigo** (`/join/<código>`) → deve mostrar **"Esse evento já terminou"**.
- Tentar ir direto no deck (`/event/<código>/deck`) → também mostra "evento terminou"
  (sem expor perfis).
- No deck/matches de quem estava dentro → tudo bloqueado; nada de like/match/conversa.
- `/admin` → **stats** do evento (participantes, likes, passes, matches, denúncias) p/ o bar.

### 6. Pós-teste
- Os dados ficam só como **estatística**; perfis/matches do evento já não aparecem.
- Pra um piloto maior/comercial: migrar pra **projeto Supabase dedicado** (trocar 2 linhas
  do `.env.local` + rodar `schema.sql`+`storage.sql`) e **agendar `mn_expire_events()` via
  pg_cron** (a cada 1 min) no projeto dedicado.

## Variáveis de ambiente
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Isolamento / regras críticas (no banco)
Toda RPC valida **evento ativo** (`status='active'` e `now()` na janela) e filtra por
`event_id`; deck exclui self/já-vistos/bloqueios/denúncias e cruza gênero↔interesse;
match só com reciprocidade no mesmo evento; ao encerrar/expirar, `mn_expire_events`
marca evento/participantes/matches como `ended/expired` → deck, swipe, matches e join
ficam bloqueados.

## Expiração total (regra crítica) — TESTADA
"Acabou o evento, acabou tudo": encerrar manual / passar do horário bloqueia deck,
like, match, matches e participação; QR antigo só mostra "evento terminou" (até via
bypass de URL). Cenários + resultados: [`docs/EXPIRATION-TEST.md`](docs/EXPIRATION-TEST.md).

## Limitações conhecidas (MVP) / próximos passos
- **Foto:** upload real via **Supabase Storage** (bucket público `mn-photos`,
  `supabase/storage.sql`); "foto de teste" segue como atalho de QA.
- **Chat** fora do MVP (V2): por ora, revela Instagram nos matches.
- **Auth** anônima por `localStorage` (uuid passado às RPCs) — suficiente pro bar;
  endurecer com Supabase Anonymous Auth (JWT → RLS por `auth.uid()`) depois.
- Agendar `mn_expire_events()` via pg_cron (a cada minuto) pra encerrar por horário
  sem depender de acesso; hoje o `mn_is_live` já trata `now() >= ends_at` em tempo real.
