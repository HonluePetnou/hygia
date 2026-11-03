#!/usr/bin/env node
// Produit dist-usb/ : cahier des charges, archive du code source, OUTILS.md et docs/demo.md.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
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

// `git archive` n'inclut que les fichiers suivis : ni node_modules, ni .env (ignorés par git).
const archive = spawnSync(
  'git',
  ['archive', '--format=tar.gz', '--prefix=hygia/', '-o', join(out, 'hygia-source.tar.gz'), 'HEAD'],
  { stdio: 'inherit' },
);
if (archive.status !== 0) process.exit(archive.status ?? 1);

console.log(`dist-usb/ prêt : ${files.length + 1} éléments.`);
