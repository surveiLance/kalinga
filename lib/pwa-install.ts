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

export type InstallBrowser = "chrome" | "edge" | "safari" | "dia" | "opera" | "other";
export function installInstructions(userAgent: string, platform: string, touchPoints: number, chosen?: InstallBrowser) {
  const note = "You can keep using Kalinga in your current browser. Installation is optional; prepare offline work in the browser or installed app you will use.";
  if (/iPhone|iPad|iPod/i.test(userAgent) || platform === "MacIntel" && touchPoints > 1) return { device: "iPhone or iPad", browser: "safari" as InstallBrowser, chooseBrowser: false, note, steps: ["Open Kalinga in Safari.", "Tap Share, then Add to Home Screen. You may need to scroll through the options.", "Keep Open as Web App enabled if shown, then tap Add."] };
  if (/Android/i.test(userAgent)) return { device: "Android phone or tablet", browser: "chrome" as InstallBrowser, chooseBrowser: false, note, steps: ["Open Kalinga in a regular Chrome tab.", "Open the three-dot browser menu and choose Install app or Add to Home screen.", "Confirm Install, then open Kalinga from its new icon."] };
  const mac = /Mac/i.test(platform) || /Macintosh/i.test(userAgent);
  const browser = chosen || (/Dia\//i.test(userAgent) ? "dia" : /OPR\/|Opera/i.test(userAgent) ? "opera" : /Edg\//i.test(userAgent) ? "edge" : /Chrome\/|Chromium\//i.test(userAgent) ? "chrome" : /Safari\//i.test(userAgent) ? "safari" : "other");
  if (browser === "chrome") return { device: mac ? "Chrome on Mac" : "Chrome on this computer", browser, chooseBrowser: true, note, steps: ["Use a regular Chrome profile. If the top-right profile says Guest, switch to a regular profile first; close any Incognito window.", "Open the three-dot menu → Cast, save, and share → Install page as app. An install icon may also appear in the address bar.", "Confirm Install. If Kalinga is already installed, open it from your app list."] };
  if (browser === "edge") return { device: "Microsoft Edge", browser, chooseBrowser: true, note, steps: ["Use a regular Edge window rather than InPrivate.", "Find Apps in Edge’s menu and choose Install this site as an app.", "Confirm Install, then open Kalinga from its new icon."] };
  if (mac && browser === "safari") return { device: "Safari on Mac", browser, chooseBrowser: true, note, steps: ["Open this Kalinga page in Safari.", "Choose Share → Add to Dock, or File → Add to Dock, then confirm Add. This needs macOS Sonoma or later.", "Open Kalinga from the Dock, sign in, and prepare your offline work there."] };
  const device = browser === "dia" ? "Dia" : browser === "opera" ? "Opera / Opera GX" : "Another browser";
  return { device, browser, chooseBrowser: true, note, steps: mac ? ["If this browser has no install option, copy the Kalinga link below and open it in Safari.", "In Safari, choose Share → Add to Dock, or File → Add to Dock, then confirm Add. This needs macOS Sonoma or later.", "Open Kalinga from the Dock, sign in, and prepare your offline work there."] : ["If this browser has no install option, copy the Kalinga link below and open it in a regular Chrome or Edge window.", "In Chrome, choose the three-dot menu → Cast, save, and share → Install page as app. In Edge, find Apps → Install this site as an app.", "You can also keep this page bookmarked and use Kalinga in this browser."] };
}
export function installationLink(href: string) { return new URL("/", href).href; }

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
