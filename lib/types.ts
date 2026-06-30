export type EventPublic = {
  event_id: string;
  name: string;
  venue_name: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  status: 'draft' | 'active' | 'ended' | 'cancelled';
  is_live: boolean;
  is_demo: boolean;
  ended: boolean;
  // studio (opcionais — eventos antigos não têm)
  public_code?: string;
  slug?: string | null;
  type?: string | null;
  theme?: Record<string, any>;
  matchmaker?: Record<string, any>;
  venue?: Record<string, any> | null;
  rewards?: any[];
};

export type Socials = { instagram?: string; spotify?: string; tiktok?: string };

export type DeckPerson = {
  participant_id: string;
  display_name: string;
  age: number;
  gender: string;
  bio: string | null;
  profile_prompt: string | null;
  night_intention: string;
  photo_url: string;
  photos?: string[];
  socials?: Socials;
};

export type MatchRow = {
  match_id: string;
  participant_id: string;
  display_name: string;
  age: number;
  photo_url: string;
  photos?: string[];
  night_intention: string;
  instagram: string | null;
  socials?: Socials;
};

export type ProfileInputPhotos = { photos: string[]; socials: Socials };

export type ProfileInput = {
  display_name: string;
  birthdate: string; // yyyy-mm-dd
  gender: string;
  interested_in?: string[];  // multi-seleção (preferência)
  photo_url: string;     // = photos[0] (compat)
  photos?: string[];     // galeria estilo Tinder
  bio: string;
  prompt: string;
  intention: string;
  instagram?: string;
  socials?: Socials;
};

export const GENDERS = [
  { v: 'woman', l: 'Mulher' },
  { v: 'man', l: 'Homem' },
  { v: 'nonbinary', l: 'Não-binário' },
  { v: 'other', l: 'Prefiro me descrever' },
];

// ---- Onboarding "B Presencial" ----
// "Sobre você" (identidade) — ordem conforme spec. 'other' abre autodescrição.
export const GENDER_OPTS = [
  { v: 'man', l: 'Homem' },
  { v: 'woman', l: 'Mulher' },
  { v: 'nonbinary', l: 'Não binário' },
  { v: 'other', l: 'Outro…' },
];
// "Quem você quer conhecer" — multi-seleção. "Todos" é atalho (marca todas).
export const PREF_OPTS = [
  { v: 'women', l: 'Mulheres' },
  { v: 'men', l: 'Homens' },
  { v: 'nonbinary', l: 'Pessoas não binárias' },
];
export const PREF_ALL = PREF_OPTS.map((o) => o.v); // ['women','men','nonbinary']
// normaliza p/ o banco: todas marcadas => ['all'] (inclui 'outro' e é inclusivo)
export const normalizePrefs = (sel: string[]) =>
  PREF_ALL.every((v) => sel.includes(v)) ? ['all'] : sel;
// desnormaliza p/ a UI: 'all' => todas marcadas
export const expandPrefs = (stored: string[] | null | undefined) =>
  !stored || stored.includes('all') ? [...PREF_ALL] : stored.filter((v) => PREF_ALL.includes(v));
export const INTERESTS = [
  { v: 'women', l: 'Mulheres' },
  { v: 'men', l: 'Homens' },
  { v: 'nonbinary', l: 'Não-binários' },
  { v: 'all', l: 'Todos' },
];
export const INTENTIONS = [
  'Quero paquerar',
  'Conhecer gente nova',
  'Conversar sem pressão',
  'Ver no que dá',
  'Só olhando',
];
export const PROMPTS = [
  'Hoje eu vim para...',
  'Se me encontrar no bar, puxe assunto sobre...',
  'Minha música da noite é...',
  'Meu drink da noite é...',
  'Se der match, comece falando de...',
];
