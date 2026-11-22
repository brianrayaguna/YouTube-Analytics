import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkLocalDownloader,
  listLocalJobs,
  isJobActive,
  isLocalDownloaderEnabled,
  hasLocalDownloaderPreference,
  setLocalDownloaderEnabled,
  subscribeLocalDownloader,
  LocalHealth,
  LocalJob,
} from '../services/localDownloader';

/** Status mesin unduh lokal + daftar job (polling selama komponen tampil). */
export const useLocalDownloader = ({ pollJobs = false }: { pollJobs?: boolean } = {}) => {
  const [health, setHealth] = useState<LocalHealth | null>(null);
  const [checking, setChecking] = useState(true);
  const [jobs, setJobs] = useState<LocalJob[]>([]);
  const [enabled, setEnabledState] = useState(isLocalDownloaderEnabled);
  const mounted = useRef(true);

  const refresh = useCallback(async (force = false) => {
    setChecking(true);
    const h = await checkLocalDownloader(force);
    if (!mounted.current) return h;
    setHealth(h);
    setChecking(false);
    // Aktifkan otomatis saat pertama kali terhubung
    if (h?.ytdlp && !hasLocalDownloaderPreference()) {
      setLocalDownloaderEnabled(true);
    }
    return h;
  }, []);

  const refreshJobs = useCallback(async () => {
    try {
      const list = await listLocalJobs();
      if (mounted.current) setJobs(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh(true);
    const unsub = subscribeLocalDownloader(() => {
      setEnabledState(isLocalDownloaderEnabled());
      refresh(true);
    });
    return () => {
      mounted.current = false;
      unsub();
    };
  }, [refresh]);

  // Periksa ulang saat tab kembali aktif ketika mesin belum terhubung (hindari polling gagal terus-menerus)
  useEffect(() => {
    if (health || !pollJobs) return;
    const onVisibility = () => {
      if (!document.hidden) refresh(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [health, pollJobs, refresh]);

  useEffect(() => {
    if (!pollJobs || !health) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const tick = async () => {
      if (stopped || document.hidden) return;
      const list = await refreshJobs();
      if (stopped) return;
      timer = setTimeout(tick, list.some(isJobActive) ? 1000 : 4000);
    };
    const onVisibility = () => {
      clearTimeout(timer);
      if (!document.hidden && !stopped) tick();
    };
    tick();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pollJobs, health, refreshJobs]);

  const setEnabled = useCallback((v: boolean) => {
    setLocalDownloaderEnabled(v);
    setEnabledState(v);
  }, []);

  return { health, checking, refresh, jobs, refreshJobs, enabled, setEnabled };
};
