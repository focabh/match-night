'use client';
import { getUserId } from './session';

// Arquitetura de A/B PRONTA, desligada por padrão (lançamento = versão canônica
// B Presencial). Ligar EXPERIMENTS=true divide os usuários de forma estável
// (mesmo usuário → mesma variante sempre) sem reescrever o fluxo.
const EXPERIMENTS = false;

export type Variant = {
  order: 'pref-first' | 'about-first'; // ordem dos blocos na tela única
  cta: string;                          // texto do botão principal
  key: string;                          // rótulo p/ analytics
};

const ORDER = ['pref-first', 'about-first'] as const;
const CTA = ['✨ Entrar no Matchmaker', '💜 Começar a conhecer pessoas'] as const;

const CANON: Variant = { order: 'pref-first', cta: CTA[0], key: 'canon' };

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

export function getVariant(): Variant {
  if (!EXPERIMENTS) return CANON;
  const h = hash(getUserId() || 'anon');
  const order = ORDER[h % 2];
  const ctaIdx = (h >> 1) % 2;
  return { order, cta: CTA[ctaIdx], key: `${order}/cta${ctaIdx + 1}` };
}
