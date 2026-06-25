'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import { getUserId, loadProfile, saveProfile } from '@/lib/session';
import { GENDERS, INTERESTS, INTENTIONS, PROMPTS, type EventPublic, type ProfileInput } from '@/lib/types';
import { EventEnded } from '@/components/States';

const ERRORS: Record<string, string> = {
  underage: 'Você precisa ter 18 anos ou mais.',
  missing_required_fields: 'Preencha todos os campos obrigatórios.',
  bio_or_prompt_required: 'Escreva uma frase de apresentação.',
  event_not_active: 'Este evento não está mais ativo.',
};

export default function Register() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [ev, setEv] = useState<EventPublic | null>(null);
  const saved = typeof window !== 'undefined' ? loadProfile<ProfileInput>() : null;
  const [f, setF] = useState<ProfileInput>(saved ?? {
    display_name: '', birthdate: '', gender: '', interested_in: '',
    photo_url: '', bio: '', prompt: '', intention: '', instagram: '',
  });
  const [promptIdx, setPromptIdx] = useState(0);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.eventByCode(code).then((e) => setEv(e)).catch(() => {}); }, [code]);
  if (ev && (ev.ended || !ev.is_live)) return <EventEnded name={ev.name} />;

  const set = (k: keyof ProfileInput, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    setErr('');
    if (!f.display_name || !f.birthdate || !f.gender || !f.interested_in || !f.photo_url || !f.intention)
      return setErr('Preencha todos os campos obrigatórios.');
    if (!(f.bio || f.prompt)) return setErr('Escreva uma frase de apresentação.');
    setBusy(true);
    try {
      await api.join(ev!.event_id, getUserId(), f);
      saveProfile(f);
      router.push(`/event/${code}/deck`);
    } catch (e: any) {
      const key = String(e.message || '').replace(/^.*?:/, '').trim();
      setErr(ERRORS[key] || 'Não foi possível entrar. Confira os dados.');
    } finally { setBusy(false); }
  }

  return (
    <main className="px-6 pt-10 pb-28">
      <h1 className="text-2xl font-black">Seu perfil da noite</h1>
      <p className="mt-1 text-sm text-muted">Rápido. Só o suficiente pra darem match com você.</p>

      <div className="mt-6 space-y-4">
        <Photo value={f.photo_url} onChange={(v) => set('photo_url', v)} />

        <div>
          <label className="label">Nome / apelido *</label>
          <input className="input" value={f.display_name} onChange={(e) => set('display_name', e.target.value)} placeholder="Como te chamam?" />
        </div>
        <div>
          <label className="label">Data de nascimento *</label>
          <input className="input" type="date" value={f.birthdate} onChange={(e) => set('birthdate', e.target.value)} />
        </div>

        <Picker label="Você é *" opts={GENDERS} value={f.gender} onPick={(v) => set('gender', v)} />
        <Picker label="Quer ver *" opts={INTERESTS} value={f.interested_in} onPick={(v) => set('interested_in', v)} />

        <div>
          <label className="label">Apresentação *</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {PROMPTS.map((p, i) => (
              <button key={i} onClick={() => setPromptIdx(i)}
                className={`chip ${promptIdx === i ? 'bg-glow2 border-glow2 text-white' : 'border-line text-muted'}`}>
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
              <button key={it} onClick={() => set('intention', it)}
                className={`chip ${f.intention === it ? 'bg-glow border-glow text-white' : 'border-line text-muted'}`}>
                {it}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Instagram (opcional)</label>
          <input className="input" value={f.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="@seu.user" autoCapitalize="none" />
        </div>
      </div>

      {err && <p className="mt-4 text-sm font-semibold text-glow">{err}</p>}

      <div className="fixed inset-x-0 bottom-0">
        <div className="shell px-6 py-4 bg-ink/90 backdrop-blur border-t border-line">
          <button disabled={busy} onClick={submit} className="btn w-full bg-glow py-4 text-white text-lg shadow-neon">
            {busy ? 'Entrando…' : 'Entrar na noite'}
          </button>
        </div>
      </div>
    </main>
  );
}

function Picker({ label, opts, value, onPick }: { label: string; opts: { v: string; l: string }[]; value: string; onPick: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => (
          <button key={o.v} onClick={() => onPick(o.v)}
            className={`chip ${value === o.v ? 'bg-glow2 border-glow2 text-white' : 'border-line text-muted'}`}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

// Upload REAL pro Supabase Storage (bucket mn-photos, público).
function Photo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [up, setUp] = useState(false);
  const [err, setErr] = useState('');

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    if (file.size > 5_242_880) { setErr('Foto até 5MB.'); return; }
    setUp(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${getUserId()}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('mn-photos').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('mn-photos').getPublicUrl(path);
      onChange(data.publicUrl);
    } catch {
      setErr('Não rolou enviar a foto. Tente outra.');
    } finally { setUp(false); }
  }

  return (
    <div>
      <label className="label">Sua foto *</label>
      <div className="flex items-center gap-4">
        <label className="relative h-24 w-24 shrink-0 rounded-2xl bg-card border border-line overflow-hidden grid place-items-center cursor-pointer">
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <span className="text-3xl">📷</span>}
          {up && <div className="absolute inset-0 grid place-items-center bg-black/60 text-xs font-bold">enviando…</div>}
          <input type="file" accept="image/*" capture="user" onChange={pick} className="hidden" />
        </label>
        <div className="flex-1">
          <label className="btn inline-block bg-glow2 px-4 py-2 text-sm text-white cursor-pointer">
            {value ? 'Trocar foto' : 'Adicionar foto'}
            <input type="file" accept="image/*" capture="user" onChange={pick} className="hidden" />
          </label>
          <button type="button" onClick={() => onChange(`https://randomuser.me/api/portraits/${Math.random() > 0.5 ? 'women' : 'men'}/${Math.floor(Math.random() * 90)}.jpg`)}
            className="mt-2 block text-xs font-semibold text-muted">usar foto de teste</button>
          {err && <p className="mt-1 text-xs text-glow">{err}</p>}
        </div>
      </div>
    </div>
  );
}
