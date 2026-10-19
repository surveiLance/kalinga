import { GabayMascot } from "@/components/gabay-mascot";

export function GabayThinking({ motion = true }: { motion?: boolean }) {
  return <div className={`gabay gabay-thinking${motion ? "" : " motion-paused"}`} role="status">
    <span className="sr-only">Gabay is thinking</span>
    <div className="gabay-thinking-bubble" aria-hidden="true"><GabayMascot size="medium" motion={motion} /><span className="gabay-thinking-dots"><i /><i /><i /></span></div>
  </div>;
}
