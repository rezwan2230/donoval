---
name: connexus-ai-doc
description: >
  Generate branded ConnexUS AI documents authored by Walter White. Use when
  the user asks to create, draft, write, or produce a document, letter, memo,
  proposal, report, or any written deliverable for ConnexUS AI, ConnexUS, or
  mentions Walter White documents. Outputs .docx or .pdf with the official
  ConnexUS AI letterhead, header logos (ConnexUS AI + RAGbox.co), branded
  footer with contact info, and Helvetica typography in navy/gray palette.
metadata:
  author: david-pierce
  version: '1.1'
  company: ConnexUS AI
---

# ConnexUS AI Document Generator

Create professionally branded documents for ConnexUS AI using the official letterhead template. All documents are authored by **Walter White, Liaison to David Pierce**.

## When to Use This Skill

Use this skill when the user:

- Asks to create a document "for ConnexUS" or "for ConnexUS AI"
- Wants a letter, memo, proposal, report, or any business document on ConnexUS AI letterhead
- Mentions Walter White writing or signing a document
- Asks for a .docx or .pdf with ConnexUS AI branding
- Says "produce a document for ConnexUS"

## Brand Specifications

| Element | Value |
|---------|-------|
| Primary font | Helvetica (fallback: Arial) |
| Body text color | #404040 (dark gray) |
| Heading color | #0E2841 (navy) |
| Accent blue | #00AEEF |
| Separator color | #E8E8E8 (light gray) |
| Body text size | 11pt |
| Page size | US Letter (8.5" x 11") |
| Margins | Top: 0.5", Right: 1", Bottom: 0.2", Left: 1.25" |

### Header
- **Left**: ConnexUS AI logo (hand icon + "ConnëxUS Ai" wordmark)
- **Right**: RAGbox.co logo
- **Below logos**: Light gray separator line with company address right-aligned: **3301 N University Drive, Coral Springs FL 33065**

### Footer
- Light gray separator line
- Contact info centered: **1.888.888.3371 | info@theconnexus.ai | www.theconnexus.ai | www.ragbox.co**

### Default Signer
- **Name**: Walter White
- **Title**: Liaison to David Pierce
- **Company**: ConnexUS AI

## Instructions

### Step 1: Determine Document Type

Ask the user (or infer from context) what kind of document to create:

| Type | Description |
|------|-------------|
| `letter` | Formal business letter with recipient info, salutation, body, closing, and signature |
| `memo` | Internal memo with subject, date, and body sections |
| `proposal` | Business proposal with title, sections, and structured content |
| `report` | Report with title, date, author line, and section-based body |
| `general` | Any other document — uses the general format with title, author, and body |

For any type other than `letter`, the general format is used (title + author line + body sections).

### Step 2: Prepare Content JSON

Create a content JSON file at `/home/user/workspace/connexus-content.json`. Structure:

```json
{
  "recipient_name": "Jane Doe",
  "recipient_address": "123 Main St\nCity, State ZIP",
  "recipient_email": "jane@example.com",
  "recipient_phone": "+1-555-0100",
  "date": "March 30, 2026",
  "subject": "Re: Partnership Proposal",
  "salutation": "Dear Jane Doe,",
  "body": [
    { "type": "paragraph", "text": "Body paragraph text here..." },
    { "type": "heading", "level": 1, "text": "Section Title" },
    { "type": "heading", "level": 2, "text": "Subsection" },
    { "type": "bullet", "items": ["Point 1", "Point 2", "Point 3"] },
    { "type": "numbered", "items": ["Step 1", "Step 2", "Step 3"] },
    { "type": "table", "headers": ["Column A", "Column B"], "rows": [["val1", "val2"]] },
    { "type": "pagebreak" }
  ],
  "closing": "Sincerely,",
  "signer_name": "Walter White",
  "signer_title": "Liaison to David Pierce"
}
```

**Field notes:**
- `date` — auto-filled to today if omitted
- `signer_name` / `signer_title` — defaults to Walter White / Liaison to David Pierce if omitted
- `recipient_*` fields — only used for letter type
- `salutation` — auto-generated from `recipient_name` if omitted (letter type only)
- `closing` — for letters, defaults to "Sincerely," if omitted. For all other document types (memo, proposal, report, general), include `closing` in the JSON to render a signature block at the end. If `closing` is omitted in non-letter types, no signature block is rendered.
- `body` — array of content blocks (see block types above). Do NOT include manual closing/signature text in the body array — use the `closing`, `signer_name`, and `signer_title` fields instead.

### Step 3: Generate the DOCX

Run the creation script:

```bash
node skills/connexus-ai-doc/scripts/create-doc.js \
  --title "Document Title" \
  --type letter \
  --content /home/user/workspace/connexus-content.json \
  --output /home/user/workspace/connexus-document.docx
```

Arguments:
- `--title` — Document title (used in general/report/proposal/memo formats; not displayed in letter format)
- `--type` — One of: `letter`, `memo`, `proposal`, `report`, `general` (default: `general`)
- `--content` — Path to the content JSON file
- `--output` — Output .docx file path

### Step 4: Convert to PDF (if requested)

If the user wants a PDF:

```bash
soffice --headless --convert-to pdf /home/user/workspace/connexus-document.docx --outdir /home/user/workspace/
```

### Step 5: Visual Verification

**Always** render the document and visually inspect before sharing:

```bash
soffice --headless --convert-to pdf /home/user/workspace/connexus-document.docx --outdir /tmp/
pdftoppm -jpeg -r 200 /tmp/connexus-document.pdf /tmp/connexus-preview
```

Then read the preview image(s) and verify:
- ConnexUS AI logo appears in the header (top-left)
- RAGbox.co logo appears in the header (top-right)
- Company address appears below the logos
- Footer shows contact info
- Text is readable and properly formatted
- No text overflow, wrapping, or truncation issues

### Step 6: Share

Share the file with the user using `share_file`. Use the document title as the asset name.

- For DOCX: share the .docx directly
- For PDF: share the .pdf file
- If both formats requested: share both files

## Content Block Reference

| Block Type | Required Fields | Notes |
|-----------|----------------|-------|
| `paragraph` | `text` | Standard body paragraph |
| `heading` | `level` (1-3), `text` | Navy bold heading; level 1 = largest |
| `bullet` | `items` (array of strings) | Bulleted list |
| `numbered` | `items` (array of strings) | Numbered list (each block starts at 1) |
| `table` | `headers` (array), `rows` (array of arrays) | Navy header row, alternating gray/white rows |
| `pagebreak` | (none) | Inserts a page break |

## Examples

### Quick letter
User: "Write a letter from Walter White to John Smith at Acme Corp thanking them for the partnership meeting"

→ Create content JSON with recipient info, warm body paragraphs, and closing. Use `--type letter`.

### Proposal document
User: "Create a ConnexUS proposal for the RAGbox implementation project"

→ Create content JSON with structured body (heading + paragraph + bullet blocks). Use `--type proposal`.

### General document
User: "Draft a ConnexUS AI document outlining our Q1 roadmap"

→ Create content JSON with headings, paragraphs, and tables. Use `--type general`.
