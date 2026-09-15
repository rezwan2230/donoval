/**
 * ConnexUS AI Document Generator
 *
 * Generates branded DOCX documents using the ConnexUS AI letterhead template.
 * Supports letters, proposals, memos, reports, and any document type.
 *
 * Usage:
 *   node create-doc.js --title "Document Title" --type letter|memo|report|proposal|general --output output.docx
 *
 * The script expects content sections to be passed via a JSON file:
 *   node create-doc.js --title "Proposal" --type proposal --content content.json --output proposal.docx
 *
 * content.json structure:
 * {
 *   "recipient_name": "Jane Doe",              // (letters only)
 *   "recipient_address": "123 Main St...",      // (letters only)
 *   "recipient_email": "jane@example.com",      // (letters only)
 *   "recipient_phone": "+1-555-0100",           // (letters only)
 *   "date": "March 30, 2026",                   // auto-filled if omitted
 *   "subject": "Re: Partnership Proposal",      // optional subject line
 *   "salutation": "Dear Jane Doe,",             // (letters only, auto-generated from recipient_name if omitted)
 *   "body": [                                   // array of content blocks
 *     { "type": "paragraph", "text": "Body text here..." },
 *     { "type": "heading", "level": 1, "text": "Section Title" },
 *     { "type": "heading", "level": 2, "text": "Subsection" },
 *     { "type": "bullet", "items": ["Point 1", "Point 2"] },
 *     { "type": "numbered", "items": ["Step 1", "Step 2"] },
 *     { "type": "table", "headers": ["Col1", "Col2"], "rows": [["a","b"],["c","d"]] },
 *     { "type": "pagebreak" }
 *   ],
 *   "closing": "Sincerely,",                   // default: "Sincerely,"
 *   "signer_name": "Walter White",             // default: Walter White
 *   "signer_title": "Liaison to David Pierce"  // default: Liaison to David Pierce
 * }
 */

const fs = require("fs");
const path = require("path");
const docx = require("docx");

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, LevelFormat,
  BorderStyle, WidthType, ShadingType, TabStopType, TabStopPosition,
  HeadingLevel, PageBreak, ExternalHyperlink,
} = docx;

// ── Paths ──────────────────────────────────────────────────────────────────────
const SKILL_DIR = path.resolve(__dirname, "..");
const ASSETS = path.join(SKILL_DIR, "assets");
const CONNEXUS_LOGO = path.join(ASSETS, "connexus-logo.png");
const RAGBOX_LOGO = path.join(ASSETS, "ragbox-logo.png");

// ── Brand constants ────────────────────────────────────────────────────────────
const BRAND = {
  navy: "0E2841",
  blue: "00AEEF",
  gray: "404040",
  lightGray: "E8E8E9",
  white: "FFFFFF",
  font: "Helvetica",
  fallbackFont: "Arial",
  bodySize: 22,         // 11pt in half-points
  headingSize: 28,      // 14pt
  titleSize: 36,        // 18pt
  smallSize: 18,        // 9pt
  companyName: "ConnexUS AI",
  address: "3301 N University Drive, Coral Springs FL 33065",
  phone: "1.888.888.3371",
  email: "info@theconnexus.ai",
  website: "www.theconnexus.ai",
  ragboxUrl: "www.ragbox.co",
  signerName: "Walter White",
  signerTitle: "Liaison to David Pierce",
};

// ── CLI argument parsing ───────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "");
    opts[key] = args[i + 1];
  }
  return opts;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function loadImage(filePath) {
  return fs.readFileSync(filePath);
}

function today() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  });
}

function textRun(text, overrides = {}) {
  return new TextRun({
    text,
    font: BRAND.font,
    color: BRAND.gray,
    size: BRAND.bodySize,
    ...overrides,
  });
}

// ── Header builder ─────────────────────────────────────────────────────────────
function buildHeader() {
  const connexusLogo = loadImage(CONNEXUS_LOGO);
  const ragboxLogo = loadImage(RAGBOX_LOGO);

  return new Header({
    children: [
      // Row 1: ConnexUS logo (left) + RAGbox logo (right) on the same line
      new Paragraph({
        spacing: { after: 60 },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new ImageRun({
            type: "png",
            data: connexusLogo,
            transformation: { width: 200, height: 47 },
            altText: { title: "ConnexUS AI Logo", description: "ConnexUS AI company logo", name: "connexus-logo" },
          }),
          new TextRun({ text: "\t", font: BRAND.font }),
          new ImageRun({
            type: "png",
            data: ragboxLogo,
            transformation: { width: 80, height: 17 },
            altText: { title: "RAGbox Logo", description: "RAGbox.co logo", name: "ragbox-logo" },
          }),
        ],
      }),
      // Row 2: Address right-aligned, with thin separator line below
      new Paragraph({
        spacing: { before: 0, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: BRAND.lightGray, space: 4 } },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: "\t" }),
          textRun(BRAND.address, { bold: true, size: 16, color: "000000" }),
        ],
      }),
    ],
  });
}

// ── Footer builder ─────────────────────────────────────────────────────────────
function buildFooter() {
  const contactLine = `${BRAND.phone}   |   ${BRAND.email}          ${BRAND.website}   |   ${BRAND.ragboxUrl}`;
  return new Footer({
    children: [
      new Paragraph({
        spacing: { before: 100 },
        border: { top: { style: BorderStyle.SINGLE, size: 3, color: BRAND.lightGray, space: 4 } },
        alignment: AlignmentType.CENTER,
        children: [
          textRun(contactLine, { size: 16, color: BRAND.gray }),
        ],
      }),
    ],
  });
}

// ── Content block renderers ────────────────────────────────────────────────────
function renderBlocks(blocks, numbering) {
  const children = [];
  let numberedRef = 0;

  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
        children.push(new Paragraph({
          spacing: { after: 200, line: 276 },
          children: [textRun(block.text)],
        }));
        break;

      case "heading":
        children.push(new Paragraph({
          heading: block.level === 1 ? HeadingLevel.HEADING_1 :
                   block.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          spacing: { before: 280, after: 140 },
          children: [textRun(block.text, {
            bold: true,
            size: block.level === 1 ? BRAND.titleSize :
                  block.level === 2 ? BRAND.headingSize : BRAND.bodySize,
            color: BRAND.navy,
          })],
        }));
        break;

      case "bullet":
        for (const item of block.items) {
          children.push(new Paragraph({
            numbering: { reference: "bullets", level: 0 },
            spacing: { after: 80 },
            children: [textRun(item)],
          }));
        }
        break;

      case "numbered":
        numberedRef++;
        for (const item of block.items) {
          children.push(new Paragraph({
            numbering: { reference: `steps-${numberedRef}`, level: 0 },
            spacing: { after: 80 },
            children: [textRun(item)],
          }));
        }
        break;

      case "table": {
        const usableWidth = 9000; // DXA
        const colCount = block.headers.length;
        const colWidth = Math.floor(usableWidth / colCount);
        const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: "B0B0B0" };
        const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

        const headerRow = new TableRow({
          children: block.headers.map(h => new TableCell({
            borders: allBorders,
            width: { size: colWidth, type: WidthType.DXA },
            shading: { fill: BRAND.navy, type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ children: [textRun(h, { bold: true, color: BRAND.white, size: 20 })] })],
          })),
        });

        const dataRows = (block.rows || []).map((row, idx) => new TableRow({
          children: row.map(cell => new TableCell({
            borders: allBorders,
            width: { size: colWidth, type: WidthType.DXA },
            shading: idx % 2 === 0
              ? { fill: "F5F5F5", type: ShadingType.CLEAR }
              : { fill: BRAND.white, type: ShadingType.CLEAR },
            margins: { top: 40, bottom: 40, left: 100, right: 100 },
            children: [new Paragraph({ children: [textRun(cell, { size: 20 })] })],
          })),
        }));

        children.push(new Table({
          width: { size: usableWidth, type: WidthType.DXA },
          columnWidths: Array(colCount).fill(colWidth),
          rows: [headerRow, ...dataRows],
        }));
        children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
        break;
      }

      case "pagebreak":
        children.push(new Paragraph({ children: [new PageBreak()] }));
        break;

      default:
        // Treat unknown types as plain paragraphs
        if (block.text) {
          children.push(new Paragraph({
            spacing: { after: 200 },
            children: [textRun(block.text)],
          }));
        }
    }
  }
  return children;
}

// ── Letter-format builder ──────────────────────────────────────────────────────
function buildLetterContent(content) {
  const children = [];
  const date = content.date || today();

  // Recipient info block
  if (content.recipient_name) {
    children.push(new Paragraph({ spacing: { after: 0 }, children: [textRun(content.recipient_name)] }));
  }
  if (content.recipient_address) {
    for (const line of content.recipient_address.split("\n")) {
      children.push(new Paragraph({ spacing: { after: 0 }, children: [textRun(line)] }));
    }
  }
  if (content.recipient_email) {
    children.push(new Paragraph({
      spacing: { after: 0 },
      children: [
        textRun("W  ", { bold: true }),
        textRun(content.recipient_email),
      ],
    }));
  }
  if (content.recipient_phone) {
    children.push(new Paragraph({
      spacing: { after: 0 },
      children: [
        textRun("P  ", { bold: true }),
        textRun(content.recipient_phone),
      ],
    }));
  }

  // Date line (right-aligned)
  children.push(new Paragraph({
    spacing: { before: 100, after: 200 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [textRun("\t"), textRun(date)],
  }));

  // Salutation
  const salutation = content.salutation ||
    (content.recipient_name ? `Dear ${content.recipient_name},` : "Dear Sir or Madam,");
  children.push(new Paragraph({
    spacing: { after: 200 },
    children: [textRun(salutation)],
  }));

  // Body blocks
  if (content.body && content.body.length > 0) {
    children.push(...renderBlocks(content.body, null));
  }

  // Closing + signature
  children.push(new Paragraph({ spacing: { before: 300, after: 0 }, children: [] }));
  const closing = content.closing || "Sincerely,";
  children.push(new Paragraph({
    spacing: { after: 300 },
    children: [textRun(closing)],
  }));

  const signerName = content.signer_name || BRAND.signerName;
  const signerTitle = content.signer_title || BRAND.signerTitle;
  children.push(new Paragraph({
    spacing: { after: 0 },
    children: [textRun(signerName, { bold: true })],
  }));
  children.push(new Paragraph({
    spacing: { after: 0 },
    children: [textRun(signerTitle, { italics: true })],
  }));
  children.push(new Paragraph({
    spacing: { after: 0 },
    children: [textRun(BRAND.companyName)],
  }));

  return children;
}

// ── General document builder ───────────────────────────────────────────────────
function buildGeneralContent(content, title) {
  const children = [];
  const date = content.date || today();

  // Document title
  if (title) {
    children.push(new Paragraph({
      spacing: { before: 100, after: 60 },
      children: [textRun(title, { bold: true, size: BRAND.titleSize, color: BRAND.navy })],
    }));
  }

  // Date and optional subject
  children.push(new Paragraph({
    spacing: { after: 40 },
    children: [textRun(date, { size: BRAND.smallSize, color: "808080" })],
  }));

  if (content.subject) {
    children.push(new Paragraph({
      spacing: { after: 80 },
      children: [
        textRun("Subject: ", { bold: true }),
        textRun(content.subject),
      ],
    }));
  }

  // Author line
  const signerName = content.signer_name || BRAND.signerName;
  const signerTitle = content.signer_title || BRAND.signerTitle;
  children.push(new Paragraph({
    spacing: { after: 200 },
    children: [
      textRun("Prepared by: ", { size: BRAND.smallSize, color: "808080" }),
      textRun(`${signerName}, ${signerTitle}`, { size: BRAND.smallSize, color: "808080" }),
    ],
  }));

  // Separator
  children.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BRAND.lightGray, space: 4 } },
    spacing: { after: 300 },
    children: [],
  }));

  // Body blocks
  if (content.body && content.body.length > 0) {
    children.push(...renderBlocks(content.body, null));
  }

  // Closing + signature (if provided in content JSON)
  if (content.closing) {
    children.push(new Paragraph({ spacing: { before: 300, after: 0 }, children: [] }));
    children.push(new Paragraph({
      spacing: { after: 300 },
      children: [textRun(content.closing)],
    }));

    const closingName = content.signer_name || BRAND.signerName;
    const closingTitle = content.signer_title || BRAND.signerTitle;
    children.push(new Paragraph({
      spacing: { after: 0 },
      children: [textRun(closingName, { bold: true })],
    }));
    children.push(new Paragraph({
      spacing: { after: 0 },
      children: [textRun(closingTitle, { italics: true })],
    }));
    children.push(new Paragraph({
      spacing: { after: 0 },
      children: [textRun(BRAND.companyName)],
    }));
  }

  return children;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  const title = opts.title || "ConnexUS AI Document";
  const docType = opts.type || "general";
  const outputPath = opts.output || "document.docx";
  const contentPath = opts.content;

  let content = {};
  if (contentPath && fs.existsSync(contentPath)) {
    content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
  }

  // Build numbering configs for bullet/numbered lists
  const numberingConfigs = [
    {
      reference: "bullets",
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: "\u2022",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    },
  ];
  // Add numbered list references (up to 20)
  for (let i = 1; i <= 20; i++) {
    numberingConfigs.push({
      reference: `steps-${i}`,
      levels: [{
        level: 0,
        format: LevelFormat.DECIMAL,
        text: "%1.",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    });
  }

  // Build content based on document type
  const bodyChildren = docType === "letter"
    ? buildLetterContent(content)
    : buildGeneralContent(content, title);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: BRAND.font, size: BRAND.bodySize, color: BRAND.gray },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: BRAND.titleSize, bold: true, font: BRAND.font, color: BRAND.navy },
          paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 },
        },
        {
          id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: BRAND.headingSize, bold: true, font: BRAND.font, color: BRAND.navy },
          paragraph: { spacing: { before: 220, after: 110 }, outlineLevel: 1 },
        },
        {
          id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: BRAND.bodySize, bold: true, font: BRAND.font, color: BRAND.navy },
          paragraph: { spacing: { before: 180, after: 90 }, outlineLevel: 2 },
        },
      ],
    },
    numbering: { config: numberingConfigs },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1080, left: 1800, header: 576, footer: 576 },
        },
      },
      headers: { default: buildHeader() },
      footers: { default: buildFooter() },
      children: bodyChildren,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created: ${outputPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
