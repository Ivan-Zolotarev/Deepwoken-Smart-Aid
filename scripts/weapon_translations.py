"""Переводы оружия: data/translations/weapons.ru.json -> data/weapons.ru.js.

Команды:
  status           сколько переведено и что устарело
  batch N          вывести N непереведённых (или устаревших) единиц оружия, по одной в строке JSON
  merge FILE       влить файл переводов {slug: {description, special_effect}} (с проверкой)
  build            проверить и собрать data/weapons.ru.js
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "weapons.json"
TR = ROOT / "data" / "translations" / "weapons.ru.json"
OUT = ROOT / "data" / "weapons.ru.js"


PLACEHOLDERS = {"", "\"\"", "???", "...", "..", "tba", "tbd", "n/a", "na", "none", "?", "-"}


def real(text):
    """Пустая строка вместо заглушек вики вроде '...' и 'TBA'."""
    return "" if (text or "").strip().lower() in PLACEHOLDERS else text


def source(w):
    """Переводимые поля оружия."""
    return {
        "description": real(w.get("description", "")),
        "special_effect": real((w.get("extra") or {}).get("special effect", "")),
    }


def digest(w):
    return hashlib.sha1(json.dumps(source(w), sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()[:10]


def load():
    weapons = json.loads(SRC.read_text(encoding="utf-8"))["weapons"]
    tr = json.loads(TR.read_text(encoding="utf-8")) if TR.exists() else {}
    return weapons, tr


def save(tr):
    TR.parent.mkdir(parents=True, exist_ok=True)
    TR.write_text(json.dumps(tr, ensure_ascii=False, indent=0, sort_keys=True), encoding="utf-8")


def needs(w, tr):
    s = source(w)
    if not s["description"] and not s["special_effect"]:
        return False
    t = tr.get(w["slug"])
    return not t or t.get("src") != digest(w)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    weapons, tr = load()
    slugs = {w["slug"] for w in weapons}

    if cmd == "status":
        todo = [w for w in weapons if needs(w, tr)]
        total = sum(1 for w in weapons if source(w)["description"] or source(w)["special_effect"])
        print(f"Переведено {total - len(todo)} из {total}; осталось {len(todo)}")
    elif cmd == "batch":
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 60
        for w in [w for w in weapons if needs(w, tr)][:n]:
            print(json.dumps({"slug": w["slug"], **{k: v for k, v in source(w).items() if v}}, ensure_ascii=False))
    elif cmd == "merge":
        new = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
        by = {w["slug"]: w for w in weapons}
        bad = []
        for slug, t in new.items():
            w = by.get(slug)
            if not w:
                bad.append(f"неизвестный slug: {slug}")
                continue
            s = source(w)
            if s["description"] and not t.get("description"):
                bad.append(f"нет описания: {slug}")
            if s["special_effect"] and not t.get("special_effect"):
                bad.append(f"нет особого эффекта: {slug}")
        if bad:
            print("\n".join(bad))
            raise SystemExit(1)
        for slug, t in new.items():
            tr[slug] = {**t, "src": digest(by[slug])}
        save(tr)
        print(f"Влито {len(new)}; всего {len(tr)}")
    elif cmd == "build":
        problems = [f"лишний ключ: {k}" for k in tr if k not in slugs]
        problems += [f"устарел: {w['slug']}" for w in weapons if w["slug"] in tr and needs(w, tr)]
        for w in weapons:
            t = tr.get(w["slug"])
            if t and "Yes" in t.get("description", "")[:0]:
                pass
        if problems:
            print("\n".join(problems))
            raise SystemExit(1)
        out = {k: {f: v for f, v in t.items() if f != "src"} for k, t in tr.items()}
        OUT.write_text(
            "window.DEEPWOKEN_DATA = window.DEEPWOKEN_DATA || {};\n"
            "window.DEEPWOKEN_DATA.weaponsRu = " + json.dumps(out, ensure_ascii=False) + ";\n",
            encoding="utf-8",
        )
        print(f"Собрано {len(out)} переводов, проблем нет")
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
