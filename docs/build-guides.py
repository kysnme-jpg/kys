#!/usr/bin/env python3
"""Build a polished printable HTML page (and PDF) from the Markdown guides.

Usage:  python3 docs/build-guides.py
Outputs: docs/guides.html  and  docs/ConsignPro-Guides.pdf
Regenerate this whenever USER_GUIDE.md / ADMIN_GUIDE.md change.
"""
import os, re, subprocess, datetime, markdown

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

GUIDES = [
    ("USER_GUIDE.md", "User Guide", "For store staff"),
    ("ADMIN_GUIDE.md", "Admin &amp; Operations Guide", "For the owner / administrator"),
]

def render_md(path):
    with open(os.path.join(HERE, path), encoding="utf-8") as f:
        text = f.read()
    # Drop the first H1 (we render our own section title) and the leading blockquote note.
    md = markdown.Markdown(extensions=["extra", "tables", "fenced_code", "toc", "sane_lists"])
    html = md.convert(text)
    toc = md.toc_tokens
    # checkbox list items
    html = html.replace("[ ]", "&#9744;").replace("[x]", "&#9745;").replace("[X]", "&#9745;")
    return html, toc

def toc_html(toc_tokens):
    """Build a nested TOC from h2/h3."""
    out = ["<ul class='toc'>"]
    for t in toc_tokens:              # h1 level produced by markdown toc
        for s in t.get("children", []):   # h2
            out.append(f"<li><a href='#{s['id']}'>{s['name']}</a>")
            subs = s.get("children", [])
            if subs:
                out.append("<ul>")
                for ss in subs:
                    out.append(f"<li><a href='#{ss['id']}'>{ss['name']}</a></li>")
                out.append("</ul>")
            out.append("</li>")
    out.append("</ul>")
    return "\n".join(out)

sections = []
toc_sections = []
for i, (path, title, sub) in enumerate(GUIDES):
    html, toc = render_md(path)
    anchor = "user" if "USER" in path else "admin"
    sections.append(f"""
    <section class="guide" id="{anchor}">
      <div class="guide-head">
        <span class="kicker">ConsignPro</span>
        <h1>{title}</h1>
        <p class="subtitle">{sub}</p>
      </div>
      {html}
    </section>""")
    toc_sections.append(f"<div class='toc-col'><h3><a href='#{anchor}'>{title}</a></h3>{toc_html(toc)}</div>")

today = datetime.date.today().strftime("%B %Y")

CSS = """
:root{--ink:#1f2937;--muted:#6b7280;--brand:#4f46e5;--brand-soft:#eef2ff;--line:#e5e7eb;--code:#f3f4f6;}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--ink);line-height:1.6;margin:0;background:#f8fafc}
.page{max-width:820px;margin:0 auto;background:#fff;padding:56px 64px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.cover{min-height:88vh;display:flex;flex-direction:column;justify-content:center;border-bottom:none}
.cover .logo{width:64px;height:64px;border-radius:16px;background:var(--brand);display:flex;align-items:center;justify-content:center;color:#fff;font-size:30px;margin-bottom:28px}
.cover h1{font-size:44px;line-height:1.1;margin:0 0 10px;letter-spacing:-.02em}
.cover .tag{color:var(--muted);font-size:18px;margin:0 0 40px}
.cover .meta{color:var(--muted);font-size:14px;border-top:1px solid var(--line);padding-top:18px}
.cover .meta b{color:var(--ink)}
.toc-wrap{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:40px}
.toc-col h3{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:var(--brand);margin:0 0 10px}
.toc-col h3 a{color:var(--brand);text-decoration:none}
ul.toc{list-style:none;padding:0;margin:0;font-size:13.5px}
ul.toc li{margin:3px 0}
ul.toc ul{list-style:none;padding-left:14px;color:var(--muted)}
ul.toc a{color:var(--ink);text-decoration:none}
ul.toc ul a{color:var(--muted)}
.guide{padding-top:8px}
.guide-head{border-bottom:3px solid var(--brand);padding-bottom:16px;margin-bottom:24px}
.kicker{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--brand);background:var(--brand-soft);padding:4px 10px;border-radius:999px}
.guide-head h1{font-size:32px;margin:14px 0 4px;letter-spacing:-.01em}
.guide-head .subtitle{color:var(--muted);margin:0;font-size:15px}
h2{font-size:21px;margin:30px 0 10px;padding-top:6px;border-top:1px solid var(--line)}
h2:first-of-type{border-top:none}
h3{font-size:16px;margin:20px 0 8px}
p,li{font-size:14.5px}
a{color:var(--brand)}
code{background:var(--code);padding:1.5px 5px;border-radius:5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px}
pre{background:var(--code);padding:14px 16px;border-radius:10px;overflow:auto;font-size:12.5px}
pre code{background:none;padding:0}
table{border-collapse:collapse;width:100%;margin:14px 0;font-size:13.5px}
th,td{border:1px solid var(--line);padding:8px 11px;text-align:left;vertical-align:top}
th{background:var(--brand-soft);font-weight:600}
tr:nth-child(even) td{background:#fafafa}
blockquote{margin:16px 0;padding:12px 16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;color:#78350f;font-size:13.5px}
blockquote p{margin:4px 0}
hr{border:none;border-top:1px solid var(--line);margin:28px 0}
ul,ol{padding-left:22px}
li{margin:3px 0}
@media print{
  body{background:#fff}
  .page{box-shadow:none;max-width:none;padding:0}
  .cover{min-height:auto;page-break-after:always;padding-top:40px}
  .guide{page-break-before:always}
  h2,h3{page-break-after:avoid}
  table,pre,blockquote,tr{page-break-inside:avoid}
  a{color:var(--ink);text-decoration:none}
}
@page{size:letter;margin:16mm 16mm}
"""

doc = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ConsignPro — Guides</title>
<style>{CSS}</style></head>
<body><div class="page">
  <div class="cover">
    <div class="logo">&#128717;</div>
    <h1>ConsignPro</h1>
    <p class="tag">Consignment Point of Sale &amp; Store Management</p>
    <p class="tag" style="font-size:22px;color:var(--ink);font-weight:600;margin-bottom:8px">User &amp; Admin Guides</p>
    <div class="toc-wrap">{''.join(toc_sections)}</div>
    <div class="meta">Updated <b>{today}</b> &nbsp;·&nbsp; Includes the Staff User Guide and the Owner/Admin Guide</div>
  </div>
  {''.join(sections)}
</div></body></html>"""

out_html = os.path.join(HERE, "guides.html")
with open(out_html, "w", encoding="utf-8") as f:
    f.write(doc)
print("wrote", out_html)

out_pdf = os.path.join(HERE, "ConsignPro-Guides.pdf")
subprocess.run([
    CHROME, "--headless", "--disable-gpu", "--no-sandbox",
    "--no-pdf-header-footer", f"--print-to-pdf={out_pdf}", f"file://{out_html}",
], check=True, capture_output=True)
print("wrote", out_pdf)
