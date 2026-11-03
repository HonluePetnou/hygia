import { createTranslator, formatDate } from '@hygia/i18n';
import type { Language } from '@hygia/types';
import type { EpidemiologyData } from './epidemiology-source.js';
import type { ExportAuthor } from './dossier-pdf.js';
import { PdfDocument } from './pdf-document.js';

/** Rapport épidémiologique en PDF : agrégats pseudonymisés uniquement. */
export function buildEpidemiologyPdf(language: Language, data: EpidemiologyData, author: ExportAuthor): Buffer {
  const t = createTranslator(language);
  const footerDate = formatDate(author.at.toISOString(), language);
  const document = new PdfDocument(t('export.epi.title'), (page, pages) => [
    t('export.epi.pseudonymized'),
    t('export.footer', { date: footerDate, author: author.id, role: author.role, page, pages }),
  ]);
  document.text('HYGIA', { size: 16, bold: true });
  document.text(t('export.epi.title'), { size: 12 });
  document.text(data.week === null ? t('export.epi.noData') : t('export.epi.week', { week: data.week }));

  document.heading(t('export.epi.outbreaks'));
  if (data.outbreaks.length === 0) document.text(t('export.epi.noOutbreak'), { indent: 10 });
  for (const item of data.outbreaks) {
    document.text(
      `• ${t('export.epi.outbreak', { ...item, pathology: label(t, item.pathology) })}`,
      { indent: 10 },
    );
  }

  document.heading(t('export.epi.districts'));
  for (const item of data.districts) document.text(`• ${t('export.epi.district', { district: item.district, cases: item.cases })}`, { indent: 10 });

  document.heading(t('export.epi.cases'));
  for (const item of data.cases) {
    document.text(`• ${t('export.epi.case', { ...item, pathology: label(t, item.pathology) })}`, { indent: 10 });
  }
  return document.build();
}

/** Libellé traduit d'une pathologie, ou son nom brut si elle n'a pas de traduction. */
function label(t: (key: string) => string, pathology: string): string {
  const key = `epidemiology.pathology.${pathology}`;
  const translated = t(key);
  return translated === key ? pathology : translated;
}
