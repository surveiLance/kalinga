import { createClient } from "npm:@supabase/supabase-js@2";

type PageContext = {
  view?: string;
  gradeLevels?: string[];
  subject?: string;
  lessonTopic?: string;
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

function safeContext(value: unknown): PageContext {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  return {
    view: cleanText(input.view, 40),
    gradeLevels: Array.isArray(input.gradeLevels)
      ? input.gradeLevels.slice(0, 12).map((grade) => cleanText(grade, 40)).filter(Boolean)
      : [],
    subject: cleanText(input.subject, 100),
    lessonTopic: cleanText(input.lessonTopic, 200),
    offline: Boolean(input.offline),
  };
}

function safeHistory(value: unknown): SafeHistoryMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-8).flatMap((item) => {
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
  const history = safeHistory(payload.history);
  const model = Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-20b";

  const systemInstruction = `You are Gabay, Kalinga's calm, practical Taglish guide for Filipino teachers.
The teacher remains in control. Give short, actionable help grounded only in the context supplied.
Never invent or label a competency as official DepEd content. If no verified curriculum source is supplied, clearly call it a draft suggestion and ask the teacher to verify it.
Do not request, infer, repeat, or expose learner names, learner reference numbers, attendance notes, health details, or other student personal data.
Respect multigrade teaching: keep grade-level intentions, activities, and assessments distinct while identifying useful shared teaching moments.
Answer in natural Taglish unless the teacher asks for a specific language. Prefer 2-5 short paragraphs or bullets.`;

  const contextText = `Current page: ${pageContext.view || "unknown"}
Grade levels: ${(pageContext.gradeLevels ?? []).join(", ") || "not supplied"}
Subject: ${pageContext.subject || "not supplied"}
Lesson topic: ${pageContext.lessonTopic || "not supplied"}
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
        temperature: 0.35,
        max_completion_tokens: 600,
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
