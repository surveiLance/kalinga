import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { validateRevisionRequest, validateRevisionProposal, type RevisionRequest, type RevisionProposal } from "@/lib/lesson-revisions";

export type GabayPageContext = {
  view: string;
  teacherName?: string;
  pageStep?: string;
  classId?: string;
  className?: string;
  gradeLevels: string[];
  subjects?: string[];
  learnerCount?: number;
  scheduleSummary?: string[];
  subject?: string;
  lessonTopic?: string;
  lessonDuration?: string;
  language?: string;
  incompleteSections?: string[];
  currentSummary?: string[];
  availableActions?: string[];
  offline: boolean;
};

export type GabayHistoryMessage = {
  role: "teacher" | "gabay";
  text: string;
};

type GabayResult =
  | { connected: true; reply: string }
  | { connected: false; reason: "not-configured" | "not-signed-in" | "busy" | "unavailable" | "offline" };

export type GabayDraft =
  | { type: "intentions"; competency: string; objective: string }
  | { type: "assessment"; formativeAssessment: string; exitTask: string; successCriteria: string }
  | { type: "full-plan"; sharedTheme: string; learnerContext: string; materials: string; nextSessionNotes: string; grades: Record<string, { competency: string; competencyCode: string; contentStandard: string; performanceStandard: string; objective: string; formativeAssessment: string; exitTask: string; successCriteria: string; reflectionQuestion: string; remediation: string; enrichment: string }>; slots: Array<{ stage: string; durationMinutes: number; teacherFocus: string; gradeTasks: Record<string, string> }> };

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonemptyString(value: unknown) {
  return typeof value === "string" && Boolean(value.trim());
}

// A draft is usable — not necessarily complete. Each requested grade must carry at
// least a competency or objective, and each slot at least one grade's task. Missing
// fields are filled by the teacher on apply (prior text is kept), so a mostly-complete
// draft from the model is accepted and finished rather than rejected whole.
export function isCompleteGabayFullPlan(value: unknown, expectedGrades: string[]): value is Extract<GabayDraft, { type: "full-plan" }> {
  if (!record(value) || value.type !== "full-plan" || !record(value.grades) || !Array.isArray(value.slots) || !value.slots.length || !expectedGrades.length) return false;
  const gradeDrafts = value.grades as Record<string, unknown>;
  if (!expectedGrades.every((grade) => {
    const item = gradeDrafts[grade];
    return record(item) && (nonemptyString(item.competency) || nonemptyString(item.objective));
  })) return false;
  return value.slots.every((slot) => {
    if (!record(slot) || !record(slot.gradeTasks)) return false;
    const gradeTasks = slot.gradeTasks as Record<string, unknown>;
    return expectedGrades.some((grade) => nonemptyString(gradeTasks[grade]));
  });
}

type GabayDraftResult =
  | { connected: true; draft: GabayDraft }
  | { connected: false; reason: "not-configured" | "not-signed-in" | "busy" | "unavailable" | "offline" };

export { isSupabaseConfigured };

export async function requestGabayRevision(request: RevisionRequest, pageContext: GabayPageContext, signal?: AbortSignal): Promise<{ connected: true; proposal: RevisionProposal } | { connected: false; reason: string }> {
  try {
    if (signal?.aborted) return { connected: false, reason: "cancelled" };
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { connected: false, reason: "offline" };
    const checked = validateRevisionRequest(request);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { connected: false, reason: "not-configured" };
    const { data } = await supabase.auth.getSession();
    if (!data.session) return { connected: false, reason: "not-signed-in" };
    const capability = await supabase.functions.invoke("gabay-chat", { body: { message: "Check revision support", task: { type: "revision-capabilities" } }, signal });
    if (signal?.aborted) return { connected: false, reason: "cancelled" };
    if (capability.error || capability.data?.revisionVersion !== 1) return { connected: false, reason: "unsupported" };
    const result = await supabase.functions.invoke("gabay-chat", { body: { message: "Suggest lesson revisions", task: { type: "revise-plan" }, revision: checked, pageContext: { ...pageContext, classId: checked.source.context.classId } }, signal });
    if (signal?.aborted) return { connected: false, reason: "cancelled" };
    if (result.error) return { connected: false, reason: (result.error as { context?: { status?: number } }).context?.status === 429 ? "busy" : "unavailable" };
    return { connected: true, proposal: validateRevisionProposal(result.data?.proposal, checked) };
  } catch (error) {
    return { connected: false, reason: signal?.aborted ? "cancelled" : error instanceof Error && /too large|too long|supports/.test(error.message) ? "too-large" : "unavailable" };
  }
}

export async function askConnectedGabay(message: string, pageContext: GabayPageContext, history: GabayHistoryMessage[] = []): Promise<GabayResult> {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { connected: false, reason: "offline" };
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { connected: false, reason: "not-configured" };

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return { connected: false, reason: "not-signed-in" };

    const { data, error } = await supabase.functions.invoke("gabay-chat", {
      body: {
        message,
        pageContext,
        history: history.slice(-12),
      },
    });

    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      return { connected: false, reason: status === 429 ? "busy" : "unavailable" };
    }

    if (typeof data?.reply !== "string" || !data.reply.trim()) {
      return { connected: false, reason: "unavailable" };
    }

    return { connected: true, reply: data.reply.trim() };
  } catch {
    return { connected: false, reason: "unavailable" };
  }
}

export async function requestGabayDraft(type: GabayDraft["type"], pageContext: GabayPageContext, grade: string): Promise<GabayDraftResult> {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { connected: false, reason: "offline" };
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { connected: false, reason: "not-configured" };

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return { connected: false, reason: "not-signed-in" };

    const { data, error } = await supabase.functions.invoke("gabay-chat", {
      body: {
        message: `Create an editable ${type} draft for ${grade}.`,
        pageContext,
        task: { type, grade },
      },
    });

    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      return { connected: false, reason: status === 429 ? "busy" : "unavailable" };
    }

    const draft = data?.draft as Record<string, unknown> | undefined;
    if (!draft || draft.type !== type) return { connected: false, reason: "unavailable" };
    if (type === "intentions" && typeof draft.competency === "string" && typeof draft.objective === "string" && draft.competency.trim() && draft.objective.trim()) {
      return { connected: true, draft: { type, competency: draft.competency.trim(), objective: draft.objective.trim() } };
    }
    if (type === "assessment" && typeof draft.formativeAssessment === "string" && typeof draft.exitTask === "string" && typeof draft.successCriteria === "string" && draft.formativeAssessment.trim() && draft.exitTask.trim() && draft.successCriteria.trim()) {
      return { connected: true, draft: { type, formativeAssessment: draft.formativeAssessment.trim(), exitTask: draft.exitTask.trim(), successCriteria: draft.successCriteria.trim() } };
    }
    if (type === "full-plan" && isCompleteGabayFullPlan(draft, pageContext.gradeLevels)) {
      return { connected: true, draft };
    }
    return { connected: false, reason: "unavailable" };
  } catch {
    return { connected: false, reason: "unavailable" };
  }
}
