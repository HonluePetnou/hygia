import type { Locale, Translate } from '@hygia/i18n';
import { formatDate } from '@hygia/i18n';
import type { SearchFilter } from '@hygia/view-models';

const OPERATORS = { gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=' } as const;

/** Texte d'une puce « Compris comme » (ex. « Âge > 60 ans »). */
export function filterLabel(filter: SearchFilter, t: Translate, locale: Locale): string {
  switch (filter.kind) {
    case 'diagnosis':
      return t('patients.chip.diagnosis', { code: filter.code, label: filter.label });
    case 'age':
      return t('patients.chip.age', { op: OPERATORS[filter.comparator], value: filter.value });
    case 'lastVisit':
      return t('patients.chip.lastVisit', {
        op: OPERATORS[filter.comparator],
        date: formatDate(filter.date, locale),
      });
    case 'lab':
      return t('patients.chip.lab', {
        label: filter.label,
        op: OPERATORS[filter.comparator],
        value: filter.value,
        unit: filter.unit,
      });
    case 'gender':
      return t(`patients.chip.gender.${filter.value}`);
    case 'text':
      return t('patients.chip.text', { value: filter.value });
  }
}
