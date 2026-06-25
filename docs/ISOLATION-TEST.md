# Teste de Isolamento — evento real × sandboxes de QA

Garante que o evento criado pelo bar no `/admin` **não mistura** com os sandboxes
de QA (`/join/demo`, `/join/ended`) nem com dados fake.

## Garantias (todas validadas)
Script: [`_setup/isolation_test.sql`](../_setup/isolation_test.sql) (cria um evento
real, exercita e limpa). Saída validada:

| # | Garantia | Verificação | Resultado |
|---|---|---|---|
| 1 | **Sem mistura** | deck do evento real só tem gente do real; vazamento de outro evento = 0; bots do `demo` dentro do real = 0 | ✅ |
| 2 | **QR/link isolado** | o código do evento real resolve só pra ele; código do `demo` é outro evento | ✅ |
| 3 | **Autolike de demo não age no real** | like sem recíproco em evento real → **sem match** (o gatilho `mn_demo_autolike` só dispara em `is_demo=true`) | ✅ |
| 4 | **Stats isoladas** | `mn_admin_stats` conta só o `event_id` daquele evento (participantes/likes/passes/matches/denúncias/bloqueios) | ✅ |
| 5 | **Painel do admin limpo** | `/admin` mostra o evento real e **esconde** `demo`/`ended` (RPC filtra `is_demo`) | ✅ |

## Por que é seguro por construção
- Toda RPC (`mn_deck`, `mn_swipe`, `mn_matches_list`, `mn_admin_stats`) filtra por
  `event_id`; o deck resolve o `event_id` da SUA participação ativa naquele evento.
- `public_code` é único por evento → o QR leva só àquele `event_id`.
- `mn_demo_autolike` e a contagem de "gente fake" existem **apenas** em eventos
  `is_demo=true`. Eventos criados pelo `/admin` nascem `is_demo=false`.
- `mn_admin_list_events` exclui `is_demo` → sandboxes nunca aparecem no fluxo do bar.

## Marcação dos sandboxes
`/join/demo` e `/join/ended` exibem um banner **"🧪 SANDBOX DE QA"** na landing
(além do "(DEMO)" no nome). Eles servem só pra treinar a experiência; o evento de
verdade é criado no `/admin`.
