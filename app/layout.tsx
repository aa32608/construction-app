import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'ConstructOS · Operations dashboard', description: 'The operating system for construction companies' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en" suppressHydrationWarning><body>{children}</body></html>; }
