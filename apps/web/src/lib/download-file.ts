import type { ExportDownload } from '@hygia/view-models';

/** Déclenche le téléchargement direct d'un export (PDF ou CSV) côté navigateur. */
export function downloadFile({ blob, filename }: ExportDownload): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
