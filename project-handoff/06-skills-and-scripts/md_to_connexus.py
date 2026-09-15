"""Convert markdown to ConnexUS content JSON schema."""
import json
import re
import sys

def parse_markdown(md_text):
    lines = md_text.split('\n')
    blocks = []
    i = 0
    n = len(lines)

    # Skip the H1 title (we pass it via --title)
    # Skip front-matter (author/date/version block) - render as paragraphs after stripping bold markers? Actually keep them.

    in_code = False
    code_lang = ""
    code_buf = []

    while i < n:
        line = lines[i]
        stripped = line.strip()

        # Code fence
        if stripped.startswith("```"):
            if not in_code:
                in_code = True
                code_lang = stripped[3:].strip()
                code_buf = []
            else:
                # End code block - render as paragraph with preserved formatting
                # Use a paragraph with line breaks preserved via separate paragraphs
                code_text = '\n'.join(code_buf)
                # Replace with a "diagram" paragraph - use bullet list for tree-like structures
                blocks.append({"type": "paragraph", "text": "[Diagram — see source document for ASCII tree]"})
                blocks.append({"type": "bullet", "items": [l for l in code_buf if l.strip() and not l.strip().startswith('│') and not l.strip().startswith('└') and not l.strip().startswith('├')]})
                in_code = False
            i += 1
            continue

        if in_code:
            code_buf.append(line)
            i += 1
            continue

        # H1 — skip (title goes via --title); but emit as section header if not first
        if stripped.startswith("# "):
            text = stripped[2:].strip()
            if i > 5:  # not the document title
                blocks.append({"type": "pagebreak"})
                blocks.append({"type": "heading", "level": 1, "text": text})
            i += 1
            continue

        # H2
        if stripped.startswith("## "):
            text = stripped[3:].strip()
            blocks.append({"type": "heading", "level": 1, "text": text})
            i += 1
            continue

        # H3
        if stripped.startswith("### "):
            text = stripped[4:].strip()
            blocks.append({"type": "heading", "level": 2, "text": text})
            i += 1
            continue

        # H4+
        if stripped.startswith("#### "):
            text = stripped[5:].strip()
            blocks.append({"type": "heading", "level": 3, "text": text})
            i += 1
            continue

        # Horizontal rule — skip
        if stripped == "---" or stripped == "***":
            i += 1
            continue

        # Table
        if stripped.startswith("|") and i + 1 < n and re.match(r"^\|[\s\-:|]+\|$", lines[i+1].strip()):
            # Parse header
            headers = [c.strip() for c in stripped.strip("|").split("|")]
            i += 2  # skip separator
            rows = []
            while i < n and lines[i].strip().startswith("|"):
                row = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                # Pad/truncate to match header count
                if len(row) < len(headers):
                    row += [""] * (len(headers) - len(row))
                elif len(row) > len(headers):
                    row = row[:len(headers)]
                rows.append(row)
                i += 1
            blocks.append({"type": "table", "headers": headers, "rows": rows})
            continue

        # Bullet list
        if re.match(r"^\s*[-*]\s+", line):
            items = []
            while i < n:
                m = re.match(r"^\s*[-*]\s+(.*)$", lines[i])
                if m:
                    items.append(m.group(1).strip())
                    i += 1
                elif lines[i].strip() == "":
                    # Allow blank line within list? Stop list.
                    break
                elif re.match(r"^\s{2,}\S", lines[i]) and items:
                    # Continuation - append to last item
                    items[-1] += " " + lines[i].strip()
                    i += 1
                else:
                    break
            if items:
                blocks.append({"type": "bullet", "items": items})
            continue

        # Numbered list
        if re.match(r"^\s*\d+\.\s+", line):
            items = []
            while i < n:
                m = re.match(r"^\s*\d+\.\s+(.*)$", lines[i])
                if m:
                    items.append(m.group(1).strip())
                    i += 1
                elif lines[i].strip() == "":
                    break
                elif re.match(r"^\s{2,}\S", lines[i]) and items:
                    items[-1] += " " + lines[i].strip()
                    i += 1
                else:
                    break
            if items:
                blocks.append({"type": "numbered", "items": items})
            continue

        # Blank line — paragraph break
        if stripped == "":
            i += 1
            continue

        # Regular paragraph — collect consecutive non-blank lines
        para_lines = [stripped]
        i += 1
        while i < n:
            nxt = lines[i].strip()
            if nxt == "" or nxt.startswith("#") or nxt.startswith("|") or nxt.startswith("```") \
               or re.match(r"^[-*]\s+", nxt) or re.match(r"^\d+\.\s+", nxt) or nxt == "---":
                break
            para_lines.append(nxt)
            i += 1
        paragraph_text = " ".join(para_lines)
        # Strip markdown bold/italic for paragraph rendering (docx skill doesn't support inline formatting)
        # Keep the text; docx skill will render literally
        blocks.append({"type": "paragraph", "text": paragraph_text})

    return blocks


if __name__ == "__main__":
    md_path = sys.argv[1]
    out_path = sys.argv[2]
    with open(md_path) as f:
        md = f.read()
    blocks = parse_markdown(md)

    # Strip the front-matter "Author:/CEO:/..." paragraphs at the top — render as a clean cover block
    # Find first heading; everything before is front matter
    cover_paras = []
    body_blocks = []
    saw_heading = False
    for b in blocks:
        if not saw_heading and b.get("type") == "heading":
            saw_heading = True
        if not saw_heading and b.get("type") == "paragraph":
            cover_paras.append(b["text"])
        else:
            body_blocks.append(b)

    # Build final structure
    final = {
        "date": "May 13, 2026",
        "body": [{"type": "paragraph", "text": p} for p in cover_paras] + body_blocks,
        "closing": "Respectfully submitted,",
        "signer_name": "Walter White",
        "signer_title": "Liaison to David Pierce"
    }

    with open(out_path, "w") as f:
        json.dump(final, f, indent=2)
    print(f"Wrote {out_path} with {len(final['body'])} body blocks")
