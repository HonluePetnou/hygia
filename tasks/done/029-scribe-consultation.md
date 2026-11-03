# 029 - Scribe de consultation

**Phase** : 7 — Fonctionnalités Should
**Dépend de** : 006, 028
**Maquettes** : `docs/maquettes/18-mobile-scribe.png` — ouvre ces images avant de coder pour la mise en page ; en cas de doute, le texte de la tâche fait foi.

## Contexte

RF9, section 8.4 et maquette « 18 · scribe de consultation » : la consultation est
enregistrée avec l'accord du patient, transcrite (Amazon Transcribe en français en
production), puis structurée en brouillon FHIR (motif, examen, diagnostic CIM-10,
prescriptions). Le médecin corrige et valide ; rien n'est enregistré sans sa validation ;
l'audio est supprimé après validation.

## Objectif

Ajouter le scribe au service IA clinique, au mobile et au web.

## Critères de fini

- Interface `Transcriber` (implémentation simulée qui renvoie une transcription fictive ;
  Transcribe plus tard) et structuration via `ClinicalLanguageModel` en brouillon FHIR.
- Endpoints : démarrer (vérifie le consentement « enregistrement audio »), envoyer l'audio,
  obtenir le brouillon, valider (crée les ressources dans le service Dossiers, supprime
  l'audio), rejeter.
- Mobile : écran Scribe (enregistrement avec onde et durée, mention du consentement,
  brouillon structuré « À valider », boutons Corriger / Valider et enregistrer). Web : bouton
  « Dicter » dans le dossier.
- Tests : refus sans consentement, brouillon structuré, validation crée les ressources et
  supprime l'audio, rejet ne crée rien.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/ia-clinique/*`, `apps/mobile/*`, `apps/web/src/app/(app)/patients/[id]/*`.
