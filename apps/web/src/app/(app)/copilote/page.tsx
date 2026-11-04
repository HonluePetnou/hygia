import { CopilotePicker } from '@/components/copilote/CopilotePicker';

/** Le copilote travaille sur un dossier : sans patient choisi, on propose d'abord le choix du patient. */
export default function CopiloteIndexPage() {
  return <CopilotePicker />;
}
