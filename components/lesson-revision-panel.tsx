"use client";

import { useEffect, useId, useRef, useState } from "react";
import { GabayThinking } from "@/components/gabay-thinking";
import { requestGabayRevision } from "@/lib/gabay-ai";
import { createRevisionLifecycle } from "@/lib/revision-lifecycle";
import { revisionContextMatches, revisionConflicts, revisionFields, revisionGroupKeys, revisionKey, revisionScopes, revisionSource, validateRevisionRequest, type RevisionScope, type RevisionRequest, type RevisionProposal, type RevisionChange } from "@/lib/lesson-revisions";
import type { SavedPlan } from "@/lib/teaching-types";

const failureMessage: Record<string, string> = { "not-signed-in": "Sign in to ask Gabay for suggestions. You can still edit the lesson yourself.", "not-configured": "Connected Gabay is unavailable in prototype mode. Your lesson is unchanged.", offline: "You are offline. Keep editing and try again when connected.", busy: "Gabay reached its request limit. Please try again shortly.", unsupported: "Lesson revisions are not available on the connected Gabay service yet. Your lesson is unchanged.", "too-large": "This lesson is too large to revise at once. Shorten long fields before trying again." };

export function LessonRevisionPanel({ plan, initialScope, onClose, onApply }: { plan: SavedPlan; initialScope: RevisionScope; onClose: () => void; onApply: (request: RevisionRequest, changes: RevisionChange[]) => void }) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [scope, setScope] = useState(initialScope);
  const [instruction, setInstruction] = useState("");
  const [state, setState] = useState<{ request?: RevisionRequest; proposal?: RevisionProposal; loading?: boolean; error?: string }>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lifecycle] = useState(createRevisionLifecycle);
  const source = revisionSource(plan);
  const contextKey = JSON.stringify([source.context, source.slots, source.references]);
  const validContext = !state.request || revisionContextMatches(state.request.source, source);
  const busy = !!state.loading && validContext;
  const conflicts = state.request && state.proposal ? revisionConflicts(state.request.source, source, state.proposal) : [];
  const available = state.proposal?.changes.filter((change) => !conflicts.includes(revisionKey(change))) || [];
  const selectedChanges = available.filter((change) => selected.has(revisionKey(change)));

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    titleRef.current?.focus();
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("keydown", escape); previous?.focus(); };
  }, [onClose]);
  useEffect(() => () => lifecycle.cancel(), [lifecycle, contextKey]);

  function changeScope(value: RevisionScope) { lifecycle.cancel(); setScope(value); setState({}); setSelected(new Set()); }
  function selectChange(change: RevisionChange, checked: boolean) {
    setSelected((current) => { const next = new Set(current); for (const key of revisionGroupKeys(change, source)) { if (checked) next.add(key); else next.delete(key); } return next; });
  }
  async function suggest(event: React.FormEvent) {
    event.preventDefault();
    if (!instruction.trim() || busy) return;
    const pending = lifecycle.start();
    let request: RevisionRequest;
    try { request = validateRevisionRequest({ id: crypto.randomUUID(), scope, instruction, source }); }
    catch (error) { setState({ error: error instanceof Error ? error.message : "Check this lesson's content before trying again." }); return; }
    setSelected(new Set()); setState({ request, loading: true });
    const timer = window.setTimeout(() => { if (lifecycle.isCurrent(pending.id)) { lifecycle.cancel(); setState({ request, error: "Gabay took too long. Your lesson is unchanged. Please try again." }); } }, 75000);
    try {
      const result = await requestGabayRevision(request, { view: "plan", pageStep: "Reviewing lesson suggestions", classId: plan.classId, gradeLevels: plan.grades, subject: plan.subject, lessonTopic: plan.title, offline: !navigator.onLine }, pending.signal);
      if (!lifecycle.isCurrent(pending.id)) return;
      setState(result.connected ? { request, proposal: result.proposal } : { request, error: failureMessage[result.reason] || "Gabay could not suggest changes. Your lesson is unchanged. You can retry or keep editing." });
    } finally { window.clearTimeout(timer); }
  }

  return <aside className="lesson-revision-panel" role="dialog" aria-modal="false" aria-labelledby={titleId}>
    <header><div><p className="eyebrow">YOUR EDITING PARTNER</p><h2 ref={titleRef} tabIndex={-1} id={titleId}>Improve lesson with Gabay</h2></div><button type="button" aria-label="Close lesson suggestions" onClick={onClose}>×</button></header>
    <div className="lesson-revision-body"><p>Your lesson stays unchanged until you choose and apply suggestions.</p>
      <form onSubmit={suggest}><label>What would you like to improve?<select value={scope} onChange={(event) => changeScope(event.target.value as RevisionScope)}>{Object.entries(revisionScopes).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><small>Includes all grades in this lesson. Curriculum references and teaching times stay unchanged.</small>
        <label>Your instructions<textarea value={instruction} maxLength={2000} rows={3} onChange={(event) => setInstruction(event.target.value)} placeholder="e.g. Make the activities easier and use leaves instead of printed worksheets." required /></label>
        <button className="primary-button" type="submit" disabled={!instruction.trim() || busy}>{busy ? "Preparing suggestions…" : "Suggest changes"}</button>
      </form>
      {busy && <div className="lesson-revision-wait"><GabayThinking /><p role="status">Gabay is reviewing your lesson. You can keep editing.</p></div>}
      {!validContext && <p className="revision-warning" role="status">The lesson setup or curriculum context changed. Generate new suggestions before applying.</p>}
      {state.error && <p className="revision-warning" role="alert">{state.error}</p>}
      {state.proposal && validContext && <section className="revision-proposals"><h3>Review suggested changes</h3>{!state.proposal.changes.length ? <p role="status">No changes suggested. Your lesson is unchanged.</p> : <>
        <label className="revision-select-all"><input type="checkbox" checked={available.length > 0 && selectedChanges.length === available.length} disabled={!available.length} onChange={(event) => setSelected(new Set(event.target.checked ? available.map(revisionKey) : []))} />Select all available suggestions</label>
        {state.proposal.changes.map((change) => {
          const key = revisionKey(change); const conflict = conflicts.includes(key);
          return <article className={conflict ? "conflicting" : ""} key={key}><label><span className="sr-only">Use this suggestion: </span><input type="checkbox" disabled={conflict} checked={!conflict && selected.has(key)} onChange={(event) => selectChange(change, event.target.checked)} /><span><small>{revisionScopes[revisionFields[change.field][0]]}{change.grade ? ` · Grade ${change.grade}` : ""}{change.slotId ? ` · Block ${source.slots.findIndex((slot) => slot.id === change.slotId) + 1}` : ""}</small><b>{revisionFields[change.field][1]}</b></span></label><div className="revision-comparison"><div><b>Current</b><p>{source.fields.find((field) => revisionKey(field) === key)?.value || "Not entered"}</p></div><div><b>Suggested</b><p>{change.value}</p></div></div>{revisionGroupKeys(change, source).length > 1 && <small>This shared activity is selected together for all grades.</small>}{conflict && <p className="revision-conflict-note">You edited this field after requesting suggestions. Your edit is protected; request a new suggestion.</p>}</article>;
        })}</>}
      </section>}
    </div>
    <footer><button type="button" className="secondary-button" onClick={onClose}>{busy ? "Cancel request" : "Keep my lesson"}</button><button type="button" className="primary-button" disabled={!validContext || !selectedChanges.length} onClick={() => { if (state.request) onApply(state.request, selectedChanges); }}>Apply selected{selectedChanges.length ? ` (${selectedChanges.length})` : ""}</button></footer>
  </aside>;
}
