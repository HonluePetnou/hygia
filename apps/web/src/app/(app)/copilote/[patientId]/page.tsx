import { CopiloteScreen } from '@/components/copilote/CopiloteScreen';

export default async function CopilotePage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  return <CopiloteScreen patientId={patientId} />;
}
