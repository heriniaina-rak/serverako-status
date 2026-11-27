import type { Metadata } from 'next';
import { JetBrains_Mono, Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({ variable: '--font-montserrat', subsets: ['latin'] });
const jetbrains = JetBrains_Mono({ variable: '--font-jetbrains', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://status.serverako.com'),
  title: 'Statut de Serverako',
  description:
    'Disponibilité en temps réel de Serverako : applications hébergées, API, dashboard, incidents et maintenances.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr" className={`${montserrat.variable} ${jetbrains.variable} antialiased`}>
      <body className="min-h-dvh font-sans text-[14px] leading-5">{children}</body>
    </html>
  );
}
