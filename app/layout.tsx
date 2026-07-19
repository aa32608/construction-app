import type { Metadata } from 'next';
import './globals.css';
import GlobalModals from './_components/GlobalModals';

export const metadata: Metadata = {
  title: 'ConstructOS · Operations dashboard',
  description: 'The operating system for construction companies',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <GlobalModals />
      </body>
    </html>
  );
}
