import { useEffect, useRef } from 'react';

interface KeyboardShortcutsOptions {
  onSearch?: () => void;
  onEscape?: () => void;
  onToggleTheme?: () => void;
  enabled?: boolean;
}

const isTypingTarget = (el: EventTarget | null) => {
  const target = el as HTMLElement | null;
  return !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
};

/** Pintasan global: "/" & Ctrl/⌘+K = cari, D = tema, Esc = tutup. */
export const useKeyboardShortcuts = (options: KeyboardShortcutsOptions) => {
  // Simpan handler terbaru di ref agar listener tidak perlu dipasang ulang tiap render
  const ref = useRef(options);
  ref.current = options;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { onSearch, onEscape, onToggleTheme, enabled = true } = ref.current;
      if (!enabled) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onSearch?.();
        return;
      }

      if (isTypingTarget(event.target)) {
        if (event.key === 'Escape') {
          (event.target as HTMLElement).blur();
          onEscape?.();
        }
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === '/') {
        event.preventDefault();
        onSearch?.();
      } else if (event.key === 'Escape') {
        onEscape?.();
      } else if (event.key === 'd' || event.key === 'D') {
        onToggleTheme?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
