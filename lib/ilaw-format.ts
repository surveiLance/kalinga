// Measured from the Filipino Grades III/IV ILAW reference DOCX. The theme's
// Calibri 11 default is overridden by Normal (Times New Roman 10); most visible
// table/body runs explicitly use 11pt, and the centered form title uses 12pt.
// Kalinga keeps its expanded tables and a separate editable lesson title.
export const ILAW_FORMAT = {
  fontFamily: "Times New Roman",
  bodySizePt: 11,
  titleSizePt: 12,
  lessonTitleSizePt: 14,
  sharedThemeFontFamily: "Century Gothic",
  sharedThemeSizePt: 8,
  pageWidthDxa: 11_906,
  pageHeightDxa: 16_838,
  pageMarginDxa: 720,
  contentWidthDxa: 10_466,
  labelWidthDxa: 2_200,
  timeWidthDxa: 1_100,
  stageWidthDxa: 1_900,
  borderColor: "000000",
  borderSizeEighthPt: 4,
  cellMarginsDxa: { top: 80, bottom: 80, left: 100, right: 100 },
  labelFill: "1F3864",
  neutralHeaderFill: "444444",
  gradeHeaderFills: ["8C5A1E", "2E6B2E", "1F3864", "7A2048"],
} as const;

export const ILAW_SECTION_COLORS = {
  I: "1F3864",
  L: "2E6B2E",
  A: "8C5A1E",
  W: "7A2048",
} as const;
