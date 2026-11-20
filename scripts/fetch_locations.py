"""Собирает локации (острова, зоны, данжи, арены) из Category:Locations Deepwoken Wiki
в data/locations.json и data/locations.js.

Запуск: python scripts/fetch_locations.py [--offline]
  --offline  взять сохранённый кэш scripts/.cache/Locations.json

Источник: https://deepwoken.fandom.com/wiki/Category:Locations (CC BY-SA 3.0).
Страницы свободной формы с шаблоном {{Location|name=|caption=|territory=|lawless=|area=}}.
Текст режется на разделы и блоки (абзац / пункт списка / подзаголовок). Внутренние ссылки
сохраняются как маркеры ⟦страница|подпись⟧, чтобы сайт мог сделать ссылки на свои разделы.
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
CACHE = Path(__file__).parent / ".cache" / "Locations.json"
OUT = ROOT / "data" / "locations.json"
OUT_JS = ROOT / "data" / "locations.js"

API = "https://deepwoken.fandom.com/api.php"
USER_AGENT = "DeepwokenSmartAid/0.1 (fan project)"

# разделы, которые не несут текста (галереи, карты, оглавления, ссылки)
SKIP_SECTIONS = {"gallery", "references", "contents", "navigation", "maps", "map", "see also",
                 "external links", "videos", "music"}
# служебные шаблоны-пометки -> тег
FLAG_TEMPLATES = {"stub": "stub", "pathfinderex": "pathfinder", "ironvowex": "vow-of-iron",
                  "cutcontent": "cut", "eventcontent": "event", "noncanon": "noncanon",
                  "inprogress": "wip", "conjecture": "conjecture"}
KIND_BY_CATEGORY = {
    "Voidzones": "voidzone", "Dungeons": "dungeon", "Chime of Conflict Arenas": "arena",
    "Locations in Battle Royale": "battle-royale", "The Depths": "depths",
}
LO, LC = "⟦", "⟧"  # маркеры ссылок


def api(params):
    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def fetch_pages():
    pages = {}
    params = {
        "action": "query", "generator": "categorymembers", "gcmtitle": "Category:Locations",
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


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower().replace("'", "")).strip("-")


def categories(text):
    return re.findall(r"\[\[Category:([^\]|]+)", text)


def mark_links(text):
    """[[Страница|подпись]] -> ⟦Страница|подпись⟧ (кроме файлов и категорий)."""
    def rep(m):
        target, _, label = m.group(1).partition("|")
        target = target.strip()
        if re.match(r"^(File|Image|Category|Media):", target, re.I):
            return ""
        target = target.split("#")[0]
        label = (label or m.group(1).split("|")[0]).strip()
        if not target:
            return label
        return f"{LO}{target}|{label}{LC}"
    return re.sub(r"\[\[([^\[\]]+)\]\]", rep, text)


CURRENT = {"title": ""}
DIALOG = re.compile(r"\{\{\s*(begin|reply|action|end|npc|player)\s*[|}]", re.I)


def prep(text):
    """Подготовка фрагмента: убираем ссылки-сноски, галереи, файлы, расшифровываем частые шаблоны."""
    text = text.replace("{{!}}", "|").replace("{{PAGENAME}}", CURRENT["title"])
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"<ref[^>]*/>", "", text)
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.S)
    text = re.sub(r"<gallery[^>]*>.*?</gallery>", "", text, flags=re.S)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"\{\{\s*c\s*\|\s*(notes|gold|[a-z]+)\s*\|\s*([^{}|]+?)\s*\}\}", r"\2 \1", text, flags=re.I)
    text = re.sub(r"\[(?:https?:)?//\S+\s+([^\]]+)\]", r"", text)
    text = re.sub(r"\[(?:https?:)?//\S+\]", "", text)
    text = mark_links(text)
    return text


def inline(text):
    """Строка викитекста -> чистый текст с маркерами ссылок."""
    text = prep(text)
    return clean(text)


def parse_table(raw):
    """Таблица {| ... |} -> список блоков (метка + вложенные пункты)."""
    blocks = []
    body = re.sub(r"^\{\|[^\n]*\n?", "", raw.strip())
    body = re.sub(r"\n?\|\}\s*$", "", body)
    for row in re.split(r"\n\|-[^\n]*\n?", "\n" + body):
        cells, cur = [], None
        for line in row.split("\n"):
            if line.startswith("|") and not line.startswith("|}"):
                if cur is not None:
                    cells.append(cur)
                cell = line[1:]
                # убираем атрибуты ячейки style=... |
                if "|" in cell and not cell.startswith("[["):
                    head, _, rest = cell.partition("|")
                    if "=" in head and "[[" not in head:
                        cell = rest
                cur = [cell]
            elif line.startswith("!"):
                if cur is not None:
                    cells.append(cur)
                cur = [line[1:].split("|")[-1]]
            elif cur is not None:
                cur.append(line)
        if cur is not None:
            cells.append(cur)
        texts = ["\n".join(c).strip() for c in cells]
        texts = [t for t in texts if t]
        if not texts:
            continue
        label = inline(texts[0].split("\n")[0])
        rest = texts[1:] if len(texts) > 1 else []
        first_body = "\n".join(texts[0].split("\n")[1:]).strip()
        if first_body:
            rest = [first_body] + rest
        if label:
            blocks.append({"t": "li", "d": 1, "x": label})
        for part in rest:
            for b in parse_blocks(part, base_depth=2):
                blocks.append(b)
    return blocks


def parse_blocks(text, base_depth=1):
    """Тело раздела -> блоки: p / li (с глубиной) / h (подзаголовок)."""
    blocks = []
    # вынимаем таблицы
    parts = re.split(r"(\{\|.*?\n\|\})", text, flags=re.S)
    for part in parts:
        if part.startswith("{|"):
            if DIALOG.search(part) or "{{!}}" in part:  # деревья диалогов не переносим
                continue
            blocks += parse_table(part)
            continue
        part = re.sub(r"<gallery[^>]*>.*?</gallery>", "", part, flags=re.S)
        part = re.sub(r"\{\{\s*EnemyGallery.*?\n?\}\}", "", part, flags=re.S | re.I)
        for line in part.splitlines():
            s = line.strip()
            if not s or s in ("<ul>", "</ul>", "----") or DIALOG.search(s) or "#tag:" in s or s.startswith("{{{") or s.startswith("{{!"):
                continue
            if re.match(r"^\[\[(File|Image):", s, re.I) or re.match(r"^\{\{[^{}]*\}\}$", s) and not s.lower().startswith("{{t|"):
                continue
            h = re.match(r"^(={3,6})\s*(.+?)\s*=+\s*$", s)
            if h:
                x = inline(h.group(2))
                if x:
                    blocks.append({"t": "h", "l": len(h.group(1)), "x": x})
                continue
            m = re.match(r"^([*#:]+)\s*(.*)$", s)
            if m:
                x = inline(m.group(2))
                if x:
                    blocks.append({"t": "li", "d": len(m.group(1)) + base_depth - 1, "x": x})
                continue
            x = inline(s)
            if x:
                if blocks and blocks[-1]["t"] == "p" and blocks[-1].get("cont"):
                    blocks[-1]["x"] += " " + x
                else:
                    blocks.append({"t": "p", "x": x})
    junk = re.compile(r"^\||\}\}|\{\{")
    blocks = [b for b in blocks if not junk.search(b["x"])]
    for b in blocks:
        b.pop("cont", None)
    return blocks


def parse_location(title, text):
    CURRENT["title"] = title
    boxes = find_templates(text, "Location")
    if boxes:
        _, p = split_params(boxes[0])
        p = {k.lower().strip(): v for k, v in p.items()}
    else:  # страницы без инфобокса (обзорные: Luminants, First Layer, Markor...)
        p = {}
    cats = categories(text)

    flags = []
    for name in re.findall(r"\{\{\s*([A-Za-z]+)\s*[|}]", text):
        f = FLAG_TEMPLATES.get(name.lower())
        if f and f not in flags:
            flags.append(f)
    for c in cats:
        if c in ("Cut Content",) and "cut" not in flags:
            flags.append("cut")
        if c in ("Event Only Content",) and "event" not in flags:
            flags.append("event")
        if c in ("Content not present in-game",) and "cut" not in flags:
            flags.append("cut")

    kinds = [KIND_BY_CATEGORY[c] for c in cats if c in KIND_BY_CATEGORY]
    region = ""
    for c in cats:
        m = re.match(r"Locations in (?:the )?(.+)$", c)
        if m and c != "Locations in Battle Royale":
            region = m.group(1)
            break
    territory = clean(p.get("territory", ""))
    area = clean(p.get("area", ""))
    if area and area.lower() not in kinds:
        kinds.append(area.lower())

    # противники из {{EnemyGallery}}
    enemies = []
    for g in find_templates(text, "EnemyGallery"):
        parts = [x.strip() for x in g.split("|")[1:]]
        # пары: файл|название
        for i in range(0, len(parts) - 1, 2):
            name = clean(parts[i + 1])
            if name and name not in enemies:
                enemies.append(name)

    # убираем шаблон-инфобокс, служебные шаблоны и категории, режем на разделы
    body = text
    for b in boxes[:1]:
        body = body.replace("{{" + b + "}}", "", 1)
    body = re.sub(r"\[\[Category:[^\]]+\]\]", "", body)
    body = re.sub(r"\{\{\s*(Stub|PathfinderEx|IronVowEx|CutContent|EventContent|NonCanon|InProgress|Topbuttons|Conjecture|Nav|HallowtideNav)[^{}]*\}\}", "", body, flags=re.I)

    pieces = re.split(r"^==\s*([^=\n][^\n]*?)\s*==\s*$", body, flags=re.M)
    intro = parse_blocks(pieces[0])
    sections = []
    for i in range(1, len(pieces), 2):
        title_s = inline(pieces[i])
        if not title_s or title_s.lower().strip(": ") in SKIP_SECTIONS:
            continue
        blocks = parse_blocks(pieces[i + 1])
        if blocks:
            sections.append({"title": title_s, "blocks": blocks})
    intro = [b for b in intro if b["t"] != "h"]

    links = []
    for src in [intro] + [s["blocks"] for s in sections]:
        for b in src:
            for m in re.finditer(LO + r"([^|" + LC + r"]+)\|", b["x"]):
                if m.group(1) not in links:
                    links.append(m.group(1))

    return {
        "name": clean(p.get("name", "")) or title,
        "slug": slugify(title),
        "title": title,
        "caption": clean(p.get("caption", "")),
        "territory": territory,
        "lawless": clean(p.get("lawless", "")).lower() == "true",
        "region": region,
        "kinds": kinds,
        "flags": flags,
        "enemies": enemies,
        "intro": intro,
        "sections": sections,
        "links": links,
        "wiki_url": "https://deepwoken.fandom.com/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
    }


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

    locations, skipped = [], []
    for title, text in sorted(pages.items()):
        loc = parse_location(title, text)
        if loc:
            locations.append(loc)
        else:
            skipped.append(title)

    seen = {}
    for loc in locations:
        n = seen.get(loc["slug"], 0)
        seen[loc["slug"]] = n + 1
        if n:
            loc["slug"] += f"-{n + 1}"

    print(f"Страниц: {len(pages)}, локаций: {len(locations)}, пропущено: {len(skipped)}")
    print("Пропущено:", skipped)
    chars = sum(len(b["x"]) for l in locations for b in l["intro"] + [x for s in l["sections"] for x in s["blocks"]])
    print("Символов текста:", chars)

    data = {
        "source": "https://deepwoken.fandom.com/wiki/Category:Locations",
        "license": "CC BY-SA 3.0",
        "fetched": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "locations": locations,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    OUT_JS.write_text(
        "window.DEEPWOKEN_DATA = window.DEEPWOKEN_DATA || {};\n"
        "window.DEEPWOKEN_DATA.locations = " + json.dumps(data, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
