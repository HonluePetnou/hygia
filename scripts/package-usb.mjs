#!/usr/bin/env node
// Produit dist-usb/ : cahier des charges, archive du code source, OUTILS.md, docs/demo.md et
// documents/ (documents de soutenance en PDF, produits par `pnpm docs:pdf` dans docs/pdf/).
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const out = 'dist-usb';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const files = [
  ['docs/cahier-des-charges-hygia-g2.pdf', 'cahier-des-charges-hygia-g2.pdf'],
  ['OUTILS.md', 'OUTILS.md'],
  ['docs/demo.md', 'demo.md'],
];
for (const [src, name] of files) {
  if (!existsSync(src)) {
    console.error(`Fichier manquant : ${src}`);
    process.exit(1);
  }
  copyFileSync(src, join(out, name));
}

// Documents de soutenance lisibles sans rien installer : PDF, diagrammes dessinés.
const pdfs = existsSync('docs/pdf') ? readdirSync('docs/pdf').filter((name) => name.endsWith('.pdf')) : [];
if (pdfs.length === 0) {
  console.error('Aucun PDF dans docs/pdf : lancer `pnpm docs:pdf` avant.');
  process.exit(1);
}
mkdirSync(join(out, 'documents'), { recursive: true });
for (const name of pdfs) copyFileSync(join('docs/pdf', name), join(out, 'documents', name));

// `git archive` n'inclut que les fichiers suivis : ni node_modules, ni .env (ignorés par git).
const archive = spawnSync(
  'git',
  ['archive', '--format=tar.gz', '--prefix=hygia/', '-o', join(out, 'hygia-source.tar.gz'), 'HEAD'],
  { stdio: 'inherit' },
);
if (archive.status !== 0) process.exit(archive.status ?? 1);

console.log(`dist-usb/ prêt : ${files.length + 1} éléments et ${pdfs.length} documents PDF.`);
