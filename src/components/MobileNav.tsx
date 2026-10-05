import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu } from 'lucide-react';
import { AnalysisMode } from '../types';
import { NavList } from './Sidebar';
import Logo from './Logo';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: AnalysisMode;
  onNavigate: (mode: AnalysisMode) => void;
  savedCount?: number;
  hasData?: boolean;
}

/** Drawer navigasi ala YouTube (overlay dari kiri). */
const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose, currentMode, onNavigate, savedCount, hasData }) => {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-black/50"
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
            className="fixed left-0 top-0 z-[201] flex h-full w-60 flex-col bg-background"
            role="dialog"
            aria-label="Menu navigasi"
          >
            <div className="flex h-14 shrink-0 items-center gap-2 px-4">
              <button type="button" onClick={onClose} className="yt-icon-btn" aria-label="Tutup menu">
                <Menu className="h-6 w-6" strokeWidth={1.75} />
              </button>
              <Logo onClick={() => { onNavigate('dashboard'); onClose(); }} />
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavList
                currentMode={currentMode}
                onNavigate={(m) => {
                  onNavigate(m);
                  onClose();
                }}
                savedCount={savedCount}
                hasData={hasData}
              />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobileNav;
