export function createUpdateGuards() {
  const checks = new Set<() => string>();
  return {
    add(check: () => string) { checks.add(check); return () => { checks.delete(check); }; },
    check() {
      try { for (const check of [...checks]) { const message = check(); if (message) return message; } }
      catch { return "Your saved work could not be checked. Keep this window open and retry after saving."; }
      return "";
    },
  };
}
export const updateGuards = createUpdateGuards();
