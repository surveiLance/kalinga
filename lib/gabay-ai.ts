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
