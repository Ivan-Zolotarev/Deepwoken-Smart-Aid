"""Проверяет data/translations/quests.ru.json и собирает data/quests.ru.js для сайта."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
quests = json.loads((ROOT / "data" / "quests.json").read_text(encoding="utf-8"))["quests"]
tr = json.loads((ROOT / "data" / "translations" / "quests.ru.json").read_text(encoding="utf-8"))

problems = []
for q in quests:
    t = tr.get(q["slug"])
    if not t:
        problems.append(f"нет перевода: {q['slug']}")
        continue
    if len(t["guide"]) != len(q["guide"]):
        problems.append(f"число абзацев: {q['slug']} {len(t['guide'])} != {len(q['guide'])}")
    if bool(q.get("afterwards")) != bool(t.get("afterwards")):
        problems.append(f"afterwards: {q['slug']}")
    if bool(q["rewards"]) != bool(t["rewards"]):
        problems.append(f"rewards: {q['slug']}")
for k in tr:
    if k not in {q["slug"] for q in quests}:
        problems.append(f"лишний ключ: {k}")

print(f"Переводов: {len(tr)} из {len(quests)}; проблем: {len(problems)}")
for p in problems:
    print(" ", p)
if problems:
    raise SystemExit(1)
(ROOT / "data" / "quests.ru.js").write_text(
    "window.DEEPWOKEN_DATA = window.DEEPWOKEN_DATA || {};\n"
    "window.DEEPWOKEN_DATA.questsRu = " + json.dumps(tr, ensure_ascii=False) + ";\n",
    encoding="utf-8",
)
