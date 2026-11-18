"""Минимальный разбор вики-разметки MediaWiki без внешних зависимостей."""
import re


def find_templates(text, name_prefix):
    """Находит верхнеуровневые шаблоны {{name_prefix...}} с учётом вложенности.

    Возвращает список строк тела шаблона (без внешних {{ }}).
    """
    result = []
    i = 0
    n = len(text)
    marker = "{{" + name_prefix
    while True:
        start = text.find(marker, i)
        if start == -1:
            break
        depth = 0
        j = start
        while j < n:
            if text.startswith("{{", j):
                depth += 1
                j += 2
            elif text.startswith("}}", j):
                depth -= 1
                j += 2
                if depth == 0:
                    break
            else:
                j += 1
        if depth != 0:  # незакрытый шаблон
            break
        result.append(text[start + 2 : j - 2])
        i = j
    return result


def split_params(body):
    """Делит тело шаблона по '|' верхнего уровня.

    Не режет внутри {{...}} и [[...]]. Возвращает (имя_шаблона, {параметр: значение}).
    """
    parts = []
    buf = []
    brace = 0
    bracket = 0
    i = 0
    n = len(body)
    while i < n:
        two = body[i : i + 2]
        if two == "{{":
            brace += 1
            buf.append(two)
            i += 2
        elif two == "}}":
            brace -= 1
            buf.append(two)
            i += 2
        elif two == "[[":
            bracket += 1
            buf.append(two)
            i += 2
        elif two == "]]":
            bracket -= 1
            buf.append(two)
            i += 2
        elif body[i] == "|" and brace == 0 and bracket == 0:
            parts.append("".join(buf))
            buf = []
            i += 1
        else:
            buf.append(body[i])
            i += 1
    parts.append("".join(buf))

    name = parts[0].strip()
    params = {}
    for idx, part in enumerate(parts[1:], start=1):
        if "=" in part:
            key, _, value = part.partition("=")
            params[key.strip()] = value.strip()
        else:
            params[str(idx)] = part.strip()
    return name, params


_LINK = re.compile(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]")
# Шаблоны вида {{t|Name}}, {{status|Name}}, {{abf|[Tag]}} -> берём последнее значение
_TPL = re.compile(r"\{\{([^{}|]+)\|([^{}]*)\}\}")


def clean(text):
    """Превращает вики-разметку в обычный текст."""
    if not text:
        return ""
    prev = None
    while prev != text:
        prev = text
        text = _TPL.sub(lambda m: m.group(2).split("|")[-1], text)
    text = _LINK.sub(r"\1", text)
    text = re.sub(r"'{2,}", "", text)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()
