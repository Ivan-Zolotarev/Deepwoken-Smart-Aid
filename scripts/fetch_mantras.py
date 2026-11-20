"""Собирает мантры из Deepwoken Wiki (Fandom) в data/mantras.json и data/mantras.js.

Запуск: python scripts/fetch_mantras.py [--offline]
  --offline  взять сохранённый кэш scripts/.cache/Mantras.json

Источник: https://deepwoken.fandom.com/wiki/Mantras (CC BY-SA 3.0).
Отдельных страниц у мантр нет: каждая описана шаблоном {{MantraInfobox|...}} на странице
школы (Flamecharm...), гибридов, клятвы, монстров и т.д. Берём все такие страницы.
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
CACHE = Path(__file__).parent / ".cache" / "Mantras.json"
OUT = ROOT / "data" / "mantras.json"
OUT_JS = ROOT / "data" / "mantras.js"

API = "https://deepwoken.fandom.com/api.php"
USER_AGENT = "DeepwokenSmartAid/0.1 (fan project)"

ATTUNEMENTS = {"Flamecharm", "Frostdraw", "Thundercall", "Galebreathe", "Shadowcast",
               "Ironsing", "Bloodrend", "Lifeweave"}
MONSTER_PAGES = {"Monster Mantras"}
SKIP_PREFIX = ("Template:", "User:", "Category:", "Mantras/", "User blog:")
# порядок важности источников при дубликатах
KIND_ORDER = {"attunement": 0, "neutral": 1, "hybrid": 2, "oath": 3, "origin": 4, "monster": 5}


def api(params):
    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def fetch_pages():
    """Страницы, использующие MantraInfobox: {title: wikitext}."""
    data = api({"action": "query", "list": "embeddedin", "eititle": "Template:MantraInfobox",
                "eilimit": "500", "format": "json"})
    titles = [x["title"] for x in data["query"]["embeddedin"]
              if not x["title"].startswith(SKIP_PREFIX)]
    pages = {}
    for t in titles:
        d = api({"action": "parse", "page": t, "prop": "wikitext", "redirects": "1", "format": "json"})
        pages[t] = d["parse"]["wikitext"]["*"]
    return pages


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower().replace("'", "")).strip("-")


def source_of(title):
    """(kind, name) источника мантры по названию страницы."""
    if title in ATTUNEMENTS:
        return "attunement", title
    if title == "Attunement-less":
        return "neutral", title
    if title == "Hybrid Abilities":
        return "hybrid", title
    if title in MONSTER_PAGES:
        return "monster", title
    if title.startswith("Oath: "):
        return "oath", title[6:]
    if title.endswith(" (Origin)"):
        return "origin", title[:-9]
    return "origin", re.sub(r"\s*\((Memento)\)", "", title)


def effect_lines(raw):
    """Тело effect -> (intro, [ {depth, text} | {heading} ])."""
    raw = re.sub(r"<gallery[^>]*>.*?</gallery>", "", raw, flags=re.S)
    raw = re.sub(r"</?(tabber|ul|ol|li)[^>]*>", "", raw)
    raw = raw.replace("{{text|pvedmg|", "PvE: {{text|x|").replace("{{text|x|", "{{text|")
    intro, items = "", []
    for line in raw.splitlines():
        s = line.strip()
        if not s or s in ("-", "|-|"):
            continue
        h = re.match(r"^\|-\|\s*(.+?)\s*=?\s*$", s)
        if h:
            items.append({"heading": clean(h.group(1)).rstrip("=").strip()})
            continue
        m = re.match(r"^(\*+)\s*(.*)$", s)
        if m:
            text = clean(m.group(2))
            if text:
                items.append({"depth": len(m.group(1)), "text": text})
            continue
        text = clean(s)
        if not text:
            continue
        if not items and not intro:
            intro = text.strip("'").strip()
        elif items and "depth" in items[-1]:
            items[-1]["text"] += " " + text
        else:
            items.append({"depth": 1, "text": text})
    return intro, items


def stars_of(name):
    m = re.search(r"\(([★☆]{1,5})\)", name)
    return m.group(1).count("★") if m else None


def parse_infoboxes(title, text):
    kind, src = source_of(title)
    res = []
    for body in find_templates(text, "MantraInfobox"):
        # effect занимает всё до конца шаблона (в нём табы с '|'), поэтому режем вручную
        m = re.search(r"\n\|effect\s*=", body)
        head = body[:m.start()] if m else body
        eff_raw = body[m.end():] if m else ""
        _, p = split_params(head)
        p = {k.lower().strip(): v for k, v in p.items()}
        raw_name = clean(p.get("name", ""))
        name = re.sub(r"\s*\([★☆]+\)\s*$", "", raw_name).strip()
        if not name:
            continue
        intro, lines = effect_lines(eff_raw)
        # прочие поля вида |blast spark=... относятся к эффекту
        for k, v in p.items():
            if k in ("name", "image", "desc", "ethercost", "ethercostesc", "dmgtype", "reqs",
                     "mantratype", "size") or k.isdigit() or k == "base":
                continue
            for ln in v.splitlines():
                mm = re.match(r"^(\*+)\s*(.*)$", ln.strip())
                if mm and clean(mm.group(2)):
                    lines.append({"depth": len(mm.group(1)), "text": clean(mm.group(2))})
        if intro in ("?", "-"):
            intro = ""
        ether = clean(p.get("ethercost", "")) or clean(p.get("ethercostesc", ""))
        dmgtype = clean(p.get("dmgtype", ""))
        res.append({
            "name": name,
            "slug": slugify(name),
            "stars": stars_of(raw_name),
            "type": clean(p.get("mantratype", "")),
            "desc": clean(p.get("desc", "")),
            "ether": "" if ether == "?" else ether,
            "damage_type": "" if dmgtype == "?" else dmgtype,
            "requirements": "" if clean(p.get("reqs", "")) == "?" else clean(p.get("reqs", "")),
            "effect_intro": intro,
            "effect": lines,
            "source_kind": kind,
            "source": src,
            "wiki_url": "https://deepwoken.fandom.com/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
        })
    return res


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

    found = []
    for title, text in sorted(pages.items()):
        if title.startswith(SKIP_PREFIX):
            continue
        found += parse_infoboxes(title, text)

    # дубликаты (одна мантра на нескольких страницах): оставляем более «основной» источник
    best = {}
    for m in found:
        key = m["name"].lower()
        if key not in best or KIND_ORDER[m["source_kind"]] < KIND_ORDER[best[key]["source_kind"]]:
            best[key] = m
    mantras = sorted(best.values(), key=lambda m: (KIND_ORDER[m["source_kind"]], m["source"], m["name"]))

    seen = {}
    for m in mantras:  # на случай коллизии слагов
        n = seen.get(m["slug"], 0)
        seen[m["slug"]] = n + 1
        if n:
            m["slug"] += f"-{n + 1}"

    kinds = {}
    for m in mantras:
        kinds[m["source_kind"]] = kinds.get(m["source_kind"], 0) + 1
    print(f"Найдено блоков: {len(found)}, уникальных мантр: {len(mantras)}")
    print("По источникам:", kinds)

    data = {
        "source": "https://deepwoken.fandom.com/wiki/Mantras",
        "license": "CC BY-SA 3.0",
        "fetched": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "mantras": mantras,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    OUT_JS.write_text(
        "window.DEEPWOKEN_DATA = window.DEEPWOKEN_DATA || {};\n"
        "window.DEEPWOKEN_DATA.mantras = " + json.dumps(data, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
