import type { ReactNode } from 'react';
import { PortalGuard } from '@/components/portal/PortalGuard';
import { GatewayProvider } from '@/lib/gateway-context';

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <GatewayProvider>
      <PortalGuard>{children}</PortalGuard>
    </GatewayProvider>
  );
}
