import { MergeScreen } from '@/components/patients/MergeScreen';

export default async function DuplicatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MergeScreen duplicateId={id} />;
}
