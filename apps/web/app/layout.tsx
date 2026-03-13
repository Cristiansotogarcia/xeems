import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'FieldOps Consent Admin',
  description: 'Transparent workforce operations dashboard'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
