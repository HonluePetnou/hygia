import { PatientScreen } from '@/components/patient/PatientScreen';

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PatientScreen patientId={id} />;
}
