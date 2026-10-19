"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GabayMascot } from "@/components/gabay-mascot";
import { canRestoreWalkthroughFocus, clipWalkthroughHighlight, nextWalkthroughStep, placeWalkthrough, walkthroughProgress, walkthroughSteps, type WalkthroughStatus } from "@/lib/gabay-walkthrough";

export function WalkthroughOffer({ onStart, onDismiss }: { onStart: () => void; onDismiss: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialogRef} className="walkthrough-offer" aria-modal="true" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onDismiss(); }}><GabayMascot size="hero" motion={false} /><p className="eyebrow">A LITTLE HELP GETTING STARTED</p><h2 id={titleId}>Let Gabay show you around</h2><p>I’ll point out where to click as you set up a class and prepare a lesson.</p><p><b>You stay in control.</b> This is your real workspace: I won’t fill, generate, save, or post anything for you.</p><div><button type="button" className="primary-button" onClick={onStart}>Start with Gabay</button><button type="button" className="secondary-button" onClick={onDismiss}>Not now</button></div><small>Optional, skippable, and available again from Gabay’s menu. No AI connection needed.</small></dialog>;
}

export function WalkthroughCard({ step, targetFound, onMove, onExit, onLocate, onMinimize }: { step: number; targetFound: boolean; onMove: (step: number) => void; onExit: () => void; onLocate: () => void; onMinimize?: () => void }) {
  const item = walkthroughSteps[step];
  const titleId = useId();
  return <section className="walkthrough-card" aria-labelledby={titleId}>
    <header><GabayMascot size="medium" motion={false} /><div><b>Gabay’s walkthrough</b><label><span className="sr-only">Jump to a walkthrough section</span><select value={item.chapter} onChange={(event) => onMove(walkthroughSteps.findIndex((entry) => entry.chapter === event.target.value))}>{[...new Set(walkthroughSteps.map((entry) => entry.chapter))].map((chapter) => <option key={chapter}>{chapter}</option>)}</select></label></div><div className="walkthrough-window-actions">{onMinimize && <button type="button" onClick={onMinimize} aria-label="Minimize walkthrough" title="Move Gabay out of the way">−</button>}<button type="button" className="walkthrough-exit" onClick={onExit} aria-label="Exit tour">×</button></div></header>
    <div className="walkthrough-copy" aria-live="polite" aria-atomic="true"><p className="walkthrough-count">{item.chapter} · {step + 1} of {walkthroughSteps.length}</p><h2 id={titleId} tabIndex={-1}>{item.title}</h2><p>{item.body}</p>{!targetFound && <p className="walkthrough-where">{item.where}</p>}</div>
    <div className="walkthrough-tools">{targetFound && <button className="walkthrough-locate" type="button" onClick={onLocate}>Show the highlighted area</button>}{onMinimize && <button className="walkthrough-locate" type="button" onClick={onMinimize}>Move Gabay aside</button>}</div>
    <footer><button type="button" className="walkthrough-back" disabled={step === 0} onClick={() => onMove(Math.max(0, step - 1))}>Back</button><button type="button" className="walkthrough-skip" onClick={() => onMove(step + 1)}>Skip step</button><button type="button" className="walkthrough-next" onClick={() => onMove(step + 1)}>{step === walkthroughSteps.length - 1 ? "Finish tour" : "Next"}<span aria-hidden="true"> →</span></button></footer>
  </section>;
}

export function GabayWalkthrough({ step, motion, onProgress, onExit }: { step: number; motion: boolean; onProgress: (status: WalkthroughStatus) => void; onExit: () => void }) {
  const targetRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef<string[]>([]);
  const manualStep = useRef<{ step: number; markers: string[] } | null>(null);
  const dockedFor = useRef<{ step: number; surface: HTMLElement | null } | null>(null);
  const activeDock = useRef<HTMLElement | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [location, setLocation] = useState<{ host: HTMLElement; docked: boolean; matched: boolean; rect: { left: number; top: number; width: number; height: number } | null; left: number; top: number; width: number } | null>(null);
  const item = walkthroughSteps[step];
  useEffect(() => {
    let frame = 0;
    let lastTarget: HTMLElement | null = null;
    let stopped = false;
    const observed = new Set<HTMLElement>();
    function measure() {
      if (stopped) return;
      const dialog = [...document.querySelectorAll<HTMLElement>("dialog[open], [role='dialog'][aria-modal='true']")].filter((element) => element.getClientRects().length).at(-1);
      const targets = [...document.querySelectorAll<HTMLElement>("[data-tour]")].filter((element) => {
        if (dialog && !dialog.contains(element) || element.closest("[inert], [hidden], [aria-hidden='true']")) return false;
        const bounds = element.getBoundingClientRect(); const style = window.getComputedStyle(element);
        return bounds.width > 0 && bounds.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      });
      visibleRef.current = targets.map((element) => element.dataset.tour || "");
      const guard = manualStep.current?.step === step ? manualStep.current : null;
      if (guard) guard.markers = guard.markers.filter((marker) => visibleRef.current.includes(marker));
      const next = nextWalkthroughStep(step, visibleRef.current, guard?.markers);
      if (next !== step) { manualStep.current = null; onProgress({ version: 2, step: next, completed: false, dismissed: false }); return; }
      const matched = item.targets.flatMap((id) => targets.filter((element) => element.dataset.tour === id))[0] || null;
      const target = matched || targets.find((element) => element.dataset.tour === "nav-toggle") || null;
      targetRef.current = target;
      if (target && target !== lastTarget && !minimized) { lastTarget = target; target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" }); }
      const bounds = target?.getBoundingClientRect();
      const viewport = { left: window.visualViewport?.offsetLeft || 0, top: window.visualViewport?.offsetTop || 0, width: window.visualViewport?.width || window.innerWidth, height: window.visualViewport?.height || window.innerHeight };
      const clips = [{ left: viewport.left + 8, top: viewport.top + 8, width: viewport.width - 16, height: viewport.height - 16 }];
      const tracked = new Set<HTMLElement>(target ? [target] : []);
      if (cardRef.current) tracked.add(cardRef.current);
      for (let parent = target?.parentElement; parent; parent = parent.parentElement) {
        const style = window.getComputedStyle(parent);
        const x = /auto|scroll|hidden|clip/.test(style.overflowX); const y = /auto|scroll|hidden|clip/.test(style.overflowY);
        tracked.add(parent);
        if (x || y) {
          const box = parent.getBoundingClientRect();
          clips.push({ left: x ? box.left + parent.clientLeft : viewport.left, top: y ? box.top + parent.clientTop : viewport.top, width: x ? parent.clientWidth : viewport.width, height: y ? parent.clientHeight : viewport.height });
        }
        if (parent.matches("dialog[open]")) break;
      }
      const footer = target?.closest(".class-setup-card")?.querySelector<HTMLElement>(".class-wizard-actions");
      if (footer && !footer.contains(target)) {
        tracked.add(footer);
        const box = footer.getBoundingClientRect();
        if (box.width > 0 && box.height > 0) clips.push({ left: viewport.left, top: viewport.top, width: viewport.width, height: Math.max(0, box.top - viewport.top - 5) });
      }
      for (const element of observed) if (!tracked.has(element)) { resize.unobserve(element); observed.delete(element); }
      for (const element of tracked) if (!observed.has(element)) { resize.observe(element); observed.add(element); }
      const rect = bounds ? clipWalkthroughHighlight(bounds, clips) : null;
      const cardHeight = cardRef.current?.offsetHeight || 360;
      const controls = [...(dialog || document).querySelectorAll<HTMLElement>("button, input, select, textarea, summary, a[href], iframe, [role='button']")].filter((element) => !element.closest(".walkthrough-layer, [inert], [hidden], [aria-hidden='true']") && element.getClientRects().length).map((element) => { const bounds = element.getBoundingClientRect(); return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }; });
      const position = placeWalkthrough(rect, { width: window.innerWidth, height: window.visualViewport?.height || window.innerHeight }, { width: 380, height: cardHeight }, controls);
      const slot = dialog?.querySelector<HTMLElement>("[data-walkthrough-host]") || (!dialog ? document.querySelector<HTMLElement>("[data-walkthrough-host='workspace']") : null);
      const heldDock = dockedFor.current?.step === step && dockedFor.current.surface === (dialog || null);
      const docked = !!slot && (minimized || !!dialog || !!position.dock || heldDock);
      if (docked && !minimized) dockedFor.current = { step, surface: dialog || null };
      if (activeDock.current !== (docked ? slot : null)) {
        activeDock.current?.classList.remove("walkthrough-dock-active");
        activeDock.current?.closest("dialog")?.removeAttribute("data-walkthrough-layout");
        activeDock.current = docked ? slot : null;
      }
      if (activeDock.current) {
        if (!activeDock.current.classList.contains("walkthrough-dock-active")) activeDock.current.classList.add("walkthrough-dock-active");
        const layout = minimized ? "compact" : "full";
        if (activeDock.current.dataset.walkthroughLayout !== layout) activeDock.current.dataset.walkthroughLayout = layout;
        const parentDialog = activeDock.current.closest("dialog");
        if (parentDialog && parentDialog.dataset.walkthroughLayout !== layout) parentDialog.dataset.walkthroughLayout = layout;
      }
      const host = docked ? slot! : dialog || document.body;
      setLocation((previous) => previous?.host === host && previous.docked === docked && previous.matched === !!matched && JSON.stringify([previous.rect, previous.left, previous.top, previous.width]) === JSON.stringify([rect, position.left, position.top, position.width]) ? previous : { host, docked, matched: !!matched, rect, ...position });
    }
    function schedule() { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(measure); }
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "hidden", "aria-hidden", "inert", "data-tour", "data-walkthrough-layout", "class"] });
    const resize = new ResizeObserver(schedule);
    if (cardRef.current) resize.observe(cardRef.current);
    function layoutEnd(event: Event) { if (event.target instanceof HTMLElement && !event.target.closest(".walkthrough-layer")) schedule(); }
    window.addEventListener("resize", schedule); window.addEventListener("scroll", schedule, true); window.visualViewport?.addEventListener("resize", schedule); window.visualViewport?.addEventListener("scroll", schedule);
    document.addEventListener("animationend", layoutEnd, true); document.addEventListener("transitionend", layoutEnd, true);
    schedule();
    return () => { stopped = true; window.cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect(); window.removeEventListener("resize", schedule); window.removeEventListener("scroll", schedule, true); window.visualViewport?.removeEventListener("resize", schedule); window.visualViewport?.removeEventListener("scroll", schedule); document.removeEventListener("animationend", layoutEnd, true); document.removeEventListener("transitionend", layoutEnd, true); };
  }, [step, item, onProgress, location?.host, minimized]);
  useEffect(() => () => { activeDock.current?.classList.remove("walkthrough-dock-active"); activeDock.current?.closest("dialog")?.removeAttribute("data-walkthrough-layout"); }, []);
  useEffect(() => { if (!minimized) cardRef.current?.querySelector<HTMLHeadingElement>("h2")?.focus({ preventScroll: true }); }, [location?.host, minimized]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const dialog = [...document.querySelectorAll<HTMLElement>("dialog[open], [role='dialog'][aria-modal='true']")].filter((element) => element.getClientRects().length).at(-1);
      const fallback = dialog?.querySelector<HTMLElement>("input, select, textarea, button") || document.querySelector<HTMLElement>("[data-tour='gabay-open']");
      if (canRestoreWalkthroughFocus(previous, !dialog || !!previous && dialog.contains(previous))) previous?.focus({ preventScroll: true }); else fallback?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => { function escape(event: KeyboardEvent) { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onExit(); } } document.addEventListener("keydown", escape, true); return () => document.removeEventListener("keydown", escape, true); }, [onExit]);
  if (!location) return null;
  function move(next: number) { manualStep.current = { step: next, markers: [...visibleRef.current] }; onProgress(next >= walkthroughSteps.length ? walkthroughProgress(step, "next") : { version: 2, step: next, completed: false, dismissed: false }); }
  return createPortal(<div className={`walkthrough-layer${location.docked ? " docked" : ""}${motion ? " motion" : ""}`}>
    {location.rect && location.rect.height > 0 && <div className="walkthrough-highlight" aria-hidden="true" style={{ left: location.rect.left, top: location.rect.top, width: location.rect.width, height: location.rect.height }} />}
    {minimized ? <button type="button" className="walkthrough-resume" onClick={() => setMinimized(false)} aria-label="Continue with Gabay"><GabayMascot size="small" motion={false} /><span>Continue tour</span></button> : <div ref={cardRef} className="walkthrough-position" style={location.docked ? undefined : { left: location.left, top: location.top, width: location.width }}><WalkthroughCard step={step} targetFound={location.matched} onMove={move} onExit={onExit} onMinimize={() => setMinimized(true)} onLocate={() => targetRef.current?.scrollIntoView({ block: "center", behavior: motion ? "smooth" : "instant" })} /></div>}
  </div>, location.host);
}
