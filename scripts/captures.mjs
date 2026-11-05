#!/usr/bin/env node
// Captures d'écran du manuel de présentation, prises dans la vraie démo (pnpm demo doit tourner).
// Pilote Chrome ou Edge installé (puppeteer-core, aucun navigateur téléchargé) comme un
// utilisateur : connexion avec un vrai code TOTP, navigation par clics (la session vit dans la page).
// Usage : pnpm demo  (dans un autre terminal), puis  pnpm docs:captures
import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const WEB = process.env.HYGIA_WEB_URL ?? 'http://localhost:3100';
const OUT = 'docs/captures';
const PASSWORD = 'Hygia-demo-2026';
// Secret TOTP commun des comptes de démonstration (services/identite/src/accounts/demo-accounts.ts).
const TOTP_SECRET = 'KRUGKIDROVUWG2ZAMJZG653OEBTYQSZY';
const FLORENCE = '00000000-0000-4000-8000-030000000001';
const ORDONNANCE = resolve('services/ingestion/fixtures/ordonnance-florence.png');

function base32(text) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of text) bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** Code TOTP (RFC 6238, SHA-1, 6 chiffres, 30 s) d'un pas donné. */
function totp(step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32(TOTP_SECRET)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

let lastStep = -1;
/** Code frais : l'Identité refuse un code déjà utilisé, on attend donc le pas suivant si besoin. */
async function freshCode() {
  for (;;) {
    const now = Date.now() / 1000;
    const step = Math.floor(now / 30);
    const left = 30 - (now % 30);
    if (step > lastStep && left > 6) {
      lastStep = step;
      return totp(step);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

function findBrowser() {
  const candidates = [
    process.env.HYGIA_BROWSER,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  const found = candidates.find((path) => path && existsSync(path));
  if (!found) throw new Error('Chrome ou Edge introuvable : HYGIA_BROWSER=chemin du navigateur.');
  return found;
}

const aria = (name) => `::-p-aria(${name})`;

async function waitText(page, text, timeout = 30_000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
}

async function shot(page, name, { fullPage = false } = {}) {
  await new Promise((r) => setTimeout(r, 800)); // fin des animations et des graphiques
  const path = `${OUT}/${name}.jpg`;
  await page.screenshot({ path, type: 'jpeg', quality: 82, fullPage });
  console.log(`✔ ${path}`);
}

/** Connexion complète sur la page courante (formulaire déjà affiché). */
async function signIn(page, email, { before } = {}) {
  await page.locator(aria('Adresse e-mail')).fill(email);
  await page.locator(aria('Mot de passe')).fill(PASSWORD);
  if (before) await shot(page, before.credentials);
  // « Service indisponible » juste après un redémarrage (disjoncteur du broker) : on réessaie.
  for (let attempt = 1; ; attempt += 1) {
    await page.locator(aria('Se connecter')).click();
    const outcome = await page.waitForFunction(
      () =>
        document.querySelector('[aria-label="Chiffre 1 sur 6"]')
          ? 'code'
          : document.body.innerText.includes('Service indisponible')
            ? 'indisponible'
            : false,
      { timeout: 30_000 },
    );
    if ((await outcome.jsonValue()) === 'code' || attempt === 3) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  await page.locator(aria('Chiffre 1 sur 6')).wait();
  if (before) await shot(page, before.code);
  await page.locator(aria('Chiffre 1 sur 6')).click();
  await page.keyboard.type(await freshCode());
  await page.locator(aria('Vérifier et continuer')).click();
  await page.waitForFunction(() => !location.pathname.startsWith('/connexion'), { timeout: 30_000 });
}

async function clickLink(page, href) {
  await page.locator(`a[href="${href}"]`).click();
  await page.waitForFunction((h) => location.pathname === h, { timeout: 30_000 }, href);
}

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: findBrowser(),
  headless: true,
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  args: ['--lang=fr-FR'],
});
const page = await browser.newPage();
page.setDefaultTimeout(30_000);

try {
  // ── Dr Aïcha Nana, médecin de l'équipe de Florence ─────────────────────────────────────────
  await page.goto(`${WEB}/connexion`, { waitUntil: 'networkidle2' });
  await signIn(page, 'aicha.nana@hd-bonassama.cm', {
    before: { credentials: '01-connexion', code: '02-code-2fa' },
  });
  await waitText(page, 'Consultations du jour');
  await shot(page, '03-tableau-de-bord');

  await clickLink(page, '/patients');
  await waitText(page, 'HYG-2024-00871');
  await shot(page, '04-patients');

  await page.locator(aria('Comparer et fusionner')).click();
  await waitText(page, 'Fusionner');
  await shot(page, '05-doublons');

  await clickLink(page, '/patients');
  await waitText(page, 'HYG-2024-00871');
  await page.locator(`a[href="/patients/${FLORENCE}"]`).click();
  await waitText(page, 'Résumé pré-consultation');
  await waitText(page, 'Risque de réadmission');
  await shot(page, '06-dossier', { fullPage: true });

  await clickLink(page, '/copilote');
  await waitText(page, 'Choisissez un patient');
  await shot(page, '07-copilote-choix');
  await page.locator(`a[href="/copilote/${FLORENCE}"]`).click();
  await page.locator(aria('Posez une question sur le dossier')).fill("Florence prend-elle de l'ibuprofène ?");
  await page.keyboard.press('Enter');
  await waitText(page, 'passage');
  await page.locator(aria('Posez une question sur le dossier')).fill('What did the echocardiography show?');
  await page.keyboard.press('Enter');
  await waitText(page, 'Answered in English');
  await shot(page, '08-copilote');

  await clickLink(page, '/import');
  const input = await page.$('input[type=file]');
  await input.uploadFile(ORDONNANCE);
  await waitText(page, 'en attente de validation');
  await shot(page, '09-import', { fullPage: true });

  await clickLink(page, '/alertes');
  await waitText(page, 'RAISONNEMENT');
  await shot(page, '10-alertes', { fullPage: true });

  // ── Dr Paul Kamga, hors équipe : bris de glace (lien direct, puis connexion) ───────────────
  await page.goto(`${WEB}/patients/${FLORENCE}`, { waitUntil: 'networkidle2' });
  await signIn(page, 'paul.kamga@cma-bepanda.cm');
  await waitText(page, 'Accès refusé');
  await shot(page, '11-acces-refuse');
  await page.locator(aria('Accès d’urgence')).click();
  await page.locator('input[type=radio]').click();
  await page.locator(aria('Précisions (obligatoire)')).fill('Patiente admise aux urgences, inconsciente');
  await shot(page, '12-bris-de-glace');
  await page.locator(aria('Ouvrir le dossier en urgence')).click();
  await waitText(page, 'Résumé pré-consultation');

  // ── Analyste : veille épidémiologique ───────────────────────────────────────────────────────
  await page.goto(`${WEB}/connexion`, { waitUntil: 'networkidle2' });
  await signIn(page, 'analyste@hygia.local');
  await waitText(page, 'Foyer anormal');
  await shot(page, '13-epidemiologie', { fullPage: true });

  // ── Florence, patiente : portail ────────────────────────────────────────────────────────────
  await page.goto(`${WEB}/connexion`, { waitUntil: 'networkidle2' });
  await signIn(page, 'florence.ngo@patient.hygia.local');
  await waitText(page, 'Qui a vu mon dossier');
  await waitText(page, 'Kamga');
  await shot(page, '14-portail', { fullPage: true });

  // ── DPO : journal d'audit ───────────────────────────────────────────────────────────────────
  await page.goto(`${WEB}/connexion`, { waitUntil: 'networkidle2' });
  await signIn(page, 'dpo@hygia.local');
  await waitText(page, 'Chaîne intègre');
  await shot(page, '15-audit', { fullPage: true });

  // ── Administrateur : comptes et supervision ─────────────────────────────────────────────────
  await page.goto(`${WEB}/connexion`, { waitUntil: 'networkidle2' });
  await signIn(page, 'admin@hygia.local');
  await waitText(page, 'Comptes et rôles');
  await waitText(page, 'Politique de sécurité');
  await shot(page, '16-administration', { fullPage: true });
  await clickLink(page, '/supervision');
  await waitText(page, 'Latence p95');
  await shot(page, '17-supervision', { fullPage: true });
} catch (error) {
  await page.screenshot({ path: `${OUT}/erreur.jpg`, type: 'jpeg', quality: 70 }).catch(() => {});
  console.error(`Échec à ${page.url()} : ${error.message} (capture : ${OUT}/erreur.jpg)`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
