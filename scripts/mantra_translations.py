"""Переводы мантр: data/translations/mantras.ru.json -> data/mantras.ru.js.

Переводятся: desc (описание), effect_intro (одна строка о том, что делает мантра) и effect —
список переводов пунктов эффекта (только пунктов с текстом, заголовки вкладок не входят) в том же порядке.

Команды:
  status           сколько переведено и что устарело
  batch N          вывести N непереведённых (или устаревших) мантр, по одной в строке JSON
  merge FILE       влить файл переводов {slug: {desc?, effect_intro?, effect?}} (с проверкой)
  build            проверить и собрать data/mantras.ru.js
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "mantras.json"
TR = ROOT / "data" / "translations" / "mantras.ru.json"
OUT = ROOT / "data" / "mantras.ru.js"


def source(m):
    return {"desc": m.get("desc", ""), "effect_intro": m.get("effect_intro", "")}


def effect_texts(m):
    return [e["text"] for e in m.get("effect", []) if "text" in e]


def h(obj):
    return hashlib.sha1(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()[:10]


def digest(m):
    return h(source(m))


def digest_e(m):
    return h(effect_texts(m))


def load():
    mantras = json.loads(SRC.read_text(encoding="utf-8"))["mantras"]
    tr = json.loads(TR.read_text(encoding="utf-8")) if TR.exists() else {}
    return mantras, tr


def save(tr):
    TR.parent.mkdir(parents=True, exist_ok=True)
    TR.write_text(json.dumps(tr, ensure_ascii=False, indent=0, sort_keys=True), encoding="utf-8")


def needs_main(m, tr):
    s = source(m)
    if not s["desc"] and not s["effect_intro"]:
        return False
    t = tr.get(m["slug"])
    return not t or t.get("src") != digest(m)


def needs_effect(m, tr):
    if not effect_texts(m):
        return False
    t = tr.get(m["slug"])
    return not t or t.get("src_e") != digest_e(m) or len(t.get("effect", [])) != len(effect_texts(m))


def needs(m, tr):
    return needs_main(m, tr) or needs_effect(m, tr)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    mantras, tr = load()
    slugs = {m["slug"] for m in mantras}

    if cmd == "status":
        a = [m for m in mantras if needs_main(m, tr)]
        b = [m for m in mantras if needs_effect(m, tr)]
        ta = sum(1 for m in mantras if source(m)["desc"] or source(m)["effect_intro"])
        tb = sum(1 for m in mantras if effect_texts(m))
        print(f"Описания: {ta - len(a)} из {ta}; пункты эффекта: {tb - len(b)} из {tb}")
    elif cmd == "batch":
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 60
        for m in [m for m in mantras if needs(m, tr)][:n]:
            row = {"slug": m["slug"]}
            if needs_main(m, tr):
                row.update({k: v for k, v in source(m).items() if v})
            if needs_effect(m, tr):
                row["effect"] = effect_texts(m)
            print(json.dumps(row, ensure_ascii=False))
    elif cmd == "merge":
        new = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
        by = {m["slug"]: m for m in mantras}
        bad = []
        for slug, t in new.items():
            m = by.get(slug)
            if not m:
                bad.append(f"неизвестный slug: {slug}")
                continue
            s = source(m)
            old = tr.get(slug, {})
            for f in ("desc", "effect_intro"):
                if s[f] and not t.get(f) and not old.get(f):
                    bad.append(f"нет поля {f}: {slug}")
            src = effect_texts(m)
            if "effect" in t and len(t["effect"]) != len(src):
                bad.append(f"пунктов эффекта {len(t['effect'])}, а в оригинале {len(src)}: {slug}")
            if src and "effect" not in t and "effect" not in old:
                bad.append(f"нет effect: {slug}")
        if bad:
            print("\n".join(bad))
            raise SystemExit(1)
        for slug, t in new.items():
            e = {**tr.get(slug, {}), **t}
            e["src"] = digest(by[slug])
            if "effect" in e:
                e["src_e"] = digest_e(by[slug])
            tr[slug] = e
        save(tr)
        print(f"Влито {len(new)}; всего {len(tr)}")
    elif cmd == "build":
        problems = [f"лишний ключ: {k}" for k in tr if k not in slugs]
        problems += [f"устарел или не хватает: {m['slug']}" for m in mantras if m["slug"] in tr and needs(m, tr)]
        if problems:
            print("\n".join(problems))
            raise SystemExit(1)
        out = {k: {f: v for f, v in t.items() if f not in ("src", "src_e")} for k, t in tr.items()}
        OUT.write_text(
            "window.DEEPWOKEN_DATA = window.DEEPWOKEN_DATA || {};\n"
            "window.DEEPWOKEN_DATA.mantrasRu = " + json.dumps(out, ensure_ascii=False) + ";\n",
            encoding="utf-8",
        )
        print(f"Собрано {len(out)} переводов, проблем нет")
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
