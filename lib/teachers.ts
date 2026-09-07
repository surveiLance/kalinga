export function teacherLabel(name: string) {
  const cleaned = name.trim();
  return cleaned ? `Teacher ${cleaned}` : "Teacher";
}

export function teacherMention(name: string, accountId = "") {
  const cleaned = name.replace(/^Teacher\s+/i, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const suffix = accountId.replace(/[^a-z0-9]/gi, "").slice(0, 4).toLowerCase();
  return `@${cleaned || "teacher"}${suffix ? `_${suffix}` : ""}`;
}

export function hasTeacherMention(message: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}(?=\\s|[.,!?;:]|$)`, "i").test(message);
}

export function teacherInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "T";
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}
