import { createClient } from "npm:@supabase/supabase-js@2";

type PageContext = {
  view?: string;
  teacherName?: string;
  pageStep?: string;
  classId?: string;
  className?: string;
  gradeLevels?: string[];
  subjects?: string[];
  learnerCount?: number;
  scheduleSummary?: string[];
  subject?: string;
  lessonTopic?: string;
  lessonDuration?: string;
  incompleteSections?: string[];
  currentSummary?: string[];
  availableActions?: string[];
  offline?: boolean;
};

type SafeHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

const MAX_MESSAGE_LENGTH = 2_000;

function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const configuredOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const localOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];
  return [...configuredOrigins, ...localOrigins].includes(origin) ? origin : null;
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, maxLength = 200) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanList(value: unknown, maxItems = 12, maxLength = 160) {
  return Array.isArray(value)
    ? value.slice(0, maxItems).map((item) => cleanText(item, maxLength)).filter(Boolean)
    : [];
}

function safeContext(value: unknown): PageContext {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  return {
    view: cleanText(input.view, 40),
    teacherName: cleanText(input.teacherName, 80),
    pageStep: cleanText(input.pageStep, 100),
    classId: cleanText(input.classId, 80),
    className: cleanText(input.className, 120),
    gradeLevels: cleanList(input.gradeLevels, 12, 40),
    subjects: cleanList(input.subjects, 16, 100),
    learnerCount: typeof input.learnerCount === "number" && Number.isFinite(input.learnerCount) ? Math.max(0, Math.min(10_000, Math.round(input.learnerCount))) : 0,
    scheduleSummary: cleanList(input.scheduleSummary, 12, 180),
    subject: cleanText(input.subject, 100),
    lessonTopic: cleanText(input.lessonTopic, 200),
    lessonDuration: cleanText(input.lessonDuration, 120),
    incompleteSections: cleanList(input.incompleteSections, 16, 100),
    currentSummary: cleanList(input.currentSummary, 16, 240),
    availableActions: cleanList(input.availableActions, 12, 120),
    offline: Boolean(input.offline),
  };
}

function safeHistory(value: unknown): SafeHistoryMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-12).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const input = item as Record<string, unknown>;
    const role: SafeHistoryMessage["role"] | null = input.role === "teacher" ? "user" : input.role === "gabay" ? "assistant" : null;
    const content = cleanText(input.text, 1_000);
    return role && content ? [{ role, content }] : [];
  });
}

Deno.serve(async (request) => {
  const origin = allowedOrigin(request);
  if (!origin) return new Response("Origin not allowed", { status: 403 });
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Sign in is required" }, 401, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  const supabasePublishableKey = publishableKeys
    ? JSON.parse(publishableKeys).default
    : Deno.env.get("SUPABASE_ANON_KEY");
  const groqApiKey = Deno.env.get("GROQ_API_KEY");
  if (!supabaseUrl || !supabasePublishableKey || !groqApiKey) {
    return json({ error: "Gabay is not configured" }, 503, origin);
  }

  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: "Invalid session" }, 401, origin);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400, origin);
  }

  const message = cleanText(payload.message, MAX_MESSAGE_LENGTH);
  if (!message) return json({ error: "A message is required" }, 400, origin);
  const pageContext = safeContext(payload.pageContext);
  pageContext.teacherName = cleanText(userData.user.user_metadata?.display_name || userData.user.user_metadata?.full_name || pageContext.teacherName, 80);

  const [{ data: ownedClassRows, error: ownedClassesError }, { data: ownedLearnerRows, error: ownedLearnersError }] = await Promise.all([
    supabase.from("classes").select("id,name,grade_levels,subjects,schedule").order("created_at").limit(24),
    supabase.from("learners").select("class_id").limit(10_000),
  ]);
  const learnerCounts = new Map<string, number>();
  for (const learner of ownedLearnerRows || []) learnerCounts.set(learner.class_id, (learnerCounts.get(learner.class_id) || 0) + 1);
  const verifiedAccountSummary = !ownedClassesError && !ownedLearnersError
    ? (ownedClassRows || []).map((item) => `${cleanText(item.name, 120)}: ${cleanList(item.grade_levels, 12, 40).join(", ") || "no grades"}; ${cleanList(item.subjects, 16, 100).join(", ") || "no subjects"}; ${learnerCounts.get(item.id) || 0} learners`).join(" | ") || "This teacher has no saved classes."
    : "The teacher's class list could not be verified right now.";

  let verifiedClassSummary = "No selected class was supplied.";
  if (pageContext.classId) {
    const classRow = !ownedClassesError ? (ownedClassRows || []).find((item) => item.id === pageContext.classId) : null;
    if (classRow) {
      pageContext.className = cleanText(classRow.name, 120);
      pageContext.gradeLevels = cleanList(classRow.grade_levels, 12, 40);
      pageContext.subjects = cleanList(classRow.subjects, 16, 100);
      pageContext.learnerCount = learnerCounts.get(classRow.id) || 0;
      const schedule = classRow.schedule && typeof classRow.schedule === "object" ? classRow.schedule as Record<string, unknown> : {};
      const meetings = Array.isArray(schedule.meetings) ? schedule.meetings : Array.isArray(classRow.schedule) ? classRow.schedule : [];
      pageContext.scheduleSummary = meetings.slice(0, 12).flatMap((meeting) => {
        if (!meeting || typeof meeting !== "object") return [];
        const item = meeting as Record<string, unknown>;
        const days = cleanText(item.days, 100);
        const startTime = cleanText(item.startTime, 40);
        const duration = typeof item.durationMinutes === "number" ? `${Math.round(item.durationMinutes)} minutes` : "";
        return days || startTime ? [`${days}${startTime ? ` at ${startTime}` : ""}${duration ? ` for ${duration}` : ""}`] : [];
      });
      verifiedClassSummary = `Verified class: ${pageContext.className}; ${pageContext.learnerCount} enrolled learners. The Auth session and row-level security confirmed this class belongs to the current teacher.`;
    } else {
      pageContext.classId = "";
      pageContext.className = "";
      pageContext.gradeLevels = [];
      pageContext.subjects = [];
      pageContext.learnerCount = 0;
      pageContext.scheduleSummary = [];
      verifiedClassSummary = "The requested class was not available to this authenticated teacher. Do not rely on client-supplied class details.";
    }
  }
  const history = safeHistory(payload.history);
  const model = Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-20b";

  const systemInstruction = `You are Gabay, Kalinga's friendly, witty teacher assistant for Filipino teachers. You accompany the teacher across the app and understand the current page from the supplied Kalinga context.
Use the teacher's supplied preferred name naturally once in a while, but not in every reply.
Use casual Taglish: mostly clear English with familiar Filipino words and connectors. Avoid deep, formal, or overly fluent Tagalog unless the teacher asks for Filipino.
Keep every answer brief: usually 1-3 sentences, or at most 3 compact bullets. Do not repeat the page description unless it directly answers the question. Ask no more than one short follow-up question.
You may add one light teacher-life joke or playful aside when it feels natural, but never force humor and never joke about learner welfare, attendance concerns, privacy, or emergencies.
The teacher remains in control. Give practical help grounded only in the supplied page and classroom context. When the teacher asks where to go or what to do, point to the most relevant action on their current page first.
Treat the verified Supabase class summary as authoritative. Use current workflow state to notice missing work and recommend one manageable next action. Do not claim to see fields or data that are not listed.
Never invent or label a competency as official DepEd content. If no verified curriculum source is supplied, clearly call it a draft suggestion and ask the teacher to verify it.
Do not request, infer, repeat, or expose learner names, learner reference numbers, attendance notes, health details, or other student personal data.
Respect multigrade teaching: keep grade-level intentions, activities, and assessments distinct while identifying useful shared teaching moments.
Do not begin every answer with a greeting or the word "Teacher."`;

  const contextText = `Teacher's preferred name: ${pageContext.teacherName || "not supplied"}
Current page: ${pageContext.view || "unknown"}
Current workflow step: ${pageContext.pageStep || "not supplied"}
Verified teacher class list: ${verifiedAccountSummary}
${verifiedClassSummary}
Selected class name: ${pageContext.className || "not supplied"}
Grade levels: ${(pageContext.gradeLevels ?? []).join(", ") || "not supplied"}
Class subjects: ${(pageContext.subjects ?? []).join(", ") || "not supplied"}
Enrolled learner count (aggregate only): ${pageContext.learnerCount ?? 0}
Class schedule: ${(pageContext.scheduleSummary ?? []).join(" | ") || "not supplied"}
Subject: ${pageContext.subject || "not supplied"}
Lesson topic: ${pageContext.lessonTopic || "not supplied"}
Lesson duration: ${pageContext.lessonDuration || "not supplied"}
Incomplete sections: ${(pageContext.incompleteSections ?? []).join(", ") || "none reported"}
What the app currently reports: ${(pageContext.currentSummary ?? []).join(" | ") || "nothing supplied"}
Actions available on this page: ${(pageContext.availableActions ?? []).join(", ") || "not supplied"}
App reports offline: ${pageContext.offline ? "yes" : "no"}`;

  const groqResponse = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "system", content: `Current Kalinga context:\n${contextText}` },
          ...history,
          { role: "user", content: message },
        ],
        temperature: 0.55,
        max_completion_tokens: 240,
      }),
    },
  );

  if (!groqResponse.ok) {
    console.error("Groq request failed", groqResponse.status, await groqResponse.text());
    const status = groqResponse.status === 429 ? 429 : 502;
    return json({ error: status === 429 ? "Gabay is busy. Try again shortly." : "Gabay is temporarily unavailable." }, status, origin);
  }

  const result = await groqResponse.json();
  const reply = typeof result?.choices?.[0]?.message?.content === "string"
    ? result.choices[0].message.content.trim()
    : "";

  if (!reply) return json({ error: "Gabay returned an empty response" }, 502, origin);
  return json({ reply, connected: true }, 200, origin);
});
