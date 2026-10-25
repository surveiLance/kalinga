import { AlignmentType, BorderStyle, Document, Packer, Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType } from "docx";
import { gradeLabel, gradeList } from "@/lib/grades";
import { ILAW_FORMAT, ILAW_SECTION_COLORS } from "@/lib/ilaw-format";
import { learnerCountSummary, planTitleLine, slotIsWholeClass, wholeClassTask } from "@/lib/lesson-plan";
import type { GradeLevel, SavedPlan, TeachingClass } from "@/lib/teaching-types";

// Editable Word export using the supplied ILAW reference's typography, page
// system and colors, with Kalinga's expanded, variable-grade table structure.

const pageWidth = ILAW_FORMAT.contentWidthDxa;
const border = { style: BorderStyle.SINGLE, size: ILAW_FORMAT.borderSizeEighthPt, color: ILAW_FORMAT.borderColor };
const borders = { top: border, bottom: border, left: border, right: border };
const margins = ILAW_FORMAT.cellMarginsDxa;
type TextOptions = { bold?: boolean; color?: string; size?: number; italics?: boolean; font?: string };

function text(value: string, options: TextOptions = {}, lineBreak = false) {
  return new TextRun({ text: value, break: lineBreak ? 1 : undefined, bold: options.bold, color: options.color ?? "000000", size: options.size ?? ILAW_FORMAT.bodySizePt * 2, italics: options.italics, font: options.font ?? ILAW_FORMAT.fontFamily });
}

function para(value: string, options: TextOptions & { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; keepNext?: boolean } = {}) {
  return new Paragraph({ alignment: options.align, keepNext: options.keepNext, spacing: { after: options.after ?? 0, line: 240, lineRule: "auto" }, children: value.split(/\r\n|\r|\n/).map((line, index) => text(line, options, index > 0)) });
}

// Explicit Word line breaks preserve empty lines and leading indentation too.
function cellParas(value: string, options: TextOptions & { align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return [para(value.trim() ? value : "—", options)];
}

function cell(value: string, width: number, options: { header?: boolean; label?: boolean; span?: number; fill?: string; centered?: boolean; theme?: boolean } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan: options.span,
    borders,
    margins,
    verticalAlign: options.header || options.label ? VerticalAlign.CENTER : VerticalAlign.TOP,
    shading: options.header || options.label ? { type: ShadingType.CLEAR, fill: options.fill ?? ILAW_FORMAT.labelFill, color: "auto" } : undefined,
    children: cellParas(value, {
      ...(options.header || options.label ? { bold: true, color: "FFFFFF" } : {}),
      ...(options.theme ? { font: ILAW_FORMAT.sharedThemeFontFamily, size: ILAW_FORMAT.sharedThemeSizePt * 2, bold: true } : {}),
      align: options.centered ? AlignmentType.CENTER : undefined,
    }),
  });
}

function table(columnWidths: number[], rows: TableRow[]) {
  return new Table({ width: { size: pageWidth, type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths, rows, borders: { ...borders, insideHorizontal: border, insideVertical: border } });
}

function sectionBanner(letter: keyof typeof ILAW_SECTION_COLORS, title: string) {
  return new Table({
    width: { size: pageWidth, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [pageWidth],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: pageWidth, type: WidthType.DXA },
      borders,
      margins: { top: 100, bottom: 100, left: 150, right: 150 },
      shading: { type: ShadingType.CLEAR, fill: ILAW_SECTION_COLORS[letter], color: "auto" },
      children: [para(`${letter}  ${title.toUpperCase()}`, { bold: true, color: "FFFFFF", keepNext: true })],
    })] })],
  });
}

function gap(after = 160, keepNext = false) {
  return new Paragraph({ keepNext, spacing: { after, line: 1, lineRule: "exact" }, children: [text("", { size: 2 })] });
}

// Distribute the remainder so every grid and merged row uses the full width,
// including three or six grades where an equal integer division loses DXA.
function gradeWidths(total: number, count: number) {
  const width = Math.floor(total / Math.max(1, count));
  return Array.from({ length: count }, (_, index) => width + (index < total % count ? 1 : 0));
}

function gradeHeader(grade: GradeLevel, width: number, index: number) {
  return cell(gradeLabel(grade).toUpperCase(), width, { header: true, centered: true, fill: ILAW_FORMAT.gradeHeaderFills[index % ILAW_FORMAT.gradeHeaderFills.length] });
}

function sharedTable(rows: Array<[string, string | undefined]>, theme = false) {
  const labelWidth = ILAW_FORMAT.labelWidthDxa;
  return table([labelWidth, pageWidth - labelWidth], rows.map(([label, value]) => new TableRow({ children: [cell(label, labelWidth, { label: true }), cell(value || "", pageWidth - labelWidth, { theme })] })));
}

// A label column plus one column per grade, for every per-grade section.
function gradeTable(grades: GradeLevel[], rows: Array<[string, Record<GradeLevel, string> | undefined]>) {
  const labelWidth = ILAW_FORMAT.labelWidthDxa;
  const widths = [labelWidth, ...gradeWidths(pageWidth - labelWidth, grades.length)];
  return table(widths, [
    new TableRow({ tableHeader: true, children: [cell("", labelWidth, { header: true, fill: ILAW_FORMAT.neutralHeaderFill }), ...grades.map((grade, index) => gradeHeader(grade, widths[index + 1], index))] }),
    ...rows.map(([label, values]) => new TableRow({ children: [cell(label, labelWidth, { label: true }), ...grades.map((grade, index) => cell(values?.[grade] || "", widths[index + 1]))] })),
  ]);
}

export function buildIlawDocument(plan: SavedPlan, teachingClass: TeachingClass, teacherName: string, schoolName: string) {
  const printedTeacher = plan.teacherName ?? teacherName;
  const printedSchool = plan.schoolName ?? schoolName;
  const grades = plan.grades;
  const printedDate = plan.teachingDate ? new Date(`${plan.teachingDate}T00:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "";
  // Preserve the source metadata proportions, normalized to the printable area.
  const metaWidths = [3_304, 3_364, 1_553, 2_245];
  const metaRow = (a: string, b: string, c: string, d: string) => new TableRow({ children: [cell(a, metaWidths[0], { header: true }), cell(b, metaWidths[1]), cell(c, metaWidths[2], { header: true }), cell(d, metaWidths[3])] });

  const timeWidth = ILAW_FORMAT.timeWidthDxa;
  const stageWidth = ILAW_FORMAT.stageWidthDxa;
  const flowGradeWidths = gradeWidths(pageWidth - timeWidth - stageWidth, grades.length);
  const flowWidths = [timeWidth, stageWidth, ...flowGradeWidths];

  const children = [
    para(planTitleLine(grades), { bold: true, size: ILAW_FORMAT.titleSizePt * 2, align: AlignmentType.CENTER, after: 120, keepNext: true }),
    para(plan.title, { bold: true, size: ILAW_FORMAT.lessonTitleSizePt * 2, align: AlignmentType.CENTER, after: 120, keepNext: true }),
    table(metaWidths, [
      metaRow("School", printedSchool.trim() || "—", "Grade Levels", gradeList(grades)),
      metaRow("Teacher", printedTeacher, "Learning Area", plan.subject),
      metaRow("Teaching Date", printedDate || "—", "Quarter/Term", plan.quarter),
      metaRow("Time / Sessions", `1 session, ${plan.duration} · ${plan.startTime || ""}`, "No. of Learners", learnerCountSummary(teachingClass, grades)),
      new TableRow({ children: [cell("Multigrade Model", metaWidths[0], { header: true }), cell(plan.multigradeModel || "—", pageWidth - metaWidths[0], { span: 3 })] }),
    ]),
    gap(),

    sectionBanner("I", "Intentions"),
    gap(60, true),
    sharedTable([["Shared Sub-theme", plan.sharedTheme]], true),
    gap(120),
    gradeTable(grades, [
      ["Pamantayang Pangnilalaman (Content Standard)", plan.contentStandards],
      ["Pamantayan sa Pagganap (Performance Standard)", plan.performanceStandards],
      ["Learning Competencies and Codes", Object.fromEntries(grades.map((grade) => [grade, [plan.competencies?.[grade], plan.competencyCodes?.[grade]].filter((value) => value?.trim()).join("\n")]))],
      ["Learning Objectives", plan.objectives],
    ]),
    gap(),

    sectionBanner("L", "Learning Experience"),
    gap(60, true),
    sharedTable([["Learner Context", plan.learnerContext], ["Instructional Materials and Resources", plan.materials]]),
    gap(100),
    para("Flow of the Lesson", { bold: true, after: 60, keepNext: true }),
    table(flowWidths, [
      new TableRow({ tableHeader: true, children: [cell("Time", timeWidth, { header: true, fill: ILAW_FORMAT.neutralHeaderFill }), cell("Stage", stageWidth, { header: true, fill: ILAW_FORMAT.neutralHeaderFill }), ...grades.map((grade, index) => gradeHeader(grade, flowGradeWidths[index], index))] }),
      ...plan.slots.map((slot) => new TableRow({ children: [
        cell([slot.durationMinutes ? `${slot.durationMinutes} min` : "", slot.time].filter(Boolean).join("\n"), timeWidth),
        cell([slot.stage || "Learning activity", slot.teacherFocus].filter((value) => value?.trim()).join("\n"), stageWidth, { label: true }),
        ...(slotIsWholeClass(slot)
          ? [cell(wholeClassTask(slot), pageWidth - timeWidth - stageWidth, { span: grades.length })]
          : grades.map((grade, index) => cell(slot.gradeTasks[grade] || "", flowGradeWidths[index]))),
      ] })),
    ]),
    gap(),

    sectionBanner("A", "Assessment"),
    gap(120, true),
    gradeTable(grades, [
      ["Formative", plan.formativeAssessments],
      ["Exit Task", plan.exitTasks],
      ["Success Criteria", plan.successCriteria],
    ]),
    gap(),

    sectionBanner("W", "Ways Forward"),
    gap(120, true),
    gradeTable(grades, [
      ["Reflection Questions", plan.reflectionQuestions],
      ["Remediation", plan.remediations],
      ["Enrichment", plan.enrichments],
    ]),
    gap(100),
    sharedTable([["Notes for Next Session / Whole-School Follow-Up", plan.nextSessionNotes]]),
    gap(400),

    new Table({
      width: { size: pageWidth, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: [pageWidth / 2, pageWidth / 2],
      rows: [new TableRow({ cantSplit: true, children: [
        new TableCell({ width: { size: pageWidth / 2, type: WidthType.DXA }, borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }, children: [para("Prepared by:", { after: 360, italics: true }), para(printedTeacher.toUpperCase(), { bold: true, align: AlignmentType.CENTER }), para("Classroom Adviser", { align: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: pageWidth / 2, type: WidthType.DXA }, borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }, children: [para("Checked by:", { after: 360, italics: true }), para((plan.schoolHeadName || "").toUpperCase() || " ", { bold: true, align: AlignmentType.CENTER }), para("School Head", { align: AlignmentType.CENTER })] }),
      ] })],
    }),
  ];

  return new Document({
    creator: "Kalinga",
    title: plan.title,
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { after: 160, line: 259 } } } },
      paragraphStyles: [{ id: "Normal", name: "Normal", run: { font: ILAW_FORMAT.fontFamily, size: 20 }, paragraph: { spacing: { after: 0, line: 240 } } }],
    },
    sections: [{
      properties: { page: { size: { width: ILAW_FORMAT.pageWidthDxa, height: ILAW_FORMAT.pageHeightDxa }, margin: { top: ILAW_FORMAT.pageMarginDxa, right: ILAW_FORMAT.pageMarginDxa, bottom: ILAW_FORMAT.pageMarginDxa, left: ILAW_FORMAT.pageMarginDxa, header: 709, footer: 709 } } },
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
