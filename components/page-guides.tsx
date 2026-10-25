"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GabayWalkthrough, WalkthroughOffer } from "@/components/gabay-walkthrough";
import { completePageGuide, isCurrentPageGuide, isNewPageGuideRequest, markPageGuideOffered, pageGuideLabels, readPageGuideStatus, shouldOfferPageGuide, type PageGuidePage, type PageGuideRequest, type PageGuideSession, type PageGuideStatus } from "@/lib/page-guides";
import { workspaceStorageKey } from "@/lib/workspace-keys";

export function PageGuideButton({ onStart, compact = false }: { onStart: () => void; compact?: boolean }) {
  return <button className={`page-guide-trigger${compact ? " page-guide-inline" : ""}`} type="button" onClick={onStart}>Guide this page</button>;
}

export function GabayPageGuides({ scope, page, motion, blocked, request, onStart }: { scope: string; page: PageGuidePage; motion: boolean; blocked: boolean; request: PageGuideRequest | null; onStart: () => void }) {
  const [status, setStatus] = useState<PageGuideStatus>(() => readPageGuideStatus(null));
  const statusRef = useRef(status);
  const [ready, setReady] = useState(false);
  const [hasModal, setHasModal] = useState(true);
  const [offerPage, setOfferPage] = useState<PageGuidePage | null>(null);
  const [active, setActive] = useState<PageGuideSession | null>(null);
  const [storageMessage, setStorageMessage] = useState("");
  const handledRequest = useRef(0);
  const live = useRef(true);
  const canPersist = useRef(true);
  const save = useCallback((next: PageGuideStatus) => {
    if (!live.current) return;
    statusRef.current = next;
    setStatus(next);
    if (!canPersist.current) return;
    try { window.localStorage.setItem(workspaceStorageKey(scope, "tutorial-status"), JSON.stringify(next)); }
    catch { canPersist.current = false; setStorageMessage("Guide preferences are remembered only until you close this page. Your teaching work is unchanged."); }
  }, [scope]);

  useEffect(() => {
    live.current = true;
    const timer = window.setTimeout(() => {
      let saved = readPageGuideStatus(null);
      try { saved = readPageGuideStatus(window.localStorage.getItem(workspaceStorageKey(scope, "tutorial-status"))); }
      catch { canPersist.current = false; setStorageMessage("Guide preferences are remembered only until you close this page. Your teaching work is unchanged."); }
      statusRef.current = saved;
      setStatus(saved);
      setReady(true);
    }, 0);
    return () => { live.current = false; window.clearTimeout(timer); };
  }, [scope]);

  useEffect(() => {
    let frame = 0;
    let stopped = false;
    function check() {
      if (stopped) return;
      setHasModal([...document.querySelectorAll("dialog[open], [role='dialog'][aria-modal='true']")].some((element) => element.getClientRects().length > 0));
    }
    function schedule() { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(check); }
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "hidden", "aria-hidden", "class"] });
    schedule();
    return () => { stopped = true; observer.disconnect(); window.cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      const start = isNewPageGuideRequest(request, scope, page, handledRequest.current);
      handledRequest.current = Math.max(handledRequest.current, request?.id || 0);
      if (start && !blocked) save(markPageGuideOffered(statusRef.current, page));
      setActive(start && !blocked ? { scope, page } : null);
      setOfferPage(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [page, scope, request, blocked, ready, save]);

  const guiding = isCurrentPageGuide(active, scope, page) && !blocked;
  useEffect(() => {
    if (!shouldOfferPageGuide(status, page, ready, blocked || hasModal || guiding)) return;
    const timer = window.setTimeout(() => setOfferPage(page), 0);
    return () => window.clearTimeout(timer);
  }, [status, page, ready, blocked, hasModal, guiding]);

  const markShown = useCallback(() => save(markPageGuideOffered(statusRef.current, page)), [save, page]);
  function finish() { save(completePageGuide(statusRef.current, page)); setActive(null); }

  return <>
    {ready && offerPage === page && !blocked && !hasModal && !guiding && <WalkthroughOffer key={page} pageLabel={pageGuideLabels[page]} onShown={markShown} onStart={() => { setOfferPage(null); onStart(); }} onDismiss={() => setOfferPage(null)} />}
    {guiding && <GabayWalkthrough key={`${scope}:${page}:${request?.id || 0}`} page={page} motion={motion} onComplete={finish} onExit={() => setActive(null)} />}
    {storageMessage && (guiding || offerPage === page) && <p className="page-guide-storage" role="status">{storageMessage}</p>}
  </>;
}
