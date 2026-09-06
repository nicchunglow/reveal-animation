import type { Metadata, Viewport } from 'next';
import { Archivo_Black, Barlow, Barlow_Condensed } from 'next/font/google';
import './globals.css';

const display = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
});
const condensed = Barlow_Condensed({
  weight: ['600', '700'],
  subsets: ['latin'],
  variable: '--font-condensed',
});
const body = Barlow({
  weight: ['400', '600'],
  subsets: ['latin'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'Matchup Reveal',
  description: 'Battle matchup reveal animation for live dance competitions.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#050405',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${condensed.variable} ${body.variable}`}>
        {children}
      </body>
    </html>
  );
}
