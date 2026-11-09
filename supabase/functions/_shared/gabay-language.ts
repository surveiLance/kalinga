export function safeResponseLanguage(value: unknown): "en" | "fil" | "hil" { return value === "fil" || value === "hil" ? value : "en"; }
export function gabayResponseLanguage(value: unknown) {
  const language = safeResponseLanguage(value);
  const instruction = language === "hil" ? "Reply in natural Hiligaynon (Ilonggo). Do not substitute Cebuano or Tagalog. Keep familiar English school terms when a translation would be unclear." : language === "fil" ? "Reply in clear, natural Filipino. Keep familiar English school terms when useful." : "Reply in clear English.";
  return `${instruction} Use the teacher's currently selected language for new replies even if earlier chat messages used another language. If the teacher explicitly asks for a different language in their current message, follow that request. Keep quoted user text and names unchanged. If you are unsure of a local word, explain the uncertainty instead of inventing a term. Refer to the menu labels in the teacher's selected interface language.`;
}
export function gabayLessonLanguage(value: unknown) {
  const language = typeof value === "string" ? value.trim().toLowerCase() : "";
  const instruction = language === "hiligaynon" ? "Write lesson prose, activities, learner questions and assessment text in natural Hiligaynon (Ilonggo), not Cebuano or Tagalog. Keep technical school terms in English when clearer." : language === "filipino" ? "Write lesson content in classroom Filipino." : language === "english & filipino" || language === "mother tongue & filipino" ? "Write activities and learner questions in Filipino, and standards and criteria in English. Do not guess an unspecified mother tongue." : "Write lesson content in English.";
  return `${instruction} The lesson language is separate from the interface and chat language. Preserve JSON property names, grade keys, official quoted curriculum references and structural ILAW stage names. Keep teacherFocus routing labels in the forms 'All grades together' or 'Guide Grade N' so the app can identify the teacher-led group. Do not translate or rewrite an existing plan unless the teacher requests it.`;
}
