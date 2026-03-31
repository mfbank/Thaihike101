import type {Metadata} from 'next';
import { Prompt } from 'next/font/google';
import './globals.css'; // Global styles
import { Navbar } from '@/components/Navbar';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const prompt = Prompt({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin', 'thai'],
  variable: '--font-prompt',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'เดินกากแต่ปากเก่ง - จองทริปเดินป่าและรถตู้ในประเทศไทย',
  description: 'จองการผจญภัยเดินป่าครั้งต่อไปของคุณกับเดินกากแต่ปากเก่ง',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${prompt.className} bg-gray-50 min-h-screen flex flex-col`}>
        <Navbar />
        <main className="flex-grow">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </body>
    </html>
  );
}
