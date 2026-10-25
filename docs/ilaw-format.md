# ILAW format reference

The original Filipino Grades III and IV ILAW Word file supplied by the project controls formatting. This is not a universal DepEd standard or an approval claim. Reference SHA-256: `19eac0cdd8dd4c0845d7dbcabceeaab07f1312da689bbb89ff0e1db47ba946fc`. The source is unchanged.

The theme has Calibri defaults, but Normal overrides the font to Times New Roman. Most visible body/table runs specify 11 pt; the form title is 12 pt. Kalinga uses those visible roles rather than mistaking the theme default for the rendered font. The localized shared-theme treatment is Century Gothic 8 pt. Devices without a font may substitute one.

`lib/ilaw-format.ts` holds source-derived measurements shared by the Word exporter and browser document: Times New Roman 11 pt, original section colors, thin black borders, A4 portrait, half-inch margins. Kalinga's additional editable title is 14 pt. Metadata follows source column proportions. Word grade/flow tables preserve full-width grids and repeat headers across pages.

User-approved differences: competencies, objectives, reflection, shared theme, context, materials and next-session notes stay in expanded tables. Do not recreate stray backticks, sample identity/content, split words or incidental editing artifacts. Success Criteria uses the source label while storage keeps `successCriteria`. Never shorten or shrink activities to force a page count. Word signatures stay together.

## Verification and limits

The four source pages, a two-page sample export and a five-page long three-grade export were rendered with bundled LibreOffice and visually inspected. Tests inspect actual DOCX for geometry, typography, table styles, full-width grids across 1/2/3/6 grades, identity snapshots, line breaks and shared-cell merging. Browser QA checks 11 pt text and mobile layout without horizontal page overflow.

PDF remains browser printing: use A4, Save as PDF, disable browser headers/footers and enable background graphics for the colored form. Browser and Word pagination are not guaranteed pixel-identical. Form fidelity does not verify facts, competency codes or curriculum alignment; teacher review before quality assurance remains essential.
