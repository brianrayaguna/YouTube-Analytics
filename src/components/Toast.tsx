import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CircleAlert, CheckCircle2, Info } from 'lucide-react';
import { ToastState } from '../types';

interface ToastProps {
  toast: ToastState | null;
  onDismiss?: () => void;
  /** Naikkan posisi saat bar seleksi tampil di bawah */
  raised?: boolean;
}

/** Snackbar ala YouTube (kiri bawah, warna terbalik). */
const Toast: React.FC<ToastProps> = ({ toast, onDismiss, raised }) => (
  <div
    className={`pointer-events-none fixed left-3 right-3 z-[400] flex justify-start transition-[bottom] sm:left-6 ${
      raised ? 'bottom-[136px] md:bottom-[88px]' : 'bottom-[72px] md:bottom-6'
    }`}
    aria-live="polite"
  >
    <AnimatePresence mode="wait">
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.18 }}
          role={toast.type === 'error' ? 'alert' : 'status'}
          className="pointer-events-auto flex min-h-12 max-w-[min(100%,520px)] items-center gap-3 rounded-lg bg-inverse px-4 py-3 text-sm text-inverse-foreground shadow-popover"
        >
          {toast.type === 'loading' && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
          {toast.type === 'error' && <CircleAlert className="h-4 w-4 shrink-0 text-[#ff6b6b] dark:text-destructive" />}
          {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4ade80] dark:text-success" />}
          {toast.type === 'info' && <Info className="h-4 w-4 shrink-0 opacity-80" />}
          <span className="flex-1 leading-5">{toast.message}</span>
          {toast.type !== 'loading' && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="-mr-1 rounded-full px-2 py-1 text-sm font-medium text-[#3ea6ff] hover:bg-white/10 dark:text-primary dark:hover:bg-black/5"
            >
              Tutup
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export default Toast;
