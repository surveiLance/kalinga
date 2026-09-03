import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

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
  | { connected: false; reason: "not-configured" | "not-signed-in" | "unavailable" };

export type GabayDraft =
  | { type: "intentions"; competency: string; objective: string }
  | { type: "assessment"; formativeAssessment: string; exitTask: string; successCriteria: string };

type GabayDraftResult =
  | { connected: true; draft: GabayDraft }
  | { connected: false; reason: "not-configured" | "not-signed-in" | "busy" | "unavailable" };

export { isSupabaseConfigured };

export async function askConnectedGabay(message: string, pageContext: GabayPageContext, history: GabayHistoryMessage[] = []): Promise<GabayResult> {
  try {
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

    if (error || typeof data?.reply !== "string" || !data.reply.trim()) {
      return { connected: false, reason: "unavailable" };
    }

    return { connected: true, reply: data.reply.trim() };
  } catch {
    return { connected: false, reason: "unavailable" };
  }
}

export async function requestGabayDraft(type: GabayDraft["type"], pageContext: GabayPageContext, grade: string): Promise<GabayDraftResult> {
  try {
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
    return { connected: false, reason: "unavailable" };
  } catch {
    return { connected: false, reason: "unavailable" };
  }
}
