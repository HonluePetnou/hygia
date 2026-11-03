// Affiche le code TOTP courant des comptes de démonstration (soutenance).
// Le secret doit rester identique à DEMO_TOTP_SECRET (src/accounts/demo-accounts.ts).
import { generate } from 'otplib';

const DEMO_TOTP_SECRET = 'KRUGKIDROVUWG2ZAMJZG653OEBTYQSZY';
const code = await generate({ secret: DEMO_TOTP_SECRET });
const left = 30 - (Math.floor(Date.now() / 1000) % 30);
console.log(`Code 2FA de démonstration : ${code} (encore ${left} s)`);
console.log(`Secret à saisir dans une application d'authentification : ${DEMO_TOTP_SECRET}`);
