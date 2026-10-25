export function canRestoreWalkthroughFocus(element: { tagName: string; isConnected: boolean } | null, allowed: boolean) {
  return !!element && element.isConnected && allowed && !["BODY", "HTML"].includes(element.tagName);
}
type Rect = { left: number; top: number; width: number; height: number };
export function clipWalkthroughHighlight(target: Rect, clips: Rect[]) {
  const left = Math.max(...clips.map((clip) => clip.left));
  const top = Math.max(...clips.map((clip) => clip.top));
  const right = Math.min(...clips.map((clip) => clip.left + clip.width));
  const bottom = Math.min(...clips.map((clip) => clip.top + clip.height));
  if (target.width <= 0 || target.height <= 0 || Math.max(target.left, left) >= Math.min(target.left + target.width, right) || Math.max(target.top, top) >= Math.min(target.top + target.height, bottom)) return null;
  const x = Math.max(left, target.left - 5); const y = Math.max(top, target.top - 5);
  return { left: x, top: y, width: Math.min(right, target.left + target.width + 5) - x, height: Math.min(bottom, target.top + target.height + 5) - y };
}
export function placeWalkthrough(target: Rect | null, viewport: { width: number; height: number }, card: { width: number; height: number }, controls: Rect[] = []) {
  const gap = 16;
  const width = viewport.width < 640 ? viewport.width - 24 : Math.min(card.width, viewport.width - 32);
  const bottom = Math.max(12, viewport.height - card.height - (viewport.width < 640 ? 84 : gap));
  if (viewport.width < 640) return { left: 12, top: bottom, width, dock: true };
  if (!target) return { left: viewport.width - width - gap, top: bottom, width, dock: true };
  const top = Math.max(gap, Math.min(target.top, bottom));
  const aligned = Math.max(gap, Math.min(target.left, viewport.width - width - gap));
  const candidates = [{ left: target.left + target.width + gap, top }, { left: target.left - gap - width, top }, { left: aligned, top: target.top + target.height + gap }, { left: aligned, top: target.top - card.height - gap }];
  const safe = candidates.find((candidate) => candidate.left >= gap && candidate.top >= gap && candidate.left + width <= viewport.width - gap && candidate.top + card.height <= viewport.height - gap && ![target, ...controls].some((control) => candidate.left < control.left + control.width + 4 && candidate.left + width > control.left - 4 && candidate.top < control.top + control.height + 4 && candidate.top + card.height > control.top - 4));
  if (safe) return { ...safe, width, dock: false };
  return { left: viewport.width - width - gap, top: bottom, width, dock: true };
}
