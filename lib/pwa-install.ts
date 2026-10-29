type InstallChoice = { outcome: "accepted" | "dismissed" };
type InstallInvitation = Event & { prompt(): Promise<void | InstallChoice>; userChoice: Promise<InstallChoice> };
export type InstallResult = "accepted" | "dismissed" | "unavailable" | "failed";
const initialState = { installed: false, canPrompt: false, prompting: false };

export function createInstallController(target: EventTarget, standalone: () => boolean) {
  let state = initialState, invitation: InstallInvitation | null = null;
  const listeners = new Set<() => void>();
  function publish(change: Partial<typeof state>) { state = { ...state, ...change }; listeners.forEach((listener) => listener()); }
  return {
    read: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() {
      const installed = () => { invitation = null; publish({ installed: true, canPrompt: false }); };
      const beforeInstall = (event: Event) => {
        const candidate = event as InstallInvitation;
        if (typeof candidate.prompt !== "function") return;
        event.preventDefault();
        if (state.installed || state.prompting) return;
        invitation = candidate; publish({ canPrompt: true });
      };
      if (standalone()) installed();
      target.addEventListener("beforeinstallprompt", beforeInstall);
      target.addEventListener("appinstalled", installed);
      return () => { target.removeEventListener("beforeinstallprompt", beforeInstall); target.removeEventListener("appinstalled", installed); invitation = null; publish({ canPrompt: false }); };
    },
    async install(): Promise<InstallResult> {
      if (!invitation || state.installed || state.prompting) return "unavailable";
      const current = invitation; invitation = null; publish({ canPrompt: false, prompting: true });
      try { const choice = await current.prompt(); return (choice || await current.userChoice).outcome; }
      catch { return "failed"; }
      finally { publish({ prompting: false }); }
    },
  };
}

export function installInstructions(userAgent: string, platform: string, touchPoints: number) {
  if (/iPhone|iPad|iPod/i.test(userAgent) || platform === "MacIntel" && touchPoints > 1) return { device: "iPhone or iPad", steps: ["Open Kalinga in Safari.", "Tap Share, then Add to Home Screen. You may need to scroll through the options.", "Keep Open as Web App enabled if shown, then tap Add."] };
  if (/Android/i.test(userAgent)) return { device: "Android phone or tablet", steps: ["Open Kalinga in Chrome.", "Open the three-dot browser menu and choose Install app or Add to Home screen.", "Confirm Install, then open Kalinga from its new icon."] };
  if (/Mac/i.test(platform) && /Safari/i.test(userAgent) && !/Chrome|Chromium|Edg|OPR/i.test(userAgent)) return { device: "Safari on Mac", steps: ["Open the File menu in Safari.", "Choose Add to Dock, then confirm Add.", "Open Kalinga from the Dock. If the option is missing, try an updated Safari or Chrome."] };
  return { device: "Computer", steps: ["Open Kalinga in Chrome or Edge.", "Use the install icon in the address bar or find Install Kalinga / Install this site as an app in the browser menu.", "Confirm Install. If you already installed Kalinga, open it from your app list."] };
}

let controller: ReturnType<typeof createInstallController> | undefined;
function browserController() {
  if (!controller && typeof window !== "undefined") controller = createInstallController(window, () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  return controller;
}
export const readInstallState = () => browserController()?.read() || initialState;
export const serverInstallState = () => initialState;
export const subscribeInstall = (listener: () => void) => browserController()?.subscribe(listener) || (() => {});
export const startAppInstall = () => browserController()?.start();
export const requestAppInstall = () => browserController()?.install() || Promise.resolve<InstallResult>("unavailable");
export function openAppInstall() { window.dispatchEvent(new Event("kalinga:install-open")); }
