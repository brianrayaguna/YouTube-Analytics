// Saran pencarian YouTube via endpoint JSONP publik (tanpa kuota API)

type SuggestResponse = [string, Array<[string, ...unknown[]]>, ...unknown[]];
type JsonpWindow = Window & Record<string, ((data: SuggestResponse) => void) | undefined>;

export const getSuggestions = (query: string, timeoutMs = 4000): Promise<string[]> => {
  if (!query.trim()) return Promise.resolve([]);

  return new Promise(resolve => {
    const w = window as unknown as JsonpWindow;
    const callbackName = `yt_suggest_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      // Biarkan no-op sementara: respons yang datang terlambat tidak memicu error
      w[callbackName] = () => undefined;
      setTimeout(() => delete w[callbackName], 30000);
      script.remove();
    };
    const finish = (results: string[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(results);
    };
    const timer = setTimeout(() => finish([]), timeoutMs);

    w[callbackName] = (data: SuggestResponse) => {
      const list = Array.isArray(data?.[1]) ? data[1].map(item => String(item[0])) : [];
      finish(list);
    };

    script.src = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=id&q=${encodeURIComponent(query)}&callback=${callbackName}`;
    script.onerror = () => finish([]);
    document.body.appendChild(script);
  });
};
