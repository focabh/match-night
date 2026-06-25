'use client';
import { useRouter } from 'next/navigation';

function Wrap({ emoji, title, text, children }: { emoji: string; title: string; text: string; children?: React.ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-8 text-center">
      <div className="text-6xl">{emoji}</div>
      <h1 className="mt-5 text-2xl font-black">{title}</h1>
      <p className="mt-3 max-w-xs text-muted leading-relaxed">{text}</p>
      {children}
    </main>
  );
}

export function EventEnded({ name }: { name: string }) {
  const r = useRouter();
  return (
    <Wrap emoji="🌙" title="Esse evento já terminou"
      text="As conexões dessa noite eram ao vivo e temporárias. Quando o evento acaba, os perfis, matches e conversas deixam de ficar disponíveis.">
      <button onClick={() => r.push('/')} className="btn mt-7 bg-card border border-line px-6 py-3">
        Voltar para o início
      </button>
    </Wrap>
  );
}

export function LeftEvent({ code }: { code: string }) {
  const r = useRouter();
  return (
    <Wrap emoji="👋" title="Você saiu deste evento"
      text="Sua participação, matches e interações desta noite não ficam mais disponíveis. Pra voltar, é só entrar de novo enquanto o evento estiver rolando.">
      <button onClick={() => r.push(`/join/${code}`)} className="btn mt-7 bg-glow2 px-6 py-3 text-white">
        Entrar de novo
      </button>
    </Wrap>
  );
}

export function EmptyDeck({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="text-5xl">🍸</div>
      <h2 className="mt-4 text-xl font-black">Por enquanto é isso</h2>
      <p className="mt-2 text-muted">Você já viu todo mundo que está aqui agora. Chega gente o tempo todo — volta já já.</p>
      <button onClick={onRefresh} className="btn mt-6 bg-card border border-line px-6 py-3">Atualizar</button>
    </div>
  );
}
