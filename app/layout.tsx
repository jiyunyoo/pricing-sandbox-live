import type { Metadata } from 'next';
import { IBM_Plex_Mono } from 'next/font/google';
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/500.css';
import '@fontsource/noto-sans-kr/700.css';
import '@fontsource/noto-sans-kr/900.css';
import './globals.css';

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '호모 실리쿠스 · 페르소나 시뮬레이션 샌드박스',
  description: 'Live OpenAI-powered persona simulation for search/experience goods pricing.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={ibmPlexMono.variable}>
      <body>{children}</body>
    </html>
  );
}
