export type WalkthroughStatus = { version: 2; step: number; completed: boolean; dismissed: boolean };
type WalkthroughStep = { id: string; chapter: string; title: string; body: string; targets: string[]; where: string; after?: string[] };
export const walkthroughSteps: WalkthroughStep[] = [
  { id: "classes", chapter: "Class setup", title: "Let’s start with your class", body: "Hi, I’m Gabay. Choose Set up my first class, or open Classes & learners from the menu at the top left. I’ll point out what to do, but you make every change.", targets: ["class-first", "nav-classes", "nav-toggle"], where: "Open the menu at the top left, then Classes & learners. On a phone, tap Classes below.", after: ["class-page", "class-details"] },
  { id: "class-open", chapter: "Class setup", title: "One home for your class", body: "Choose Add class to create a class. Already have one? You can keep it and skip ahead to Lesson plans using the menu above.", targets: ["class-add"], where: "In Classes & learners, choose Add class or Set up a class.", after: ["class-details"] },
  { id: "class-details", chapter: "Class setup", title: "Name it, then choose grades and subjects", body: "Enter your section name. Choose the grade levels learning together, then your subjects. These details are reused in lesson plans. When ready, choose Continue to schedule.", targets: ["class-details", "class-details-next"], where: "Open Add class. The first step asks for the name, grades, and subjects.", after: ["class-schedule"] },
  { id: "class-schedule", chapter: "Class setup", title: "Choose when your class meets", body: "Select the days, start time, and end time. The summary helps you check them. Add another meeting only if needed, then Continue to learners.", targets: ["class-schedule"], where: "In class setup, continue to the Schedule step.", after: ["class-learners"] },
  { id: "class-learners", chapter: "Class setup", title: "Add learners now—or later", body: "Add each learner’s name and grade. Sex is optional and helps fill the lesson-plan counts. Choose Save class when ready, or Save without learners. Only your Save button creates the class.", targets: ["class-learners", "class-save"], where: "Continue to Learners in class setup. You can return later from the Learners tab.", after: ["class-overview"] },
  { id: "plans", chapter: "Lesson plans", title: "Now prepare a lesson", body: "Open Plan lessons. Your class information is already available, so you do not have to enter it again.", targets: ["nav-plan"], where: "Open Plan lessons from the navigation. On a phone, tap Plan.", after: ["plan-page", "plan-index"] },
  { id: "plan-open", chapter: "Lesson plans", title: "Start a new plan or open your own", body: "Choose New lesson plan, or open a saved lesson to continue editing it. Nothing is created just by looking around.", targets: ["plan-new", "plan-index"], where: "Open Plan lessons, then New lesson plan or one of your saved lessons.", after: ["plan-setup", "plan-document"] },
  { id: "plan-setup", chapter: "Lesson plans", title: "Give the lesson a clear starting point", body: "Check the class, subject, topic, and teaching date. Add materials or learning needs in the optional notes—without learner names. Change setup lets you adjust time, language, and grades.", targets: ["plan-setup", "plan-change"], where: "Open a lesson. Use Change setup if the setup fields are folded away." },
  { id: "plan-draft", chapter: "Lesson plans", title: "Choose how you want to begin", body: "Draft with Gabay gives you an editable starting point when signed in and connected. Or choose I’ll write it myself. The tour never runs AI for you. You remain responsible for checking the lesson.", targets: ["plan-draft", "plan-manual", "plan-improve"], where: "In the lesson setup, enter a topic to draft with Gabay, or choose I’ll write it myself. Existing lessons use Improve lesson with Gabay." },
  { id: "plan-edit", chapter: "Lesson plans", title: "Edit the actual ILAW document", body: "Click into the document to change the text yourself. Check Intentions, Learning Experience, Assessment, and Ways Forward for every grade. Improve lesson with Gabay lets you review suggestions before applying them.", targets: ["plan-intentions", "plan-document"], where: "Open a lesson and scroll to the ILAW document. All lesson text stays editable." },
  { id: "plan-save", chapter: "Lesson plans", title: "Save when you are ready", body: "Choose Save lesson to keep your work. After changing anything, save again. Check the sync message above: saved on this device is different from synced online.", targets: ["plan-save", "plan-saved"], where: "The lesson toolbar above the document contains Save lesson.", after: ["plan-saved"] },
  { id: "plan-export", chapter: "Lesson plans", title: "Take your lesson with you", body: "Print / PDF opens the print dialog; choose Save as PDF there. Download Word gives you an editable Microsoft Word file. Both use your current lesson. These actions also save it.", targets: ["plan-pdf", "plan-word"], where: "Open a lesson. Find Print / PDF and Download Word in its toolbar. You do not need to download anything for this tour." },
  { id: "teach-open", chapter: "Lesson plans", title: "Use the plan during class", body: "Choose Teach this lesson when you want the classroom guide. It saves the current lesson and opens a simpler view of what to do next.", targets: ["plan-teach"], where: "Open a lesson and choose Teach this lesson in the toolbar.", after: ["teach-page"] },
  { id: "teach", chapter: "Other features", title: "One teaching step at a time", body: "The teaching guide shows your current activity, timing, and what each grade is doing. Previous and Next move between steps. You can return to edit the lesson whenever needed.", targets: ["teach-current", "teach-page"], where: "Open a saved lesson, then choose Teach this lesson. You may skip this step if you are only setting up." },
  { id: "attendance", chapter: "Other features", title: "Attendance uses your class roster", body: "From Today or the teaching guide, choose Take attendance. Check the date and grade, mark each learner, then save. This guide never marks or saves attendance for you.", targets: ["attendance-page", "attendance-open", "nav-home"], where: "Open Today and choose Take attendance for your class, or use Attendance in the teaching guide." },
  { id: "resources", chapter: "Other features", title: "Find or share teaching materials", body: "Open Find resources to view materials and PDFs. Upload a resource lets you add your own file, describe its grades and subject, and choose who can access it. Nothing is uploaded by the tour.", targets: ["library-page", "nav-library"], where: "Open Find resources from the navigation; on a phone, tap Resources." },
  { id: "community", chapter: "Other features", title: "You can ask other teachers", body: "Open Ask teachers to ask a question, attach a resource, or reply to a discussion. Use @mentions when needed. Posting and online sharing require signing in and a connection.", targets: ["community-page", "nav-community"], where: "Open Ask teachers from the navigation; on a phone, tap Ask." },
  { id: "notifications", chapter: "Other features", title: "Watch for replies", body: "The bell brings your notifications together, including replies and mentions. Check here when another teacher responds.", targets: ["notifications"], where: "Find the bell at the top of the page. Close any open editing popup first." },
  { id: "finish", chapter: "Other features", title: "I’m here when you need a hand", body: "You’re ready to explore. Check the sync message before closing your work. For help, open Ask Gabay. To replay this guide, open Gabay’s menu and choose Show me around Kalinga.", targets: ["gabay-open", "sync-status"], where: "Ask Gabay and the sync message are at the top of the page. Close any open editing popup to see them." },
];
export const emptyWalkthroughStatus: WalkthroughStatus = { version: 2, step: 0, completed: false, dismissed: false };
export function canRestoreWalkthroughFocus(element: { tagName: string; isConnected: boolean } | null, allowed: boolean) {
  return !!element && element.isConnected && allowed && !["BODY", "HTML"].includes(element.tagName);
}
function safeStep(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(walkthroughSteps.length - 1, Math.floor(value))) : 0; }
export function readWalkthroughStatus(value: string | null): WalkthroughStatus {
  try {
    const stored = JSON.parse(value || "null");
    if (!stored || typeof stored !== "object") return { ...emptyWalkthroughStatus };
    if (stored.version !== 2) return { ...emptyWalkthroughStatus, dismissed: true };
    return { version: 2, step: safeStep(stored.step), completed: stored.completed === true, dismissed: stored.dismissed === true };
  } catch { return { ...emptyWalkthroughStatus }; }
}
export function walkthroughProgress(step: number, action: "next" | "back" | "pause"): WalkthroughStatus {
  const current = safeStep(step);
  return { version: 2, step: safeStep(current + (action === "next" ? 1 : action === "back" ? -1 : 0)), completed: action === "next" && current === walkthroughSteps.length - 1, dismissed: action === "pause" };
}
export function nextWalkthroughStep(step: number, visible: string[], alreadyVisible: string[] = []) {
  return walkthroughSteps[safeStep(step)].after?.some((target) => visible.includes(target) && !alreadyVisible.includes(target)) ? safeStep(step + 1) : safeStep(step);
}
export function canAdvanceWalkthrough(step: number, visible: string[]) {
  const item = walkthroughSteps[safeStep(step)];
  return item.targets.some((target) => visible.includes(target)) && (!item.after || item.after.some((target) => visible.includes(target)));
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
