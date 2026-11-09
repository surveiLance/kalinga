export type PromptDetails = { goal: string; needs: string; materials: string; format: string };
export const emptyPromptDetails: PromptDetails = { goal: "", needs: "", materials: "", format: "" };
export function buildTeacherPrompt(details: PromptDetails, translate: (text: string) => string) {
  return [["My request", details.goal], ["Learner needs", details.needs], ["Materials and limits", details.materials], ["Response format", details.format && translate(details.format)]].filter(([, value]) => value.trim()).map(([label, value]) => `${translate(label)}: ${value.trim()}`).join("\n");
}
export function appendTeacherPrompt(existing: string, addition: string, limit = 2000) {
  if (!addition.trim() || existing.includes(addition.trim())) return existing;
  const combined = existing.trim() ? `${existing}\n\n${addition.trim()}` : addition.trim();
  return combined.length <= limit ? combined : null;
}
