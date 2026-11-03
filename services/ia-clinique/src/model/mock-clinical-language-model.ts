import { createTranslator } from '@hygia/i18n';
import type { ClinicalLanguageModel, GenerationRequest } from './clinical-language-model.js';

/**
 * Modèle simulé et déterministe : assemble la réponse à partir des passages fournis, dans
 * l'ordre, en faisant suivre chacun de son marqueur `[n]`. Sans passage, il ne répond rien d'autre
 * que l'absence de source.
 */
export class MockClinicalLanguageModel implements ClinicalLanguageModel {
  async generate({ passages, language }: GenerationRequest): Promise<string> {
    const t = createTranslator(language);
    if (passages.length === 0) return t('copilot.noSourceAnswer');
    const cited = passages.map((passage, index) => `${passage.text} [${index + 1}]`);
    return `${t('copilot.answerIntro')} ${cited.join(' ')}`;
  }
}
