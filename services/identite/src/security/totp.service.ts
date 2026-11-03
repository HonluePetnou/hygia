import { Injectable } from '@nestjs/common';
import { generate, generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';

/** Nom de l'émetteur affiché dans l'application d'authentification. */
export const TOTP_ISSUER = 'HYGIA';

/** Tolérance d'horloge : un pas de 30 s avant et après. */
const TOLERANCE_SECONDS = 30;

/** Mot de passe à usage unique basé sur le temps (RFC 6238), compatible Google Authenticator. */
@Injectable()
export class TotpService {
  /** Nouveau secret aléatoire (base32). */
  newSecret(): string {
    return generateSecret();
  }

  /** URI `otpauth://` à encoder dans le QR code. */
  uri(secret: string, accountLabel: string): string {
    return generateURI({ issuer: TOTP_ISSUER, label: accountLabel, secret });
  }

  /** QR code de l'URI, sous forme d'URL `data:image/png`. */
  qrCode(uri: string): Promise<string> {
    return QRCode.toDataURL(uri, { margin: 1, width: 240 });
  }

  /** Code attendu à l'instant `at` (démonstration et tests). */
  currentCode(secret: string, at: Date): Promise<string> {
    return generate({ secret, epoch: Math.floor(at.getTime() / 1000) });
  }

  /** Vrai si `code` (6 chiffres) est valide à l'instant `at`. */
  async check(secret: string, code: string, at: Date): Promise<boolean> {
    if (!/^\d{6}$/.test(code)) return false;
    const result = await verify({
      secret,
      token: code,
      epoch: Math.floor(at.getTime() / 1000),
      epochTolerance: TOLERANCE_SECONDS,
    });
    return result.valid;
  }
}
