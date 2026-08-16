#!/usr/bin/env python3
"""
Build index.html: inline the CSS, the JS and the compacted item data into a
single self-contained page that GitHub Pages (or a file:// open) can serve.

Usage:  python3 tools/build.py
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TEMPLATE = os.path.join(ROOT, "src", "index.template.html")
CSS = os.path.join(ROOT, "src", "styles.css")
JS = os.path.join(ROOT, "src", "app.js")
DATA = os.path.join(ROOT, "data", "items.json")
OUT = os.path.join(ROOT, "index.html")

# Categories that make dull table items — mostly bulk currency.
DROP_CLASSES = {"Rune"}

IMG_RE = re.compile(
    r"^https://static\.wikia\.nocookie\.net/(?:darksouls|eldenring)/images/"
    r"(.+?)/revision/latest(?:/scale-to-width-down/\d+)?(?:\?cb=(\d+))?$"
)


def compact_img(url):
    """Store just the path + cache-buster; app.js rebuilds the full URL."""
    if not url:
        return None
    m = IMG_RE.match(url)
    if not m:
        return None
    path, cb = m.group(1), m.group(2)
    return path + ("?" + cb if cb else "")


def compact(items):
    out = []
    for it in items:
        if it.get("class") in DROP_CLASSES:
            continue
        rec = {
            "name": it["name"],
            "game": it["game"],
            "kind": it["kind"],
            "class": it["class"],
        }
        if it.get("page"):
            rec["page"] = it["page"]
        img = compact_img(it.get("img"))
        if img:
            rec["img"] = img
        desc = [d for d in it.get("desc", []) if d]
        # Two paragraphs is plenty for a card; the third is usually skill text.
        if desc:
            rec["desc"] = desc[:2]
        for k in ("req", "scale", "elem", "wt", "atkType", "skill", "effects",
                  "weightClass"):
            if it.get(k):
                rec[k] = it[k]
        out.append(rec)
    return out


def main():
    for path in (TEMPLATE, CSS, JS, DATA):
        if not os.path.exists(path):
            sys.exit(f"missing: {path}")

    with open(DATA, encoding="utf-8") as f:
        raw = json.load(f)

    items = compact(raw["items"])
    data_js = json.dumps({"items": items}, ensure_ascii=False,
                         separators=(",", ":"))

    css = open(CSS, encoding="utf-8").read()
    js = open(JS, encoding="utf-8").read()
    html = open(TEMPLATE, encoding="utf-8").read()

    # </script> inside a string literal would close the inline script tag.
    data_js = data_js.replace("</", "<\\/")

    for token, payload in (("/*__CSS__*/", css),
                           ("/*__DATA__*/", data_js),
                           ("/*__JS__*/", js)):
        if token not in html:
            sys.exit(f"template is missing {token}")
        html = html.replace(token, payload)

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)

    size = os.path.getsize(OUT)
    art = sum(1 for i in items if i.get("img"))
    lore = sum(1 for i in items if i.get("desc"))
    print(f"wrote {OUT}")
    print(f"  {len(items)} items ({art} with art, {lore} with descriptions)")
    print(f"  {size/1024:.0f} KB uncompressed")


if __name__ == "__main__":
    main()
