import type { Account } from './account.js';

/** Jeton d'injection de `AccountRepository`. */
export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

/** Stockage des comptes (en mémoire ici ; Cognito / PostgreSQL ensuite). */
export interface AccountRepository {
  findById(id: string): Account | undefined;
  /** Recherche insensible à la casse. */
  findByEmail(email: string): Account | undefined;
  list(): Account[];
  /** Crée ou remplace un compte (la version est incrémentée par l'appelant). */
  save(account: Account): void;
}

/** Dépôt en mémoire. */
export class InMemoryAccountRepository implements AccountRepository {
  private readonly accounts = new Map<string, Account>();

  constructor(initial: Account[] = []) {
    initial.forEach((account) => this.save(account));
  }

  findById(id: string): Account | undefined {
    return this.accounts.get(id);
  }

  findByEmail(email: string): Account | undefined {
    const wanted = email.trim().toLowerCase();
    return [...this.accounts.values()].find((a) => a.email.toLowerCase() === wanted);
  }

  list(): Account[] {
    return [...this.accounts.values()];
  }

  save(account: Account): void {
    this.accounts.set(account.id, account);
  }
}
