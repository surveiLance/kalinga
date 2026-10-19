export const revisionScopes = { whole: "Whole lesson", intentions: "I · Intentions", experience: "L · Learning Experience", assessment: "A · Assessment", forward: "W · Ways Forward" } as const;
export type RevisionScope = keyof typeof revisionScopes;
export const revisionFields = {
  sharedTheme: ["intentions", "Shared theme", "text"], objectives: ["intentions", "Learning objective", "grade"],
  learnerContext: ["experience", "Learner context", "text"], materials: ["experience", "Materials", "text"], teacherFocus: ["experience", "Teacher focus", "slot"], gradeTasks: ["experience", "Grade activity", "task"],
  formativeAssessments: ["assessment", "Learning check", "grade"], exitTasks: ["assessment", "Exit task", "grade"], successCriteria: ["assessment", "Success criteria", "grade"],
  reflectionQuestions: ["forward", "Proposed reflection question", "grade"], remediations: ["forward", "Proposed remediation", "grade"], enrichments: ["forward", "Proposed enrichment", "grade"], nextSessionNotes: ["forward", "Next-session notes", "text"],
} as const;
export type RevisionField = keyof typeof revisionFields;
export type RevisionChange = { field: RevisionField; grade?: string; slotId?: string; value: string };
export type RevisionSource = {
  context: { planId: string; classId: string; title: string; subject: string; grades: string[]; language: string; duration: string; startTime: string; quarter: string; date: string; model: string };
  slots: Array<{ id: string; time: string; stage: string; durationMinutes: number; wholeClass: boolean }>;
  references: Record<string, Record<string, string>>;
  fields: RevisionChange[];
};
export type RevisionRequest = { id: string; scope: RevisionScope; instruction: string; source: RevisionSource };
export type RevisionProposal = { id: string; changes: RevisionChange[] };
export const revisionKey = (change: Omit<RevisionChange, "value">) => JSON.stringify([change.field, change.grade || "", change.slotId || ""]);
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function exact(value: Record<string, unknown>, keys: string[]) { if (Object.keys(value).some((key) => !keys.includes(key))) throw new Error("Unexpected revision fields."); }
function text(value: unknown, limit = 4000, required = false): asserts value is string { if (typeof value !== "string" || value.length > limit || (required && !value.trim())) throw new Error("Revision text is missing or too long."); }
function target(value: unknown, source: RevisionSource): RevisionChange {
  if (!object(value)) throw new Error("Invalid change.");
  exact(value, ["field", "grade", "slotId", "value"]);
  if (typeof value.field !== "string" || !Object.hasOwn(revisionFields, value.field)) throw new Error("Protected or unknown field.");
  text(value.value);
  const kind = revisionFields[value.field as RevisionField][2];
  if ((kind === "grade" || kind === "task") ? typeof value.grade !== "string" || !source.context.grades.includes(value.grade) : value.grade !== undefined) throw new Error("Invalid grade target.");
  if ((kind === "slot" || kind === "task") ? typeof value.slotId !== "string" || !source.slots.some((slot) => slot.id === value.slotId) : value.slotId !== undefined) throw new Error("Invalid activity target.");
  return value as RevisionChange;
}
export function validateRevisionRequest(value: unknown): RevisionRequest {
  if (new TextEncoder().encode(JSON.stringify(value)).length > 120000) throw new Error("This lesson is too large to revise at once. Shorten its text first.");
  if (!object(value)) throw new Error("Invalid revision request.");
  exact(value, ["id", "scope", "instruction", "source"]);
  text(value.id, 100, true); text(value.instruction, 2000, true);
  if (typeof value.scope !== "string" || !Object.hasOwn(revisionScopes, value.scope) || !object(value.source)) throw new Error("Invalid revision scope.");
  const source = value.source;
  exact(source, ["context", "slots", "references", "fields"]);
  if (!object(source.context) || !Array.isArray(source.slots) || !Array.isArray(source.fields) || !object(source.references)) throw new Error("Invalid lesson source.");
  const context = source.context;
  exact(context, ["planId", "classId", "title", "subject", "grades", "language", "duration", "startTime", "quarter", "date", "model"]);
  for (const key of ["planId", "classId", "title", "subject", "language", "duration", "startTime", "quarter", "date", "model"]) text(context[key], 4000, ["planId", "classId", "title", "subject"].includes(key));
  if (!Array.isArray(context.grades) || !context.grades.length || context.grades.length > 13 || new Set(context.grades).size !== context.grades.length) throw new Error("Invalid lesson grades.");
  for (const grade of context.grades) text(grade, 40, true);
  if (!source.slots.length || source.slots.length > 40) throw new Error("A revision supports 1–40 teaching blocks.");
  const slotIds = new Set();
  for (const slot of source.slots) {
    if (!object(slot)) throw new Error("Invalid block.");
    exact(slot, ["id", "time", "stage", "durationMinutes", "wholeClass"]);
    text(slot.id, 100, true); text(slot.time, 100); text(slot.stage, 4000);
    if (slotIds.has(slot.id) || typeof slot.wholeClass !== "boolean" || typeof slot.durationMinutes !== "number" || !Number.isFinite(slot.durationMinutes) || slot.durationMinutes < 1 || slot.durationMinutes > 600) throw new Error("Invalid block timing or identity.");
    slotIds.add(slot.id);
  }
  exact(source.references, ["competencies", "competencyCodes", "contentStandards", "performanceStandards"]);
  for (const refs of Object.values(source.references)) {
    if (!object(refs)) throw new Error("Invalid curriculum references.");
    exact(refs, context.grades as string[]);
    Object.values(refs).forEach((item) => text(item));
  }
  const checked = source as unknown as RevisionSource;
  const expected: string[] = [];
  for (const [field, [, , kind]] of Object.entries(revisionFields)) {
    if (kind === "text") expected.push(revisionKey({ field: field as RevisionField }));
    if (kind === "grade") context.grades.forEach((grade) => expected.push(revisionKey({ field: field as RevisionField, grade })));
    if (kind === "slot") checked.slots.forEach((slot) => expected.push(revisionKey({ field: field as RevisionField, slotId: slot.id })));
    if (kind === "task") checked.slots.forEach((slot) => checked.context.grades.forEach((grade) => expected.push(revisionKey({ field: field as RevisionField, slotId: slot.id, grade }))));
  }
  const keys = source.fields.map((field) => revisionKey(target(field, checked)));
  if (keys.length !== expected.length || new Set(keys).size !== keys.length || expected.some((key) => !keys.includes(key))) throw new Error("The lesson source is incomplete.");
  return value as unknown as RevisionRequest;
}
export function validateRevisionProposal(value: unknown, request: RevisionRequest): RevisionProposal {
  if (!object(value)) throw new Error("Invalid proposal.");
  exact(value, ["id", "changes"]);
  if (value.id !== request.id || !Array.isArray(value.changes) || value.changes.length > request.source.fields.length) throw new Error("Invalid or outdated proposal.");
  const seen = new Set<string>();
  const changes = value.changes.map((item) => {
    const change = target(item, request.source);
    if (!change.value.trim() || (request.scope !== "whole" && revisionFields[change.field][0] !== request.scope)) throw new Error("Empty or out-of-scope suggestion.");
    const key = revisionKey(change);
    if (seen.has(key)) throw new Error("Duplicate suggestion.");
    seen.add(key);
    return { ...change, value: change.value.trim() };
  }).filter((change) => request.source.fields.find((field) => revisionKey(field) === revisionKey(change))?.value !== change.value);
  return { id: request.id, changes };
}
export function revisionContextMatches(source: RevisionSource, current: RevisionSource) {
  return JSON.stringify([source.context, source.slots, source.references]) === JSON.stringify([current.context, current.slots, current.references]);
}
export function revisionConflicts(source: RevisionSource, current: RevisionSource, proposal: RevisionProposal) {
  return proposal.changes.filter((change) => !revisionContextMatches(source, current) || source.fields.find((field) => revisionKey(field) === revisionKey(change))?.value !== current.fields.find((field) => revisionKey(field) === revisionKey(change))?.value).map(revisionKey);
}
export function redactRevisionRequest(request: RevisionRequest, redact: (text: string) => string): RevisionRequest {
  return { ...request, instruction: redact(request.instruction), source: { ...request.source, context: { ...request.source.context, title: redact(request.source.context.title) }, references: Object.fromEntries(Object.entries(request.source.references).map(([field, grades]) => [field, Object.fromEntries(Object.entries(grades).map(([grade, value]) => [grade, redact(value)]))])), fields: request.source.fields.map((field) => ({ ...field, value: redact(field.value) })) } };
}
