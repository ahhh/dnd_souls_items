#!/usr/bin/env python3
"""
Scrape weapon / armor / item data from the Dark Souls and Elden Ring Fandom wikis
into data/items.json.

Uses the MediaWiki API only (the rendered HTML endpoints are 403 for scripts).
For every page we keep: name, game, souls class, infobox fields (requirements,
scaling grades, weight, effects, skill) and the in-game item description.

Usage:  python3 tools/scrape.py [--out data/items.json] [--limit N]
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

UA = (
    "souls-dnd-items/1.0 (static item generator; contact via GitHub) "
    "python-urllib"
)

DS = "darksouls.fandom.com"
ER = "eldenring.fandom.com"

# (wiki, category, kind, souls_class)
#   kind: weapon | shield | catalyst | armor | ring | talisman | item
SOURCES = [
    # ---------- Dark Souls: weapons ----------
    (DS, "Dark Souls: Daggers", "weapon", "Dagger"),
    (DS, "Dark Souls: Straight Swords", "weapon", "Straight Sword"),
    (DS, "Dark Souls: Greatswords", "weapon", "Greatsword"),
    (DS, "Dark Souls: Ultra Greatswords", "weapon", "Ultra Greatsword"),
    (DS, "Dark Souls: Curved Swords", "weapon", "Curved Sword"),
    (DS, "Dark Souls: Curved Greatswords", "weapon", "Curved Greatsword"),
    (DS, "Dark Souls: Katanas", "weapon", "Katana"),
    (DS, "Dark Souls: Thrusting Swords", "weapon", "Thrusting Sword"),
    (DS, "Dark Souls: Axes", "weapon", "Axe"),
    (DS, "Dark Souls: Greataxes", "weapon", "Greataxe"),
    (DS, "Dark Souls: Hammers", "weapon", "Hammer"),
    (DS, "Dark Souls: Great Hammers", "weapon", "Great Hammer"),
    (DS, "Dark Souls: Spears", "weapon", "Spear"),
    (DS, "Dark Souls: Halberds", "weapon", "Halberd"),
    (DS, "Dark Souls: Whips", "weapon", "Whip"),
    (DS, "Dark Souls: Bows", "weapon", "Bow"),
    (DS, "Dark Souls: Crossbows", "weapon", "Crossbow"),
    # ---------- Dark Souls: shields & casting tools ----------
    (DS, "Dark Souls: Small Shields", "shield", "Small Shield"),
    (DS, "Dark Souls: Medium Shields", "shield", "Medium Shield"),
    (DS, "Dark Souls: Greatshields", "shield", "Greatshield"),
    (DS, "Dark Souls: Catalysts", "catalyst", "Catalyst"),
    (DS, "Dark Souls: Talismans", "catalyst", "Talisman"),
    # ---------- Dark Souls: armor ----------
    (DS, "Dark Souls: Head Armor", "armor", "Helm"),
    (DS, "Dark Souls: Chest Armor", "armor", "Chest"),
    (DS, "Dark Souls: Hands Armor", "armor", "Gauntlets"),
    (DS, "Dark Souls: Legs Armor", "armor", "Leggings"),
    # ---------- Dark Souls: trinkets & sundries ----------
    (DS, "Dark Souls: Rings", "ring", "Ring"),
    (DS, "Dark Souls: Miscellaneous Items", "item", "Curio"),
    (DS, "Dark Souls: Restorative Items", "item", "Restorative"),
    (DS, "Dark Souls: Offensive Items", "item", "Offensive"),
    (DS, "Dark Souls: Key Items", "item", "Key Item"),
    (DS, "Dark Souls: Upgrade Materials", "item", "Upgrade Material"),
    (DS, "Dark Souls: Embers", "item", "Ember"),
    (DS, "Dark Souls: Souls", "item", "Soul"),

    # ---------- Elden Ring: weapons ----------
    (ER, "Daggers", "weapon", "Dagger"),
    (ER, "Straight Swords", "weapon", "Straight Sword"),
    (ER, "Greatswords", "weapon", "Greatsword"),
    (ER, "Colossal Swords", "weapon", "Colossal Sword"),
    (ER, "Light Greatswords", "weapon", "Light Greatsword"),
    (ER, "Thrusting Swords", "weapon", "Thrusting Sword"),
    (ER, "Heavy Thrusting Swords", "weapon", "Heavy Thrusting Sword"),
    (ER, "Curved Swords", "weapon", "Curved Sword"),
    (ER, "Curved Greatswords", "weapon", "Curved Greatsword"),
    (ER, "Katanas", "weapon", "Katana"),
    (ER, "Great Katanas", "weapon", "Great Katana"),
    (ER, "Twinblades", "weapon", "Twinblade"),
    (ER, "Backhand Blades", "weapon", "Backhand Blade"),
    (ER, "Axes", "weapon", "Axe"),
    (ER, "Greataxes", "weapon", "Greataxe"),
    (ER, "Hammers", "weapon", "Hammer"),
    (ER, "Great Hammers", "weapon", "Great Hammer"),
    (ER, "Flails", "weapon", "Flail"),
    (ER, "Colossal Weapons", "weapon", "Colossal Weapon"),
    (ER, "Spears", "weapon", "Spear"),
    (ER, "Great Spears", "weapon", "Great Spear"),
    (ER, "Halberds", "weapon", "Halberd"),
    (ER, "Reapers", "weapon", "Reaper"),
    (ER, "Whips", "weapon", "Whip"),
    (ER, "Fists", "weapon", "Fist"),
    (ER, "Claws", "weapon", "Claw"),
    (ER, "Beast Claws", "weapon", "Beast Claw"),
    (ER, "Hand-to-Hand", "weapon", "Hand-to-Hand Art"),
    (ER, "Perfume Bottles", "weapon", "Perfume Bottle"),
    (ER, "Light Bows", "weapon", "Light Bow"),
    (ER, "Bows", "weapon", "Bow"),
    (ER, "Greatbows", "weapon", "Greatbow"),
    (ER, "Crossbows", "weapon", "Crossbow"),
    (ER, "Ballistas", "weapon", "Ballista"),
    (ER, "Torches", "weapon", "Torch"),
    # ---------- Elden Ring: shields & catalysts ----------
    (ER, "Small Shields", "shield", "Small Shield"),
    (ER, "Medium Shields", "shield", "Medium Shield"),
    (ER, "Greatshields", "shield", "Greatshield"),
    (ER, "Thrusting Shields", "shield", "Thrusting Shield"),
    (ER, "Glintstone Staves", "catalyst", "Glintstone Staff"),
    (ER, "Sacred Seals", "catalyst", "Sacred Seal"),
    # ---------- Elden Ring: armor ----------
    (ER, "Head", "armor", "Helm"),
    (ER, "Chest", "armor", "Chest"),
    (ER, "Arms", "armor", "Gauntlets"),
    (ER, "Legs", "armor", "Leggings"),
    # ---------- Elden Ring: trinkets & sundries ----------
    (ER, "Talismans", "ring", "Talisman"),
    (ER, "Crafting Materials", "item", "Crafting Material"),
    (ER, "Grease", "item", "Grease"),
    (ER, "Great Runes", "item", "Great Rune"),
    (ER, "Golden Runes", "item", "Rune"),
    (ER, "Ashes of War", "item", "Ash of War"),
]

# Pages that are category indexes / disambiguation rather than real items.
STOP_EXACT = {
    "Weapons", "Shields", "Armor", "Ammunition", "Skill", "Flask",
    "Upgrade Materials", "Talismans", "Crafting Materials", "Greases",
    "Ashes of War", "Great Runes", "Golden Runes", "Bell Bearings",
    "Cookbooks", "Armor Sets", "Staves", "Consumables", "Head", "Chest",
    "Arms", "Legs",
}
STOP_RE = re.compile(
    r"""^(
        .*\(Shadow\ of\ the\ Erdtree\)$
      | .*\(Altered\)$
      | .*\ Set$
      | .*\ Sets$
      | .*\(disambiguation\)$
      | .*\(Dark\ Souls\ I{1,3}\)$
      | .*\(Dark\ Souls\ III\)$
      | Category:.*
    )$""",
    re.X,
)


# --------------------------------------------------------------------------
# API plumbing
# --------------------------------------------------------------------------

def api(host, params, retries=4):
    params = dict(params)
    params["format"] = "json"
    params["formatversion"] = "1"
    url = f"https://{host}/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    last = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001 - retry on anything transient
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"API failed for {url}: {last}")


def category_members(host, cat):
    out, cont = [], None
    while True:
        p = {
            "action": "query", "list": "categorymembers",
            "cmtitle": f"Category:{cat}", "cmlimit": "500", "cmnamespace": "0",
        }
        if cont:
            p["cmcontinue"] = cont
        d = api(host, p)
        out += [m["title"] for m in d.get("query", {}).get("categorymembers", [])]
        cont = d.get("continue", {}).get("cmcontinue")
        if not cont:
            return out


def batched(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def fetch_wikitext(host, titles):
    """title -> raw wikitext"""
    out = {}
    for chunk in batched(titles, 20):
        d = api(host, {
            "action": "query", "prop": "revisions", "rvprop": "content",
            "rvslots": "main", "titles": "|".join(chunk),
        })
        pages = d.get("query", {}).get("pages", {})
        norm = {n["from"]: n["to"] for n in d.get("query", {}).get("normalized", [])}
        for p in (pages.values() if isinstance(pages, dict) else pages):
            if "revisions" not in p:
                continue
            try:
                out[p["title"]] = p["revisions"][0]["slots"]["main"]["*"]
            except (KeyError, IndexError):
                pass
        for frm, to in norm.items():
            if to in out and frm not in out:
                out[frm] = out[to]
    return out


def fetch_images(host, titles, size=400):
    """title -> thumbnail URL"""
    out = {}
    for chunk in batched(titles, 50):
        d = api(host, {
            "action": "query", "prop": "pageimages", "piprop": "thumbnail",
            "pithumbsize": str(size), "pilimit": "50", "titles": "|".join(chunk),
        })
        pages = d.get("query", {}).get("pages", {})
        for p in (pages.values() if isinstance(pages, dict) else pages):
            thumb = p.get("thumbnail", {}).get("source")
            if thumb:
                out[p["title"]] = thumb
    return out


# --------------------------------------------------------------------------
# Wikitext parsing
# --------------------------------------------------------------------------

def find_template(text, name_pattern):
    """Return the inner body of the first {{Template ...}} whose name matches."""
    for m in re.finditer(r"\{\{\s*(" + name_pattern + r")\s*[\|\}]", text, re.I):
        start = m.start()
        depth, i = 0, start
        while i < len(text) - 1:
            two = text[i:i + 2]
            if two == "{{":
                depth += 1
                i += 2
                continue
            if two == "}}":
                depth -= 1
                i += 2
                if depth == 0:
                    return text[start + 2:i - 2]
                continue
            i += 1
        return text[start + 2:]
    return None


def split_params(body):
    """Split a template body on top-level pipes."""
    parts, depth_c, depth_b, buf = [], 0, 0, []
    i = 0
    while i < len(body):
        two = body[i:i + 2]
        if two == "{{":
            depth_c += 1; buf.append(two); i += 2; continue
        if two == "}}":
            depth_c -= 1; buf.append(two); i += 2; continue
        if two == "[[":
            depth_b += 1; buf.append(two); i += 2; continue
        if two == "]]":
            depth_b -= 1; buf.append(two); i += 2; continue
        ch = body[i]
        if ch == "|" and depth_c == 0 and depth_b == 0:
            parts.append("".join(buf)); buf = []; i += 1; continue
        buf.append(ch); i += 1
    parts.append("".join(buf))
    return parts


def parse_params(body):
    if body is None:
        return {}
    out = {}
    for part in split_params(body)[1:]:
        if "=" not in part:
            continue
        k, v = part.split("=", 1)
        out[k.strip().lower()] = v.strip()
    return out


LINK_RE = re.compile(r"\[\[(?:[^\]\|]*\|)?([^\]\|]*)\]\]")
HTMLTAG_RE = re.compile(r"<[^>]+>")
TMPL_RE = re.compile(r"\{\{[^{}]*\}\}")


def clean(s):
    """Strip wiki markup down to readable prose."""
    if not s:
        return ""
    s = LINK_RE.sub(r"\1", s)
    for _ in range(3):
        s = TMPL_RE.sub(" ", s)
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = HTMLTAG_RE.sub("", s)
    s = s.replace("'''", "").replace("''", "")
    s = s.replace("&mdash;", "-").replace("&nbsp;", " ").replace("&amp;", "&")
    s = re.sub(r"\s+", " ", s)
    return s.strip(" \t\n-*:")


def parse_description(text):
    """The in-game item description, as a list of paragraphs."""
    body = find_template(text, r"Description")
    if not body:
        return []
    params = parse_params(body)
    lines = []
    # Elden Ring: EN_line1..N   |  Dark Souls: First/Second/Third paragraph
    keys = [k for k in params if re.fullmatch(r"en_line\d+", k)]
    keys.sort(key=lambda k: int(re.search(r"\d+", k).group()))
    if not keys:
        order = ["first paragraph", "second paragraph", "third paragraph",
                 "fourth paragraph", "fifth paragraph"]
        keys = [k for k in order if k in params]
    for k in keys:
        c = clean(params[k])
        if c and not c.lower().startswith(("unique skill", "skill:")):
            lines.append(c)
    return lines


def grade(v):
    """Scaling grade letter, or None."""
    if not v:
        return None
    v = clean(v).strip().upper()
    m = re.match(r"^(S|A|B|C|D|E)\b", v)
    return m.group(1) if m else None


def num(v):
    if not v:
        return None
    m = re.search(r"-?\d+(?:\.\d+)?", clean(v))
    return float(m.group()) if m else None


DISAMBIG_RE = re.compile(
    r"\s*\((?:weapon|shield|armor|ring|item|Dark Souls|Elden Ring|"
    r"consumable|spell|Shadow of the Erdtree)\)$", re.I)


def display_name(title):
    return DISAMBIG_RE.sub("", title).strip()


def parse_page(title, text, game, kind, souls_class):
    infobox = (find_template(text, r"Infobox\s+Weapon|Weapon|Infobox\s+Armor|Armor|"
                                   r"Infobox\s+Talisman|Talisman|Ring|Infobox\s+Item|Item")
               or "")
    p = parse_params(infobox)

    def g(*keys):
        for k in keys:
            if k in p and clean(p[k]) not in ("", "-", "—"):
                return p[k]
        return None

    name = display_name(title)
    rec = {
        "name": name,
        "game": game,
        "kind": kind,
        "class": souls_class,
        "desc": parse_description(text),
    }
    if name != title:
        rec["page"] = title  # keep the real wiki title for the source link

    # Requirements (Elden Ring uses *_req, Dark Souls uses *-req)
    reqs = {}
    for stat, keys in (
        ("str", ("str_req", "str-req")),
        ("dex", ("dex_req", "dex-req")),
        ("int", ("int_req", "int-req")),
        ("fai", ("fai_req", "fth-req", "fth_req")),
        ("arc", ("arc_req",)),
    ):
        n = num(g(*keys))
        if n:
            reqs[stat] = int(n)
    if reqs:
        rec["req"] = reqs

    # Scaling grades
    scale = {}
    for stat, keys in (
        ("str", ("str_scale", "str-bonus")),
        ("dex", ("dex_scale", "dex-bonus")),
        ("int", ("int_scale", "int-bonus")),
        ("fai", ("fai_scale", "fth-bonus")),
        ("arc", ("arc_scale",)),
    ):
        gr = grade(g(*keys))
        if gr:
            scale[stat] = gr
    if scale:
        rec["scale"] = scale

    # Elemental attack power -> which damage types this thing natively deals
    elems = []
    for elem, keys in (
        ("magic", ("magic_power", "atk-magic")),
        ("fire", ("fire_power", "atk-fire")),
        ("lightning", ("lightning_power", "atk-lightning")),
        ("holy", ("holy_power",)),
    ):
        n = num(g(*keys))
        if n and n > 0:
            elems.append(elem)
    if elems:
        rec["elem"] = elems

    w = num(g("weight"))
    if w is not None:
        rec["wt"] = w

    for field, keys in (
        ("atkType", ("attack_type", "atk-type")),
        ("skill", ("skills", "skill")),
        ("effects", ("effects", "effect")),
        ("weightClass", ("weight-class", "weight_class")),
        ("poise", ("poise",)),
    ):
        v = g(*keys)
        if v:
            c = clean(v)
            if c:
                rec[field] = c

    return rec


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/items.json")
    ap.add_argument("--limit", type=int, default=0,
                    help="cap pages per category (for quick test runs)")
    args = ap.parse_args()

    by_wiki = {}
    for host, cat, kind, cls in SOURCES:
        by_wiki.setdefault(host, []).append((cat, kind, cls))

    records = {}   # (game, name) -> record
    for host, cats in by_wiki.items():
        game = "ds" if host == DS else "er"
        # 1. enumerate
        wanted = {}   # title -> (kind, class)
        for cat, kind, cls in cats:
            try:
                titles = category_members(host, cat)
            except Exception as e:  # noqa: BLE001
                print(f"  !! {cat}: {e}", file=sys.stderr)
                continue
            keep = []
            for t in titles:
                base = re.sub(r"\s*\(.*\)$", "", t)
                if t in STOP_EXACT or base in STOP_EXACT or STOP_RE.match(t):
                    continue
                if t.lower() == cat.lower() or base.lower() == cat.lower():
                    continue
                keep.append(t)
            if args.limit:
                keep = keep[:args.limit]
            for t in keep:
                wanted.setdefault(t, (kind, cls))
            print(f"  {game}  {len(keep):4d}  {cat}", file=sys.stderr)

        titles = sorted(wanted)
        print(f"[{game}] fetching {len(titles)} pages...", file=sys.stderr)

        # 2. wikitext
        text = fetch_wikitext(host, titles)
        print(f"[{game}] got wikitext for {len(text)}", file=sys.stderr)

        # 3. images
        imgs = fetch_images(host, titles)
        print(f"[{game}] got images for {len(imgs)}", file=sys.stderr)

        # 4. parse
        for t in titles:
            if t not in text:
                continue
            kind, cls = wanted[t]
            rec = parse_page(t, text[t], game, kind, cls)
            if t in imgs:
                rec["img"] = imgs[t]
            records[(game, t)] = rec

    items = [records[k] for k in sorted(records)]

    # Trim the noisiest fields and drop pages with nothing usable.
    items = [i for i in items if i.get("desc") or i.get("img") or i.get("req")]

    out = {
        "generated": time.strftime("%Y-%m-%d"),
        "sources": {
            "ds": "https://darksouls.fandom.com/wiki/Dark_Souls_Wiki",
            "er": "https://eldenring.fandom.com/wiki/Elden_Ring_Wiki",
        },
        "license": "Fandom text is CC BY-SA 3.0. Images are game assets used for reference.",
        "items": items,
    }
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    kinds = {}
    for i in items:
        kinds[i["kind"]] = kinds.get(i["kind"], 0) + 1
    print(f"\nwrote {len(items)} items -> {args.out}", file=sys.stderr)
    for k, v in sorted(kinds.items()):
        print(f"  {v:5d}  {k}", file=sys.stderr)
    withimg = sum(1 for i in items if i.get("img"))
    withdesc = sum(1 for i in items if i.get("desc"))
    print(f"  {withimg} with art, {withdesc} with description", file=sys.stderr)


if __name__ == "__main__":
    main()
