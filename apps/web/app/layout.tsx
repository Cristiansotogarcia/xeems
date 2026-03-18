import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'XEEMS Portal',
  description: 'Admin portal and employee download hub for XEEMS managed desktop and mobile monitoring.',
  icons: {
    icon: '/xeems-icon.png',
    apple: '/xeems-icon.png'
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
