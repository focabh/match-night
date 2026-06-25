import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0710',        // fundo noturno
        ink2: '#140d1f',
        card: '#1b1326',
        line: '#2c2138',
        glow: '#ff3d7f',       // rosa neon (curtir)
        glow2: '#7b5cff',      // roxo (marca)
        amber: '#ffb547',
        muted: '#a99fb5',
      },
      fontFamily: { display: ['ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { neon: '0 0 40px -8px rgba(255,61,127,.55)', up: '0 -8px 30px -10px rgba(0,0,0,.6)' },
      keyframes: {
        pop: { '0%': { transform: 'scale(.8)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
      },
      animation: { pop: 'pop .25s ease-out' },
    },
  },
  plugins: [],
};
export default config;
