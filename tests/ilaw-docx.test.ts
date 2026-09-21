import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { Packer } from "docx";
import { buildIlawDocument, ilawDocumentFileName } from "@/lib/ilaw-docx";
import { learnerCountSummary, planHasTeacherContent } from "@/lib/lesson-plan";
import type { SavedPlan, TeachingClass } from "@/lib/teaching-types";

const teachingClass: TeachingClass = {
  id: "c1", name: "Grade 3 & 4", grades: ["3", "4"], subjects: ["Filipino"], quarter: "Quarter 1", meetingDays: "Monday to Friday", startTime: "8:00 AM", meetings: [],
  learners: [
    { id: "l1", name: "A", grade: "3", sex: "Female" }, { id: "l2", name: "B", grade: "3", sex: "Male" }, { id: "l3", name: "C", grade: "3", sex: "Female" },
    { id: "l4", name: "D", grade: "4", sex: "Male" },
  ],
};

// Shaped like the DLP teachers already submit, including a Filipino body.
const plan: SavedPlan = {
  id: "p1", classId: "c1", title: "Tekstong Impormatibo at Pangatnig", subject: "Filipino", quarter: "Term 1", grades: ["3", "4"], duration: "90 minutes", startTime: "8:00 AM",
  language: "Filipino", teachingDate: "2026-08-04", multigradeModel: "Same Theme, Different Task (STDT)", sharedTheme: "Pag-iisa-isang Paglalarawan",
  contentStandards: { "3": "Naipamamalas ng mag-aaral ang kahusayan sa pagbigkas.", "4": "Naipamamalas ng mag-aaral ang kahusayan sa pagpapalawak ng bokabolaryo." },
  performanceStandards: { "3": "Nagagamit ang kahusayan sa pagbigkas.", "4": "Nagagamit ang wastong gramatika." },
  competencies: { "3": "Natutukoy ang sight words", "4": "Nauunawaan ang tekstong impormatibo" },
  competencyCodes: { "3": "F3PB-Ia-1", "4": "" },
  objectives: { "3": "Natutukoy ang mga sight words.", "4": "Natutukoy ang pangunahing ideya." },
  learnerContext: "Ang mga mag-aaral ay nagmula sa isang lokal na komunidad.",
  materials: "Mga larawan, activity sheets, pisara at chalk",
  slots: [
    { id: "s1", time: "8:00 AM", stage: "Whole-Class Motivation", durationMinutes: 10, teacherFocus: "All grades together", gradeTasks: { "3": "Magpakita ng babala sa panahon.", "4": "Magpakita ng babala sa panahon." } },
    { id: "s2", time: "8:10 AM", stage: "Direct Teaching", durationMinutes: 15, teacherFocus: "Guide Grade 3", gradeTasks: { "3": "Magbasa ng ulat-panahon.", "4": "Bilugan ang mga pangatnig." } },
  ],
  formativeAssessments: { "3": "Obserbahan ang pakikilahok.", "4": "Obserbahan ang pag-uugnay ng kaisipan." },
  exitTasks: { "3": "Isulat ang simpleng paglalarawan.", "4": "Punan ang patlang gamit ang pangatnig." },
  successCriteria: { "3": "Nailalarawan nang payak.", "4": "Nakagagamit ng angkop na pangatnig." },
  reflectionQuestions: { "3": "Ano ang mensahe ng ulat-panahon?", "4": "Anong pangatnig ang ginamit mo?" },
  remediations: { "3": "Muling basahin sa tulong ng guro.", "4": "Magsanay sa pag-uugnay." },
  enrichments: { "3": "Maghanap ng babala sa paaralan.", "4": "Bumuo ng dalawang pangungusap." },
  nextSessionNotes: "Ipagpatuloy ang pagbasa ng mga ulat-panahon.",
  schoolHeadName: "Dexter T. Orlandez",
  savedAt: "test",
};

// A .docx is a zip; the body is word/document.xml, deflated. Walk the central
// directory to find it and inflate just that entry.
function readZipEntry(buffer: Buffer, name: string) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let offset = buffer.readUInt32LE(eocd + 16);
  const count = buffer.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i += 1) {
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const entryName = buffer.subarray(offset + 46, offset + 46 + nameLength).toString();
    if (entryName === name) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const data = buffer.subarray(start, start + compressedSize);
      return (method === 8 ? inflateRawSync(data) : data).toString("utf8");
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`${name} not found in archive`);
}

async function documentXml(document: ReturnType<typeof buildIlawDocument>) {
  const buffer = await Packer.toBuffer(document);
  return { buffer, xml: readZipEntry(buffer, "word/document.xml") };
}

describe("ILAW Word export", () => {
  it("packs to a real .docx", async () => {
    const { buffer } = await documentXml(buildIlawDocument(plan, teachingClass, "Jocelyn E. Mallorca", "Kasilayan Elementary School"));
    expect(buffer.length).toBeGreaterThan(4_000);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
  });

  it("carries every section of the DepEd form", async () => {
    const { xml } = await documentXml(buildIlawDocument(plan, teachingClass, "Jocelyn E. Mallorca", "Kasilayan Elementary School"));
    for (const expected of [
      "DAILY LESSON PLAN FOR GRADE 3, GRADE 4", "Kasilayan Elementary School", "Jocelyn E. Mallorca", "August 4, 2026",
      "INTENTIONS", "LEARNING EXPERIENCE", "ASSESSMENT", "WAYS FORWARD",
      "Pamantayang Pangnilalaman", "Pamantayan sa Pagganap", "Learning Competencies and Codes", "F3PB-Ia-1",
      "Flow of the Lesson", "Whole-Class Motivation", "Bilugan ang mga pangatnig.",
      "Exit Task", "Success Criteria", "Reflection Questions", "Remediation", "Enrichment",
      "Prepared by:", "Checked by:", "JOCELYN E. MALLORCA", "DEXTER T. ORLANDEZ", "School Head",
    ]) {
      expect(xml, `missing: ${expected}`).toContain(expected);
    }
  });

  it("prints per-grade learner counts the way supervisors read them", () => {
    expect(learnerCountSummary(teachingClass, ["3", "4"])).toBe("Grade 3: 3 (F-2, M-1) · Grade 4: 1 (F-0, M-1)");
  });

  it("prints a dash rather than nothing for an empty cell", async () => {
    const empty = { ...plan, contentStandards: {}, learnerContext: "" };
    const { xml } = await documentXml(buildIlawDocument(empty, teachingClass, "T", ""));
    expect(xml).toContain("—");
  });

  it("names the file from the subject and title", () => {
    expect(ilawDocumentFileName(plan)).toBe("filipino-tekstong-impormatibo-at-pangatnig-ilaw-dlp.docx");
    expect(ilawDocumentFileName({ ...plan, title: "", subject: "" })).toBe("lesson-plan-ilaw-dlp.docx");
  });
});

describe("planHasTeacherContent", () => {
  it("is false for a fresh plan whose only content is the default timetable", () => {
    expect(planHasTeacherContent({ ...plan, sharedTheme: "", learnerContext: "", materials: "", nextSessionNotes: "", contentStandards: {}, performanceStandards: {}, competencies: {}, competencyCodes: {}, objectives: {}, formativeAssessments: {}, exitTasks: {}, successCriteria: {}, reflectionQuestions: {}, remediations: {}, enrichments: {} })).toBe(false);
  });

  it("is true once any grade field has text", () => {
    expect(planHasTeacherContent({ ...plan, sharedTheme: "", learnerContext: "", materials: "", nextSessionNotes: "", contentStandards: {}, performanceStandards: {}, competencies: { "3": "  something " }, competencyCodes: {}, objectives: {}, formativeAssessments: {}, exitTasks: {}, successCriteria: {}, reflectionQuestions: {}, remediations: {}, enrichments: {} })).toBe(true);
  });
});
