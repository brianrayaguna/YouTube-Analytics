import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
    <svg viewBox="0 0 28 20" className="h-20 w-28 opacity-90" aria-hidden="true">
      <rect width="28" height="20" rx="5.5" fill="hsl(var(--yt-red))" />
      <path d="M11.2 5.6v8.8l7.6-4.4z" fill="#fff" />
    </svg>
    <p className="mt-8 text-base text-foreground">Halaman ini tidak tersedia. Mohon maaf atas ketidaknyamanan ini.</p>
    <p className="mt-1 text-sm text-muted-foreground">Coba telusuri dari beranda.</p>
    <div className="mt-6">
      <Link to="/" className="yt-pill-primary">
        Kembali ke beranda
      </Link>
    </div>
  </div>
);

export default NotFound;
