import { createTranslator, formatDate } from '@hygia/i18n';
import type { AllergyIntolerance, Language, MedicationRequest, Patient } from '@hygia/types';
import type { TimelineEvent } from '../patients/timeline.js';
import { PdfDocument } from './pdf-document.js';

/** Qui exporte, quand, et sous quel rôle (pied de page). */
export interface ExportAuthor {
  id: string;
  role: string;
  at: Date;
}

/** Données du PDF d'un dossier. */
export interface DossierPdfInput {
  language: Language;
  patient: Patient;
  organization: string | undefined;
  allergies: AllergyIntolerance[];
  treatments: MedicationRequest[];
  timeline: TimelineEvent[];
  /** Lignes du résumé validé par un soignant ; absent si le résumé n'a pas été validé. */
  summary: string[] | undefined;
  author: ExportAuthor;
}

/**
 * PDF du dossier : en-tête établissement, identité, allergies, traitements, chronologie, résumé
 * validé ; pied de page (date, auteur, confidentialité) sur chaque page.
 */
export function buildDossierPdf(input: DossierPdfInput): Buffer {
  const { language, patient, author } = input;
  const t = createTranslator(language);
  const date = (iso: string): string => formatDate(iso, language);
  const footerDate = formatDate(author.at.toISOString(), language);
  const document = new PdfDocument(`${t('export.dossier.title')} ${patient.ipp}`, (page, pages) => [
    t('export.confidential'),
    t('export.footer', { date: footerDate, author: author.id, role: author.role, page, pages }),
  ]);

  document.text(input.organization ?? 'HYGIA', { size: 16, bold: true });
  document.text(t('export.dossier.title'), { size: 12 });
  document.heading(t('export.dossier.identity'));
  document.text(t('export.dossier.name', { name: `${patient.familyName} ${patient.givenName}` }));
  document.text(t('export.dossier.ipp', { ipp: patient.ipp }));
  document.text(t('export.dossier.gender', { gender: t(`patient.gender.${patient.gender}`) }));
  document.text(t('export.dossier.birth', { date: date(patient.birthDate) }));
  document.text(t('export.dossier.version', { version: patient.version }));

  document.heading(t('export.dossier.allergies'));
  const none = t('export.dossier.none');
  if (input.allergies.length === 0) document.text(none, { indent: 10 });
  for (const item of input.allergies) {
    const criticality = t(`export.criticality.${item.criticality}`);
    document.text(`• ${t('export.dossier.allergy', { label: item.substance.display, criticality })}`, { indent: 10 });
  }

  document.heading(t('export.dossier.treatments'));
  if (input.treatments.length === 0) document.text(none, { indent: 10 });
  for (const item of input.treatments) {
    const line = t('export.dossier.treatment', {
      label: item.medication.display,
      dose: item.dosage.doseValue,
      unit: item.dosage.doseUnit,
      times: item.dosage.timesPerDay,
      date: date(item.authoredOn),
    });
    document.text(`• ${line}`, { indent: 10 });
  }

  document.heading(t('export.dossier.timeline'));
  if (input.timeline.length === 0) document.text(none, { indent: 10 });
  for (const event of input.timeline) {
    const type = t(`patient.timeline.type.${event.type}`);
    document.text(`${date(event.date)} — ${type} : ${event.label}`, { indent: 10 });
  }

  if (input.summary !== undefined) {
    document.heading(t('export.dossier.summary'));
    document.text(t('export.dossier.summaryNote'), { size: 9, indent: 10 });
    for (const line of input.summary) document.text(`• ${line}`, { indent: 10 });
  }
  return document.build();
}
