import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Polokol SafeDAO Demo',
  description: 'Polokol SafeDAO Demo dApp',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
