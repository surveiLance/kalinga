export function appLaunchTarget(target: string | undefined, current: string) {
  if (!target) return "";
  try {
    const url = new URL(target), here = new URL(current);
    if (url.origin !== here.origin || url.pathname !== "/" || url.href === here.href) return "";
    const hash = new URLSearchParams(url.hash.slice(1));
    return ["code", "confirmed", "password-reset", "error", "error_code"].some((key) => url.searchParams.has(key)) || ["access_token", "error", "error_code"].some((key) => hash.has(key)) ? url.href : "";
  } catch { return ""; }
}
