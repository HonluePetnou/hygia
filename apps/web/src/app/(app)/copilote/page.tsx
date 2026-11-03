import { redirect } from 'next/navigation';

/** Le copilote travaille sur un dossier : sans patient choisi, on passe par la liste des patients. */
export default function CopiloteIndexPage(): never {
  redirect('/patients');
}
