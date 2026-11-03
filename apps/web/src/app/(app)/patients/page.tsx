import { PatientsScreen } from '@/components/patients/PatientsScreen';

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  return <PatientsScreen initialQuery={Array.isArray(q) ? (q[0] ?? '') : (q ?? '')} />;
}
