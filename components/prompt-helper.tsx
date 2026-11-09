"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInterfaceLanguage } from "@/components/language-switch";
import { useAppUpdateGuard } from "@/components/app-updates";
import { appendTeacherPrompt, buildTeacherPrompt, emptyPromptDetails, type PromptDetails } from "@/lib/prompt-helper";
import styles from "./prompt-helper.module.css";

export function PromptHelper({ mode, context, existingText, onUse, disabled = false, inline = false, visible = true }: { mode: "chat" | "lesson" | "revision"; context?: string; existingText: string; onUse: (text: string) => void; disabled?: boolean; inline?: boolean; visible?: boolean }) {
  const { t } = useInterfaceLanguage();
  const [details, setDetails] = useState(emptyPromptDetails);
  const [error, setError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const disclosure = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const addition = buildTeacherPrompt(details, t);
  const combined = appendTeacherPrompt(existingText, addition);
  useAppUpdateGuard(addition ? "Use or clear your unfinished prompt details before updating." : "");
  useLayoutEffect(() => {
    if (mode !== "chat" || !chatOpen || !visible) return;
    const chat = trigger.current?.closest(".gabay-chat-popover");
    if (!chat) return;
    const place = () => {
      const bounds = chat.getBoundingClientRect(), width = Math.min(380, window.innerWidth - 24);
      const left = bounds.left >= width + 24 ? bounds.left - width - 12 : Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12));
      const top = Math.max(12, Math.min(bounds.top, window.innerHeight - 220));
      const maxHeight = Math.min(760, window.innerHeight - top - (window.innerWidth <= 720 ? 80 : 12));
      setPosition((current) => current?.left === left && current.top === top && current.width === width && current.maxHeight === maxHeight ? current : { left, top, width, maxHeight });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(chat);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [chatOpen, mode, visible]);
  useEffect(() => {
    if (mode !== "chat" || !chatOpen || !visible) return;
    let panel: HTMLElement | null = null;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setChatOpen(false); trigger.current?.focus(); } };
    const frame = window.requestAnimationFrame(() => { panel = document.getElementById(`${id}-panel`); panel?.addEventListener("keydown", escape); panel?.querySelector<HTMLTextAreaElement>("textarea")?.focus({ preventScroll: true }); });
    return () => { window.cancelAnimationFrame(frame); panel?.removeEventListener("keydown", escape); };
  }, [chatOpen, id, mode, visible]);
  const examples = mode === "lesson" ? [{ label: "Mixed reading levels", field: "needs", value: "Learners have different reading levels. Include support for those who need it." }, { label: "No printer", field: "materials", value: "No printer is available. Use reusable classroom materials." }] : [{ label: "Simpler activities", field: "goal", value: "Make the activities easier to follow while keeping the learning objective." }, { label: "Independent tasks", field: "goal", value: "Suggest an independent task for one grade while I guide another grade." }];
  function update(field: keyof PromptDetails, value: string) { setDetails((current) => ({ ...current, [field]: value })); setError(""); }
  function example(item: typeof examples[number]) {
    const field = item.field as keyof PromptDetails, value = t(item.value);
    if (details[field].includes(value)) return;
    const next = appendTeacherPrompt(details[field], value, 500);
    if (next === null) { setError(t("Shorten this field before adding another example.")); return; }
    update(field, next);
  }
  function closePanel() { setChatOpen(false); trigger.current?.focus(); }
  function useDetails() { if (!addition || combined === null || disabled) return; onUse(combined); setDetails(emptyPromptDetails); setError(""); if (mode === "chat") closePanel(); else if (disclosure.current && !inline) disclosure.current.open = false; }
  const preview = <label htmlFor={`${id}-preview`}>{t("Preview your instructions")}<textarea id={`${id}-preview`} rows={4} readOnly value={combined ?? `${existingText}\n\n${addition}`} /><small>{(combined ?? `${existingText}\n\n${addition}`).length} / 2000 {t("characters")}</small></label>;
  const fields = <>
    {context && <p className={styles.context}><b>{t("Already included")}:</b> {context}</p>}
    <p>{t("Add only what Gabay needs. Do not include learner names or private details.")}</p>
    <div className={styles.examples} aria-label={t("Examples you can edit")}>{examples.map((item) => <button type="button" disabled={disabled} key={item.label} onClick={() => example(item)}>{t(item.label)}</button>)}</div>
    <div className={mode === "chat" ? styles.fields : styles.stacked}>{([{ field: "goal", label: mode === "lesson" ? "Teaching focus" : "What do you need help with?", placeholder: "e.g. Explain the activity in simpler steps." }, { field: "needs", label: "Learner needs", placeholder: "e.g. Some learners need help reading the instructions." }, { field: "materials", label: "Materials and limits", placeholder: "e.g. We have bottle caps and a chalkboard, but no printer." }] as const).map((item) => <label htmlFor={`${id}-${item.field}`} key={item.field}>{t(item.label)}<textarea id={`${id}-${item.field}`} rows={2} maxLength={500} value={details[item.field]} disabled={disabled} placeholder={t(item.placeholder)} onChange={(event) => update(item.field, event.target.value)} /></label>)}</div>
    {mode === "chat" && <label htmlFor={`${id}-format`}>{t("Response format")}<select id={`${id}-format`} value={details.format} disabled={disabled} onChange={(event) => update("format", event.target.value)}><option value="">{t("Let Gabay choose")}</option>{["Short explanation", "Step-by-step instructions", "A few activity ideas", "Checklist"].map((value) => <option value={value} key={value}>{t(value)}</option>)}</select></label>}
    {addition && (mode === "chat" ? <details className={styles.preview}><summary>{t("Preview your instructions")}</summary>{preview}</details> : preview)}
    {combined === null && <p className={styles.error} role="status">{t("These details are too long. Shorten them before using them; your existing text is unchanged.")}</p>}{error && <p className={styles.error} role="status">{error}</p>}
  </>;
  const actions = <div className={styles.actions}><button type="button" disabled={disabled || !addition || combined === null} onClick={useDetails}>{t("Use these details")}</button><button type="button" disabled={disabled || !addition} onClick={() => { setDetails(emptyPromptDetails); setError(""); }}>{t("Clear helper")}</button></div>;
  if (mode === "chat") return <>
    <button ref={trigger} className={styles.launcher} type="button" aria-expanded={chatOpen && visible} aria-controls={`${id}-panel`} onClick={() => setChatOpen((value) => !value)}>{t("Help me ask Gabay")}<span aria-hidden="true">{chatOpen ? "−" : "+"}</span></button>
    {chatOpen && visible && position && createPortal(<section id={`${id}-panel`} className={styles.panel} style={position} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`}><header><div><small>{t("Optional")}</small><h2 id={`${id}-title`}>{t("Help me ask Gabay")}</h2></div><button type="button" aria-label={t("Close prompt helper")} onClick={closePanel}>×</button></header><div className={styles.body}>{fields}</div><footer><p>{t("Nothing is sent automatically. Review your text, then press Send.")}</p>{actions}</footer></section>, document.body)}
  </>;
  return <details ref={disclosure} open={inline || undefined} className={`${styles.helper} ${inline ? styles.inline : ""}`}><summary>{t(mode === "lesson" ? "Help me describe my class" : "Help me write my instructions")}<small>{t("Optional")}</small></summary><div className={styles.body}>{fields}<p className={styles.note}>{t("This prepares your text only. Nothing is sent until you press Send, Generate or Suggest changes.")}</p>{actions}</div></details>;
}
