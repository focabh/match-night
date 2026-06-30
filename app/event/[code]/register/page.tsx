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
    photo_url: '', bio: '', prompt: '', intention: '', instagram: '',
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
    if (!f.photo_url) return fail('Adicione sua foto.');
    if (!f.display_name.trim()) return fail('Diga seu nome ou apelido.');
    if (!f.birthdate) return fail('Informe sua data de nascimento.');
    if (!f.gender) return fail('Escolha como você se identifica.');
    if (!f.interested_in) return fail('Escolha o que você quer ver.');
    if (!(f.bio || f.prompt).trim()) return fail('Escreva uma frase de apresentação.');
    if (!f.intention) return fail('Escolha sua intenção da noite.');
    if (!ev) return fail('Carregando o evento… tente de novo em 1s.');
    setBusy(true);
    try {
      await api.join(ev.event_id, getUserId(), f);
      saveProfile(f);
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
        <Photo value={f.photo_url} onChange={(v) => set('photo_url', v)} />

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
          <label className="label">Instagram (opcional)</label>
          <input className="input" value={f.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="@seu.user" autoCapitalize="none" />
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
            className="mt-2 block text-xs font-semibold text-glow2 underline">usar foto de teste</button>
          {err && <p className="mt-1 text-xs text-glow">{err}</p>}
        </div>
      </div>
    </div>
  );
}
