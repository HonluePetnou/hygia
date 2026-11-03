import bcrypt from 'bcryptjs';

/** Jeton d'injection de `PasswordHasher`. */
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/** Hachage des secrets (mots de passe, codes de secours). */
export interface PasswordHasher {
  hash(secret: string): Promise<string>;
  verify(secret: string, hash: string): Promise<boolean>;
}

/** Hachage bcrypt salé ; le coût est configurable (`IDENTITE_BCRYPT_COST`). */
export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly cost: number) {}

  hash(secret: string): Promise<string> {
    return bcrypt.hash(secret, this.cost);
  }

  verify(secret: string, hash: string): Promise<boolean> {
    return bcrypt.compare(secret, hash);
  }
}
