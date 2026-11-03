import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { GatewayProvider } from '@/lib/gateway-context';

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return (
    <GatewayProvider>
      <AppShell>{children}</AppShell>
    </GatewayProvider>
  );
}
