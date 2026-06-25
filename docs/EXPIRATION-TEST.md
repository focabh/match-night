# Teste de Expiração Total — "acabou o evento, acabou tudo"

Regra crítica do produto: quando o evento termina (manualmente OU por horário),
**toda a experiência social é bloqueada** — deck, like/pass, match, matches,
participação — e o QR/link antigo só mostra "evento terminou".

## Onde a regra mora (centralizada)
- `mn_is_live(event)` = `status='active' AND now() entre starts_at e ends_at`.
  → **se `now() >= ends_at`, o evento é tratado como encerrado em tempo real**,
  mesmo que o `status` no banco ainda esteja `active` (não depende de cron).
- Toda RPC (`mn_deck`, `mn_swipe`, `mn_matches_list`, `mn_join_event`) valida
  `mn_is_live` e retorna vazio / lança `event_not_active`.
- `mn_event_public(code).ended` = `status in ('ended','cancelled') OR now() >= ends_at`
  → a UI (`/join/[code]`, `/event/[code]/deck`, `/matches`) renderiza a tela
  **"Esse evento já terminou"**.
- `mn_admin_end_event` encerra na hora; `mn_expire_events()` (cron) marca
  `events.status='ended'` + `participants.status='expired'` + `matches.status='expired'`.

## Resultado do teste automatizado
Script: [`_setup/expiry_test.sql`](../_setup/expiry_test.sql) (roda no banco, cria
eventos, exercita e limpa). Saída validada:

| Cenário | Verificações | Resultado |
|---|---|---|
| **1. Evento ATIVO** | is_live=true, ended=false, deck retorna gente | ✅ |
| **2. ENCERRADO MANUAL** (admin) | ended=true, is_live=false, deck=0, matches=0, **swipe bloqueado**, **join bloqueado** | ✅ |
| **3. PASSOU DO HORÁRIO** (status ainda `active` no banco) | ended=true, is_live=false, deck=0, matches=0, **swipe bloqueado** — **em tempo real, sem cron** | ✅ |
| **4. Após `mn_expire_events()` (cron)** | status→`ended`, participantes→`expired`, matches→`expired` | ✅ |
| **5. QR/link ANTIGO** | `event_public.ended=true` nos dois eventos | ✅ |

## Verificação na UI (ao vivo, produção)
Evento de teste já encerrado: **public_code `ended`** (`/join/ended`).
- `/join/ended` (abrir o QR antigo) → tela **"Esse evento já terminou"**. ✅
- **Bypass por URL** indo direto em `/event/ended/deck` → também cai em
  **"Esse evento já terminou"** (não expõe deck/matches). ✅ (screenshot
  `_setup/mn_ended_deck.png`)

## Como reproduzir
```bash
# banco (saída JSON com todas as asserções)
SB_PAT=<uat_pat> MN_REF=kbxhzzzicyeexdbqdfnl node _setup/run.mjs _setup/expiry_test.sql
# UI: abra https://match-night-bh.vercel.app/join/ended
```

## Operação (recomendado pro piloto)
Agendar `mn_expire_events()` via pg_cron a cada 1 min para encerrar por horário e
marcar os status no banco. **Não é obrigatório para a segurança** (a checagem
`now() >= ends_at` já bloqueia tudo em tempo real), mas mantém os status limpos
para os relatórios/stats do bar.
