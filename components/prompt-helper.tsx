"use client";
import { useId, useRef, useState } from "react";
import { useInterfaceLanguage } from "@/components/language-switch";
import { useAppUpdateGuard } from "@/components/app-updates";
import { appendTeacherPrompt, buildTeacherPrompt, emptyPromptDetails, type PromptDetails } from "@/lib/prompt-helper";
import styles from "./prompt-helper.module.css";

export function PromptHelper({ mode, context, existingText, onUse, disabled = false, inline = false }: { mode: "chat" | "lesson" | "revision"; context?: string; existingText: string; onUse: (text: string) => void; disabled?: boolean; inline?: boolean }) {
  const { t } = useInterfaceLanguage();
  const [details, setDetails] = useState(emptyPromptDetails);
  const [error, setError] = useState("");
  const disclosure = useRef<HTMLDetailsElement>(null);
  const id = useId();
  const addition = buildTeacherPrompt(details, t);
  const combined = appendTeacherPrompt(existingText, addition);
  useAppUpdateGuard(addition ? "Use or clear your unfinished prompt details before updating." : "");
  const examples = mode === "lesson" ? [{ label: "Mixed reading levels", field: "needs", value: "Learners have different reading levels. Include support for those who need it." }, { label: "No printer", field: "materials", value: "No printer is available. Use reusable classroom materials." }] : [{ label: "Simpler activities", field: "goal", value: "Make the activities easier to follow while keeping the learning objective." }, { label: "Independent tasks", field: "goal", value: "Suggest an independent task for one grade while I guide another grade." }];
  function update(field: keyof PromptDetails, value: string) { setDetails((current) => ({ ...current, [field]: value })); setError(""); }
  function example(item: typeof examples[number]) {
    const field = item.field as keyof PromptDetails, value = t(item.value);
    if (details[field].includes(value)) return;
    const next = appendTeacherPrompt(details[field], value, 500);
    if (next === null) { setError(t("Shorten this field before adding another example.")); return; }
    update(field, next);
  }
  function useDetails() { if (!addition || combined === null || disabled) return; onUse(combined); setDetails(emptyPromptDetails); setError(""); if (disclosure.current && !inline) disclosure.current.open = false; }
  return <details ref={disclosure} open={inline || undefined} className={`${styles.helper} ${mode === "chat" ? styles.compact : ""} ${inline ? styles.inline : ""}`}><summary>{t(mode === "lesson" ? "Help me describe my class" : mode === "revision" ? "Help me write my instructions" : "Help me ask Gabay")}<small>{t("Optional")}</small></summary><div className={styles.body}>
    {context && <p className={styles.context}><b>{t("Already included")}:</b> {context}</p>}
    <p>{t("Add only what Gabay needs. Do not include learner names or private details.")}</p>
    <div className={styles.examples} aria-label={t("Examples you can edit")}>{examples.map((item) => <button type="button" disabled={disabled} key={item.label} onClick={() => example(item)}>{t(item.label)}</button>)}</div>
    {([{ field: "goal", label: mode === "lesson" ? "Teaching focus" : "What do you need help with?", placeholder: "e.g. Explain the activity in simpler steps." }, { field: "needs", label: "Learner needs", placeholder: "e.g. Some learners need help reading the instructions." }, { field: "materials", label: "Materials and limits", placeholder: "e.g. We have bottle caps and a chalkboard, but no printer." }] as const).map((item) => <label htmlFor={`${id}-${item.field}`} key={item.field}>{t(item.label)}<textarea id={`${id}-${item.field}`} rows={2} maxLength={500} value={details[item.field]} disabled={disabled} placeholder={t(item.placeholder)} onChange={(event) => update(item.field, event.target.value)} /></label>)}
    {mode === "chat" && <label htmlFor={`${id}-format`}>{t("Response format")}<select id={`${id}-format`} value={details.format} disabled={disabled} onChange={(event) => update("format", event.target.value)}><option value="">{t("Let Gabay choose")}</option>{["Short explanation", "Step-by-step instructions", "A few activity ideas", "Checklist"].map((value) => <option value={value} key={value}>{t(value)}</option>)}</select></label>}
    {addition && <label htmlFor={`${id}-preview`}>{t("Preview your instructions")}<textarea id={`${id}-preview`} rows={4} readOnly value={combined ?? `${existingText}\n\n${addition}`} /><small>{(combined ?? `${existingText}\n\n${addition}`).length} / 2000 {t("characters")}</small></label>}
    {combined === null && <p className={styles.error} role="status">{t("These details are too long. Shorten them before using them; your existing text is unchanged.")}</p>}{error && <p className={styles.error} role="status">{error}</p>}
    <p className={styles.note}>{t("This prepares your text only. Nothing is sent until you press Send, Generate or Suggest changes.")}</p>
    <div className={styles.actions}><button type="button" disabled={disabled || !addition || combined === null} onClick={useDetails}>{t("Use these details")}</button><button type="button" disabled={disabled || !addition} onClick={() => { setDetails(emptyPromptDetails); setError(""); }}>{t("Clear helper")}</button></div>
  </div></details>;
}
