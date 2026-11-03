import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { SessionProvider } from '@/lib/session-context';
import './globals.css';
import './screens.css';
import './copilot-import.css';
import './alertes.css';
import './epidemiologie.css';
import './audit.css';
import './supervision.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HYGIA',
  description: 'Plateforme répartie d’analyse des dossiers patients',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={jakarta.variable}>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
