from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"
OUTPUT.mkdir(parents=True, exist_ok=True)

INK = colors.HexColor("#172038")
MUTED = colors.HexColor("#687188")
ORANGE = colors.HexColor("#F15424")
TEAL = colors.HexColor("#20857F")
TEAL_LIGHT = colors.HexColor("#E3F3F0")
CREAM = colors.HexColor("#FBF5E9")
PAPER = colors.HexColor("#FFFEFB")
LINE = colors.HexColor("#DDD5C8")
PALE_ORANGE = colors.HexColor("#FCE6DC")

PAGE_W, PAGE_H = A4
MARGIN_X = 18 * mm
MARGIN_TOP = 22 * mm
MARGIN_BOTTOM = 18 * mm


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Kicker", fontName="Helvetica-Bold", fontSize=8.5, leading=10, textColor=ORANGE, spaceAfter=5, tracking=1.1))
styles.add(ParagraphStyle(name="TitleK", fontName="Times-Bold", fontSize=25, leading=28, textColor=INK, spaceAfter=8))
styles.add(ParagraphStyle(name="SubtitleK", fontName="Helvetica", fontSize=10.5, leading=15, textColor=MUTED, spaceAfter=13))
styles.add(ParagraphStyle(name="SectionK", fontName="Times-Bold", fontSize=17, leading=20, textColor=INK, spaceBefore=8, spaceAfter=8))
styles.add(ParagraphStyle(name="BodyK", fontName="Helvetica", fontSize=9.5, leading=14, textColor=INK, spaceAfter=7))
styles.add(ParagraphStyle(name="SmallK", fontName="Helvetica", fontSize=8, leading=11, textColor=MUTED))
styles.add(ParagraphStyle(name="LabelK", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=TEAL, spaceAfter=3))
styles.add(ParagraphStyle(name="CardTitleK", fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=INK, spaceAfter=4))
styles.add(ParagraphStyle(name="CenteredK", parent=styles["BodyK"], alignment=TA_CENTER))


def paragraph(text, style="BodyK"):
    return Paragraph(text, styles[style])


def page_decor(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(CREAM)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(PAPER)
    canvas.roundRect(11 * mm, 11 * mm, PAGE_W - 22 * mm, PAGE_H - 22 * mm, 5 * mm, fill=1, stroke=0)
    canvas.setFillColor(TEAL)
    canvas.roundRect(18 * mm, PAGE_H - 15 * mm, 28 * mm, 2.4 * mm, 1.2 * mm, fill=1, stroke=0)
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.setFillColor(INK)
    canvas.drawString(18 * mm, 12.5 * mm, "KALINGA TEACHER RESOURCE")
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_W - 18 * mm, 12.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def document(path):
    doc = BaseDocTemplate(
        str(path), pagesize=A4,
        leftMargin=MARGIN_X, rightMargin=MARGIN_X,
        topMargin=MARGIN_TOP, bottomMargin=MARGIN_BOTTOM,
        title=path.stem.replace("-", " ").title(),
        author="Kalinga Teacher Resource Library",
    )
    frame = Frame(MARGIN_X, MARGIN_BOTTOM, PAGE_W - 2 * MARGIN_X, PAGE_H - MARGIN_TOP - MARGIN_BOTTOM, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates(PageTemplate(id="kalinga", frames=[frame], onPage=page_decor))
    return doc


def info_strip(items):
    cells = []
    for label, value in items:
        cells.append([paragraph(label.upper(), "LabelK"), paragraph(value, "CardTitleK")])
    table = Table([cells], colWidths=[(PAGE_W - 2 * MARGIN_X) / len(cells)] * len(cells), hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TEAL_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#BBDCD6")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CDE5E1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return table


def callout(title, body, color=TEAL_LIGHT):
    content = [[paragraph(title, "CardTitleK"), paragraph(body, "BodyK")]]
    table = Table(content, colWidths=[42 * mm, PAGE_W - 2 * MARGIN_X - 42 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return table


def lined_box(title, prompt, lines=4):
    rows = [[paragraph(title, "CardTitleK")], [paragraph(prompt, "SmallK")]]
    for _ in range(lines):
        rows.append([Spacer(1, 8 * mm)])
    table = Table(rows, colWidths=[PAGE_W - 2 * MARGIN_X])
    commands = [
        ("BACKGROUND", (0, 0), (-1, 1), TEAL_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    for row in range(2, len(rows)):
        commands.append(("LINEBELOW", (0, row), (-1, row), 0.45, colors.HexColor("#CBC4B9")))
    table.setStyle(TableStyle(commands))
    return table


def math_resource():
    path = OUTPUT / "fraction-market-bottle-cap-math.pdf"
    doc = document(path)
    story = [
        paragraph("MATHEMATICS - READY TO TEACH", "Kicker"),
        paragraph("Fraction Market with Bottle Caps", "TitleK"),
        paragraph("A low-cost multigrade activity for representing, comparing, and explaining fractions using familiar classroom objects.", "SubtitleK"),
        info_strip([("Grades", "3 to 5"), ("Time", "40 to 55 minutes"), ("Materials", "Bottle caps, paper, pencil"), ("Grouping", "Pairs or small groups")]),
        Spacer(1, 6 * mm),
        paragraph("Learning goals", "SectionK"),
        paragraph("By the end of the activity, learners should be able to:", "BodyK"),
        paragraph("- represent a fraction as equal groups or parts;<br/>- compare two fractions using objects, drawings, or words;<br/>- explain how they know which fraction is greater or whether two fractions are equivalent.", "BodyK"),
        callout("Teacher check", "Ask learners to explain their model before accepting a numerical answer. Their explanation is the strongest evidence of understanding."),
        Spacer(1, 5 * mm),
        paragraph("Before class", "SectionK"),
        paragraph("Prepare 20 to 30 clean bottle caps per group. If bottle caps are unavailable, use seeds, pebbles, folded paper squares, or other safe objects that can be counted and moved.", "BodyK"),
        paragraph("Write these sample market orders on the board: one-half of 12 caps, one-third of 12 caps, three-fourths of 16 caps, and two-thirds of 18 caps.", "BodyK"),
        PageBreak(),
        paragraph("ACTIVITY FLOW", "Kicker"),
        paragraph("Run the Fraction Market", "TitleK"),
        info_strip([("Step 1", "Model"), ("Step 2", "Compare"), ("Step 3", "Explain"), ("Step 4", "Create")]),
        Spacer(1, 5 * mm),
        paragraph("1. Warm-up: fair shares - 8 minutes", "SectionK"),
        paragraph("Give each pair 12 caps. Ask them to show one-half, one-third, and one-fourth of the set. After every model, ask: How many equal groups did you make? How many caps are in the named part?", "BodyK"),
        paragraph("2. Market orders - 15 minutes", "SectionK"),
        paragraph("Read one order at a time. Learners build the fraction, sketch what they built, and write the fraction. Let older learners create two correct models for the same fraction.", "BodyK"),
        paragraph("3. Compare two orders - 12 minutes", "SectionK"),
        paragraph("Pairs compare two models. They complete this sentence: I think ___ is greater than / less than / equal to ___ because ___. Encourage them to rearrange caps to prove the comparison.", "BodyK"),
        paragraph("4. Learner-created challenge - 10 minutes", "SectionK"),
        paragraph("Each pair creates one market order for another pair. The order must include a fraction, a total number of caps, and a way to check the answer.", "BodyK"),
        callout("Multigrade move", "Grade 3: unit fractions. Grade 4: like and unlike denominators using models. Grade 5: equivalent fractions and explanation. Everyone uses the same materials, but the reasoning demand changes.", PALE_ORANGE),
        PageBreak(),
        paragraph("LEARNER RECORD SHEET", "Kicker"),
        paragraph("Show your fraction thinking", "TitleK"),
        paragraph("Name: ________________________________   Grade: __________   Date: __________", "BodyK"),
        lined_box("Market order 1", "Write the fraction, draw or describe your model, and explain how you checked it.", 3),
        Spacer(1, 4 * mm),
        lined_box("Market order 2", "Compare two fractions. Use greater than, less than, or equal to, then explain why.", 3),
        Spacer(1, 4 * mm),
        lined_box("My challenge for another pair", "Write a new fraction market order and the answer key.", 3),
        Spacer(1, 5 * mm),
        callout("Exit check", "Show three-fourths of 12 using caps or a drawing. Write one sentence that explains why your model is correct."),
    ]
    doc.build(story)
    return path


def science_resource():
    path = OUTPUT / "schoolyard-plant-detectives-science.pdf"
    doc = document(path)
    story = [
        paragraph("SCIENCE - READY TO TEACH", "Kicker"),
        paragraph("Schoolyard Plant Detectives", "TitleK"),
        paragraph("An observation-based investigation that helps learners compare local plants, identify patterns, and support a claim with evidence.", "SubtitleK"),
        info_strip([("Grades", "3 to 5"), ("Time", "45 to 60 minutes"), ("Materials", "Paper, pencil, string"), ("Setting", "Schoolyard or window view")]),
        Spacer(1, 6 * mm),
        paragraph("Learning goals", "SectionK"),
        paragraph("By the end of the investigation, learners should be able to:", "BodyK"),
        paragraph("- observe plant structures using safe, non-destructive methods;<br/>- record similarities and differences in a simple table;<br/>- make a claim about how a plant is suited to its location and support it with observations.", "BodyK"),
        callout("Safety first", "Set clear boundaries. Learners should not taste plants, touch unknown sap, climb, or remove living parts. Observe from a safe distance when needed.", PALE_ORANGE),
        Spacer(1, 5 * mm),
        paragraph("Before class", "SectionK"),
        paragraph("Choose two or three plants that learners can observe safely. Include plants from different spots if possible, such as sun and shade, dry and damp ground, or open and sheltered areas.", "BodyK"),
        paragraph("If going outside is not possible, use plants visible from a window or bring safe fallen leaves. Learners can also compare clear teacher-made sketches.", "BodyK"),
        PageBreak(),
        paragraph("INVESTIGATION FLOW", "Kicker"),
        paragraph("Observe, compare, and explain", "TitleK"),
        info_strip([("Step 1", "Notice"), ("Step 2", "Record"), ("Step 3", "Compare"), ("Step 4", "Claim")]),
        Spacer(1, 5 * mm),
        paragraph("1. Notice without naming - 8 minutes", "SectionK"),
        paragraph("Ask learners to silently observe one plant. They list colors, shapes, textures, size, and where the plant is growing. Avoid giving the plant name first so the focus stays on evidence.", "BodyK"),
        paragraph("2. Record two plants - 15 minutes", "SectionK"),
        paragraph("Pairs record leaf shape, stem type, approximate height, nearby light, and soil condition. They may add one question they cannot answer through observation alone.", "BodyK"),
        paragraph("3. Compare patterns - 10 minutes", "SectionK"),
        paragraph("Learners circle one similarity and underline one difference. Ask: Which observation can another person verify? Which statement is only a guess?", "BodyK"),
        paragraph("4. Make an evidence-based claim - 12 minutes", "SectionK"),
        paragraph("Use the frame: I think this plant is suited to ___ because I observed ___. A useful follow-up is: What other evidence would make your claim stronger?", "BodyK"),
        callout("Multigrade move", "Grade 3: identify visible parts. Grade 4: compare structures and locations. Grade 5: write a claim with two pieces of evidence and note one limitation.", TEAL_LIGHT),
        PageBreak(),
        paragraph("FIELD NOTES", "Kicker"),
        paragraph("Plant detective record", "TitleK"),
        paragraph("Name: ________________________________   Grade: __________   Date: __________", "BodyK"),
        Table([
            [paragraph("Observation", "CardTitleK"), paragraph("Plant A", "CardTitleK"), paragraph("Plant B", "CardTitleK")],
            [paragraph("Leaf shape and texture", "SmallK"), "", ""],
            [paragraph("Stem or trunk", "SmallK"), "", ""],
            [paragraph("Light and ground", "SmallK"), "", ""],
            [paragraph("One other detail", "SmallK"), "", ""],
        ], colWidths=[44 * mm, 61 * mm, 61 * mm], rowHeights=[11 * mm, 20 * mm, 20 * mm, 20 * mm, 20 * mm], style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), TEAL_LIGHT),
            ("GRID", (0, 0), (-1, -1), 0.7, LINE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
        ])),
        Spacer(1, 5 * mm),
        lined_box("My claim", "I think __________________ is suited to __________________ because I observed __________________.", 3),
        Spacer(1, 4 * mm),
        lined_box("A question for our next investigation", "What do you still want to find out?", 2),
    ]
    doc.build(story)
    return path


if __name__ == "__main__":
    for resource_path in (math_resource(), science_resource()):
        print(resource_path)
