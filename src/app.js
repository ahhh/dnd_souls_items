/* ==========================================================================
   Souls Forge — random D&D 5e (2014) items in the flavor of Dark Souls
   and Elden Ring.

   Every generated item starts from a real armament, armor piece, ring or
   curio scraped from the two wikis, keeping its artwork, its in-game
   description, and its actual stat requirements / scaling grades / weight.
   Those Souls numbers then drive the 5e conversion:

     * a Souls STR/DEX requirement becomes a 5e ability-score requirement
     * scaling grades decide whether a weapon is finesse, and what its
       magic bonus keys off
     * a "Causes blood loss buildup" effect becomes a bleed rider
     * the weapon's real Ash of War / Weapon Art becomes an activated ability

   Data arrives as window.SOULS_DATA (inlined at build time by tools/build.py).
   ========================================================================== */

(function () {
  "use strict";

  // ------------------------------------------------------------------
  // Seeded RNG — every item has a shareable seed, so a permalink always
  // rebuilds the exact same item.
  // ------------------------------------------------------------------

  function hashSeed(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  }

  function makeRng(seedStr) {
    let a = hashSeed(seedStr);
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

  function newSeed() {
    let s = "";
    for (let i = 0; i < 7; i++) {
      s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return s;
  }

  const R = {
    pick: (rng, arr) => arr[Math.floor(rng() * arr.length)],
    int: (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1)),
    chance: (rng, p) => rng() < p,
    shuffle: (rng, arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    weighted: (rng, entries) => {
      const total = entries.reduce((s, e) => s + e.w, 0);
      let r = rng() * total;
      for (const e of entries) {
        r -= e.w;
        if (r <= 0) return e;
      }
      return entries[entries.length - 1];
    },
  };

  // ------------------------------------------------------------------
  // 5e weapon profiles, keyed by Souls weapon class.
  // dmg/type/props are straight PHB 2014 where an analogue exists.
  // `trait` is an inherent, non-magical quirk that gives the class its
  // Souls character without breaking the damage math.
  // ------------------------------------------------------------------

  const WEAPONS = {
    "Dagger": { base: "dagger", dmg: "1d4", type: "piercing", cat: "simple", wt: 1, cost: "2 gp",
      props: ["finesse", "light", "thrown (range 20/60)"] },
    "Straight Sword": { base: "longsword", dmg: "1d8", type: "slashing", cat: "martial", wt: 3, cost: "15 gp",
      props: ["versatile (1d10)"] },
    "Light Greatsword": { base: "longsword", dmg: "1d8", type: "slashing", cat: "martial", wt: 4, cost: "40 gp",
      props: ["finesse", "versatile (1d10)"],
      trait: ["Duelist's Poise", "While you wield this weapon in two hands and no other, you gain a +1 bonus to AC."] },
    "Greatsword": { base: "greatsword", dmg: "2d6", type: "slashing", cat: "martial", wt: 6, cost: "50 gp",
      props: ["heavy", "two-handed"] },
    "Ultra Greatsword": { base: "greatsword", dmg: "2d6", type: "slashing", cat: "martial", wt: 14, cost: "75 gp",
      props: ["heavy", "two-handed"], colossal: true },
    "Colossal Sword": { base: "greatsword", dmg: "2d6", type: "slashing", cat: "martial", wt: 16, cost: "75 gp",
      props: ["heavy", "two-handed"], colossal: true },
    "Colossal Weapon": { base: "maul", dmg: "2d6", type: "bludgeoning", cat: "martial", wt: 18, cost: "75 gp",
      props: ["heavy", "two-handed"], colossal: true },
    "Curved Sword": { base: "scimitar", dmg: "1d6", type: "slashing", cat: "martial", wt: 3, cost: "25 gp",
      props: ["finesse", "light"] },
    "Curved Greatsword": { base: "greatsword", dmg: "2d6", type: "slashing", cat: "martial", wt: 8, cost: "50 gp",
      props: ["heavy", "two-handed"],
      trait: ["Sweeping Arc", "When you hit with this weapon, a second creature within 5 feet of the target takes damage equal to your ability modifier."] },
    "Katana": { base: "longsword", dmg: "1d8", type: "slashing", cat: "martial", wt: 3, cost: "35 gp",
      props: ["finesse", "versatile (1d10)"],
      trait: ["Keen Edge", "This weapon scores a critical hit on a roll of 19 or 20."] },
    "Great Katana": { base: "greatsword", dmg: "2d6", type: "slashing", cat: "martial", wt: 9, cost: "60 gp",
      props: ["heavy", "two-handed"],
      trait: ["Keen Edge", "This weapon scores a critical hit on a roll of 19 or 20."] },
    "Twinblade": { base: "double blade", dmg: "1d8", type: "slashing", cat: "martial", wt: 6, cost: "50 gp",
      props: ["two-handed", "special"],
      trait: ["Twin Ends", "When you take the Attack action with this weapon, you can use a bonus action to make one additional melee attack with its other end. Add no ability modifier to that attack's damage unless the modifier is negative."] },
    "Backhand Blade": { base: "shortsword", dmg: "1d6", type: "slashing", cat: "martial", wt: 2, cost: "30 gp",
      props: ["finesse", "light"],
      trait: ["Reverse Grip", "Once per turn, when a creature misses you with a melee attack, you can use your reaction to make one attack against it with this weapon."] },
    "Thrusting Sword": { base: "rapier", dmg: "1d8", type: "piercing", cat: "martial", wt: 2, cost: "25 gp",
      props: ["finesse"] },
    "Heavy Thrusting Sword": { base: "rapier", dmg: "1d8", type: "piercing", cat: "martial", wt: 4, cost: "40 gp",
      props: ["finesse"],
      trait: ["Lunge", "Once on each of your turns, you can make one attack with this weapon against a target up to 10 feet away."] },
    "Axe": { base: "battleaxe", dmg: "1d8", type: "slashing", cat: "martial", wt: 4, cost: "10 gp",
      props: ["versatile (1d10)"] },
    "Greataxe": { base: "greataxe", dmg: "1d12", type: "slashing", cat: "martial", wt: 7, cost: "30 gp",
      props: ["heavy", "two-handed"] },
    "Hammer": { base: "warhammer", dmg: "1d8", type: "bludgeoning", cat: "martial", wt: 2, cost: "15 gp",
      props: ["versatile (1d10)"] },
    "Great Hammer": { base: "maul", dmg: "2d6", type: "bludgeoning", cat: "martial", wt: 10, cost: "10 gp",
      props: ["heavy", "two-handed"],
      trait: ["Stagger", "On a critical hit, the target must succeed on a DC 13 Strength saving throw or be knocked prone."] },
    "Flail": { base: "flail", dmg: "1d8", type: "bludgeoning", cat: "martial", wt: 2, cost: "10 gp",
      props: [],
      trait: ["Guardbreaker", "Attacks with this weapon ignore the AC bonus granted by a target's shield."] },
    "Spear": { base: "spear", dmg: "1d6", type: "piercing", cat: "simple", wt: 3, cost: "1 gp",
      props: ["thrown (range 20/60)", "versatile (1d8)"] },
    "Great Spear": { base: "pike", dmg: "1d10", type: "piercing", cat: "martial", wt: 18, cost: "5 gp",
      props: ["heavy", "reach", "two-handed"] },
    "Halberd": { base: "halberd", dmg: "1d10", type: "slashing", cat: "martial", wt: 6, cost: "20 gp",
      props: ["heavy", "reach", "two-handed"] },
    "Reaper": { base: "glaive", dmg: "1d10", type: "slashing", cat: "martial", wt: 6, cost: "20 gp",
      props: ["heavy", "reach", "two-handed"],
      trait: ["Harvest", "When you reduce a creature to 0 hit points with this weapon, you can immediately move up to 10 feet without provoking opportunity attacks."] },
    "Whip": { base: "whip", dmg: "1d4", type: "slashing", cat: "martial", wt: 3, cost: "2 gp",
      props: ["finesse", "reach"] },
    "Fist": { base: "gauntlet", dmg: "1d4", type: "bludgeoning", cat: "simple", wt: 2, cost: "5 gp",
      props: ["light"],
      trait: ["Bare-Knuckle", "While wearing this, your unarmed strikes deal damage as shown above and count as magical for overcoming resistance if the item is magical."] },
    "Hand-to-Hand Art": { base: "unarmed focus", dmg: "1d6", type: "bludgeoning", cat: "simple", wt: 1, cost: "10 gp",
      props: ["light", "special"],
      trait: ["Flowing Form", "While you wield no other weapon and wear no shield, you can make one unarmed strike as a bonus action."] },
    "Claw": { base: "claws", dmg: "1d4", type: "slashing", cat: "martial", wt: 2, cost: "15 gp",
      props: ["finesse", "light"],
      trait: ["Rend", "When you attack a creature that cannot see you and hit, the attack deals an extra 1d6 damage."] },
    "Beast Claw": { base: "claws", dmg: "1d6", type: "slashing", cat: "martial", wt: 4, cost: "25 gp",
      props: ["finesse", "light"],
      trait: ["Bestial", "On a critical hit with this weapon, you can move up to 10 feet toward another creature as part of the same action."] },
    "Perfume Bottle": { base: "alchemical censer", dmg: "1d6", type: "fire", cat: "martial", wt: 2, cost: "50 gp",
      props: ["special"],
      trait: ["Atomize", "As an action, expend one of the bottle's 3 charges to spray its contents in a 15-foot cone. Each creature there makes a DC 13 Dexterity saving throw, taking 2d6 damage of the bottle's type on a failure, or half as much on a success. The bottle regains all charges at dawn."] },
    "Torch": { base: "torch", dmg: "1d4", type: "fire", cat: "simple", wt: 1, cost: "1 cp",
      props: ["light"],
      trait: ["Firelight", "While lit, this sheds bright light in a 20-foot radius and dim light for an additional 20 feet."] },
    "Light Bow": { base: "shortbow", dmg: "1d6", type: "piercing", cat: "simple", wt: 2, cost: "25 gp",
      props: ["ammunition (range 80/320)", "two-handed"], ranged: true },
    "Bow": { base: "longbow", dmg: "1d8", type: "piercing", cat: "martial", wt: 2, cost: "50 gp",
      props: ["ammunition (range 150/600)", "heavy", "two-handed"], ranged: true },
    "Greatbow": { base: "greatbow", dmg: "1d10", type: "piercing", cat: "martial", wt: 8, cost: "100 gp",
      props: ["ammunition (range 200/800)", "heavy", "two-handed"], ranged: true, colossal: true },
    "Crossbow": { base: "heavy crossbow", dmg: "1d10", type: "piercing", cat: "martial", wt: 18, cost: "50 gp",
      props: ["ammunition (range 100/400)", "heavy", "loading", "two-handed"], ranged: true },
    "Ballista": { base: "hand ballista", dmg: "2d10", type: "piercing", cat: "martial", wt: 30, cost: "250 gp",
      props: ["ammunition (range 120/480)", "heavy", "loading", "two-handed", "special"], ranged: true, colossal: true,
      trait: ["Braced", "You must be prone, or brace against a solid surface, to fire this weapon without disadvantage."] },
  };

  const SHIELDS = {
    "Small Shield": { ac: 1, wt: 3, cost: "8 gp",
      trait: ["Parry", "When a creature you can see hits you with a melee attack, you can use your reaction to add 2 to your AC against that attack, potentially causing it to miss."] },
    "Medium Shield": { ac: 2, wt: 6, cost: "10 gp" },
    "Greatshield": { ac: 3, wt: 20, cost: "60 gp", str: 15,
      trait: ["Bulwark", "As a reaction when you are hit by an attack, you can take half the damage. You can do so three times, regaining all uses at dawn. You have disadvantage on Dexterity (Stealth) checks while this shield is equipped."] },
    "Thrusting Shield": { ac: 2, wt: 8, cost: "35 gp",
      trait: ["Shield Thrust", "You can make a melee weapon attack with this shield, dealing 1d6 piercing damage. It counts as a finesse weapon."] },
  };

  const CATALYSTS = {
    "Catalyst": { kind: "arcane focus", abil: "Intelligence", school: "sorceries", wt: 3, cost: "10 gp" },
    "Glintstone Staff": { kind: "arcane focus", abil: "Intelligence", school: "glintstone sorceries", wt: 3, cost: "10 gp" },
    "Talisman": { kind: "holy symbol", abil: "Wisdom", school: "miracles", wt: 1, cost: "5 gp" },
    "Sacred Seal": { kind: "holy symbol", abil: "Wisdom", school: "incantations", wt: 1, cost: "5 gp" },
  };

  // 5e armor, by inferred Souls weight class.
  const ARMORS = {
    light: [
      { name: "padded", ac: "11 + Dex modifier", wt: 8, cost: "5 gp", stealth: true },
      { name: "leather", ac: "11 + Dex modifier", wt: 10, cost: "10 gp" },
      { name: "studded leather", ac: "12 + Dex modifier", wt: 13, cost: "45 gp" },
    ],
    medium: [
      { name: "hide", ac: "12 + Dex modifier (max 2)", wt: 12, cost: "10 gp" },
      { name: "chain shirt", ac: "13 + Dex modifier (max 2)", wt: 20, cost: "50 gp" },
      { name: "scale mail", ac: "14 + Dex modifier (max 2)", wt: 45, cost: "50 gp", stealth: true },
      { name: "breastplate", ac: "14 + Dex modifier (max 2)", wt: 20, cost: "400 gp" },
      { name: "half plate", ac: "15 + Dex modifier (max 2)", wt: 40, cost: "750 gp", stealth: true },
    ],
    heavy: [
      { name: "ring mail", ac: "14", wt: 40, cost: "30 gp", stealth: true },
      { name: "chain mail", ac: "16", wt: 55, cost: "75 gp", str: 13, stealth: true },
      { name: "splint", ac: "17", wt: 60, cost: "200 gp", str: 15, stealth: true },
      { name: "plate", ac: "18", wt: 65, cost: "1,500 gp", str: 15, stealth: true },
    ],
  };

  // ------------------------------------------------------------------
  // Infusions — Dark Souls upgrade paths and Elden Ring affinities,
  // each rendered as a 5e damage rider or property.
  // ------------------------------------------------------------------

  const INFUSIONS = [
    { name: "Fire", w: 10, dmg: "1d6", type: "fire",
      text: "Attacks with this weapon deal an extra 1d6 fire damage." },
    { name: "Chaos", w: 5, dmg: "", type: "fire", elem: "fire",
      text: "Attacks with this weapon deal an extra 1d6 fire damage, and an extra 2d6 instead while you are below half your hit point maximum. The flame feeds on desperation." },
    { name: "Lightning", w: 8, dmg: "1d6", type: "lightning",
      text: "Attacks with this weapon deal an extra 1d6 lightning damage." },
    { name: "Magic", w: 9, dmg: "1d6", type: "force", elem: "magic",
      text: "Attacks with this weapon deal an extra 1d6 force damage." },
    { name: "Moonlight", w: 3, dmg: "1d8", type: "force", elem: "magic", min: 2,
      text: "Attacks with this weapon deal an extra 1d8 force damage. In moonlight or under a night sky, this becomes 2d8." },
    { name: "Crystal", w: 4, dmg: "1d8", type: "force", elem: "magic",
      text: "Attacks with this weapon deal an extra 1d8 force damage. But the crystal is brittle: on a natural 1 on an attack roll, the blade cracks and loses all magical properties until repaired by a smith over a long rest." },
    { name: "Divine", w: 6, dmg: "1d6", type: "radiant", elem: "holy",
      text: "Attacks with this weapon deal an extra 1d6 radiant damage. A creature slain by this weapon cannot be restored to unlife by any effect short of a wish." },
    { name: "Sacred", w: 6, dmg: "1d6", type: "radiant", elem: "holy",
      text: "Attacks with this weapon deal an extra 1d6 radiant damage, and an extra 2d6 instead against undead and fiends." },
    { name: "Occult", w: 4, dmg: "1d6", type: "necrotic",
      text: "Attacks with this weapon deal an extra 1d6 necrotic damage, and an extra 2d6 instead against celestials and creatures currently benefiting from a divine blessing." },
    { name: "Blood", w: 6, dmg: "", type: "necrotic",
      text: "The third time you hit the same creature with this weapon within 1 minute, blood loss sets in: it takes an extra 3d6 necrotic damage." },
    { name: "Frost", w: 6, dmg: "1d4", type: "cold",
      text: "Attacks with this weapon deal an extra 1d4 cold damage. On a hit, the target must succeed on a DC 13 Constitution saving throw or have its speed reduced by 10 feet until the end of its next turn." },
    { name: "Poison", w: 5, dmg: "", type: "poison",
      text: "On a hit, the target must succeed on a DC 13 Constitution saving throw or be poisoned for 1 minute, repeating the save at the end of each of its turns." },
    { name: "Rotten", w: 3, dmg: "", type: "poison",
      text: "On a hit, the target must succeed on a DC 14 Constitution saving throw or take 1d6 poison damage at the start of each of its turns for 1 minute. Each time it fails a subsequent save, the damage increases by 1d6." },
    { name: "Raw", w: 4, dmg: "", type: "",
      text: "The blade is left unrefined and brutally simple. Its bonus to attack and damage rolls applies even to creatures immune to magic, but the weapon gains no benefit from any other infusion." },
    { name: "Keen", w: 7, dmg: "", type: "",
      text: "This weapon scores a critical hit on a roll of 19 or 20. If it already had that property, it critically hits on 18-20 instead." },
    { name: "Heavy", w: 7, dmg: "", type: "",
      text: "Once on each of your turns when you hit with this weapon, you can add your Strength modifier a second time to the damage roll." },
    { name: "Flame Art", w: 4, dmg: "1d6", type: "fire", elem: "fire",
      text: "Attacks with this weapon deal an extra 1d6 fire damage, and you add your Intelligence modifier (minimum +0) to that damage." },
    { name: "Lightning-Scarred", w: 3, dmg: "1d6", type: "lightning", elem: "lightning", min: 2,
      text: "Attacks with this weapon deal an extra 1d6 lightning damage. On a critical hit, lightning arcs to one other creature within 15 feet, dealing 2d6 lightning damage to it." },
  ];

  // ------------------------------------------------------------------
  // Souls status effects, detected from the wiki's own `effects` field.
  // ------------------------------------------------------------------

  const STATUSES = [
    { match: /blood ?loss|bleed|hemorrhage/i, name: "Blood Loss",
      text: "The third time you hit the same creature with this weapon within 1 minute, it suffers hemorrhage and takes an extra 3d6 necrotic damage." },
    { match: /scarlet rot|\brot\b/i, name: "Scarlet Rot",
      text: "On a hit, the target must succeed on a DC 14 Constitution saving throw or take 1d6 poison damage at the start of each of its turns for 1 minute. On each failed save at the end of its turns, the damage increases by 1d6." },
    { match: /frostbite|frost/i, name: "Frostbite",
      text: "On a hit, the target must succeed on a DC 13 Constitution saving throw or have its speed halved and take an extra 1d6 cold damage from the next attack that hits it before the end of your next turn." },
    { match: /poison|toxic/i, name: "Venom",
      text: "On a hit, the target must succeed on a DC 13 Constitution saving throw or be poisoned for 1 minute, repeating the save at the end of each of its turns." },
    { match: /sleep/i, name: "Sleep",
      text: "On a hit, the target must succeed on a DC 13 Wisdom saving throw or fall unconscious for 1 minute. The effect ends early if the creature takes damage or another creature uses an action to shake it awake." },
    { match: /madness/i, name: "Madness",
      text: "On a hit against a creature that can see or hear, it must succeed on a DC 13 Wisdom saving throw or take 2d6 psychic damage and be frightened of you until the end of its next turn." },
    { match: /death blight|deathblight/i, name: "Deathblight",
      text: "On a critical hit, the target must succeed on a DC 15 Constitution saving throw or drop to 0 hit points. A creature that succeeds is immune to this weapon's Deathblight for 24 hours." },
    { match: /curse/i, name: "Creeping Curse",
      text: "On a hit, the target must succeed on a DC 13 Charisma saving throw or have its hit point maximum reduced by 1d6 until it finishes a long rest." },
  ];

  // ------------------------------------------------------------------
  // Boons — the magical properties. `for` gates them by item kind.
  // `min` is the minimum rarity tier (1 uncommon .. 4 legendary).
  // ------------------------------------------------------------------

  const BOONS = [
    // --- weapons ---
    { n: "Hollowslayer", f: "weapon", min: 1,
      t: "This weapon deals an extra 1d8 damage against undead." },
    { n: "Demon-Blooded", f: "weapon", min: 1,
      t: "This weapon deals an extra 1d6 fire damage against fiends, and sheds dim light in a 5-foot radius when a fiend is within 60 feet." },
    { n: "Poise-Breaker", f: "weapon", min: 1,
      t: "On a critical hit, the target must succeed on a DC 14 Strength saving throw or be knocked prone." },
    { n: "Riposte", f: "weapon", min: 2,
      t: "When a creature within 5 feet of you misses you with a melee attack, you can use your reaction to make one attack against it with this weapon. On a hit, the attack deals an extra 2d6 damage." },
    { n: "Backstab", f: "weapon", min: 1,
      t: "When you hit a creature that is surprised, or that cannot see you, the attack deals an extra 2d6 damage." },
    { n: "Farron's Reach", f: "weapon", min: 1,
      t: "This weapon gains the reach property, adding 5 feet to your reach with it." },
    { n: "Estus-Bound", f: "any", min: 1,
      t: "This item has 3 charges and regains 1d3 expended charges at dawn. As a bonus action, you can expend a charge to regain 2d4 + 2 hit points." },
    { n: "Soul Siphon", f: "weapon", min: 2,
      t: "When you reduce a creature to 0 hit points with this weapon, you gain temporary hit points equal to 1d6 + the creature's challenge rating (minimum 1). These last until you finish a long rest." },
    { n: "Kindled", f: "any", min: 1,
      t: "This item sheds bright light in a 15-foot radius and dim light for an additional 15 feet. You can extinguish or rekindle it as a bonus action." },
    { n: "Bonfire Ash", f: "any", min: 2,
      t: "Once per day, you can spend 10 minutes tending a fire with this item. You and up to five creatures who rest by it gain the benefits of a short rest, and each regains one spent Hit Die." },
    { n: "Sunlight Oath", f: "any", min: 2,
      t: "As a bonus action, you can raise this item high and call the sun's praise. You and each ally within 30 feet who can see you add 1d4 to their next attack roll or saving throw made before the start of your next turn. Once used, this property cannot be used again until the next dawn." },
    { n: "Moonlight Wave", f: "weapon", min: 3,
      t: "As an action, you can sweep this weapon to release a wave of pale light in a 30-foot line 5 feet wide. Each creature in the line makes a DC 15 Dexterity saving throw, taking 4d8 force damage on a failure, or half as much on a success. This property can be used three times, and regains all uses at dawn." },
    { n: "Carthus Flame Arc", f: "weapon", min: 1,
      t: "As a bonus action, you can wreathe this weapon in flame for 1 minute, causing it to deal an extra 1d6 fire damage on a hit. This property can be used three times, and regains all uses at dawn." },
    { n: "Bloodhound's Step", f: "any", min: 2,
      t: "As a bonus action, you can teleport up to 30 feet to an unoccupied space you can see. Until the start of your next turn, you are lightly obscured. This property can be used three times, and regains all uses at dawn." },
    { n: "Godslayer", f: "weapon", min: 3,
      t: "This weapon deals an extra 2d6 damage against creatures that have legendary actions." },
    { n: "Dragonform", f: "any", min: 3,
      t: "As an action, you can assume a draconic aspect for 1 minute: your unarmed strikes deal 1d10 slashing damage, and you gain resistance to one damage type of your choice from acid, cold, fire, lightning, or poison. Once used, this property cannot be used again until the next dawn." },
    { n: "Unbreakable", f: "any", min: 1,
      t: "This item cannot be broken, corroded, or destroyed by any means short of divine intervention, and you cannot be disarmed of it against your will." },
    { n: "Lifehunt", f: "weapon", min: 2,
      t: "When you hit with this weapon, you regain hit points equal to half the damage dealt. Immediately afterward, you take 1d4 necrotic damage as the scythe drinks from you too." },
    { n: "Ancient Dragon's Wrath", f: "weapon", min: 3,
      t: "As an action, you can exhale the stored wrath of a dragon in a 30-foot cone. Each creature there makes a DC 15 Dexterity saving throw, taking 6d6 lightning damage on a failure, or half as much on a success. Once used, this property cannot be used again until the next dawn." },
    { n: "Perseverance", f: "any", min: 1,
      t: "You have advantage on saving throws against being frightened while you carry this item." },
    { n: "Guardbreaker", f: "weapon", min: 1,
      t: "Attacks with this weapon ignore the AC bonus granted by a target's shield, and ignore half cover." },
    { n: "Quickstep", f: "any", min: 1,
      t: "As a bonus action, you can take the Disengage action." },
    { n: "Homing Soulmass", f: "any", min: 2,
      t: "As an action, you can release three darts of pale light. Each strikes a creature of your choice within 60 feet that you can see, dealing 1d4 + 1 force damage. This property can be used three times, and regains all uses at dawn." },
    { n: "Great Rune's Favor", f: "any", min: 3,
      t: "While you are attuned to this item and above half your hit point maximum, you gain a +1 bonus to all saving throws." },
    { n: "Tarnished's Resolve", f: "any", min: 3,
      t: "When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. Once used, this property cannot be used again until you finish a long rest." },
    { n: "Silver Serpent", f: "any", min: 1,
      t: "You have advantage on death saving throws, and on Wisdom (Perception) checks made to spot hidden treasure." },
    { n: "Hornet's Ring", f: "weapon", min: 2,
      t: "When you score a critical hit with this weapon, roll the weapon's damage dice one additional time and add it to the extra damage of the critical hit." },
    { n: "Chime of Want", f: "any", min: 1,
      t: "While you hold this item, you always know the direction to the nearest unclaimed hoard of coin or gems within one mile, though not its distance or what guards it." },

    // --- armor ---
    { n: "Poise", f: "armor", min: 1,
      t: "You cannot be knocked prone or moved against your will by creatures of your size or smaller." },
    { n: "Havel's Weight", f: "armor", min: 1,
      t: "Your carrying capacity is doubled, and you have advantage on ability checks and saving throws made to resist being pushed or grappled." },
    { n: "Iron Flesh", f: "armor", min: 2,
      t: "As an action, you can harden your body to stone for 1 minute, gaining resistance to bludgeoning, piercing, and slashing damage from nonmagical attacks. Your speed is halved for the duration. Once used, this property cannot be used again until the next dawn." },
    { n: "Wolf's Vigil", f: "armor", min: 1,
      t: "You have advantage on saving throws against being moved, knocked prone, or restrained." },
    { n: "Grass Crest", f: "armor", min: 1,
      t: "When you spend Hit Dice at the end of a short rest, you regain an extra 1d6 hit points per die spent." },
    { n: "Fog-Wreathed", f: "armor", min: 1,
      t: "You have advantage on Dexterity (Stealth) checks made in dim light or darkness, and this armor never imposes disadvantage on Stealth." },
    { n: "Flame-Warded", f: "armor", min: 2,
      t: "You have resistance to fire damage." },
    { n: "Thorned", f: "armor", min: 1,
      t: "A creature that hits you with a melee attack while within 5 feet of you takes 1d4 piercing damage." },
    { n: "Cleanrot", f: "armor", min: 1,
      t: "You are immune to disease and cannot be poisoned." },
    { n: "Bull-Goat's Bearing", f: "armor", min: 2,
      t: "You have advantage on saving throws against effects that would stun or incapacitate you, and you are immune to being frightened by creatures of challenge rating 4 or lower." },

    // --- shields ---
    { n: "Parry Master", f: "shield", min: 2,
      t: "When a creature you can see hits you with a melee attack, you can use your reaction to impose disadvantage on that attack roll. If it then misses, you can make one melee weapon attack against that creature as part of the same reaction." },
    { n: "Spell-Eater", f: "shield", min: 3,
      t: "When you are targeted by a spell of 3rd level or lower, you can use your reaction to absorb it. The spell has no effect on you, and you regain hit points equal to 5 times the spell's level. Once used, this property cannot be used again until the next dawn." },
    { n: "Wall of Lordran", f: "shield", min: 2,
      t: "While you take the Dodge action, this shield's bonus to AC also applies to any ally within 5 feet of you." },

    // --- catalysts ---
    { n: "Glintstone Focus", f: "catalyst", min: 1,
      t: "While you hold this focus, you gain a +1 bonus to spell attack rolls and to the saving throw DCs of your spells." },
    { n: "Soul Arrow", f: "catalyst", min: 1,
      t: "This focus has 3 charges and regains all of them at dawn. While holding it, you can expend 1 charge to cast magic missile from it as a 1st-level spell." },
    { n: "Erdtree's Blessing", f: "catalyst", min: 2,
      t: "This focus has 3 charges and regains 1d3 expended charges at dawn. While holding it, you can expend 1 charge to cast cure wounds from it as a 3rd-level spell." },
    { n: "Sorcerer's Lingering", f: "catalyst", min: 2,
      t: "When you cast a spell with a duration of 1 minute or longer using this focus, its duration is doubled, to a maximum of 24 hours." },
  ];

  // ------------------------------------------------------------------
  // Curses — drawn from the Souls games' own curse mechanics.
  //
  // Every entry here needs to be felt at the table on a normal session's
  // timescale (not gated behind a nat 1, or an environmental trigger a
  // given campaign might never hit), and none of them may be able to
  // spiral into character death, permanent zeroing of a stat, or an
  // unusable item — a curse is a toll you pay for power, not a second
  // save-or-die stapled to your gear.
  // ------------------------------------------------------------------

  const CURSES = [
    { n: "Cursed", t: "While you are attuned to this item, your hit point maximum is halved. This effect ends when the curse is lifted by a remove curse spell or a purging stone." },
    { n: "Hollowing", t: "Each dawn while you are attuned to this item, you must succeed on a DC 13 Charisma saving throw or your Charisma score is reduced by 1 (to a minimum of 3), and you look a little less like yourself. All lost points return when the curse is lifted." },
    { n: "Bound", t: "This item is magically bound to your hand. Once you attune to it, you cannot willingly let go of it, stow it, or unequip it, and you have disadvantage on attack rolls you make with any other weapon while it remains bound. A remove curse spell ends this effect." },
    { n: "Blood Debt", t: "Each time you hit a creature with this item, you take 1d4 necrotic damage that can't be reduced or prevented. The item drinks first, and gives after." },
    { n: "Egg Burden", t: "A parasite has made its home upon you. Your speed is reduced by 10 feet, and you have disadvantage on Charisma (Persuasion) checks and Dexterity (Stealth) checks made against or in front of any creature that could notice it move beneath your skin." },
    { n: "Basilisk's Gaze", t: "Whenever you fail a saving throw against a spell or magical effect while attuned to this item, you must succeed on a DC 13 Constitution saving throw or be blinded until the end of your next turn." },
    { n: "Covetous", t: "You must succeed on a DC 15 Wisdom saving throw to give this item away, sell it, or leave it behind; on a failure, you keep it and cannot try again for 24 hours. Whenever it is not on your person, you have disadvantage on all saving throws, your thoughts too consumed with wanting it back." },
    { n: "Abyssal Hunger", t: "You must slay a living creature with this item at least once every 7 days. Each day beyond that you go without doing so, you have disadvantage on all attack rolls, ability checks, and saving throws until you feed it again. Going hungry longer doesn't make this worse." },
    { n: "Frenzied Flame", t: "When a creature scores a critical hit against you, you must succeed on a DC 15 Wisdom saving throw or spend your next turn attacking the creature nearest to you, ally or not." },
    { n: "Weight of the Rock", t: "This item is preternaturally heavy no matter how it looks or how little it weighs on paper. Your speed is reduced by 10 feet while you carry it, and you have disadvantage on Dexterity saving throws made to reduce or avoid damage from an area effect." },
    { n: "Fading", t: "Each dawn, this item's bonus to attack and damage rolls, or to AC, decreases by 1, to a minimum of +0. It is fully restored the first time you slay a creature whose challenge rating is 5 or higher with it." },
    { n: "Ghostly", t: "You are as much shade as flesh, and healing magic finds you hard to hold onto. Whenever a creature other than you restores your hit points with a spell or magical effect, you regain only half as many, rounded down. Living creatures also find your presence unsettling, giving you disadvantage on Charisma (Persuasion) checks made against them." },
    { n: "Grave-Cold", t: "Your body runs unnaturally cold. You have vulnerability to cold damage, gain no benefit from warmth of any kind, and have disadvantage on Constitution saving throws made to maintain concentration." },
    { n: "Marked of Death", t: "Your soul is marked for the grave. You have disadvantage on death saving throws, and whenever you spend a Hit Die to heal during a short rest, you regain only the minimum possible hit points from it instead of rolling." },
    { n: "Serpent's Tithe", t: "This item consumes 10 gp worth of coin or gems each dawn. If it is not fed, all of its magical properties are dormant until it is." },
    { n: "Sleep-Wreathed", t: "When you finish a long rest while attuned to this item, you must succeed on a DC 13 Constitution saving throw or gain no benefit from it, having spent the night in dreams that were not yours." },
    { n: "Toxic", t: "Each dawn while you are attuned to this item, you must succeed on a DC 13 Constitution saving throw or be poisoned for 1 hour as its venom seeps outward from wherever it touches you." },
    { n: "Rusted", t: "This item seizes at the worst moment. The first time you hit with an attack using it after each short or long rest, roll a d20; on a 1, that attack deals no damage and you have disadvantage on damage rolls made with it until the end of your next turn." },
  ];

  // ------------------------------------------------------------------
  // Weapon arts — the item's real Ash of War / skill becomes an
  // activated ability. Effects are grouped so they fit the weapon.
  // ------------------------------------------------------------------

  const ARTS = {
    heavy: [
      "you slam the weapon down. Each creature within 10 feet makes a DC 15 Strength saving throw, taking 3d8 bludgeoning damage and being knocked prone on a failure, or half as much damage and no fall on a success.",
      "you make one attack with this weapon. On a hit, it deals an extra 4d6 damage and the target is pushed 15 feet away.",
      "you charge up to 30 feet in a straight line and make one attack against each creature you pass within 5 feet of, with a separate attack roll for each.",
    ],
    light: [
      "you make two attacks with this weapon as part of the same action, each with a +2 bonus to the attack roll.",
      "you step through the target's guard: make one attack with advantage. On a hit, it deals an extra 3d6 damage and the target cannot take reactions until the end of its next turn.",
      "you move up to 20 feet without provoking opportunity attacks and make one attack with advantage at any point during that movement.",
    ],
    reach: [
      "you sweep the weapon in a wide arc. Each creature within 10 feet makes a DC 14 Dexterity saving throw, taking 3d6 damage of the weapon's type on a failure, or half as much on a success.",
      "you plant the weapon and brace. Until the start of your next turn, any creature that enters your reach provokes an opportunity attack from you, and you have advantage on those attacks.",
      "you thrust the weapon out in a 20-foot line. Each creature in the line makes a DC 14 Dexterity saving throw, taking 4d6 piercing damage on a failure, or half as much on a success.",
    ],
    ranged: [
      "you loose an empowered shot. Make one attack with this weapon with a +3 bonus to the attack roll. On a hit, it deals an extra 3d8 damage.",
      "you fire three shots in quick succession at up to three creatures you can see, making a separate attack roll against each with no ability modifier added to the damage.",
      "you fire a shot that arcs over cover. Make one attack against a creature you can see within range, ignoring half and three-quarters cover. On a hit, it deals an extra 2d8 damage.",
    ],
    magic: [
      "you release the stored spell. Each creature in a 15-foot cone makes a DC 15 Dexterity saving throw, taking 4d8 force damage on a failure, or half as much on a success.",
      "you weave a ward. You and each ally within 10 feet gain 10 temporary hit points and resistance to one damage type of your choice until the end of your next turn.",
      "you conjure a blade of light and make a melee spell attack against a creature within 10 feet using your spellcasting ability. On a hit, it takes 5d8 radiant damage.",
    ],
    guard: [
      "you raise the shield and set your stance. Until the start of your next turn, you have resistance to all damage from attacks you can see, and creatures have disadvantage on attack rolls against you.",
      "you bash forward. Make one melee attack against a creature within 5 feet. On a hit, it takes 2d8 bludgeoning damage and must succeed on a DC 14 Strength saving throw or be knocked prone.",
      "you reflect the blow. The next time a creature hits you with a melee attack before the start of your next turn, it takes damage equal to the damage it dealt you.",
    ],
  };

  function artGroup(cls, prof) {
    if (prof && prof.ranged) return "ranged";
    if (prof && (prof.props.includes("reach") || prof.colossal)) {
      return prof.colossal ? "heavy" : "reach";
    }
    if (prof && prof.props.some((p) => p === "heavy")) return "heavy";
    return "light";
  }

  // ------------------------------------------------------------------
  // Ring / talisman benefits, matched against the wiki's own effect text
  // where possible, and otherwise drawn at random.
  // ------------------------------------------------------------------

  const RING_MATCHES = [
    { m: /equip(ment)? load|carry|burden/i, t: "Your carrying capacity is doubled, and you count as one size larger for determining how much you can push, drag, or lift." },
    { m: /stamina/i, t: "You can take the Dash action as a bonus action. Once used, this cannot be used again until you finish a short rest." },
    { m: /fall(ing)? damage|fall/i, t: "You take no damage from falls of 30 feet or less, and reduce all other falling damage by 20." },
    { m: /poison/i, t: "You have advantage on saving throws against poison, and resistance to poison damage." },
    { m: /bleed|blood loss/i, t: "You are immune to any effect that would cause you to lose hit points at the start of your turns from bleeding, and you have advantage on death saving throws." },
    { m: /curse/i, t: "You have advantage on saving throws against curses, and against any effect that would reduce your hit point maximum." },
    { m: /fire/i, t: "You have resistance to fire damage." },
    { m: /lightning/i, t: "You have resistance to lightning damage." },
    { m: /magic (defen|resist)|magic damage/i, t: "You have advantage on saving throws against spells." },
    { m: /invisib|hidden|stealth|silent|sound/i, t: "You have advantage on Dexterity (Stealth) checks, and you make no sound when you move at your normal walking speed." },
    { m: /health|hp|vitality/i, t: "Your hit point maximum increases by 10 while you wear this." },
    { m: /attack power|damage/i, t: "You gain a +1 bonus to damage rolls with weapon attacks." },
    { m: /sorcer|intelligence|glintstone|magic (attack|power)/i, t: "You gain a +1 bonus to spell attack rolls made with sorceries and arcane spells." },
    { m: /incant|faith|miracle|holy|sacred/i, t: "You gain a +1 bonus to the saving throw DC of divine spells you cast, and you have advantage on saving throws against being frightened." },
    { m: /item discovery|discovery|rune|soul(s)? (gain|absorb)/i, t: "You have advantage on Wisdom (Perception) and Intelligence (Investigation) checks made to find concealed objects and hidden treasure." },
    { m: /focus|fp\b/i, t: "Once per long rest, you can regain one expended spell slot of 3rd level or lower as a bonus action." },
    { m: /frost|cold/i, t: "You have resistance to cold damage, and you suffer no ill effects from extreme cold." },
    { m: /dragon/i, t: "You have advantage on saving throws against the breath weapons and Frightful Presence of dragons." },
  ];

  const RING_GENERIC = [
    "You gain a +1 bonus to AC while you wear this.",
    "You have advantage on initiative rolls.",
    "You can see in darkness within 60 feet as if it were dim light.",
    "You have advantage on Charisma (Intimidation) checks made against creatures that have seen you kill.",
    "You gain a +1 bonus to saving throws against spells and magical effects.",
    "You have advantage on Constitution saving throws made to maintain concentration on a spell.",
    "Once per long rest, when you fail a saving throw, you can choose to succeed instead.",
    "You need only half the usual amount of food and drink, and you can hold your breath for twice as long.",
    "You can speak, read, and write one additional language of your choice, chosen when you attune to this item.",
    "You have advantage on Wisdom (Survival) checks made to track creatures, and on Intelligence checks to recall lore about the dead.",
  ];

  // ------------------------------------------------------------------
  // Consumables and curios.
  // ------------------------------------------------------------------

  const CONSUMABLES = [
    { n: "Restorative", t: "As an action, you can consume this. You regain {HD} hit points." },
    { n: "Restorative", t: "As an action, you can consume this. You gain {TEMP} temporary hit points that last for 1 hour." },
    { n: "Restorative", t: "As an action, you can consume this. It ends one disease or one condition afflicting you: blinded, deafened, paralyzed, or poisoned." },
    { n: "Offensive", t: "As an action, you can hurl this up to 40 feet. It bursts on impact, and each creature within 10 feet makes a DC 13 Dexterity saving throw, taking {DMG} damage on a failure, or half as much on a success." },
    { n: "Offensive", t: "As a bonus action, you can apply this to a weapon. For the next 10 minutes, attacks with that weapon deal an extra {RIDER} damage on a hit." },
    { n: "Ember", t: "As an action, you can crush this in your hand. For 1 hour, you gain {TEMP} temporary hit points and advantage on saving throws against being frightened." },
    { n: "Soul", t: "As an action, you can absorb the soul held within. You gain the benefit of a short rest, and regain one expended spell slot of 2nd level or lower. A creature can absorb no more than one soul per long rest." },
    { n: "Curio", t: "While you carry this, you have advantage on Intelligence (History) checks made to recall lore about the age that made it." },
    { n: "Curio", t: "As an action, you can hold this aloft. Undead within 30 feet that can see it must succeed on a DC 13 Wisdom saving throw or be turned for 1 minute. Once used, this cannot be used again until the next dawn." },
    { n: "Key Item", t: "This item opens one specific lock, ward, or sealed door, known to the item and to whoever forged it. No other key will serve, and no lockpick will substitute." },
    { n: "Upgrade Material", t: "A smith who works this into a weapon or suit of armor over the course of a long rest can increase that item's bonus to attack and damage rolls, or to AC, by 1, to a maximum of +3. The material is consumed." },
    { n: "Crafting Material", t: "This is a reagent. Ten of them, worked over an hour, substitute for up to 100 gp of material components in the crafting of a magic item or the casting of a spell." },
    { n: "Grease", t: "As a bonus action, you can coat a weapon with this. For the next 10 minutes, attacks with that weapon deal an extra {RIDER} damage on a hit. One application coats one weapon." },
    { n: "Great Rune", t: "While attuned to this rune and above half your hit point maximum, you gain a +1 bonus to attack rolls, saving throws, and AC. Should you fall below half your hit points, the rune goes dark until you finish a long rest." },
    { n: "Rune", t: "As an action, you can shatter this rune, releasing the memories held inside. You gain inspiration, and regain hit points equal to {HD}." },
    { n: "Ash of War", t: "A smith can bind this ash to a weapon over a short rest, replacing any art already bound to it. The weapon gains an activated art: as a bonus action, {ART} This art can be used three times, and regains all uses at dawn." },
  ];

  // ------------------------------------------------------------------
  // Rarity
  // ------------------------------------------------------------------

  const RARITIES = [
    { key: "common",    label: "common",     tier: 0, bonus: [0, 0], boons: [0, 0], attune: 0.0,  w: 20 },
    { key: "uncommon",  label: "uncommon",   tier: 1, bonus: [0, 1], boons: [1, 1], attune: 0.3,  w: 30 },
    { key: "rare",      label: "rare",       tier: 2, bonus: [1, 2], boons: [1, 2], attune: 0.65, w: 25 },
    { key: "veryrare",  label: "very rare",  tier: 3, bonus: [2, 3], boons: [2, 2], attune: 0.85, w: 16 },
    { key: "legendary", label: "legendary",  tier: 4, bonus: [3, 3], boons: [2, 3], attune: 0.95, w: 9 },
  ];

  // ------------------------------------------------------------------
  // Small helpers
  // ------------------------------------------------------------------

  const GRADE = { S: 6, A: 5, B: 4, C: 3, D: 2, E: 1 };

  // A Souls stat requirement (roughly 0-70) onto a 5e ability score.
  function toAbilityScore(soulsReq) {
    if (!soulsReq) return 0;
    return Math.max(8, Math.min(19, Math.round(8 + soulsReq * 0.26)));
  }

  const WIKI_HOST = { ds: "darksouls.fandom.com", er: "eldenring.fandom.com" };
  const GAME_LABEL = { ds: "Dark Souls", er: "Elden Ring" };

  function imgUrl(item) {
    if (!item.img) return null;
    // Stored compactly as "a/ab/File_name.png?cachebuster"
    const wiki = item.game === "ds" ? "darksouls" : "eldenring";
    const [path, cb] = item.img.split("?");
    return (
      "https://static.wikia.nocookie.net/" + wiki + "/images/" + path +
      "/revision/latest/scale-to-width-down/400" + (cb ? "?cb=" + cb : "")
    );
  }

  function wikiUrl(item) {
    const title = (item.page || item.name).replace(/ /g, "_");
    return "https://" + WIKI_HOST[item.game] + "/wiki/" + encodeURIComponent(title);
  }

  function cleanName(name) {
    return name.replace(/^Ash of War:\s*/, "");
  }

  function titleCase(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // Infer a Souls armor weight class from whatever signals we have.
  const HEAVY_WORDS = /plate|iron|knight|havel|giant|crucible|veteran|banished|drake|lordsworn|bull|gundyr|smithing|steel|greaves|cuirass|armor of|scaled|tree sentinel|golem|malformed/i;
  const LIGHT_WORDS = /robe|cloth|hat|hood|garb|cap|dress|mask|veil|tunic|sorcer|prisoner|traveler|traveller|wanderer|rag|cape|shawl|crown|circlet|hair|band|scarf|blindfold|astrologer|preceptor|noble|page|bandit/i;
  const MED_WORDS = /leather|hide|scale|chain|mail|surcoat|vest|brigandine|fur|hunter|blackguard|raptor|guardian/i;

  function armorWeightClass(item) {
    if (item.weightClass) {
      const wc = item.weightClass.toLowerCase();
      if (wc.startsWith("light")) return "light";
      if (wc.startsWith("heav")) return "heavy";
      if (wc.startsWith("med")) return "medium";
    }
    if (typeof item.wt === "number") {
      if (item.wt >= 9) return "heavy";
      if (item.wt >= 4) return "medium";
      if (item.wt > 0) return "light";
    }
    const n = item.name;
    if (HEAVY_WORDS.test(n)) return "heavy";
    if (MED_WORDS.test(n)) return "medium";
    if (LIGHT_WORDS.test(n)) return "light";
    return "medium";
  }

  // ------------------------------------------------------------------
  // The pool
  // ------------------------------------------------------------------

  const ALL = (window.SOULS_DATA && window.SOULS_DATA.items) || [];

  function filterPool(opts) {
    return ALL.filter((it) => {
      if (opts.game !== "any" && it.game !== opts.game) return false;
      if (opts.kind !== "any") {
        if (opts.kind === "weapon" && it.kind !== "weapon") return false;
        if (opts.kind === "armor" && it.kind !== "armor") return false;
        if (opts.kind === "shield" && it.kind !== "shield") return false;
        if (opts.kind === "catalyst" && it.kind !== "catalyst") return false;
        if (opts.kind === "ring" && it.kind !== "ring") return false;
        if (opts.kind === "item" && it.kind !== "item") return false;
      }
      if (opts.artOnly && !it.img) return false;
      return true;
    });
  }

  // ------------------------------------------------------------------
  // Rarity + modifier rolling, shared by every item kind
  // ------------------------------------------------------------------

  function rollRarity(rng, opts) {
    // "Magic items" off is the master switch; the rarity picker is disabled
    // alongside it in the UI, so there is no contradiction to resolve here.
    if (!opts.magical) return RARITIES[0];
    if (opts.rarity !== "any") {
      const forced = RARITIES.find((r) => r.key === opts.rarity);
      if (forced) return forced;
    }
    // A magical run still turns up the occasional mundane masterwork.
    if (R.chance(rng, 0.12)) return RARITIES[0];
    const pool = RARITIES.filter((r) => r.tier > 0);
    return R.weighted(rng, pool.map((r) => ({ ...r, w: r.w })));
  }

  function rollBoons(rng, rarity, forKind, count) {
    const eligible = BOONS.filter(
      (b) => (b.f === forKind || b.f === "any") && b.min <= rarity.tier
    );
    return R.shuffle(rng, eligible).slice(0, Math.min(count, eligible.length));
  }

  // Which infusions suit a weapon that scales off a given stat.
  const SCALE_AFFINITY = {
    int: ["Magic", "Moonlight", "Crystal", "Flame Art"],
    fai: ["Divine", "Sacred", "Lightning"],
    arc: ["Occult", "Blood", "Rotten", "Poison"],
  };

  function rollInfusion(rng, item, rarity) {
    const pool = INFUSIONS.filter((i) => !i.min || i.min <= rarity.tier);

    // Bias toward what the weapon natively deals, and toward the stat it
    // actually scales with — a C-grade Intelligence weapon wants glintstone.
    const favored = new Set();
    if (item.scale) {
      for (const [stat, names] of Object.entries(SCALE_AFFINITY)) {
        if ((GRADE[item.scale[stat]] || 0) >= 3) names.forEach((n) => favored.add(n));
      }
    }

    return R.weighted(rng, pool.map((i) => {
      let w = i.w;
      if (item.elem && i.elem && item.elem.includes(i.elem)) w *= 6;
      if (favored.has(i.name)) w *= 4;
      return { ...i, w };
    }));
  }

  function detectStatus(item) {
    if (!item.effects) return null;
    for (const s of STATUSES) if (s.match.test(item.effects)) return s;
    return null;
  }

  function rollCurse(rng) { return R.pick(rng, CURSES); }

  // ------------------------------------------------------------------
  // Builders — one per item kind. Each returns a normalized card.
  // ------------------------------------------------------------------

  function buildWeapon(item, opts, rng) {
    const prof = WEAPONS[item.class] || WEAPONS["Straight Sword"];
    const rarity = rollRarity(rng, opts);
    const bonus = rarity.bonus[0] === rarity.bonus[1]
      ? rarity.bonus[0]
      : R.int(rng, rarity.bonus[0], rarity.bonus[1]);

    const props = prof.props.slice();
    const traits = [];
    const stats = [];

    // Damage type: prefer whatever the wiki says the weapon actually does,
    // but "Standard"/"Regular" carries no information, so keep the profile's.
    let dtype = prof.type;
    if (item.atkType && !/standard|regular/i.test(item.atkType)) {
      if (/slash/i.test(item.atkType)) dtype = "slashing";
      else if (/thrust|pierc/i.test(item.atkType)) dtype = "piercing";
      else if (/strike|blunt/i.test(item.atkType)) dtype = "bludgeoning";
    }

    // Finesse falls out of the scaling grades: dexterity-scaling weapons
    // are the nimble ones.
    if (item.scale && !props.includes("finesse") && !prof.ranged && !props.includes("two-handed")) {
      const dex = GRADE[item.scale.dex] || 0;
      const str = GRADE[item.scale.str] || 0;
      if (dex > str) props.push("finesse");
    }

    stats.push({ k: "Damage", v: `${prof.dmg}${bonus ? " + " + bonus : ""} ${dtype}` });
    stats.push({ k: "Weight", v: `${prof.wt} lb.` });
    stats.push({ k: "Cost", v: prof.cost });

    // Souls stat requirement -> 5e ability requirement.
    const reqStr = toAbilityScore(item.req && item.req.str);
    const reqDex = toAbilityScore(item.req && item.req.dex);
    if (reqStr >= 13) {
      traits.push({
        n: "Cumbersome",
        t: `This weapon requires a Strength score of ${reqStr}. If your Strength is lower, you have disadvantage on attack rolls made with it, and your speed is reduced by 5 feet while you wield it.`,
      });
    } else if (reqDex >= 15) {
      traits.push({
        n: "Exacting",
        t: `This weapon requires a Dexterity score of ${reqDex}. If your Dexterity is lower, you have disadvantage on attack rolls made with it.`,
      });
    }

    if (prof.trait) traits.push({ n: prof.trait[0], t: prof.trait[1] });

    // Native status effect from the game.
    const status = detectStatus(item);
    if (status) traits.push({ n: status.name, t: status.text });

    // Infusion.
    let infusion = null;
    if (opts.infusions && rarity.tier > 0 && R.chance(rng, 0.72)) {
      infusion = rollInfusion(rng, item, rarity);
      traits.push({ n: infusion.name + " Infusion", t: infusion.text });
    }

    // The weapon's real Ash of War / skill, as an activated art.
    if (item.skill && !/^no skill$/i.test(item.skill) && rarity.tier > 0 && opts.arts) {
      const group = artGroup(item.class, prof);
      traits.push({
        n: item.skill + " (Weapon Art)",
        t: `This weapon has 3 charges and regains all of them at dawn. As a bonus action, you can expend a charge to invoke its art: ${R.pick(rng, ARTS[group])}`,
      });
    }

    // Magic boons.
    const nBoons = rarity.boons[0] === rarity.boons[1]
      ? rarity.boons[0]
      : R.int(rng, rarity.boons[0], rarity.boons[1]);
    if (rarity.tier > 0) {
      for (const b of rollBoons(rng, rarity, "weapon", infusion ? nBoons - 1 : nBoons)) {
        traits.push({ n: b.n, t: b.t });
      }
    }

    const cursed = opts.curses && rarity.tier > 0 && R.chance(rng, 0.18);
    if (cursed) {
      const c = rollCurse(rng);
      traits.push({ n: c.n, t: c.t, curse: true });
    }

    const attuned = rarity.tier > 0 && (cursed || R.chance(rng, rarity.attune));

    const name = buildName(item, infusion, bonus, cursed, rng);
    const catLabel = prof.cat === "simple" ? "simple" : "martial";
    const rangeLabel = prof.ranged ? "ranged" : "melee";

    return {
      name,
      baseName: cleanName(item.name),
      eyebrow: `${GAME_LABEL[item.game]} · ${item.class}`,
      typeLine: `Weapon (${prof.base}), ${rarity.label}${attuned ? " (requires attunement)" : ""}`,
      sub: `${catLabel} ${rangeLabel} weapon`,
      attuned,
      stats,
      props,
      traits,
      rarity,
      cursed,
      item,
    };
  }

  function buildShield(item, opts, rng) {
    const prof = SHIELDS[item.class] || SHIELDS["Medium Shield"];
    const rarity = rollRarity(rng, opts);
    const bonus = rarity.bonus[0] === rarity.bonus[1]
      ? rarity.bonus[0]
      : R.int(rng, rarity.bonus[0], rarity.bonus[1]);

    const traits = [];
    const stats = [
      { k: "AC", v: `+${prof.ac + bonus}` },
      { k: "Weight", v: `${prof.wt} lb.` },
      { k: "Cost", v: prof.cost },
    ];

    const reqStr = toAbilityScore(item.req && item.req.str);
    if (reqStr >= 13 || prof.str) {
      const s = Math.max(reqStr, prof.str || 0);
      traits.push({
        n: "Bracing",
        t: `This shield requires a Strength score of ${s}. If your Strength is lower, your speed is reduced by 10 feet while it is equipped.`,
      });
    }
    if (prof.trait) traits.push({ n: prof.trait[0], t: prof.trait[1] });

    const status = detectStatus(item);
    if (status) traits.push({ n: status.name, t: status.text });

    if (item.skill && !/^no skill$/i.test(item.skill) && rarity.tier > 0 && opts.arts) {
      traits.push({
        n: item.skill + " (Shield Art)",
        t: `This shield has 3 charges and regains all of them at dawn. As a bonus action, you can expend a charge: ${R.pick(rng, ARTS.guard)}`,
      });
    }

    if (rarity.tier > 0) {
      const n = R.int(rng, rarity.boons[0], rarity.boons[1]);
      for (const b of rollBoons(rng, rarity, "shield", n)) traits.push({ n: b.n, t: b.t });
    }

    const cursed = opts.curses && rarity.tier > 0 && R.chance(rng, 0.15);
    if (cursed) {
      const c = rollCurse(rng);
      traits.push({ n: c.n, t: c.t, curse: true });
    }
    const attuned = rarity.tier > 0 && (cursed || R.chance(rng, rarity.attune));

    return {
      name: buildName(item, null, bonus, cursed, rng),
      baseName: cleanName(item.name),
      eyebrow: `${GAME_LABEL[item.game]} · ${item.class}`,
      typeLine: `Armor (shield), ${rarity.label}${attuned ? " (requires attunement)" : ""}`,
      sub: "shield",
      attuned, stats, props: [], traits, rarity, cursed, item,
    };
  }

  function buildArmor(item, opts, rng) {
    const rarity = rollRarity(rng, opts);
    const bonus = rarity.bonus[0] === rarity.bonus[1]
      ? rarity.bonus[0]
      : R.int(rng, rarity.bonus[0], rarity.bonus[1]);
    const traits = [];
    const wc = armorWeightClass(item);
    const isBody = item.class === "Chest";

    let stats, typeLine, sub;

    if (isBody) {
      // A chest piece is a full suit of 5e armor.
      const a = R.pick(rng, ARMORS[wc]);
      const acNum = a.ac.match(/^\d+/);
      const ac = bonus
        ? a.ac.replace(/^\d+/, String(Number(acNum[0]) + bonus))
        : a.ac;
      stats = [
        { k: "AC", v: ac },
        { k: "Weight", v: `${a.wt} lb.` },
        { k: "Cost", v: a.cost },
      ];
      typeLine = `Armor (${a.name}), ${rarity.label}`;
      sub = `${wc} armor`;
      if (a.str) {
        traits.push({
          n: "Weight of It",
          t: `You must have a Strength score of ${a.str} to wear this armor without your speed being reduced by 10 feet.`,
        });
      }
      if (a.stealth) {
        traits.push({
          n: "Clattering",
          t: "You have disadvantage on Dexterity (Stealth) checks while wearing this armor.",
        });
      }
    } else {
      // Helms, gauntlets and greaves have no 5e armor slot, so they become
      // wondrous items worn in that place.
      const slot = { Helm: "head", Gauntlets: "hands", Leggings: "feet" }[item.class] || "body";
      stats = [
        { k: "Slot", v: titleCase(slot) },
        { k: "Weight", v: `${item.wt ? Math.max(1, Math.round(item.wt)) : 3} lb.` },
      ];
      typeLine = `Wondrous item, ${rarity.label}`;
      sub = `worn on the ${slot}`;
      if (rarity.tier === 0) {
        traits.push({
          n: "Well-Made",
          t: "This piece is finely wrought but holds no magic. Worn with a matching set, it is worth four times its weight in coin to the right collector.",
        });
      }
    }

    const nBoons = rarity.tier > 0 ? R.int(rng, rarity.boons[0], rarity.boons[1]) : 0;
    for (const b of rollBoons(rng, rarity, "armor", nBoons)) traits.push({ n: b.n, t: b.t });

    const cursed = opts.curses && rarity.tier > 0 && R.chance(rng, 0.16);
    if (cursed) {
      const c = rollCurse(rng);
      traits.push({ n: c.n, t: c.t, curse: true });
    }
    const attuned = rarity.tier > 0 && (cursed || R.chance(rng, rarity.attune * 0.8));
    if (attuned) typeLine += " (requires attunement)";

    return {
      name: buildName(item, null, isBody ? bonus : 0, cursed, rng),
      baseName: cleanName(item.name),
      eyebrow: `${GAME_LABEL[item.game]} · ${item.class}`,
      typeLine, sub, attuned, stats, props: [], traits, rarity, cursed, item,
    };
  }

  function buildCatalyst(item, opts, rng) {
    const prof = CATALYSTS[item.class] || CATALYSTS["Catalyst"];
    const rarity = rollRarity(rng, opts);
    const bonus = rarity.bonus[0] === rarity.bonus[1]
      ? rarity.bonus[0]
      : R.int(rng, rarity.bonus[0], rarity.bonus[1]);
    const traits = [];

    const stats = [
      { k: "Focus", v: titleCase(prof.kind) },
      { k: "Weight", v: `${prof.wt} lb.` },
      { k: "Cost", v: prof.cost },
    ];

    if (bonus > 0) {
      traits.push({
        n: "Attuned Conduit",
        t: `While you hold this focus, you gain a +${bonus} bonus to spell attack rolls and to the saving throw DCs of your spells.`,
      });
    }

    const reqAbil = item.req && (item.req.int || item.req.fai);
    if (reqAbil) {
      const score = toAbilityScore(reqAbil);
      if (score >= 13) {
        const which = item.req.int ? "Intelligence" : "Wisdom";
        traits.push({
          n: "Demanding",
          t: `You must have a ${which} score of ${score} to draw on this focus. With a lower score, any spell you cast through it has its save DC reduced by 2.`,
        });
      }
    }

    if (rarity.tier > 0) {
      const n = R.int(rng, rarity.boons[0], rarity.boons[1]);
      for (const b of rollBoons(rng, rarity, "catalyst", n)) traits.push({ n: b.n, t: b.t });
    }

    const cursed = opts.curses && rarity.tier > 0 && R.chance(rng, 0.16);
    if (cursed) {
      const c = rollCurse(rng);
      traits.push({ n: c.n, t: c.t, curse: true });
    }
    const attuned = rarity.tier > 0 && (cursed || R.chance(rng, rarity.attune));

    return {
      name: buildName(item, null, bonus, cursed, rng),
      baseName: cleanName(item.name),
      eyebrow: `${GAME_LABEL[item.game]} · ${item.class}`,
      typeLine: `Wondrous item (${prof.kind}), ${rarity.label}${attuned ? " (requires attunement)" : ""}`,
      sub: `a focus for ${prof.school}`,
      attuned, stats, props: [], traits, rarity, cursed, item,
    };
  }

  function buildRing(item, opts, rng) {
    const rarity = rollRarity(rng, opts);
    const traits = [];
    const isRing = item.class === "Ring";

    // If the wiki recorded what the ring actually does, honor it.
    let matched = null;
    const src = [item.effects || "", (item.desc || []).join(" ")].join(" ");
    for (const m of RING_MATCHES) {
      if (m.m.test(src)) { matched = m; break; }
    }
    traits.push({
      n: cleanName(item.name).replace(/\s*\+\d+$/, ""),
      t: matched ? matched.t : R.pick(rng, RING_GENERIC),
    });

    if (rarity.tier >= 2) {
      const extra = rollBoons(rng, rarity, "any", rarity.tier >= 3 ? 2 : 1);
      for (const b of extra) traits.push({ n: b.n, t: b.t });
    }

    const cursed = opts.curses && R.chance(rng, 0.18);
    if (cursed) {
      const c = rollCurse(rng);
      traits.push({ n: c.n, t: c.t, curse: true });
    }
    const attuned = cursed || R.chance(rng, Math.max(0.5, rarity.attune));

    return {
      name: buildName(item, null, 0, cursed, rng),
      baseName: cleanName(item.name),
      eyebrow: `${GAME_LABEL[item.game]} · ${item.class}`,
      typeLine: `${isRing ? "Ring" : "Wondrous item (talisman)"}, ${rarity.label}${attuned ? " (requires attunement)" : ""}`,
      sub: isRing ? "worn on a finger" : "worn at the belt",
      attuned,
      stats: [{ k: "Weight", v: "—" }, { k: "Slot", v: isRing ? "Ring" : "Talisman" }],
      props: [], traits, rarity, cursed, item,
    };
  }

  function buildItem(item, opts, rng) {
    const consumable = /Restorative|Offensive|Ember|Soul|Grease|Rune|Crafting/.test(item.class);

    // A firebomb is a firebomb. Consumables stay at the low end unless the
    // rarity was pinned deliberately.
    let rarity = rollRarity(rng, opts);
    if (consumable && opts.rarity === "any" && rarity.tier > 1) rarity = RARITIES[R.int(rng, 0, 1)];

    const pool = CONSUMABLES.filter((c) => c.n === item.class);
    const tpl = pool.length ? R.pick(rng, pool) : R.pick(rng, CONSUMABLES.filter((c) => c.n === "Curio"));

    const hd = R.pick(rng, ["2d4 + 2", "4d4 + 4", "8d4 + 8"]);
    const temp = R.pick(rng, ["5", "10", "15"]);
    const dmg = R.pick(rng, ["3d6 fire", "3d6 lightning", "2d6 poison", "4d6 force"]);
    const rider = R.pick(rng, ["1d6 fire", "1d6 lightning", "1d6 cold", "1d4 poison", "1d6 radiant"]);
    // An Ash of War is bound to whatever weapon the smith has to hand, so it
    // must not assume a bow.
    const art = R.pick(rng, ARTS[R.pick(rng, ["heavy", "light", "reach"])]);

    const text = tpl.t
      .replace("{HD}", hd).replace("{TEMP}", temp)
      .replace("{DMG}", dmg).replace("{RIDER}", rider)
      .replace("{ART}", art);

    const traits = [{ n: "Use", t: text }];
    if (rarity.tier >= 2 && !consumable) {
      for (const b of rollBoons(rng, rarity, "any", 1)) traits.push({ n: b.n, t: b.t });
    }

    const cursed = opts.curses && !consumable && R.chance(rng, 0.12);
    if (cursed) {
      const c = rollCurse(rng);
      traits.push({ n: c.n, t: c.t, curse: true });
    }

    return {
      name: buildName(item, null, 0, cursed, rng),
      baseName: cleanName(item.name),
      eyebrow: `${GAME_LABEL[item.game]} · ${item.class}`,
      typeLine: `${consumable ? "Potion or consumable" : "Wondrous item"}, ${rarity.label}`,
      sub: consumable ? "single use" : "a curio of the old world",
      attuned: false,
      stats: [{ k: "Weight", v: "1 lb." }, { k: "Cost", v: R.pick(rng, ["25 gp", "50 gp", "100 gp", "250 gp", "500 gp"]) }],
      props: [], traits, rarity, cursed, item,
    };
  }

  // ------------------------------------------------------------------
  // Naming, in the Souls idiom: "<Infusion> <Base> +<N>"
  // ------------------------------------------------------------------

  const CURSE_PREFIX = ["Blighted", "Hollowed", "Accursed", "Rotted", "Forsaken", "Grave-Bound"];

  function buildName(item, infusion, bonus, cursed, rng) {
    let n = cleanName(item.name);
    if (infusion) n = infusion.name + " " + n;
    else if (cursed && R.chance(rng, 0.5)) n = R.pick(rng, CURSE_PREFIX) + " " + n;
    if (bonus > 0) n += " +" + bonus;
    return n;
  }

  // ------------------------------------------------------------------
  // Assembly
  // ------------------------------------------------------------------

  const BUILDERS = {
    weapon: buildWeapon,
    shield: buildShield,
    armor: buildArmor,
    catalyst: buildCatalyst,
    ring: buildRing,
    item: buildItem,
  };

  function generate(opts, seed) {
    const rng = makeRng(seed);
    const pool = filterPool(opts);
    if (!pool.length) return null;
    const base = R.pick(rng, pool);
    const card = (BUILDERS[base.kind] || buildItem)(base, opts, rng);
    card.seed = seed;
    card.img = imgUrl(base);
    card.wiki = wikiUrl(base);
    card.lore = base.desc || [];
    card.souls = soulsLine(base);
    return card;
  }

  function soulsLine(item) {
    const bits = [];
    if (item.req) {
      const r = Object.entries(item.req)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => k.toUpperCase() + " " + v);
      if (r.length) bits.push("Requires " + r.join(" / "));
    }
    if (item.scale) {
      const s = Object.entries(item.scale).map(([k, v]) => k.toUpperCase() + " " + v);
      if (s.length) bits.push("Scaling " + s.join(" / "));
    }
    if (item.wt) bits.push(item.wt + " units");
    return bits.join("  ·  ");
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------

  const SIGILS = ["†", "‡", "⚔", "◆", "✵", "⚜"];

  function sigilFor(name) {
    return SIGILS[hashSeed(name) % SIGILS.length];
  }

  // If the wiki drops an image, leave a sigil in the niche rather than a hole.
  function wireArtFallback(root) {
    root.querySelectorAll(".plinth img").forEach((img) => {
      const fail = () => {
        const span = document.createElement("span");
        span.className = "sigil";
        span.textContent = sigilFor(img.alt || "");
        img.replaceWith(span);
      };
      img.addEventListener("error", fail, { once: true });
      // An image that already failed before this ran reports complete
      // with no intrinsic width.
      if (img.complete && img.naturalWidth === 0) fail();
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  function renderCard(card) {
    // referrerpolicy is load-bearing: the wikis' CDN refuses image requests
    // that carry a third-party Referer, and serves them fine without one.
    const art = card.img
      ? `<img src="${esc(card.img)}" alt="${esc(card.baseName)}" loading="lazy"
             referrerpolicy="no-referrer">`
      : `<span class="sigil">${sigilFor(card.baseName)}</span>`;

    const stats = card.stats.map(
      (s) => `<div><dt>${esc(s.k)}</dt><dd>${esc(s.v)}</dd></div>`
    ).join("");

    const props = card.props && card.props.length
      ? `<p class="props">Properties: ${esc(card.props.join(", "))}</p>` : "";

    const traits = card.traits.map(
      (t) => `<p class="trait${t.curse ? " is-curse" : ""}"><b>${esc(t.n)}.</b> ${esc(t.t)}</p>`
    ).join("");

    const lore = card.lore && card.lore.length
      ? `<div class="lore">${card.lore.map((l) => `<p>${esc(l)}</p>`).join("")}</div>` : "";

    const souls = card.souls
      ? `<span>${esc(card.souls)}</span>` : "<span></span>";

    return `
      <article class="card kindling${card.cursed ? " is-cursed" : ""}" data-seed="${esc(card.seed)}">
        <div class="card-head">
          <div class="plinth">${art}</div>
          <div class="card-title">
            <span class="eyebrow">${esc(card.eyebrow)}</span>
            <h2>${esc(card.name)}</h2>
            <p class="subtype">${esc(card.typeLine)}</p>
            ${card.attuned ? '<span class="attune">Requires attunement</span>' : ""}
          </div>
        </div>
        <div class="card-body">
          <dl class="statline">${stats}</dl>
          ${props}
          ${traits}
          ${lore}
          <div class="prov">
            ${souls}
            <a href="${esc(card.wiki)}" target="_blank" rel="noopener">Source: ${esc(card.baseName)} &#8599;</a>
          </div>
        </div>
      </article>`;
  }

  // Plain-text export, formatted like a stat block you can paste into notes.
  function toText(card) {
    const L = [];
    L.push(card.name);
    L.push(card.typeLine);
    L.push("");
    L.push(card.stats.map((s) => `${s.k}: ${s.v}`).join("   "));
    if (card.props && card.props.length) L.push(`Properties: ${card.props.join(", ")}`);
    L.push("");
    for (const t of card.traits) L.push(`${t.n}. ${t.t}\n`);
    if (card.lore && card.lore.length) {
      L.push("---");
      for (const l of card.lore) L.push(`"${l}"`);
    }
    L.push("");
    L.push(`[${card.eyebrow}${card.souls ? " · " + card.souls : ""}]`);
    L.push(card.wiki);
    return L.join("\n");
  }

  // ------------------------------------------------------------------
  // UI
  // ------------------------------------------------------------------

  const out = document.getElementById("out");
  const toast = document.getElementById("toast");
  let current = [];

  function readOpts() {
    const val = (name) => {
      const el = document.querySelector(`input[name="${name}"]:checked`);
      return el ? el.value : "any";
    };
    const on = (id) => document.getElementById(id).checked;
    return {
      kind: val("kind"),
      game: val("game"),
      rarity: val("rarity"),
      magical: on("t-magical"),
      infusions: on("t-infusions"),
      curses: on("t-curses"),
      arts: on("t-arts"),
      artOnly: on("t-art"),
      count: Number(val("count")) || 1,
    };
  }

  function say(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(say._t);
    say._t = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function draw(seeds) {
    const opts = readOpts();
    const cards = [];
    for (let i = 0; i < opts.count; i++) {
      const seed = seeds && seeds[i] ? seeds[i] : newSeed();
      const c = generate(opts, seed);
      if (c) cards.push(c);
    }
    if (!cards.length) {
      out.innerHTML = `<div class="empty"><span class="mark">&#10013;</span>
        <p>No armament answers to those filters. Loosen them and try again.</p></div>`;
      current = [];
      return;
    }
    current = cards;
    out.innerHTML = cards.map(renderCard).join("");
    wireArtFallback(out);
    const hash = "#" + cards.map((c) => c.seed).join(",") + "|" + encodeOpts(opts);
    history.replaceState(null, "", hash);
  }

  function encodeOpts(o) {
    return [o.kind, o.game, o.rarity, o.count,
      (o.magical ? "m" : "") + (o.infusions ? "i" : "") + (o.curses ? "c" : "") +
      (o.arts ? "a" : "") + (o.artOnly ? "p" : "")].join(".");
  }

  function applyHash() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!h) return null;
    const [seedPart, optPart] = h.split("|");
    if (optPart) {
      const [kind, game, rarity, count, flags] = optPart.split(".");
      const set = (name, v) => {
        const el = document.querySelector(`input[name="${name}"][value="${v}"]`);
        if (el) el.checked = true;
      };
      set("kind", kind); set("game", game); set("rarity", rarity); set("count", count);
      const f = flags || "";
      document.getElementById("t-magical").checked = f.includes("m");
      document.getElementById("t-infusions").checked = f.includes("i");
      document.getElementById("t-curses").checked = f.includes("c");
      document.getElementById("t-arts").checked = f.includes("a");
      document.getElementById("t-art").checked = f.includes("p");
    }
    return seedPart ? seedPart.split(",").filter(Boolean) : null;
  }

  document.getElementById("forge").addEventListener("click", () => draw(null));

  document.getElementById("reroll").addEventListener("click", () => {
    // Same base items, freshly rolled stats: nudge each seed forward.
    if (!current.length) return draw(null);
    draw(current.map((c) => c.seed.slice(0, -1) + ALPHABET[Math.floor(Math.random() * ALPHABET.length)]));
  });

  document.getElementById("copy").addEventListener("click", async () => {
    if (!current.length) return;
    const text = current.map(toText).join("\n\n" + "-".repeat(48) + "\n\n");
    try {
      await navigator.clipboard.writeText(text);
      say("Copied to clipboard");
    } catch (e) {
      say("Clipboard blocked");
    }
  });

  document.getElementById("link").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      say("Permalink copied");
    } catch (e) {
      say("Clipboard blocked");
    }
  });

  // Rarity, infusions, arts and curses are all downstream of "Magic items";
  // grey them out together rather than letting them look live but inert.
  const MAGIC_DEPENDENTS = ["t-infusions", "t-arts", "t-curses"];

  function syncMagicDependents() {
    const on = document.getElementById("t-magical").checked;
    document.querySelectorAll('input[name="rarity"]').forEach((el) => {
      el.disabled = !on;
      el.closest("label").style.opacity = on ? "" : "0.35";
    });
    MAGIC_DEPENDENTS.forEach((id) => {
      const el = document.getElementById(id);
      el.disabled = !on;
      el.closest("label").style.opacity = on ? "" : "0.35";
    });
  }

  // Regenerate whenever a filter changes, so the page always reflects the rail.
  document.querySelectorAll(".rail input").forEach((el) => {
    el.addEventListener("change", () => {
      syncMagicDependents();
      draw(null);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === " " && e.target === document.body) { e.preventDefault(); draw(null); }
  });

  const seeds = applyHash();
  syncMagicDependents();
  draw(seeds);
})();
