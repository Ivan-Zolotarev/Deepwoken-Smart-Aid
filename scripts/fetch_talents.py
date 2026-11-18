"""Собирает таланты со страницы Talents Deepwoken Wiki (Fandom) в data/talents.json.

Запуск: python scripts/fetch_talents.py [--offline]
  --offline  не ходить в сеть, взять сохранённый кэш scripts/.cache/Talents.wiki

Источник: https://deepwoken.fandom.com/wiki/Talents (CC BY-SA 3.0).
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
CACHE = Path(__file__).parent / ".cache"
OUT = ROOT / "data" / "talents.json"

API = "https://deepwoken.fandom.com/api.php"
PAGE = "Talents"
USER_AGENT = "DeepwokenSmartAid/0.1 (fan project)"

KNOWN_FIELDS = {
    "name", "rarity", "tags", "icon", "category", "description",
    "info", "stats", "requirements", "equipment",
}

# Опечатки и варианты имён параметров в вики -> каноническое имя
ALIASES = {
    "catergory": "category",
    "categoy": "category",
    "equip": "equipment",
    "requirement": "requirements",
    "stat": "stats",
    "mutual exclusives": "mutual_exclusives",
}


def fetch_wikitext(page):
    query = urllib.parse.urlencode(
        {"action": "parse", "page": page, "prop": "wikitext", "format": "json"}
    )
    req = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)["parse"]["wikitext"]["*"]


def parse_tags(raw):
    """'[Willpower] {{abf|[Combat Tag]}} [Damage Buff]' -> ['Willpower', 'Combat Tag', 'Damage Buff']."""
    return re.findall(r"\[([^\[\]]+)\]", clean(raw))


def parse_requirements(raw):
    """'65 Willpower, 20 Agility' -> [{'stat': 'Willpower', 'value': 65}, ...]; остальное -> notes."""
    text = clean(raw)
    stats = [
        {"stat": m.group(2).strip(), "value": int(m.group(1))}
        for m in re.finditer(r"(\d+)\s+([A-Za-z][A-Za-z' -]*?)(?=,|;|\band\b|$|\n)", text)
    ]
    return {"raw": text, "stats": stats}


def parse_info(raw):
    """Маркированный список '*text' -> список строк (вложенные '**' сохраняют отступ)."""
    items = []
    for line in raw.splitlines():
        m = re.match(r"^(\*+)\s*(.*)$", line.strip())
        if m:
            items.append({"level": len(m.group(1)), "text": clean(m.group(2))})
        elif line.strip() and items:
            items[-1]["text"] += " " + clean(line)
    return items


def parse_talent(params):
    params = {ALIASES.get(k.lower(), k.lower()): v for k, v in params.items()}
    talent = {
        "name": clean(params.get("name", "")),
        "rarity": clean(params.get("rarity", "")),
        "category": clean(params.get("category", "")),
        "icon": clean(params.get("icon", "")),
        "tags": parse_tags(params.get("tags", "")),
        "description": clean(params.get("description", "")),
        "info": parse_info(params.get("info", "")),
        "stats": clean(params.get("stats", "")),
        "requirements": parse_requirements(params.get("requirements", "")),
        "equipment": clean(params.get("equipment", "")),
    }
    extra = {k: clean(v) for k, v in params.items() if k not in KNOWN_FIELDS}
    if extra:
        talent["extra"] = extra
    talent["wiki_url"] = "https://deepwoken.fandom.com/wiki/" + urllib.parse.quote(
        talent["name"].replace(" ", "_")
    )
    return talent


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true")
    args = ap.parse_args()

    CACHE.mkdir(exist_ok=True)
    cache_file = CACHE / f"{PAGE}.wiki"
    if args.offline:
        text = cache_file.read_text(encoding="utf-8")
    else:
        text = fetch_wikitext(PAGE)
        cache_file.write_text(text, encoding="utf-8")

    talents = []
    for body in find_templates(text, "TalentInfo/Talents"):
        _, params = split_params(body)
        if params.get("name"):
            talents.append(parse_talent(params))

    talents.sort(key=lambda t: (t["category"], t["name"]))

    OUT.parent.mkdir(exist_ok=True)
    payload = {
        "meta": {
            "source": "https://deepwoken.fandom.com/wiki/Talents",
            "license": "CC BY-SA 3.0",
            "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "count": len(talents),
        },
        "talents": talents,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Сохранено талантов: {len(talents)} -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
