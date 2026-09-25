import { AlignmentType, BorderStyle, Document, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { gradeLabel, gradeList } from "@/lib/grades";
import { learnerCountSummary, planTitleLine, slotIsWholeClass, wholeClassTask } from "@/lib/lesson-plan";
import type { GradeLevel, SavedPlan, TeachingClass } from "@/lib/teaching-types";

// Builds the DepEd-style multigrade DLP as a real Word document, laid out to match
// the reference teachers already submit: a navy header table, the four ILAW
// sections with one column per grade, a Time / Stage / grade lesson-flow table,
// and a Prepared by / Checked by block. School heads edit these before signing,
// which a PDF does not allow.

const navy = "1F3864";
const sand = "EEE9DF";
const pageWidth = 10_466; // A4, 0.5in margins, in DXA
const border = { style: BorderStyle.SINGLE, size: 6, color: "555555" };
const borders = { top: border, bottom: border, left: border, right: border };
const margins = { top: 80, bottom: 80, left: 100, right: 100 };

function text(value: string, options: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}) {
  return new TextRun({ text: value, bold: options.bold, color: options.color, size: options.size ?? 20, italics: options.italics, font: "Arial" });
}

function para(value: string, options: { bold?: boolean; color?: string; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; italics?: boolean } = {}) {
  return new Paragraph({ alignment: options.align, spacing: { after: options.after ?? 0 }, children: [text(value, options)] });
}

// Long fields often arrive with line breaks; each becomes its own paragraph so the
// cell reads as the teacher wrote it.
function cellParas(value: string, options: { bold?: boolean; color?: string } = {}) {
  const lines = (value || "—").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return (lines.length ? lines : ["—"]).map((line) => para(line, options));
}

function cell(value: string, width: number, options: { header?: boolean; label?: boolean; span?: number } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan: options.span,
    borders,
    margins,
    shading: options.header ? { type: ShadingType.CLEAR, fill: navy, color: "auto" } : options.label ? { type: ShadingType.CLEAR, fill: sand, color: "auto" } : undefined,
    children: cellParas(value, options.header ? { bold: true, color: "FFFFFF" } : options.label ? { bold: true } : {}),
  });
}

function table(columnWidths: number[], rows: TableRow[]) {
  return new Table({ width: { size: pageWidth, type: WidthType.DXA }, columnWidths, rows });
}

function sectionBanner(letter: string, title: string) {
  return new Table({
    width: { size: pageWidth, type: WidthType.DXA },
    columnWidths: [pageWidth],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: pageWidth, type: WidthType.DXA },
      borders,
      margins,
      shading: { type: ShadingType.CLEAR, fill: navy, color: "auto" },
      children: [new Paragraph({ children: [text(`${letter}  `, { bold: true, color: "FFFFFF", size: 26 }), text(title.toUpperCase(), { bold: true, color: "FFFFFF", size: 22 })] })],
    })] })],
  });
}

function gap(after = 160) {
  return new Paragraph({ spacing: { after }, children: [] });
}

// A label column plus one column per grade, for every per-grade section.
function gradeTable(grades: GradeLevel[], rows: Array<[string, Record<GradeLevel, string> | undefined]>) {
  const labelWidth = 2_200;
  const gradeWidth = Math.floor((pageWidth - labelWidth) / Math.max(1, grades.length));
  const widths = [labelWidth, ...grades.map(() => gradeWidth)];
  return table(widths, [
    new TableRow({ tableHeader: true, children: [cell("", labelWidth, { header: true }), ...grades.map((grade) => cell(gradeLabel(grade).toUpperCase(), gradeWidth, { header: true }))] }),
    ...rows.map(([label, values]) => new TableRow({ children: [cell(label, labelWidth, { label: true }), ...grades.map((grade) => cell(values?.[grade] || "", gradeWidth))] })),
  ]);
}

export function buildIlawDocument(plan: SavedPlan, teachingClass: TeachingClass, teacherName: string, schoolName: string) {
  const grades = plan.grades;
  const printedDate = plan.teachingDate ? new Date(`${plan.teachingDate}T00:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "";
  const metaLabel = 2_000;
  const metaValue = Math.floor((pageWidth - metaLabel * 2) / 2);
  const metaWidths = [metaLabel, metaValue, metaLabel, metaValue];
  const metaRow = (a: string, b: string, c: string, d: string) => new TableRow({ children: [cell(a, metaLabel, { header: true }), cell(b, metaValue), cell(c, metaLabel, { header: true }), cell(d, metaValue)] });

  const timeWidth = 1_100;
  const stageWidth = 1_900;
  const flowGradeWidth = Math.floor((pageWidth - timeWidth - stageWidth) / Math.max(1, grades.length));
  const flowWidths = [timeWidth, stageWidth, ...grades.map(() => flowGradeWidth)];

  const children = [
    para(planTitleLine(grades), { bold: true, size: 26, align: AlignmentType.CENTER, after: 60 }),
    para(plan.title, { bold: true, size: 32, align: AlignmentType.CENTER, after: 200 }),
    table(metaWidths, [
      metaRow("School", schoolName.trim() || "—", "Grade Levels", gradeList(grades)),
      metaRow("Teacher", teacherName, "Learning Area", plan.subject),
      metaRow("Teaching Date", printedDate || "—", "Quarter/Term", plan.quarter),
      metaRow("Time / Sessions", `1 session, ${plan.duration} · ${plan.startTime || ""}`, "No. of Learners", learnerCountSummary(teachingClass, grades)),
      new TableRow({ children: [cell("Multigrade Model", metaLabel, { header: true }), cell(plan.multigradeModel || "—", metaValue * 2 + metaLabel, { span: 3 })] }),
    ]),
    gap(),

    sectionBanner("I", "Intentions"),
    ...(plan.sharedTheme?.trim() ? [gap(60), para("Shared Sub-theme", { bold: true }), ...cellParas(plan.sharedTheme), gap(120)] : [gap(120)]),
    gradeTable(grades, [
      ["Pamantayang Pangnilalaman (Content Standard)", plan.contentStandards],
      ["Pamantayan sa Pagganap (Performance Standard)", plan.performanceStandards],
      ["Learning Competencies and Codes", Object.fromEntries(grades.map((grade) => [grade, [plan.competencies?.[grade], plan.competencyCodes?.[grade]].filter((value) => value?.trim()).join("\n")]))],
      ["Learning Objectives", plan.objectives],
    ]),
    gap(),

    sectionBanner("L", "Learning Experience"),
    gap(60),
    para("Learner Context", { bold: true }),
    ...cellParas(plan.learnerContext || ""),
    gap(100),
    para("Instructional Materials and Resources", { bold: true }),
    ...cellParas(plan.materials || ""),
    gap(100),
    para("Flow of the Lesson", { bold: true, after: 60 }),
    table(flowWidths, [
      new TableRow({ tableHeader: true, children: [cell("Time", timeWidth, { header: true }), cell("Stage", stageWidth, { header: true }), ...grades.map((grade) => cell(gradeLabel(grade).toUpperCase(), flowGradeWidth, { header: true }))] }),
      ...plan.slots.map((slot) => new TableRow({ children: [
        cell([slot.durationMinutes ? `${slot.durationMinutes} min` : "", slot.time].filter(Boolean).join("\n"), timeWidth, { label: true }),
        cell([slot.stage || "Learning activity", slot.teacherFocus].filter((value) => value?.trim()).join("\n"), stageWidth),
        ...(slotIsWholeClass(slot)
          ? [cell(wholeClassTask(slot), flowGradeWidth * grades.length, { span: grades.length })]
          : grades.map((grade) => cell(slot.gradeTasks[grade] || "", flowGradeWidth))),
      ] })),
    ]),
    gap(),

    sectionBanner("A", "Assessment"),
    gap(120),
    gradeTable(grades, [
      ["Formative", plan.formativeAssessments],
      ["Exit Task", plan.exitTasks],
      ["Success Criteria", plan.successCriteria],
    ]),
    gap(),

    sectionBanner("W", "Ways Forward"),
    gap(120),
    gradeTable(grades, [
      ["Reflection Questions", plan.reflectionQuestions],
      ["Remediation", plan.remediations],
      ["Enrichment", plan.enrichments],
    ]),
    gap(100),
    para("Notes for Next Session / Whole-School Follow-Up", { bold: true }),
    ...cellParas(plan.nextSessionNotes || ""),
    gap(400),

    new Table({
      width: { size: pageWidth, type: WidthType.DXA },
      columnWidths: [pageWidth / 2, pageWidth / 2],
      rows: [new TableRow({ children: [
        new TableCell({ width: { size: pageWidth / 2, type: WidthType.DXA }, borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }, children: [para("Prepared by:", { after: 360 }), para(teacherName.toUpperCase(), { bold: true }), para("Classroom Adviser", { size: 18 })] }),
        new TableCell({ width: { size: pageWidth / 2, type: WidthType.DXA }, borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }, children: [para("Checked by:", { after: 360 }), para((plan.schoolHeadName || "").toUpperCase() || " ", { bold: true }), para("School Head", { size: 18 })] }),
      ] })],
    }),
  ];

  return new Document({
    creator: "Kalinga",
    title: plan.title,
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [{
      properties: { page: { size: { width: 11_906, height: 16_838 }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children,
    }],
  });
}

export async function ilawDocumentBlob(plan: SavedPlan, teachingClass: TeachingClass, teacherName: string, schoolName: string) {
  return Packer.toBlob(buildIlawDocument(plan, teachingClass, teacherName, schoolName));
}

export function ilawDocumentFileName(plan: SavedPlan) {
  const stem = `${plan.subject}-${plan.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "lesson-plan";
  return `${stem}-ilaw-dlp.docx`;
}
