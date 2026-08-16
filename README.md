# Souls Forge

A random **D&D 5e (2014)** item generator in the flavor of **Dark Souls** and **Elden Ring**,
in the spirit of [Mork_Items](https://github.com/ahhh/Mork_Items).

Every roll starts from a *real* armament, armor piece, ring or curio — 2,059 of them, scraped
from the two Fandom wikis with their artwork, their in-game description, and their actual
stat requirements, scaling grades and status effects. Those Souls numbers then drive the 5e
conversion, so the results feel like they came out of the games rather than off a random table.

**The whole app is one self-contained `index.html`.** No build tooling, no dependencies,
no server. Drop it on GitHub Pages and it works.

---

## What it does with the Souls data

The conversion is not cosmetic. The wiki data actually decides the 5e stat block:

| From the game | Becomes in 5e |
|---|---|
| Weapon class (Katana, Colossal Sword, Reaper…) | A PHB weapon profile — damage die, damage type, properties |
| STR / DEX requirement | An ability-score requirement, with disadvantage below it |
| Scaling grades (S–E) | A DEX-scaling weapon gains **finesse**; INT/FAI/ARC scaling biases which infusion it gets |
| `Causes blood loss buildup` | A **Blood Loss** rider — hemorrhage damage on the third hit |
| Frostbite / Scarlet Rot / Sleep / Madness / Death Blight | The matching 5e save-or-suffer rider |
| Native magic / fire / lightning / holy damage | Biases the infusion roll toward that element |
| The weapon's real Ash of War or Weapon Art | An activated ability with charges, named after the actual skill |
| Armor weight class | Light / medium / heavy 5e armor (padded through plate) |
| A ring's effect text | A matched 5e benefit — "boosts equipment load" becomes doubled carrying capacity |

So the Moonveil that comes out of the generator is a finesse katana that scales with
Intelligence, tends to roll a glintstone infusion, carries a bleed rider, and has an activated
art called *Transient Moonlight*. Because that is what Moonveil is.

## Controls

- **What to forge** — weapon, armor, shield, catalyst, ring, curio, or any
- **Source** — Dark Souls, Elden Ring, or both
- **Rarity** — roll it, or pin it from common to legendary
- **Magic items** — master switch; off gives you mundane gear only
- **Infusions & affinities** — Fire, Chaos, Lightning, Magic, Moonlight, Crystal, Divine,
  Sacred, Occult, Blood, Frost, Poison, Rotten, Raw, Keen, Heavy, Flame Art
- **Weapon arts** — turn the item's real skill into an activated ability
- **Curses** — 18 of them, drawn from the games' own curse mechanics (halved HP, hollowing,
  bound-to-your-hand, abyssal hunger). A cursed item visibly corrupts the card.
- **How many** — 1, 3, 5 or 10 at a time, for stocking a hoard

`Space` forges another. **Copy** gives you a plain-text stat block to paste into notes.
**Copy permalink** gives you a URL that rebuilds the exact same items — every item has a seed,
so anything you roll can be shared or bookmarked.

---

## Hosting it on GitHub Pages

`index.html` is the entire site. Nothing needs building on GitHub's side.

```bash
cd souls-dnd-items
git init
git add .
git commit -m "Souls Forge"
git branch -M main
git remote add origin git@github.com:YOUR_NAME/souls-dnd-items.git
git push -u origin main
```

Then: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save.**

It goes live at `https://YOUR_NAME.github.io/souls-dnd-items/` in a minute or so.

To try it locally first, just open `index.html` in a browser — it works from `file://`
because everything is inlined.

---

## Repo layout

```
index.html                 the built, self-contained app — this is what gets hosted
data/items.json            the scraped dataset (source of truth, 2,093 entries)
src/index.template.html    page shell
src/styles.css             styles
src/app.js                 the generator: 5e profiles, infusions, boons, curses, rendering
tools/scrape.py            rebuilds data/items.json from the two wikis
tools/build.py             inlines src/ + data/ into index.html
```

### Rebuilding

Edit anything under `src/`, then:

```bash
python3 tools/build.py
```

To re-pull the wikis (only needed if the source data changes — takes a few minutes):

```bash
python3 tools/scrape.py        # writes data/items.json
python3 tools/build.py         # writes index.html
```

Both scripts are stdlib-only Python 3. No pip install.

### Adding your own content

Almost everything interesting lives in a table near the top of `src/app.js`:

- `WEAPONS` / `SHIELDS` / `CATALYSTS` / `ARMORS` — the 5e profiles per Souls class
- `INFUSIONS` — the elemental affinities
- `BOONS` — magic properties, gated by item kind and minimum rarity
- `CURSES` — the drawbacks
- `ARTS` — activated weapon-art effects, grouped by weapon shape
- `RARITIES` — the power budget per tier

Add an entry, run `tools/build.py`, done.

---

## A note on the artwork

Images are **hotlinked** from the Fandom CDN, not copied into this repo, so nothing
copyrighted is redistributed here.

One wrinkle worth knowing if you fork this: Fandom's CDN **404s image requests that carry a
third-party `Referer`**, which is exactly what a page on `github.io` sends by default. The fix
is the `referrerpolicy="no-referrer"` attribute on every `<img>` — with no Referer, the CDN
serves the image normally. If you rewrite the rendering code, keep that attribute or every
image on the page will break.

If an image fails anyway, the card falls back to a sigil rather than leaving a hole.

## Credits and licensing

Item names, artwork and in-game descriptions belong to **FromSoftware** and **Bandai Namco**,
and come from the [Dark Souls](https://darksouls.fandom.com/) and
[Elden Ring](https://eldenring.fandom.com/) wikis (wiki text is
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)).

The 5e statistics are generated by this tool and are not from the games. This is an unofficial
fan project with no affiliation to FromSoftware, Bandai Namco, or Wizards of the Coast.

The generator code is MIT licensed — see `LICENSE`.
