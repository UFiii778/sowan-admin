import './globals.css';

export const metadata = {
  title: 'SowanQR',
  description: 'Sistem Pemantauan & Manajemen Data Tamu Real-time',
  icons: {
    icon: [
      {
        url: '/favicon-dark.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/favicon-light.png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="bg-slate-50 m-0 p-0">
        <div className="min-h-screen bg-slate-50">
          {children}
        </div>
      </body>
    </html>
  );
}
