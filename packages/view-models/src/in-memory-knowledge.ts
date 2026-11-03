import type { demoDataset } from '@hygia/fhir';
import type { CopiloteSource } from './types.js';

/** Jeu de données utilisé par les implémentations en mémoire. */
export type Dataset = typeof demoDataset;

interface Passage {
  id: string;
  patientId: string;
  title: string;
  date: string;
  text: string;
}

const normalize = (text: string): string[] =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);

const patientIdOf = (subject: { reference: string }): string =>
  subject.reference.split('/')[1] ?? '';

/** Passages recherchables d'un jeu de données (documents et données structurées). */
export class InMemoryKnowledge {
  private readonly passages: Passage[];

  constructor(dataset: Dataset) {
    this.passages = [
      ...dataset.documents.map((d) => ({
        id: d.id,
        patientId: patientIdOf(d.subject),
        title: d.title,
        date: d.date,
        text: `${d.documentType} ${d.title}`,
      })),
      ...dataset.observations.map((o) => ({
        id: o.id,
        patientId: patientIdOf(o.subject),
        title: o.code.display,
        date: o.effectiveDate,
        text: `${o.code.display} ${o.value} ${o.unit}`,
      })),
      ...dataset.conditions.map((c) => ({
        id: c.id,
        patientId: patientIdOf(c.subject),
        title: c.code.display,
        date: c.onsetDate,
        text: c.code.display,
      })),
      ...dataset.medicationRequests.map((m) => ({
        id: m.id,
        patientId: patientIdOf(m.subject),
        title: m.medication.display,
        date: m.authoredOn,
        text: `${m.medication.display} ${m.dosage.doseValue} ${m.dosage.doseUnit}`,
      })),
    ];
  }

  /** Meilleurs passages du patient pour la requête (aucun si aucun mot en commun). */
  search(patientId: string, query: string, limit: number): CopiloteSource[] {
    const words = new Set(normalize(query));
    return this.passages
      .filter((p) => p.patientId === patientId)
      .map((p) => ({ p, score: normalize(p.text).filter((w) => words.has(w)).length }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || b.p.date.localeCompare(a.p.date))
      .slice(0, limit)
      .map(({ p }, index) => ({
        n: index + 1,
        documentId: p.id,
        titre: p.title,
        date: p.date,
        extrait: p.text,
      }));
  }
}
