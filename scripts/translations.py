"""Работа с переводами талантов.

Источник правды: data/translations/talents.ru.json (слаг -> перевод). Правится вручную или пачками.
Команды:
  python scripts/translations.py status            сколько переведено, что устарело
  python scripts/translations.py batch N [Common,Rare]
                                                   выдать N ещё не переведённых талантов в JSON
  python scripts/translations.py build             проверить и собрать data/talents.ru.js для сайта
"""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TALENTS = ROOT / "data" / "talents.json"
GLOSSARY = ROOT / "data" / "glossary.ru.json"
TR_DIR = ROOT / "data" / "translations"
TR_FILE = TR_DIR / "talents.ru.json"
OUT_JS = ROOT / "data" / "talents.ru.js"


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def source_hash(t):
    """Хэш английского текста: если вики изменила описание, перевод помечается устаревшим."""
    raw = "\n".join([t["description"], t["stats"]] + [i["text"] for i in t["info"]])
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:10]


def load_talents():
    return {slugify(t["name"]): t for t in json.loads(TALENTS.read_text(encoding="utf-8"))["talents"]}


def load_tr():
    if TR_FILE.exists():
        return json.loads(TR_FILE.read_text(encoding="utf-8"))
    return {}


def cmd_status():
    talents, tr = load_talents(), load_tr()
    stale = [s for s, v in tr.items() if s in talents and v.get("src") != source_hash(talents[s])]
    missing = [s for s in tr if s not in talents]
    print(f"Переведено: {len(tr)} / {len(talents)}; устарело: {len(stale)}; нет в данных: {len(missing)}")
    for s in stale:
        print("  устарел:", s)
    for s in missing:
        print("  нет таланта:", s)


def cmd_batch(n, rarities):
    talents, tr = load_talents(), load_tr()
    out = []
    for slug, t in talents.items():
        if slug in tr and tr[slug].get("src") == source_hash(t):
            continue
        if rarities and t["rarity"] not in rarities:
            continue
        out.append({
            "slug": slug,
            "name": t["name"],
            "description": t["description"],
            "info": [i["text"] for i in t["info"]],
            "stats": t["stats"],
        })
        if len(out) >= n:
            break
    # по одному таланту в строке: компактно и удобно читать
    for item in out:
        print(json.dumps(item, ensure_ascii=False, separators=(",", ":")))


def cmd_merge(path):
    """Добавляет пачку переводов (JSON слаг -> перевод) в talents.ru.json и проставляет хэши."""
    talents, tr = load_talents(), load_tr()
    batch = json.loads(Path(path).read_text(encoding="utf-8"))
    bad = 0
    for slug, v in batch.items():
        t = talents.get(slug)
        if not t:
            print("! нет таланта:", slug)
            bad += 1
            continue
        if len(v.get("info", [])) != len(t["info"]):
            print(f"! {slug}: пунктов info {len(v.get('info', []))}, в оригинале {len(t['info'])}, пропущен")
            bad += 1
            continue
        v.setdefault("stats", "")
        v["src"] = source_hash(t)
        tr[slug] = v
    TR_FILE.write_text(json.dumps(tr, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Добавлено: {len(batch) - bad}, отклонено: {bad}, всего переведено: {len(tr)}")


def cmd_stamp():
    """Проставляет хэш исходника переводам, у которых его ещё нет (после свежего перевода)."""
    talents, tr = load_talents(), load_tr()
    n = 0
    for slug, v in tr.items():
        if slug in talents and "src" not in v:
            v["src"] = source_hash(talents[slug])
            n += 1
    TR_FILE.write_text(json.dumps(tr, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Проставлен хэш: {n}")


def cmd_build():
    talents, tr = load_talents(), load_tr()
    glossary = json.loads(GLOSSARY.read_text(encoding="utf-8"))
    problems = 0
    for slug, v in tr.items():
        t = talents.get(slug)
        if not t:
            print("! нет таланта в данных:", slug)
            problems += 1
            continue
        if len(v.get("info", [])) != len(t["info"]):
            print(f"! {slug}: пунктов info {len(v.get('info', []))}, в оригинале {len(t['info'])}")
            problems += 1
        if not v.get("description"):
            print(f"! {slug}: нет описания")
            problems += 1
        if v.get("src") != source_hash(t):
            print(f"! {slug}: перевод устарел (оригинал изменился)")
            problems += 1
    payload = {
        "translations": {
            s: {
                "description": v["description"],
                "info": v.get("info", []),
                "stats": v.get("stats", ""),
            }
            for s, v in tr.items() if s in talents
        },
        "glossary": {x["en"]: x["ru"] for x in glossary["terms"]},
    }
    OUT_JS.write_text(
        "window.DEEPWOKEN_DATA = window.DEEPWOKEN_DATA || {};\n"
        "window.DEEPWOKEN_DATA.ru = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    print(f"Собрано переводов: {len(payload['translations'])}, проблем: {problems} -> {OUT_JS.relative_to(ROOT)}")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    TR_DIR.mkdir(parents=True, exist_ok=True)
    if len(sys.argv) < 2:
        print(__doc__)
        return
    cmd = sys.argv[1]
    if cmd == "status":
        cmd_status()
    elif cmd == "batch":
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 25
        r = set(sys.argv[3].split(",")) if len(sys.argv) > 3 else set()
        cmd_batch(n, r)
    elif cmd == "merge":
        cmd_merge(sys.argv[2])
    elif cmd == "stamp":
        cmd_stamp()
    elif cmd == "build":
        cmd_build()
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
