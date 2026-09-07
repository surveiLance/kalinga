import { describe, expect, it } from "vitest";
import { hasTeacherMention, teacherInitials, teacherLabel, teacherMention } from "@/lib/teachers";

describe("teacherMention", () => {
  it("builds a stable tag from a display name and account id", () => {
    expect(teacherMention("Ana Reyes", "9f2c1d4e-aaaa")).toBe("@ana_reyes_9f2c");
  });

  it("does not double up the Teacher prefix the UI already adds", () => {
    expect(teacherMention("Teacher Ana", "abcd")).toBe("@ana_abcd");
  });

  it("survives punctuation, accents, and extra spacing", () => {
    expect(teacherMention("Ma. Cristina  Dela-Cruz", "12ab")).toBe("@ma_cristina_dela_cruz_12ab");
  });

  it("falls back to a usable tag when the name has no usable characters", () => {
    expect(teacherMention("!!!", "abcd")).toBe("@teacher_abcd");
  });

  it("still separates two teachers who share a display name", () => {
    expect(teacherMention("Ana", "1111")).not.toBe(teacherMention("Ana", "2222"));
  });
});

describe("hasTeacherMention", () => {
  const tag = "@ana_9f2c";

  it("matches the tag at a word boundary and before punctuation", () => {
    expect(hasTeacherMention(`Hi ${tag} can you help?`, tag)).toBe(true);
    expect(hasTeacherMention(`${tag}, please look`, tag)).toBe(true);
    expect(hasTeacherMention(`thanks ${tag}`, tag)).toBe(true);
    expect(hasTeacherMention(tag, tag)).toBe(true);
  });

  it("does not fire on a longer tag that merely starts with this one", () => {
    expect(hasTeacherMention("hello @ana_9f2c_extra", tag)).toBe(false);
  });

  it("does not fire on a different teacher's tag", () => {
    expect(hasTeacherMention("hello @ben_9f2c", tag)).toBe(false);
  });

  it("treats a tag containing regex characters as literal text", () => {
    expect(hasTeacherMention("hi @a.b+c", "@a.b+c")).toBe(true);
    expect(hasTeacherMention("hi @axbxc", "@a.b+c")).toBe(false);
  });
});

describe("teacherLabel and teacherInitials", () => {
  it("labels a named teacher and degrades gracefully when the name is blank", () => {
    expect(teacherLabel("Ana")).toBe("Teacher Ana");
    expect(teacherLabel("   ")).toBe("Teacher");
  });

  it("takes at most two initials", () => {
    expect(teacherInitials("Ana Reyes")).toBe("AR");
    expect(teacherInitials("Ana Maria Reyes")).toBe("AM");
    expect(teacherInitials("ana")).toBe("A");
    expect(teacherInitials("   ")).toBe("T");
  });
});
