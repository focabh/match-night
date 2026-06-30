// ============================================================
// STUDIO — tipos + 7 templates prontos ("bonito por padrão").
// Selecionar um template pré-preenche cores, copy, CTA, badges, regras,
// config do matchmaker e um prêmio sugerido. Customização é opcional.
// ============================================================

export type Theme = {
  template: string;
  emoji: string;
  headline: string;
  subcopy: string;
  cta_label: string;
  cover_url: string;
  bg_url: string;
  logo_url: string;
  primary: string;     // cor de destaque (curtir/CTA)
  secondary: string;   // cor da marca
  button: string;      // cor do botão principal
  badges: string[];
  rules: string[];
};

export type Matchmaker = {
  enabled: boolean;
  super_like_quota: number;
  happy_hour: { enabled: boolean; from: string; to: string };
  match_da_hora: boolean;
  destaques: boolean;
  age_min: number;
  age_max: number;
  audience: string;
  organizer_participates: boolean;
  visibility: 'public' | 'private';
};

export type RewardKind = 'drink' | 'vip' | 'porcao' | 'brinde' | 'desconto' | 'combo' | 'consumacao';
export type Reward = {
  name: string;
  kind: RewardKind;
  emoji: string;
  qty_total: number | null;
  points_required: number;
  redeem_rule: string;
  valid_from: string;
  valid_to: string;
};

export type Venue = {
  id?: string | null;
  name: string;
  logo_url?: string;
  cover_url?: string;
  bg_url?: string;
  primary_color?: string;
  secondary_color?: string;
  button_color?: string;
  address?: string;
  map_url?: string;
  instagram?: string;
  about?: string;
  ambient_photos?: string[];
  default_rewards?: Reward[];
};

export const REWARD_KINDS: { v: RewardKind; l: string; emoji: string }[] = [
  { v: 'drink', l: 'Drink', emoji: '🍸' },
  { v: 'combo', l: 'Combo', emoji: '🍺' },
  { v: 'porcao', l: 'Porção', emoji: '🍟' },
  { v: 'vip', l: 'Entrada VIP', emoji: '🎟️' },
  { v: 'desconto', l: 'Desconto', emoji: '🏷️' },
  { v: 'brinde', l: 'Brinde', emoji: '🎁' },
  { v: 'consumacao', l: 'Consumação', emoji: '💳' },
];

export const EVENT_TYPES = [
  'Noite dos Solteiros', 'Matchmaker Night', 'Happy Hour de Matches',
  'Networking', 'Speed Dating', 'Festa Temática', 'Karaokê Social',
  'Rock Night', 'Evento Privado',
];

export type Template = {
  key: string;
  emoji: string;
  label: string;
  type: string;
  theme: Omit<Theme, 'logo_url'> & { logo_url?: string };
  matchmaker: Matchmaker;
  rewards: Reward[];
};

const baseMM = (over: Partial<Matchmaker> = {}): Matchmaker => ({
  enabled: true, super_like_quota: 3,
  happy_hour: { enabled: true, from: '21:00', to: '22:00' },
  match_da_hora: true, destaques: true, age_min: 18, age_max: 60,
  audience: 'Solteiros(as)', organizer_participates: false, visibility: 'public',
  ...over,
});

export const TEMPLATES: Template[] = [
  {
    key: 'singles', emoji: '💜', label: 'Noite dos Solteiros', type: 'Noite dos Solteiros',
    theme: {
      template: 'singles', emoji: '💜', headline: 'Noite dos Solteiros',
      subcopy: 'Quem tá solteiro(a) hoje aqui? Curta, dê match e deixa a noite acontecer.',
      cta_label: 'Entrar no Matchmaker',
      cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=900&q=70',
      bg_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=900&q=70',
      primary: '#ff3d7f', secondary: '#7b5cff', button: '#ff3d7f',
      badges: ['+18', 'Ao vivo', 'Solteiros'],
      rules: ['Respeito sempre', 'Sem prints de conversa', 'O match vale só nesta noite'],
    },
    matchmaker: baseMM(),
    rewards: [{ name: 'Drink do Primeiro Match', kind: 'drink', emoji: '🍸', qty_total: 50, points_required: 1, redeem_rule: 'Mostre seu 1º match no balcão', valid_from: '21:00', valid_to: '23:30' }],
  },
  {
    key: 'happyhour', emoji: '🔥', label: 'Happy Hour de Matches', type: 'Happy Hour de Matches',
    theme: {
      template: 'happyhour', emoji: '🔥', headline: 'Happy Hour de Matches',
      subcopy: 'Chegou cedo, já vai dando match. Quanto mais cedo, mais gente pra conhecer.',
      cta_label: 'Bora dar match',
      cover_url: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=900&q=70',
      bg_url: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=900&q=70',
      primary: '#ff6b35', secondary: '#ffb547', button: '#ff6b35',
      badges: ['+18', 'Happy Hour', '2x1'],
      rules: ['Respeito sempre', 'Aproveite o happy hour'],
    },
    matchmaker: baseMM({ super_like_quota: 2, happy_hour: { enabled: true, from: '18:00', to: '20:00' }, audience: 'Galera do happy hour' }),
    rewards: [{ name: '2º Drink na faixa', kind: 'combo', emoji: '🍺', qty_total: 80, points_required: 0, redeem_rule: 'Durante o happy hour', valid_from: '18:00', valid_to: '20:00' }],
  },
  {
    key: 'networking', emoji: '💼', label: 'Networking', type: 'Networking',
    theme: {
      template: 'networking', emoji: '💼', headline: 'Networking Night',
      subcopy: 'Conexões que valem a pena. Conheça gente da área tomando um drink.',
      cta_label: 'Conectar agora',
      cover_url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&q=70',
      bg_url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&q=70',
      primary: '#2dd4bf', secondary: '#3b82f6', button: '#2dd4bf',
      badges: ['Networking', 'Pro', 'Drinks'],
      rules: ['Respeito e profissionalismo', 'Troque contato com quem fizer sentido'],
    },
    matchmaker: baseMM({ super_like_quota: 5, match_da_hora: false, age_min: 21, age_max: 65, audience: 'Profissionais', happy_hour: { enabled: false, from: '19:00', to: '20:00' } }),
    rewards: [{ name: 'Café/Drink de boas-vindas', kind: 'consumacao', emoji: '☕', qty_total: 100, points_required: 0, redeem_rule: 'Na entrada, com o crachá', valid_from: '19:00', valid_to: '21:00' }],
  },
  {
    key: 'karaoke', emoji: '🎤', label: 'Karaokê Social', type: 'Karaokê Social',
    theme: {
      template: 'karaoke', emoji: '🎤', headline: 'Karaokê Social',
      subcopy: 'Solta a voz e conhece gente. Dueto com match é ponto extra. 🎶',
      cta_label: 'Subir no palco',
      cover_url: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=900&q=70',
      bg_url: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=900&q=70',
      primary: '#a855f7', secondary: '#ec4899', button: '#a855f7',
      badges: ['+18', 'Karaokê', 'Ao vivo'],
      rules: ['Respeito sempre', 'Aplauda quem se arriscar', 'Dueto vale match'],
    },
    matchmaker: baseMM({ audience: 'Cantores de chuveiro' }),
    rewards: [{ name: 'Shot pra coragem', kind: 'drink', emoji: '🥃', qty_total: 60, points_required: 1, redeem_rule: 'Cante uma música e mostre o match', valid_from: '21:00', valid_to: '23:59' }],
  },
  {
    key: 'rock', emoji: '🎸', label: 'Rock Night', type: 'Rock Night',
    theme: {
      template: 'rock', emoji: '🎸', headline: 'Rock Night',
      subcopy: 'Som pesado, gente sem frescura. Acha quem curte a mesma vibe.',
      cta_label: 'Entrar no rolê',
      cover_url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=900&q=70',
      bg_url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=900&q=70',
      primary: '#ef4444', secondary: '#f59e0b', button: '#ef4444',
      badges: ['+18', 'Rock', 'Ao vivo'],
      rules: ['Respeito sempre', 'Roda punk é por conta e risco 🤘'],
    },
    matchmaker: baseMM({ audience: 'Roqueiros' }),
    rewards: [{ name: 'Chopp duplo', kind: 'combo', emoji: '🍺', qty_total: 70, points_required: 2, redeem_rule: 'Com 2 matches no balcão', valid_from: '22:00', valid_to: '23:59' }],
  },
  {
    key: 'tematica', emoji: '🎭', label: 'Festa Temática', type: 'Festa Temática',
    theme: {
      template: 'tematica', emoji: '🎭', headline: 'Festa Temática',
      subcopy: 'Veio fantasiado? Melhor ainda. Acha sua dupla na pista.',
      cta_label: 'Entrar na festa',
      cover_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=900&q=70',
      bg_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=900&q=70',
      primary: '#f59e0b', secondary: '#8b5cf6', button: '#f59e0b',
      badges: ['+18', 'Temática', 'Fantasia'],
      rules: ['Respeito sempre', 'Capriche no tema'],
    },
    matchmaker: baseMM({ destaques: true, audience: 'Foliões' }),
    rewards: [{ name: 'Drink temático', kind: 'drink', emoji: '🍹', qty_total: 60, points_required: 1, redeem_rule: 'Mostre o match e a fantasia', valid_from: '22:00', valid_to: '23:59' }],
  },
  {
    key: 'speed', emoji: '🎯', label: 'Speed Dating', type: 'Speed Dating',
    theme: {
      template: 'speed', emoji: '🎯', headline: 'Speed Dating',
      subcopy: 'Poucos minutos por pessoa. Curtiu? Deu match, troquem contato.',
      cta_label: 'Começar rodadas',
      cover_url: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=900&q=70',
      bg_url: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=900&q=70',
      primary: '#ec4899', secondary: '#6366f1', button: '#ec4899',
      badges: ['+18', 'Speed Dating', 'Rodadas'],
      rules: ['Respeito sempre', 'Seja pontual nas rodadas', 'Sem pressão'],
    },
    matchmaker: baseMM({ super_like_quota: 1, destaques: false, audience: 'Quem quer agilizar' }),
    rewards: [{ name: 'Drink de cortesia', kind: 'consumacao', emoji: '🍸', qty_total: 40, points_required: 0, redeem_rule: 'Ao completar 5 rodadas', valid_from: '20:00', valid_to: '22:00' }],
  },
];

export const templateByKey = (k: string) => TEMPLATES.find((t) => t.key === k) || TEMPLATES[0];

// ---------- PALETAS CURADAS (contraste seguro) ----------
export type Palette = { name: string; primary: string; secondary: string; button: string };
export const PALETTES: Palette[] = [
  { name: 'Neon Rosa', primary: '#ff3d7f', secondary: '#7b5cff', button: '#ff3d7f' },
  { name: 'Sunset', primary: '#ff6b35', secondary: '#ffb547', button: '#ff6b35' },
  { name: 'Roxo', primary: '#a855f7', secondary: '#ec4899', button: '#a855f7' },
  { name: 'Rubi', primary: '#ef4444', secondary: '#f59e0b', button: '#ef4444' },
  { name: 'Aqua', primary: '#2dd4bf', secondary: '#3b82f6', button: '#0ea5e9' },
  { name: 'Champagne', primary: '#E8B339', secondary: '#232a6b', button: '#d6336c' },
  { name: 'Esmeralda', primary: '#10b981', secondary: '#0ea5e9', button: '#10b981' },
];

// galeria de capas curadas por template (evita "foto ruim" no modo rápido)
const POOL = {
  party: [
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=900&q=70',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=900&q=70',
    'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=900&q=70',
  ],
  drinks: [
    'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=900&q=70',
    'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=900&q=70',
    'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=900&q=70',
  ],
  music: [
    'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=900&q=70',
    'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=900&q=70',
    'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?w=900&q=70',
  ],
  pro: [
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&q=70',
    'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=900&q=70',
    'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=900&q=70',
  ],
};
export const COVERS: Record<string, string[]> = {
  singles: POOL.party, happyhour: POOL.drinks, networking: POOL.pro,
  karaoke: POOL.music, rock: POOL.music, tematica: POOL.party, speed: POOL.drinks,
};
export const coversFor = (key: string) => COVERS[key] || POOL.party;

// cor de texto legível sobre uma cor (luminância) -> garante contraste do botão
export function readableText(hex: string): string {
  const h = (hex || '#000').replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16) / 255, g = parseInt(n.slice(2, 4), 16) / 255, b = parseInt(n.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? '#0a0710' : '#ffffff';
}

// fallback de tema p/ eventos sem theme (compat com eventos antigos)
export const DEFAULT_THEME: Theme = { ...TEMPLATES[0].theme, logo_url: '' };

export function themeOf(ev: any): Theme {
  const t = ev?.theme && Object.keys(ev.theme).length ? ev.theme : null;
  const vn = ev?.venue;
  return {
    ...DEFAULT_THEME,
    ...(t || {}),
    // identidade do local sobrepõe se o evento não trouxer
    primary: t?.primary || vn?.primary_color || DEFAULT_THEME.primary,
    secondary: t?.secondary || vn?.secondary_color || DEFAULT_THEME.secondary,
    button: t?.button || vn?.button_color || t?.primary || DEFAULT_THEME.button,
    logo_url: t?.logo_url || vn?.logo_url || '',
    cover_url: t?.cover_url || vn?.cover_url || DEFAULT_THEME.cover_url,
    bg_url: t?.bg_url || vn?.bg_url || t?.cover_url || DEFAULT_THEME.bg_url,
    headline: t?.headline || ev?.name || DEFAULT_THEME.headline,
  };
}
