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

export type DeckPerson = {
  participant_id: string;
  display_name: string;
  age: number;
  gender: string;
  bio: string | null;
  profile_prompt: string | null;
  night_intention: string;
  photo_url: string;
};

export type MatchRow = {
  match_id: string;
  participant_id: string;
  display_name: string;
  age: number;
  photo_url: string;
  night_intention: string;
  instagram: string | null;
};

export type ProfileInput = {
  display_name: string;
  birthdate: string; // yyyy-mm-dd
  gender: string;
  interested_in: string;
  photo_url: string;
  bio: string;
  prompt: string;
  intention: string;
  instagram?: string;
};

export const GENDERS = [
  { v: 'woman', l: 'Mulher' },
  { v: 'man', l: 'Homem' },
  { v: 'nonbinary', l: 'Não-binário' },
  { v: 'other', l: 'Prefiro me descrever' },
];
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
