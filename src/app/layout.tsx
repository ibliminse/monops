import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from 'sonner';
import { GoogleAnalytics } from '@/components/google-analytics';
import { DonationPrompt } from '@/components/donation-prompt';
import { ConsentBanner } from '@/components/consent-banner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MonOps - Monad NFT Operations Dashboard',
  description: 'Batch actions and monitoring for Monad EVM mainnet NFTs',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0a0a0f] text-white antialiased`}>
        <GoogleAnalytics />
        <Providers>
          <ErrorBoundary>
            <Sidebar />
            <div className="md:ml-64 min-h-screen flex flex-col">
              <Header />
              <main className="flex-1 max-w-6xl w-full px-4 py-4 md:px-6 md:py-6">
                {children}
              </main>
            </div>
          </ErrorBoundary>
          <DonationPrompt />
          <ConsentBanner />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'rgba(13, 13, 18, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(12px)',
                color: 'white',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
