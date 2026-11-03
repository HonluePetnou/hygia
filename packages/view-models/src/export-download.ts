/** Fichier produit par un export, prêt à être téléchargé par le client. */
export interface ExportDownload {
  blob: Blob;
  filename: string;
}
