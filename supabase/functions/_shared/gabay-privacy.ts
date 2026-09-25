function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactGabayPII(value: string, learnerNames: string[]) {
  let redacted = value.replace(/\b(?:\d[ -]?){11}\d\b/g, "[learner identifier removed]");
  const names = [...new Set(learnerNames.map((name) => name.trim()).filter((name) => name.length >= 2))]
    .sort((left, right) => right.length - left.length);
  for (const name of names) redacted = redacted.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(name)}(?=$|[^\\p{L}\\p{N}])`, "giu"), "$1[learner name removed]");
  return redacted;
}
