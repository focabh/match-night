import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Match Night — conexões da noite',
  description: 'Match ao vivo, só neste evento. Acabou a noite, acabou tudo.',
};
export const viewport: Viewport = {
  themeColor: '#0a0710',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
