const { chromium } = require('playwright');
const BASE = 'https://match-night-bh.vercel.app';
const OUT = 'C:/Claude Code/match-night/_setup';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message.slice(0, 140)));

  // 1) Landing
  await p.goto(BASE + '/join/demo', { waitUntil: 'networkidle', timeout: 45000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: OUT + '/mn_1_landing.png' });

  // 18+ e entrar
  await p.locator('input[type=checkbox]').first().check();
  await p.getByText('Entrar na noite', { exact: false }).first().click();
  await p.waitForTimeout(2500); // -> register

  // 2) Cadastro
  await p.locator('input[placeholder*="URL"]').fill('https://randomuser.me/api/portraits/men/32.jpg');
  await p.locator('input[placeholder*="chamam"]').fill('Arnaldo');
  await p.locator('input[type=date]').fill('1990-05-10');
  await p.getByText('Homem', { exact: true }).click();
  await p.getByText('Mulheres', { exact: true }).click();
  await p.locator('textarea').fill('Vim curtir a noite e conhecer gente boa');
  await p.getByText('Quero paquerar', { exact: true }).click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '/mn_2_register.png' });
  await p.getByText('Entrar na noite', { exact: false }).last().click();
  await p.waitForTimeout(3500); // -> deck

  // 3) Deck
  await p.screenshot({ path: OUT + '/mn_3_deck.png' });

  // 4) Like (botão coração) -> match (autolike demo)
  await p.locator('button:has-text("❤")').first().click().catch(() => {});
  await p.waitForTimeout(2500);
  await p.screenshot({ path: OUT + '/mn_4_match.png' });

  const url = p.url();
  console.log('URL=' + url);
  console.log('ERRS=' + JSON.stringify(errs.slice(0, 6)));
  await b.close();
})().catch(e => { console.log('FATAL ' + e.message); process.exit(0); });
