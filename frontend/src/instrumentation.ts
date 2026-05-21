// Runs on the server before any rendering.
// Next.js 15 injects a broken localStorage stub via --localstorage-file;
// replace it with a fully functional in-memory implementation so SSR never throws.
export async function register() {
  if (typeof window === "undefined") {
    const store = new Map<string, string>();
    const polyfill = {
      getItem:    (k: string) => store.get(k) ?? null,
      setItem:    (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clear:      () => { store.clear(); },
      get length() { return store.size; },
      key:        (i: number) => [...store.keys()][i] ?? null,
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: polyfill,
      writable: true,
      configurable: true,
    });
  }
}
