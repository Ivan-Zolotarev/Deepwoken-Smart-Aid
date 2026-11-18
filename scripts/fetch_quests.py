"""Собирает квесты со страницы Quests Deepwoken Wiki (Fandom) в data/quests.json и data/quests.js.

Запуск: python scripts/fetch_quests.py [--offline]
  --offline  взять сохранённый кэш scripts/.cache/Quests.wiki

Источник: https://deepwoken.fandom.com/wiki/Quests (CC BY-SA 3.0).
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
from wikitext import clean  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).parent / ".cache" / "Quests.wiki"
OUT = ROOT / "data" / "quests.json"
OUT_JS = ROOT / "data" / "quests.js"

API = "https://deepwoken.fandom.com/api.php"
PAGE = "Quests"
USER_AGENT = "DeepwokenSmartAid/0.1 (fan project)"

# Заголовок уровня 2 -> тип квеста
KINDS = {
    "talent quests": "talent",
    "one-time ordinary quests": "one-time",
    "repeatable ordinary quests": "repeatable",
}
TRAITS = {"bravery", "compassion", "curiosity", "miscellaneous"}


def fetch_wikitext():
    query = urllib.parse.urlencode(
        {"action": "parse", "page": PAGE, "prop": "wikitext", "format": "json"}
    )
    req = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)["parse"]["wikitext"]["*"]


def slugify(name):
    s = re.sub(r"[^a-z0-9]+", "-", name.lower().replace("'", ""))
    return s.strip("-")


def links(raw):
    """Имена всех [[ссылок]] (цель ссылки, не подпись)."""
    out = []
    for m in re.finditer(r"\[\[(?!File:|Category:)([^\]|#]+)", raw):
        name = m.group(1).strip()
        if name and name not in out:
            out.append(name)
    return out


def talents_in(raw):
    out = []
    for m in re.finditer(r"\{\{t\|([^{}|]+)", raw):
        name = m.group(1).strip()
        if name not in out:
            out.append(name)
    return out


def parse_block(block):
    """Разбирает тело квеста: поля, шаги, NPC."""
    # NPC: подписи миниатюр [[File:..|thumb|right|<div ...>[[Name]]</div>]]
    npcs = []
    for m in re.finditer(r"\[\[File:[^\n]*?\[\[(?:[^\]|]*\|)?([^\]]+)\]\]", block):
        if m.group(1) not in npcs:
            npcs.append(m.group(1).strip())

    for g in re.findall(r"<gallery.*?</gallery>", block, flags=re.S):
        for m in re.finditer(r"\|\s*\[\[([^\]|]+)", g):
            if m.group(1) not in npcs:
                npcs.append(m.group(1).strip())

    # убираем галереи, таблицу-обёртку и файлы
    body = re.sub(r"<gallery.*?</gallery>", "", block, flags=re.S)
    body = re.sub(r"\[\[File:[^\n]*", "", body)
    body = re.sub(r"^\s*(\{\||\|\}|\|\s*style[^\n]*|\|-[^\n]*)\s*$", "", body, flags=re.M)
    body = re.sub(r"</?div[^>]*>", "", body)
    body = re.sub(r"<gallery.*?</gallery>", "", body, flags=re.S)

    # делим по известным жирным меткам; прочий жирный текст остаётся в абзаце
    label_re = r"'''\s*(quest location|guide|rewards?\(?s?\)?|afterwards?|notes?)\s*:?\s*'''\s*:?"
    parts = re.split(label_re, body, flags=re.I)
    fields = {}
    for i in range(1, len(parts) - 1, 2):
        label = parts[i].strip().lower()
        if label.startswith("quest"):
            key = "location"
        elif label == "guide":
            key = "guide"
        elif label.startswith("reward"):
            key = "rewards"
        else:
            key = "afterwards"
        fields[key] = fields.get(key, "") + parts[i + 1]

    result = {"npcs": npcs}
    loc = fields.get("location", "")
    result["locations"] = links(loc) or ([clean(loc)] if clean(loc) else [])
    result["location_text"] = clean(loc).replace("\n", " ")

    guide_raw = fields.get("guide", "")
    guide = []
    for line in guide_raw.split("\n"):
        line = line.strip()
        if not line:
            continue
        guide.append({"text": clean(line.lstrip("*# ")), "step": line[0] in "*#"})
    result["guide"] = guide
    after = clean(fields.get("afterwards", "")).replace("\n", " ")
    if after:
        result["afterwards"] = after

    rew_raw = re.split(r"\{\{History|Category:", fields.get("rewards", ""))[0]
    result["rewards"] = clean(rew_raw).replace("\n", " ")
    result["reward_talents"] = talents_in(rew_raw)
    result["links"] = links(guide_raw)
    return result


def parse_page(text):
    quests = []
    kind = trait = None
    cur = None
    buf = []

    def flush():
        if cur is not None:
            q = parse_block("\n".join(buf))
            q.update(cur)
            quests.append(q)

    for line in text.split("\n"):
        m = re.match(r"^(={2,4})\s*(.*?)\s*\1\s*$", line)
        if not m:
            buf.append(line)
            continue
        level, title = len(m.group(1)), m.group(2)
        flush()
        buf = []
        cur = None
        low = title.lower()
        if level == 2:
            kind = KINDS.get(low)
            trait = None
        elif level == 3:
            trait = low if low in TRAITS else trait
        elif level == 4 and kind:
            cur = {"name": title, "kind": kind, "trait": trait}
    flush()
    return quests


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true")
    args = ap.parse_args()

    CACHE.parent.mkdir(exist_ok=True)
    if args.offline and CACHE.exists():
        text = CACHE.read_text(encoding="utf-8")
    else:
        text = fetch_wikitext()
        CACHE.write_text(text, encoding="utf-8")

    quests = parse_page(text)
    seen = set()
    for q in quests:
        q["slug"] = slugify(q["name"])
        if q["slug"] in seen:
            q["slug"] += "-" + q["kind"]
        seen.add(q["slug"])

    # проверка целостности
    problems = [q["name"] for q in quests if not q["guide"]]
    no_loc = [q["name"] for q in quests if not q["locations"]]
    no_rew = [q["name"] for q in quests if not q["rewards"]]
    print(f"Квестов: {len(quests)}")
    print("Без гайда:", problems)
    print("Без локации:", no_loc)
    print("Без наград:", no_rew)

    data = {
        "source": "https://deepwoken.fandom.com/wiki/Quests",
        "license": "CC BY-SA 3.0",
        "fetched": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "quests": quests,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    OUT_JS.write_text(
        "window.DEEPWOKEN_DATA = window.DEEPWOKEN_DATA || {};\n"
        "window.DEEPWOKEN_DATA.quests = "
        + json.dumps(data, ensure_ascii=False)
        + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
