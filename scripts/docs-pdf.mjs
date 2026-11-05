#!/usr/bin/env node
// Convertit les documents de soutenance (Markdown) en PDF, diagrammes Mermaid dessinés :
// Markdown → HTML (marked) → diagrammes (mermaid, local, sans Internet) → PDF (Chrome/Edge headless).
// Usage : pnpm docs:pdf  (navigateur imposé : HYGIA_BROWSER=chemin\vers\chrome.exe)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Marked } from 'marked';

const DOCUMENTS = [
  ['docs/architecture.md', 'HYGIA - Dossier d architecture.pdf'],
  ['docs/tests.md', 'HYGIA - Plan et rapport de tests.pdf'],
  ['docs/guide-utilisateur.md', 'HYGIA - Guide utilisateur.pdf'],
  ['docs/exploitation.md', 'HYGIA - Documentation d exploitation.pdf'],
  ['docs/demo.md', 'HYGIA - Scenario de demonstration.pdf'],
  ['docs/adr/0001-stack-technique.md', 'HYGIA - ADR 0001 Stack technique.pdf'],
  ['docs/adr/0002-persistance-dossiers.md', 'HYGIA - ADR 0002 Persistance des dossiers.pdf'],
];
const OUT = 'docs/pdf';

function findBrowser() {
  const candidates = [
    process.env.HYGIA_BROWSER,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  const found = candidates.find((path) => path && existsSync(path));
  if (!found) {
    console.error('Chrome, Edge ou Chromium introuvable : HYGIA_BROWSER=chemin du navigateur.');
    process.exit(1);
  }
  return found;
}

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const marked = new Marked({
  gfm: true,
  renderer: {
    // Bloc ```mermaid → <pre class="mermaid"> (mermaid décode les entités, <br/> compris).
    code({ text, lang }) {
      if (lang === 'mermaid') return `<pre class="mermaid">${escapeHtml(text)}</pre>\n`;
      return `<pre><code>${escapeHtml(text)}</code></pre>\n`;
    },
  },
});

const STYLE = `
  @page { size: A4; margin: 18mm 16mm 20mm; }
  body { font-family: "Segoe UI", Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #1f2933; }
  h1 { font-size: 20pt; color: #0f5f57; border-bottom: 2px solid #0f766e; padding-bottom: 4pt; margin-top: 0; }
  h2 { font-size: 14pt; color: #0f5f57; margin-top: 18pt; break-after: avoid; }
  h3 { font-size: 12pt; color: #134e4a; break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 9pt; break-inside: auto; }
  th, td { border: 1px solid #cbd5e1; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #e6f4f1; }
  tr { break-inside: avoid; }
  code { font-family: Consolas, "Courier New", monospace; font-size: 9pt; background: #f1f5f9; padding: 0 2pt; border-radius: 2pt; }
  pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 6pt; white-space: pre-wrap; break-inside: avoid; }
  pre code { background: none; padding: 0; }
  pre.mermaid { background: none; border: none; text-align: center; }
  pre.mermaid svg { max-width: 100%; height: auto; }
  blockquote { border-left: 3px solid #0f766e; margin-left: 0; padding-left: 10pt; color: #475569; }
  .pied { position: fixed; bottom: -12mm; left: 0; right: 0; font-size: 8pt; color: #94a3b8; text-align: center; }
`;

function page(title, body, mermaidUrl) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${STYLE}</style></head><body>
${body}
<div class="pied">HYGIA · Groupe G2 · ENSPD GIT 5 · Architecture logicielle et objets répartis</div>
<script src="${mermaidUrl}"></script>
<script>
  mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict',
                       flowchart: { htmlLabels: true }, fontFamily: 'Segoe UI, Arial, sans-serif' });
  mermaid.run({ querySelector: 'pre.mermaid' }).finally(() => { document.body.dataset.pret = '1'; });
</script></body></html>`;
}

const browser = findBrowser();
const mermaidUrl = pathToFileURL(resolve('node_modules/mermaid/dist/mermaid.min.js')).href;
const work = join(tmpdir(), `hygia-docs-${process.pid}`);
mkdirSync(work, { recursive: true });
mkdirSync(OUT, { recursive: true });

let failures = 0;
for (const [source, name] of DOCUMENTS) {
  const markdown = readFileSync(source, 'utf8');
  const title = (markdown.match(/^#\s+(.+)$/m)?.[1] ?? name).trim();
  const html = join(work, `${name}.html`);
  writeFileSync(html, page(title, marked.parse(markdown), mermaidUrl));
  const pdf = resolve(OUT, name);
  rmSync(pdf, { force: true });
  spawnSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      '--allow-file-access-from-files',
      // Temps virtuel laissé à mermaid pour dessiner avant l'impression.
      '--virtual-time-budget=20000',
      `--print-to-pdf=${pdf}`,
      pathToFileURL(html).href,
    ],
    { stdio: 'ignore', timeout: 120_000 },
  );
  if (existsSync(pdf) && statSync(pdf).size > 0) {
    console.log(`✔ ${name} (${Math.round(statSync(pdf).size / 1024)} Ko)`);
  } else {
    console.error(`✘ ${name} : PDF non produit`);
    failures += 1;
  }
}
// HYGIA_DOCS_GARDER_HTML=1 : garde les pages HTML intermédiaires (relecture, captures).
if (process.env.HYGIA_DOCS_GARDER_HTML === '1') console.log(`Pages HTML : ${work}`);
else rmSync(work, { recursive: true, force: true });
process.exit(failures === 0 ? 0 : 1);
