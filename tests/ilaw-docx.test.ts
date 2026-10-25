import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { Packer } from "docx";
import { buildIlawDocument, ilawDocumentFileName } from "@/lib/ilaw-docx";
import { learnerCountSummary, planHasTeacherContent, planTitleLine, slotIsWholeClass, wholeClassTask } from "@/lib/lesson-plan";
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
  return { buffer, xml: readZipEntry(buffer, "word/document.xml"), styles: readZipEntry(buffer, "word/styles.xml") };
}

function rows(xml: string) {
  return xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || [];
}

function paragraphContaining(xml: string, value: string) {
  return (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).find((paragraph) => paragraph.includes(value)) || "";
}

describe("ILAW Word export", () => {
  it("keeps section-banner spacing attached to the following table rather than orphaning the heading", async () => {
    const { xml } = await documentXml(buildIlawDocument(plan, teachingClass, 'T', 'S'));
    for (const section of ['LEARNING EXPERIENCE', 'ASSESSMENT', 'WAYS FORWARD']) {
      const afterBanner = xml.slice(xml.indexOf(section)).split('</w:tbl>')[1];
      expect(afterBanner.match(/^<w:p>[\s\S]*?<\/w:p>/)?.[0], section).toContain('<w:keepNext/>');
    }
  });
  it("keeps teaching stages navy and signature names centered like the reference form", async () => {
    const { xml } = await documentXml(buildIlawDocument(plan, teachingClass, "Jocelyn E. Mallorca", "Kasilayan Elementary School"));
    const row = rows(xml).find((candidate) => candidate.includes('Guide Grade 3')) || '';
    const cells = [...row.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((match) => match[0]);
    expect(cells[0]).not.toContain('w:fill="1F3864"');
    expect(cells[1]).toContain('w:fill="1F3864"');
    expect(paragraphContaining(xml, 'JOCELYN E. MALLORCA')).toContain('<w:jc w:val="center"/>');
    expect(paragraphContaining(xml, 'DEXTER T. ORLANDEZ')).toContain('<w:jc w:val="center"/>');
  });
  it("packs to a real .docx", async () => {
    const { buffer } = await documentXml(buildIlawDocument(plan, teachingClass, "Jocelyn E. Mallorca", "Kasilayan Elementary School"));
    expect(buffer.length).toBeGreaterThan(4_000);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
  });

  it("uses the A4 page and half-inch margins of the teachers' reference form", async () => {
    const { xml } = await documentXml(buildIlawDocument(plan, teachingClass, "Jocelyn E. Mallorca", "Kasilayan Elementary School"));
    expect(xml).toMatch(/<w:pgSz[^>]*w:w="11906"[^>]*w:h="16838"/);
    expect(xml).toMatch(/<w:pgMar[^>]*w:top="720"[^>]*w:right="720"[^>]*w:bottom="720"[^>]*w:left="720"/);
    expect(xml).toMatch(/<w:pgMar[^>]*w:header="709"[^>]*w:footer="709"/);
  });

  it("uses the reference's effective Times New Roman body and 12-point title", async () => {
    const { xml, styles } = await documentXml(buildIlawDocument(plan, teachingClass, "T", "S"));
    // The source theme default is Calibri 11, but its Normal paragraph style
    // overrides that to Times New Roman 10. Its body runs then specify 11pt.
    expect(styles.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/)?.[0]).toMatch(/w:ascii="Calibri"/);
    const normal = styles.match(/<w:style[^>]*w:styleId="Normal"[\s\S]*?<\/w:style>/)?.[0] || "";
    expect(normal).toContain('w:ascii="Times New Roman"');
    expect(normal).toContain('<w:sz w:val="20"/>');
    const body = paragraphContaining(xml, "Naipamamalas ng mag-aaral ang kahusayan sa pagbigkas.");
    expect(body).toContain('w:ascii="Times New Roman"');
    expect(body).toContain('<w:sz w:val="22"/>');
    expect(body).toMatch(/<w:spacing[^>]*w:line="240"[^>]*w:lineRule="auto"/);
    const title = paragraphContaining(xml, "DAILY LESSON PLAN FOR GRADE");
    expect(title).toContain('<w:sz w:val="24"/>');
    expect(title).toContain('<w:jc w:val="center"/>');
    expect(xml).not.toContain('w:ascii="Arial"');
  });

  it("puts the shared fields inside bordered rows while retaining their complete contents", async () => {
    const { xml } = await documentXml(buildIlawDocument(plan, teachingClass, "T", "S"));
    for (const [label, value] of [
      ["Shared Sub-theme", plan.sharedTheme!],
      ["Learner Context", plan.learnerContext!],
      ["Instructional Materials and Resources", plan.materials!],
      ["Notes for Next Session / Whole-School Follow-Up", plan.nextSessionNotes!],
    ]) {
      const row = rows(xml).find((candidate) => candidate.includes(label)) || "";
      expect(row, `missing bordered row: ${label}`).toContain(value);
      expect(row.match(/<w:tcBorders>/g)).toHaveLength(2);
      expect(row).toContain('w:val="single"');
    }
    const theme = paragraphContaining(xml, plan.sharedTheme!);
    expect(theme).toContain('w:ascii="Century Gothic"');
    expect(theme).toContain('<w:sz w:val="16"/>');
  });

  it("uses the reference's section colors, thin borders and padded cells", async () => {
    const { xml } = await documentXml(buildIlawDocument(plan, teachingClass, "T", "S"));
    for (const [title, fill] of [["INTENTIONS", "1F3864"], ["LEARNING EXPERIENCE", "2E6B2E"], ["ASSESSMENT", "8C5A1E"], ["WAYS FORWARD", "7A2048"]]) {
      const row = rows(xml).find((candidate) => candidate.includes(title)) || "";
      expect(row).toContain(`w:fill="${fill}"`);
      expect(row).toContain('<w:sz w:val="22"/>');
      expect(row).toContain('w:color="000000" w:sz="4"');
    }
    const bodyRow = rows(xml).find((candidate) => candidate.includes("Pamantayang Pangnilalaman")) || "";
    expect(bodyRow).toContain('w:fill="1F3864"');
    expect(bodyRow).toMatch(/<w:top w:type="dxa" w:w="80"\/>/);
    expect(bodyRow).toMatch(/<w:left w:type="dxa" w:w="100"\/>/);
    expect(xml).not.toContain('<w:trHeight');
  });

  it("preserves line breaks, empty lines, indentation and XML-sensitive teacher text", async () => {
    const multiline = { ...plan, materials: "First & second\r\n\r\n  Indented <third>\nFourth" };
    const { xml } = await documentXml(buildIlawDocument(multiline, teachingClass, "T", "S"));
    const paragraph = paragraphContaining(xml, "First &amp; second");
    expect(paragraph.match(/<w:br\/>/g)).toHaveLength(3);
    expect(paragraph).toContain('xml:space="preserve">  Indented &lt;third&gt;');
    expect(paragraph).toContain("Fourth");
  });

  it.each([{ grades: ["Kindergarten"] }, { grades: ["3", "4"] }, { grades: ["2", "3", "4"] }, { grades: ["1", "2", "3", "4", "5", "6"] }])("fits every table grid within the printable page for $grades", async ({ grades }) => {
    const variable = { ...plan, grades, slots: [{ ...plan.slots[0], wholeClass: true, gradeTasks: Object.fromEntries(grades.map((grade) => [grade, "Shared task"])) }] };
    const { xml } = await documentXml(buildIlawDocument(variable, teachingClass, "T", "S"));
    const tables = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || [];
    for (const table of tables) {
      const widths = [...table.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((match) => Number(match[1]));
      expect(widths.every((width) => width > 0)).toBe(true);
      expect(widths.reduce((sum, width) => sum + width, 0)).toBe(10466);
      expect(table).toContain('<w:tblLayout w:type="fixed"/>');
    }
    const gradeTables = tables.filter((table) => table.includes('<w:tblHeader/>'));
    expect(gradeTables).toHaveLength(4);
    for (const table of gradeTables) {
      const header = rows(table)[0];
      for (const grade of grades) expect(header).toContain(grade === "Kindergarten" ? "KINDERGARTEN" : `GRADE ${grade}`);
    }
    const flow = gradeTables.find((table) => table.includes("Shared task")) || "";
    const sharedRow = rows(flow).find((row) => row.includes("Shared task")) || "";
    expect(sharedRow).toContain(`<w:gridSpan w:val="${grades.length}"/>`);
    const flowWidths = [...flow.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((match) => Number(match[1]));
    expect(sharedRow).toContain(`<w:tcW w:type="dxa" w:w="${flowWidths.slice(2).reduce((sum, width) => sum + width, 0)}"/>`);
  });

  it("exports the saved teacher and school snapshots with legacy argument fallback", async () => {
    const snapshot = { ...plan, teacherName: "Saved Teacher", schoolName: "Saved School" };
    const { xml } = await documentXml(buildIlawDocument(snapshot, teachingClass, "Current Teacher", "Current School"));
    expect(xml).toContain("Saved Teacher");
    expect(xml).toContain("SAVED TEACHER");
    expect(xml).toContain("Saved School");
    expect(xml).not.toContain("Current Teacher");
    expect(xml).not.toContain("Current School");
    const { xml: legacy } = await documentXml(buildIlawDocument(plan, teachingClass, "Current Teacher", "Current School"));
    expect(legacy).toContain("Current Teacher");
    expect(legacy).toContain("Current School");
    const { xml: intentionallyBlank } = await documentXml(buildIlawDocument({ ...plan, teacherName: "", schoolName: "" }, teachingClass, "Current Teacher", "Current School"));
    expect(intentionallyBlank).not.toContain("Current Teacher");
    expect(intentionallyBlank).not.toContain("Current School");
  });

  it("carries every section of the DepEd form", async () => {
    const { xml } = await documentXml(buildIlawDocument(plan, teachingClass, "Jocelyn E. Mallorca", "Kasilayan Elementary School"));
    for (const expected of [
      "DAILY LESSON PLAN FOR GRADE III &amp; IV", "Kasilayan Elementary School", "Jocelyn E. Mallorca", "August 4, 2026",
      "INTENTIONS", "LEARNING EXPERIENCE", "ASSESSMENT", "WAYS FORWARD",
      "Pamantayang Pangnilalaman", "Pamantayan sa Pagganap", "Learning Competencies and Codes", "F3PB-Ia-1",
      "Flow of the Lesson", "Whole-Class Motivation", "Bilugan ang mga pangatnig.",
      "Exit Task", "Success Criteria", "Reflection Questions", "Remediation", "Enrichment",
      "Prepared by:", "Checked by:", "JOCELYN E. MALLORCA", "DEXTER T. ORLANDEZ", "School Head",
    ]) {
      expect(xml, `missing: ${expected}`).toContain(expected);
    }
    for (const values of [plan.contentStandards, plan.performanceStandards, plan.competencies, plan.competencyCodes, plan.objectives, plan.formativeAssessments, plan.exitTasks, plan.successCriteria, plan.reflectionQuestions, plan.remediations, plan.enrichments]) {
      for (const value of Object.values(values || {}).filter(Boolean)) expect(xml, `missing teacher content: ${value}`).toContain(value);
    }
    for (const slot of plan.slots) {
      for (const value of [slot.time, slot.stage, slot.teacherFocus, ...Object.values(slot.gradeTasks)].filter(Boolean)) expect(xml).toContain(value);
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

  it("merges a whole-class block across every grade column, as the DepEd form does", async () => {
    const shared = { ...plan, slots: [{ id: "s1", time: "8:00 AM", stage: "Whole-Class Motivation", durationMinutes: 10, wholeClass: true, teacherFocus: "All grades together", gradeTasks: { "3": "Magpakita ng babala.", "4": "Magpakita ng babala." } }] };
    const { xml } = await documentXml(buildIlawDocument(shared, teachingClass, "T", "S"));
    expect(xml).toContain('<w:gridSpan w:val="2"/>');
    expect(xml.split("Magpakita ng babala.").length - 1).toBe(1);
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

describe("DepEd form conventions", () => {
  it("writes grade levels in Roman numerals", () => {
    expect(planTitleLine(["3", "4"])).toBe("DAILY LESSON PLAN FOR GRADE III & IV");
    expect(planTitleLine(["2", "3", "4"])).toBe("DAILY LESSON PLAN FOR GRADE II, III & IV");
    expect(planTitleLine(["Kindergarten"])).toBe("DAILY LESSON PLAN FOR GRADE KINDERGARTEN");
  });

  it("reads an older plan's identical grade cells as a whole-class block", () => {
    const legacy = { id: "s", time: "8:00 AM", teacherFocus: "", gradeTasks: { "3": "Shared introduction", "4": "shared introduction " } };
    expect(slotIsWholeClass(legacy)).toBe(true);
    expect(wholeClassTask(legacy)).toBe("Shared introduction");
  });

  it("does not merge a block whose grades do different work", () => {
    expect(slotIsWholeClass({ id: "s", time: "8:00 AM", teacherFocus: "", gradeTasks: { "3": "Guided lesson", "4": "Independent task" } })).toBe(false);
  });

  it("lets an explicit flag override the text heuristic", () => {
    expect(slotIsWholeClass({ id: "s", time: "8:00 AM", wholeClass: false, teacherFocus: "", gradeTasks: { "3": "Same", "4": "Same" } })).toBe(false);
    expect(slotIsWholeClass({ id: "s", time: "8:00 AM", wholeClass: true, teacherFocus: "", gradeTasks: { "3": "A", "4": "" } })).toBe(true);
  });
});
