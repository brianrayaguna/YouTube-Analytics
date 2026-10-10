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
    if (h?.ytdlp && h.authorized !== false && !hasLocalDownloaderPreference()) {
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

  // Coba sambung ulang berkala saat belum terhubung
  useEffect(() => {
    if (health || !pollJobs) return;
    const t = setInterval(() => refresh(true), 5000);
    return () => clearInterval(t);
  }, [health, pollJobs, refresh]);

  useEffect(() => {
    if (!pollJobs || !health) return;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      const list = await refreshJobs();
      if (stopped) return;
      timer = setTimeout(tick, list.some(isJobActive) ? 1000 : 4000);
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [pollJobs, health, refreshJobs]);

  const setEnabled = useCallback((v: boolean) => {
    setLocalDownloaderEnabled(v);
    setEnabledState(v);
  }, []);

  return { health, checking, refresh, jobs, refreshJobs, enabled, setEnabled };
};
