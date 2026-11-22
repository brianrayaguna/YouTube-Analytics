import { Link } from 'react-router-dom';

const NotFound = () => (
  <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
    <svg viewBox="0 0 32 32" className="h-16 w-16" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0F172A" />
      <rect x="6.5" y="18" width="4.5" height="7.5" rx="1.6" fill="#3DA5FF" />
      <rect x="13.75" y="12.5" width="4.5" height="13" rx="1.6" fill="#2DD4BF" />
      <rect x="21" y="6.5" width="4.5" height="19" rx="1.6" fill="#FF3B30" />
    </svg>
    <h1 className="mt-6 text-2xl font-bold text-foreground">Halaman tidak ditemukan</h1>
    <p className="mt-2 max-w-sm text-sm text-muted-foreground">
      Alamat yang dituju tidak tersedia. Kembali ke beranda untuk memulai analisis channel.
    </p>
    <div className="mt-6">
      <Link to="/" className="yt-pill-primary">
        Kembali ke beranda
      </Link>
    </div>
  </main>
);

export default NotFound;
