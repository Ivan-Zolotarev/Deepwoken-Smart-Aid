"""Собирает оружие из Category:Weapons Deepwoken Wiki (Fandom) в data/weapons.json и data/weapons.js.

Запуск: python scripts/fetch_weapons.py [--offline]
  --offline  взять сохранённый кэш scripts/.cache/Weapons.json

Источник: https://deepwoken.fandom.com/wiki/Category:Weapons (CC BY-SA 3.0).
У каждой страницы оружия есть шаблон {{Weapon_Infobox|...}} со статами.
"""
import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from wikitext import clean, find_templates, split_params  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).parent / ".cache" / "Weapons.json"
OUT = ROOT / "data" / "weapons.json"
OUT_JS = ROOT / "data" / "weapons.js"

API = "https://deepwoken.fandom.com/api.php"
USER_AGENT = "DeepwokenSmartAid/0.1 (fan project)"


def api(params):
    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def fetch_pages():
    """Все страницы категории Weapons: {title: wikitext}."""
    pages = {}
    params = {
        "action": "query", "generator": "categorymembers", "gcmtitle": "Category:Weapons",
        "gcmlimit": "40", "gcmnamespace": "0", "prop": "revisions", "rvprop": "content",
        "rvslots": "main", "format": "json",
    }
    while True:
        data = api(params)
        for p in data.get("query", {}).get("pages", {}).values():
            revs = p.get("revisions")
            if revs:
                pages[p["title"]] = revs[0]["slots"]["main"]["*"]
        if "continue" not in data:
            return pages
        params.update(data["continue"])


def categories(text):
    return re.findall(r"\[\[Category:([^\]|]+)", text)


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower().replace("'", "")).strip("-")


def parse_lines(raw):
    """Маркированный список '*text' -> список строк."""
    items = []
    for line in raw.splitlines():
        m = re.match(r"^(\*+)\s*(.*)$", line.strip())
        if m:
            items.append(clean(m.group(2)))
        elif line.strip():
            if items:
                items[-1] += " " + clean(line)
            else:
                items.append(clean(line))
    return [i for i in items if i]


def first_number(s):
    m = re.search(r"-?\d+(?:\.\d+)?", s or "")
    return float(m.group(0)) if m else None


def parse_weapon(title, text):
    bodies = find_templates(text, "Weapon_Infobox") or find_templates(text, "Weapon Infobox")
    if not bodies:
        return None
    _, p = split_params(bodies[0])
    p = {k.lower().strip(): v for k, v in p.items()}
    cats = categories(text)
    w = {
        "name": title,
        "slug": slugify(title),
        "type": clean(p.get("type", "")),
        "rarity": clean(p.get("rarity", "")),
        "requirements": clean(p.get("requirements", "")),
        "damage": first_number(p.get("damage")),
        "damage_type": clean(p.get("damage type", "")),
        "scaling": clean(p.get("scaling", "")),
        "posture_damage": first_number(p.get("posture damage")),
        "range": first_number(p.get("range")),
        "range_type": clean(p.get("range type", "")),
        "swing_speed": clean(p.get("swing speed", "")),
        "attack_duration": clean(p.get("attack duration", "")),
        "selling_price": first_number(p.get("selling price")),
        "description": clean(p.get("description", "")),
        "obtainment": parse_lines(p.get("obtainment", "")),
        "categories": [c for c in cats if c != "Weapons"],
        "wiki_url": "https://deepwoken.fandom.com/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
    }
    # всё, что не разобрали явно, сохраняем как есть
    known = {"type", "rarity", "requirements", "damage", "damage type", "scaling", "posture damage",
             "range", "range type", "swing speed", "attack duration", "selling price", "description",
             "obtainment", "image"}
    extra = {k: clean(v) for k, v in p.items()
             if k not in known and not k.isdigit() and k != "name" and clean(v)}
    if extra:
        w["extra"] = extra
    # класс оружия: по категории, иначе по коду стата в требованиях
    for c in cats:
        if c in ("Light Weapons", "Medium Weapons", "Heavy Weapons"):
            w["class"] = c.split()[0]
    if "class" not in w:
        for code, cls in (("LHT", "Light"), ("MED", "Medium"), ("HVY", "Heavy")):
            if code in w["requirements"]:
                w["class"] = cls
                break
    return w


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true")
    args = ap.parse_args()

    CACHE.parent.mkdir(exist_ok=True)
    if args.offline and CACHE.exists():
        pages = json.loads(CACHE.read_text(encoding="utf-8"))
    else:
        pages = fetch_pages()
        CACHE.write_text(json.dumps(pages, ensure_ascii=False), encoding="utf-8")

    weapons, skipped = [], []
    for title, text in sorted(pages.items()):
        w = parse_weapon(title, text)
        if w:
            weapons.append(w)
        else:
            skipped.append(title)

    print(f"Страниц: {len(pages)}, оружия: {len(weapons)}, без инфобокса: {len(skipped)}")
    print("Пропущено:", skipped)

    data = {
        "source": "https://deepwoken.fandom.com/wiki/Category:Weapons",
        "license": "CC BY-SA 3.0",
        "fetched": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "weapons": weapons,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    OUT_JS.write_text(
        "window.DEEPWOKEN_DATA = window.DEEPWOKEN_DATA || {};\n"
        "window.DEEPWOKEN_DATA.weapons = " + json.dumps(data, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
