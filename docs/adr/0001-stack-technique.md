# ADR 0001 — Stack technique

- Statut : accepté
- Date : 2026-11-02

## Contexte

Le cahier des charges (sections 6, 7, 9 et 12) impose une architecture en trois étages avec broker,
micro-services, tubes et filtres, MVVM et multi-agents, déployée sur AWS. Une alternative Laravel
a été envisagée pour aller plus vite sur la première tranche.

## Décision

Garder la stack du cahier : TypeScript (NestJS, Next.js, Expo, MobX, Prisma) dans un monorepo
pnpm + Turborepo, Python pour les agents IA, AWS simulé en local par LocalStack.

## Conséquences

- Le code livré correspond au cahier des charges imprimé.
- Les vues-modèles MobX sont partagées entre le web et le mobile (argument MVVM).
- Laravel est écarté : son patron MVC est explicitement non retenu (section 6.7).
- Les micro-services restent indépendants du langage ; un service pourra changer de technologie sans toucher aux autres.
