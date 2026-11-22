import React from 'react';
import { Loader2, CircleAlert, CheckCircle2, Info } from 'lucide-react';
import { ToastState } from '../types';
import { cn } from '@/lib/utils';

interface ToastProps {
  toast: ToastState | null;
  onDismiss?: () => void;
  /** Naikkan posisi saat bar seleksi tampil di bawah */
  raised?: boolean;
}

/** Snackbar notifikasi di kiri bawah dengan kontras terkalibrasi. */
const Toast: React.FC<ToastProps> = ({ toast, onDismiss, raised }) => (
  <div
    className={cn(
      'pointer-events-none fixed bottom-[72px] left-3 right-3 z-[400] flex justify-start transition-transform duration-200 ease-out sm:left-6 md:bottom-6',
      raised && '-translate-y-16'
    )}
    aria-live="polite"
  >
    {toast && (
      <div
        key={toast.id}
        role={toast.type === 'error' ? 'alert' : 'status'}
        className="animate-toast-in pointer-events-auto flex min-h-12 max-w-[min(100%,520px)] items-center gap-3 rounded-lg bg-inverse px-4 py-2.5 text-sm text-inverse-foreground shadow-popover"
      >
        {toast.type === 'loading' && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
        {toast.type === 'error' && <CircleAlert className="h-4 w-4 shrink-0 text-inverse-destructive" aria-hidden="true" />}
        {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-inverse-success" aria-hidden="true" />}
        {toast.type === 'info' && <Info className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />}
        <span className="flex-1 leading-5">{toast.message}</span>
        {toast.type !== 'loading' && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="-mr-1 inline-flex min-h-10 items-center rounded-full px-3 text-sm font-medium text-inverse-primary transition-colors hover:bg-inverse-foreground/10"
          >
            Tutup
          </button>
        )}
      </div>
    )}
  </div>
);

export default Toast;
