"use client";
import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { interfaceLanguages, readInterfaceLanguage, refreshInterfaceLanguage, serverInterfaceLanguage, setInterfaceLanguage, setInterfaceLanguageScope, subscribeInterfaceLanguage, translateInterface, type InterfaceLanguage } from "@/lib/interface-language";
import styles from "./language-switch.module.css";

const LanguageContext = createContext<InterfaceLanguage>("en");
export function LanguageProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribeInterfaceLanguage, readInterfaceLanguage, serverInterfaceLanguage);
  useEffect(() => { refreshInterfaceLanguage(); const changed = () => refreshInterfaceLanguage(); window.addEventListener("storage", changed); return () => window.removeEventListener("storage", changed); }, []);
  useEffect(() => { document.documentElement.lang = state.language; }, [state.language]);
  return <LanguageContext.Provider value={state.language}>{children}</LanguageContext.Provider>;
}
export function useInterfaceLanguageScope(scope: string) { useEffect(() => { setInterfaceLanguageScope(scope); }, [scope]); }
export function useInterfaceLanguage() { const language = useContext(LanguageContext); return { language, t: (text: string) => translateInterface(language, text) }; }
export function T({ children }: { children: ReactNode }) { const { t } = useInterfaceLanguage(); return <>{typeof children === "string" ? t(children) : children}</>; }
export function GabayLanguageLabel() { const { language } = useInterfaceLanguage(); return <small className={styles.reply}>Gabay: {interfaceLanguages.find((item) => item.code === language)!.name}</small>; }
export function LanguageSwitch() {
  const { language, t } = useInterfaceLanguage();
  const state = useSyncExternalStore(subscribeInterfaceLanguage, readInterfaceLanguage, serverInterfaceLanguage);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => { const close = (event: PointerEvent) => { if (details.current && !details.current.contains(event.target as Node)) details.current.open = false; }; const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && details.current?.open) { details.current.open = false; details.current.querySelector("summary")?.focus(); } }; document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape); return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); }; }, []);
  return <details ref={details} className={styles.switch}><summary aria-label="Language / Wika / Lengguwahe"><small>{t("Language")}</small><span>{language === "hil" ? "Hiligaynon" : interfaceLanguages.find((item) => item.code === language)!.name} ▾</span></summary><section className={styles.panel} aria-label="Language settings"><h2>Language / Wika / Lengguwahe</h2><fieldset><legend>{t("Menus and common actions")} + {t("Gabay’s new replies")}</legend>{interfaceLanguages.map((item) => <label key={item.code}><input type="radio" name="interface-language" value={item.code} checked={language === item.code} onChange={() => setInterfaceLanguage(item.code)} /><span>{item.name}{item.code === "hil" && <small>Preview</small>}</span></label>)}</fieldset><p>{t("Lesson language stays separate. Choose it in each lesson plan.")}</p><p>{t("Existing lessons, chats and teachers’ posts keep their original text.")}</p><p className={styles.note}>{t("Some screens still use English. Hiligaynon translations are a preview and need teacher review.")}</p>{!state.persisted && <p role="status">This choice could not be saved on this device.</p>}<button type="button" onClick={() => { if (details.current) details.current.open = false; }}>{t("Done")}</button></section></details>;
}
