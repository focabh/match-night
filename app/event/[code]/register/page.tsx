'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import { getUserId, loadProfile, saveProfile } from '@/lib/session';
import { GENDERS, INTERESTS, INTENTIONS, PROMPTS, type EventPublic, type ProfileInput } from '@/lib/types';
import { themeOf } from '@/lib/studio';
import { EventEnded } from '@/components/States';

const ERRORS: Record<string, string> = {
  underage: 'Você precisa ter 18 anos ou mais.',
  missing_required_fields: 'Preencha todos os campos obrigatórios.',
  bio_or_prompt_required: 'Escreva uma frase de apresentação.',
  event_not_active: 'Este evento não está mais ativo.',
  event_not_found: 'Não achamos esse evento.',
  consent_required: 'Confirme que tem 18 anos ou mais.',
};

export default function Register() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [ev, setEv] = useState<EventPublic | null>(null);
  const saved = typeof window !== 'undefined' ? loadProfile<ProfileInput>() : null;
  const [f, setF] = useState<ProfileInput>(saved ?? {
    display_name: '', birthdate: '', gender: '', interested_in: '',
    photo_url: '', photos: [], bio: '', prompt: '', intention: '', instagram: '', socials: {},
  });
  const [promptIdx, setPromptIdx] = useState(0);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const errRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { api.eventByCode(code).then((e) => setEv(e)).catch(() => {}); }, [code]);
  if (ev && (ev.ended || !ev.is_live)) return <EventEnded name={ev.name} />;

  const set = (k: keyof ProfileInput, v: string) => { setF((p) => ({ ...p, [k]: v })); if (err) setErr(''); };

  function fail(msg: string) {
    setErr(msg);
    setBusy(false);
    // garante que o erro fica visível (não some no fim da página)
    setTimeout(() => errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }

  async function submit() {
    if (busy) return;
    setErr('');
    const photos = f.photos || [];
    if (photos.length === 0) return fail('Adicione pelo menos uma foto.');
    if (!f.display_name.trim()) return fail('Diga seu nome ou apelido.');
    if (!f.birthdate) return fail('Informe sua data de nascimento.');
    if (!f.gender) return fail('Escolha como você se identifica.');
    if (!f.interested_in) return fail('Escolha o que você quer ver.');
    if (!(f.bio || f.prompt).trim()) return fail('Escreva uma frase de apresentação.');
    if (!f.intention) return fail('Escolha sua intenção da noite.');
    if (!ev) return fail('Carregando o evento… tente de novo em 1s.');
    setBusy(true);
    try {
      const socials = {
        instagram: f.instagram?.trim() || undefined,
        spotify: f.socials?.spotify?.trim() || undefined,
        tiktok: f.socials?.tiktok?.trim() || undefined,
      };
      const payload: ProfileInput = { ...f, photos, photo_url: photos[0], socials };
      await api.join(ev.event_id, getUserId(), payload);
      saveProfile(payload);
      router.push(`/event/${code}/deck`);
    } catch (e: any) {
      const key = String(e?.message || '').replace(/^.*?:/, '').trim();
      fail(ERRORS[key] || 'Não foi possível entrar. Confira os dados e tente de novo.');
    }
  }

  return (
    <main className="px-5 py-8">
      <h1 className="text-2xl font-black text-white">Seu perfil da noite</h1>
      <p className="mt-1 text-sm text-muted">Rápido. Só o suficiente pra darem match com você.</p>

      <div className="mt-6 space-y-5">
        <PhotoGallery photos={f.photos || []} onChange={(arr) => { setF((p) => ({ ...p, photos: arr, photo_url: arr[0] || '' })); if (err) setErr(''); }} />

        <div>
          <label className="label">Nome / apelido *</label>
          <input className="input" value={f.display_name} onChange={(e) => set('display_name', e.target.value)} placeholder="Como te chamam?" />
        </div>
        <div>
          <label className="label">Data de nascimento *</label>
          <input className="input" type="date" value={f.birthdate} onChange={(e) => set('birthdate', e.target.value)} />
        </div>

        <Picker label="Você é *" opts={GENDERS} value={f.gender} onPick={(v) => set('gender', v)} accent="glow2" />
        <Picker label="Quer ver *" opts={INTERESTS} value={f.interested_in} onPick={(v) => set('interested_in', v)} accent="glow2" />

        <div>
          <label className="label">Apresentação *</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {PROMPTS.map((p, i) => (
              <button key={i} type="button" onClick={() => setPromptIdx(i)}
                className={`chip ${promptIdx === i ? 'bg-glow2 border-glow2 text-white' : 'bg-card border-line text-white/80'}`}>
                {p.replace('...', '')}
              </button>
            ))}
          </div>
          <textarea className="input" rows={2} maxLength={160} placeholder={PROMPTS[promptIdx]}
            value={f.prompt} onChange={(e) => set('prompt', e.target.value)} />
        </div>

        <div>
          <label className="label">Intenção da noite *</label>
          <div className="flex flex-wrap gap-2">
            {INTENTIONS.map((it) => (
              <button key={it} type="button" onClick={() => set('intention', it)}
                className={`chip ${f.intention === it ? 'bg-glow border-glow text-white' : 'bg-card border-line text-white/80'}`}>
                {it}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Redes sociais (opcional)</label>
          <p className="-mt-1 mb-2 text-xs text-muted">Aparecem pra quem der match com você.</p>
          <div className="space-y-2">
            <SocialInput icon="📸" prefix="@" placeholder="instagram" value={f.instagram || ''} onChange={(v) => set('instagram', v)} />
            <SocialInput icon="🎵" prefix="@" placeholder="tiktok" value={f.socials?.tiktok || ''} onChange={(v) => setF((p) => ({ ...p, socials: { ...p.socials, tiktok: v } }))} />
            <SocialInput icon="🎧" prefix="" placeholder="spotify (perfil ou playlist)" value={f.socials?.spotify || ''} onChange={(v) => setF((p) => ({ ...p, socials: { ...p.socials, spotify: v } }))} />
          </div>
        </div>
      </div>

      <div ref={errRef}>
        {err && (
          <p className="mt-6 rounded-2xl border border-glow/50 bg-glow/15 px-4 py-3 text-sm font-semibold text-white">
            {err}
          </p>
        )}
      </div>

      <button disabled={busy} onClick={submit}
        className="btn mt-6 w-full py-4 text-white text-lg shadow-neon" style={{ background: themeOf(ev).button }}>
        {busy ? 'Entrando…' : 'Entrar na noite'}
      </button>
      <p className="mt-3 text-center text-xs text-muted">Seu perfil vale só nesta noite. Acabou o evento, some tudo.</p>
    </main>
  );
}

function Picker({ label, opts, value, onPick, accent }: { label: string; opts: { v: string; l: string }[]; value: string; onPick: (v: string) => void; accent: 'glow' | 'glow2' }) {
  const on = accent === 'glow' ? 'bg-glow border-glow text-white' : 'bg-glow2 border-glow2 text-white';
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => (
          <button key={o.v} type="button" onClick={() => onPick(o.v)}
            className={`chip ${value === o.v ? on : 'bg-card border-line text-white/80'}`}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function SocialInput({ icon, prefix, placeholder, value, onChange }: { icon: string; prefix: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-card border border-line px-3">
      <span className="text-lg">{icon}</span>
      {prefix && <span className="text-muted">{prefix}</span>}
      <input className="w-full bg-transparent py-3 text-white placeholder:text-muted outline-none" value={value}
        onChange={(e) => onChange(e.target.value.replace(/^@/, ''))} placeholder={placeholder} autoCapitalize="none" />
    </div>
  );
}

// Galeria de fotos estilo Tinder: até 6, multi-seleção da galeria do celular,
// 1ª foto = capa, remover e "tornar capa". Upload real pro Supabase Storage.
const MAX_PHOTOS = 6;
function PhotoGallery({ photos, onChange }: { photos: string[]; onChange: (arr: string[]) => void }) {
  const [up, setUp] = useState(false);
  const [err, setErr] = useState('');

  async function uploadOne(file: File): Promise<string | null> {
    if (file.size > 8_388_608) { setErr('Cada foto até 8MB.'); return null; }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${getUserId()}/${Date.now()}-${Math.floor(performance.now())}.${ext}`;
    const { error } = await supabase.storage.from('mn-photos').upload(path, file, { upsert: true, contentType: file.type });
    if (error) return null;
    return supabase.storage.from('mn-photos').getPublicUrl(path).data.publicUrl;
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setErr(''); setUp(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      const urls: string[] = [];
      for (const file of files.slice(0, room)) { const u = await uploadOne(file); if (u) urls.push(u); }
      if (urls.length) onChange([...photos, ...urls]);
      else if (!err) setErr('Não rolou enviar. Tente outra foto.');
    } finally { setUp(false); }
  }
  const remove = (i: number) => onChange(photos.filter((_, j) => j !== i));
  const makeCover = (i: number) => onChange([photos[i], ...photos.filter((_, j) => j !== i)]);

  const cells = Array.from({ length: MAX_PHOTOS });
  return (
    <div>
      <label className="label">Suas fotos * <span className="text-muted">(a 1ª é a capa · arraste a galeria)</span></label>
      <div className="grid grid-cols-3 gap-2">
        {cells.map((_, i) => {
          const url = photos[i];
          if (url) return (
            <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-card">
              <img src={url} alt="" className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-glow px-2 py-0.5 text-[9px] font-black text-white">CAPA</span>}
              <button type="button" onClick={() => remove(i)} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs text-white">✕</button>
              {i !== 0 && <button type="button" onClick={() => makeCover(i)} className="absolute inset-x-1 bottom-1 rounded-full bg-black/60 py-0.5 text-[10px] font-bold text-white">★ capa</button>}
            </div>
          );
          const isNext = i === photos.length;
          return (
            <label key={i} className={`grid aspect-[3/4] cursor-pointer place-items-center rounded-2xl border-2 border-dashed ${isNext ? 'border-glow2 bg-glow2/10' : 'border-line bg-card/40'}`}>
              <span className={`text-2xl ${isNext ? 'text-glow2' : 'text-muted'}`}>＋</span>
              <input type="file" accept="image/*" multiple onChange={pick} className="hidden" disabled={up} />
            </label>
          );
        })}
      </div>
      {up && <p className="mt-1 text-xs text-glow2">enviando fotos…</p>}
      {err && <p className="mt-1 text-xs text-glow">{err}</p>}
      <button type="button"
        onClick={() => { const room = MAX_PHOTOS - photos.length; const extra = Array.from({ length: Math.min(room, 3) }, () => `https://randomuser.me/api/portraits/${Math.random() > 0.5 ? 'women' : 'men'}/${Math.floor(Math.random() * 90)}.jpg`); onChange([...photos, ...extra]); }}
        className="mt-2 text-xs font-semibold text-glow2 underline">usar fotos de teste</button>
    </div>
  );
}
