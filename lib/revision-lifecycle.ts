export function createRevisionLifecycle() {
  let id = 0;
  let controller: AbortController | undefined;
  return {
    start() { controller?.abort(); controller = new AbortController(); id += 1; return { id, signal: controller.signal }; },
    cancel() { id += 1; controller?.abort(); },
    isCurrent(candidate: number) { return candidate === id && !!controller && !controller.signal.aborted; },
  };
}
