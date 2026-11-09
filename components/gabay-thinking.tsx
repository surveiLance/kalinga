import { T } from "@/components/language-switch";
import { GabayMascot } from "@/components/gabay-mascot";

export function isGabayThinking(replying: boolean, lastMessageRole?: "teacher" | "gabay") {
  return replying && lastMessageRole === "teacher";
}

export function GabayThinking({ motion = true }: { motion?: boolean }) {
  return <div className={`gabay gabay-thinking${motion ? "" : " motion-paused"}`} role="status">
    <span className="sr-only"><T>Gabay is thinking</T></span>
    <div className="gabay-thinking-bubble" aria-hidden="true"><GabayMascot size="medium" motion={motion} /><span className="gabay-thinking-dots"><i /><i /><i /></span></div>
  </div>;
}
