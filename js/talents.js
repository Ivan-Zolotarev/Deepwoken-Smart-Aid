// Раздел «Таланты»: каталог с фильтрами и карточка таланта
(function () {
  var I18N = window.I18N;
  var PAGE_SIZE = 60;
  // Стат-требования, по которым имеет смысл фильтровать (остальное в вики — текстовые условия)
  var STAT_FILTER = [
    "Strength", "Fortitude", "Agility", "Intelligence", "Willpower", "Charisma",
    "Flamecharm", "Frostdraw", "Thundercall", "Galebreathe", "Shadowcast", "Ironsing", "Bloodrend",
    "Light Weapon", "Medium Weapon", "Heavy Weapon"
  ];

  var state = { q: "", rarity: "", category: "", tag: "", stat: "", limit: PAGE_SIZE };
  var data = null;          // массив талантов
  var bySlug = {};
  var options = null;       // значения для фильтров
  var loading = null;
  var ru = { translations: {}, glossary: {} };   // русские переводы и словарь терминов
  var showOriginal = false;                      // в карточке: показать английский оригинал

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function slugify(n) {
    return String(n).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function t(k) { return I18N.t(k); }
  function rarityLabel(key) {
    var k = "rarity." + key;
    var v = t(k);
    return v === k ? key : v;
  }

  function isRu() { return I18N.lang === "ru"; }
  // Перевод таланта для текущего языка или null
  function trans(x) { return isRu() ? (ru.translations[x.slug] || null) : null; }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // Термин по словарю: «Passive Agility» -> «Пассивная Ловкость» (только в русском интерфейсе)
  function term(s) {
    if (!isRu()) return s;
    var plus = s.charAt(0) === "+" ? "+" : "";
    var v = ru.glossary[plus ? s.slice(1) : s];
    return v ? plus + cap(v) : s;
  }

  var STAT_NAMES = ["Strength", "Fortitude", "Agility", "Intelligence", "Willpower", "Charisma",
    "Light Weapon", "Medium Weapon", "Heavy Weapon"];
  var statRe = new RegExp("\\b(" + STAT_NAMES.join("|") + ")\\b", "g");

  // Названия статов внутри строки требований: «65 Willpower» -> «65 Сила воли»
  function reqText(raw) {
    if (!isRu()) return raw;
    return raw.replace(statRe, function (m) { return ru.glossary[m] ? cap(ru.glossary[m]) : m; });
  }

  function init() {
    if (window.DEEPWOKEN_DATA.ru) ru = window.DEEPWOKEN_DATA.ru;
    var payload = window.DEEPWOKEN_DATA.talents;
    data = payload.talents;
    var rar = {}, cat = {}, tag = {};
    data.forEach(function (x) {
      x.slug = slugify(x.name);
      x.rarityKey = x.rarity || "Equipment";
      x.statNames = x.requirements.stats.map(function (s) { return s.stat; });
      var tr = ru.translations[x.slug];
      x.hay = (x.name + " " + x.description + " " + x.category + " " + x.tags.join(" ") +
        (tr ? " " + tr.description : "")).toLowerCase();
      bySlug[x.slug] = x;
      rar[x.rarityKey] = (rar[x.rarityKey] || 0) + 1;
      if (x.category) cat[x.category] = 1;
      x.tags.forEach(function (g) { tag[g] = 1; });
    });
    options = {
      rarities: Object.keys(rar).sort(function (a, b) { return rar[b] - rar[a]; }),
      categories: Object.keys(cat).sort(),
      tags: Object.keys(tag).sort()
    };
  }

  function load() {
    if (data) return Promise.resolve();
    if (!loading) {
      loading = new Promise(function (resolve, reject) {
        var addScript = function (src, ok, fail) {
          var s = document.createElement("script");
          s.src = src;
          s.onload = ok;
          s.onerror = fail;
          document.head.appendChild(s);
        };
        var loadTalents = function () {
          addScript("data/talents.js",
            function () { init(); resolve(); },
            function () { loading = null; reject(new Error("talents.js")); });
        };
        // Переводы необязательны: если файла нет, показываем оригинал
        addScript("data/talents.ru.js", loadTalents, loadTalents);
      });
    }
    return loading;
  }

  // ---------- Список ----------
  function filtered() {
    var q = state.q.trim().toLowerCase();
    return data.filter(function (x) {
      if (state.rarity && x.rarityKey !== state.rarity) return false;
      if (state.category && x.category !== state.category) return false;
      if (state.tag && x.tags.indexOf(state.tag) === -1) return false;
      if (state.stat && x.statNames.indexOf(state.stat) === -1) return false;
      if (q && x.hay.indexOf(q) === -1) return false;
      return true;
    });
  }

  function selectHtml(id, label, values, current, fmt) {
    var opts = '<option value="">' + esc(t("talents.any")) + '</option>' + values.map(function (v) {
      return '<option value="' + esc(v) + '"' + (v === current ? " selected" : "") + '>' + esc(fmt ? fmt(v) : v) + '</option>';
    }).join("");
    return '<label class="field"><span>' + esc(label) + '</span><select id="' + id + '">' + opts + '</select></label>';
  }

  function cardHtml(x) {
    var tr = trans(x);
    var req = x.requirements.raw ? '<p class="card__req">' + esc(reqText(x.requirements.raw)) + '</p>' : "";
    var untranslated = isRu() && !tr
      ? ' <span class="tag tag--en" title="' + esc(t("talents.untranslated")) + '">EN</span>' : "";
    return '<a class="card card--talent" href="#/talents/' + x.slug + '">' +
      '<span class="tag rarity rarity--' + slugify(x.rarityKey) + '">' + esc(rarityLabel(x.rarityKey)) + '</span>' + untranslated +
      '<h3 class="card__title">' + esc(x.name) + '</h3>' +
      (x.category ? '<p class="card__cat">' + esc(x.category) + '</p>' : "") +
      '<p class="card__text card__text--clamp">' + esc(tr ? tr.description : x.description) + '</p>' + req +
    '</a>';
  }

  function resultsHtml() {
    var list = filtered();
    var shown = list.slice(0, state.limit);
    var html = '<p class="count" role="status">' + esc(t("talents.found")) + ': <strong>' + list.length + '</strong> / ' + data.length + '</p>';
    if (!list.length) return html + '<div class="callout">' + esc(t("talents.empty")) + '</div>';
    html += '<div class="grid">' + shown.map(cardHtml).join("") + '</div>';
    if (list.length > shown.length) {
      html += '<p class="more"><button type="button" class="btn btn--ghost" id="t-more">' +
        esc(t("talents.more")) + ' (' + (list.length - shown.length) + ')</button></p>';
    }
    return html;
  }

  function listView() {
    var statValues = STAT_FILTER;
    return {
      title: t("nav.talents"),
      html:
        '<p class="eyebrow">' + esc(t("nav.talents")) + '</p>' +
        '<h1>' + esc(t("talents.title")) + '</h1>' +
        '<p class="lead">' + esc(t("talents.lead")) + '</p>' +
        '<form class="filters" id="t-filters" onsubmit="return false">' +
          '<label class="field field--wide"><span>' + esc(t("talents.search")) + '</span>' +
            '<input type="search" id="t-q" value="' + esc(state.q) + '" placeholder="' + esc(t("talents.search.ph")) + '" autocomplete="off"></label>' +
          selectHtml("t-rarity", t("talents.rarity"), options.rarities, state.rarity, rarityLabel) +
          selectHtml("t-category", t("talents.category"), options.categories, state.category) +
          selectHtml("t-tag", t("talents.tag"), options.tags, state.tag, term) +
          selectHtml("t-stat", t("talents.stat"), statValues, state.stat, term) +
          '<button type="button" class="btn btn--ghost btn--sm" id="t-reset">' + esc(t("talents.reset")) + '</button>' +
        '</form>' +
        '<div id="t-results">' + resultsHtml() + '</div>',
      afterRender: function (root) { bindList(root); }
    };
  }

  function bindList(root) {
    var results = root.querySelector("#t-results");
    function refresh() { results.innerHTML = resultsHtml(); }
    function bind(id, key) {
      var el = root.querySelector(id);
      el.addEventListener(key === "q" ? "input" : "change", function () {
        state[key] = el.value;
        state.limit = PAGE_SIZE;
        refresh();
      });
    }
    bind("#t-q", "q");
    bind("#t-rarity", "rarity");
    bind("#t-category", "category");
    bind("#t-tag", "tag");
    bind("#t-stat", "stat");
    root.querySelector("#t-reset").addEventListener("click", function () {
      state = { q: "", rarity: "", category: "", tag: "", stat: "", limit: PAGE_SIZE };
      ["#t-q", "#t-rarity", "#t-category", "#t-tag", "#t-stat"].forEach(function (id) {
        root.querySelector(id).value = "";
      });
      refresh();
    });
    results.addEventListener("click", function (e) {
      if (e.target.id === "t-more") {
        state.limit += PAGE_SIZE;
        refresh();
      }
    });
  }

  // ---------- Карточка таланта ----------
  function infoHtml(items) {
    if (!items.length) return "";
    var html = "", level = 0;
    items.forEach(function (it) {
      while (level < it.level) { html += "<ul>"; level++; }
      while (level > it.level) { html += "</ul>"; level--; }
      html += "<li>" + esc(it.text) + "</li>";
    });
    while (level > 0) { html += "</ul>"; level--; }
    return '<h2>' + esc(t("talents.details")) + '</h2><div class="info-list">' + html + "</div>";
  }

  // Плашка о языке текста и кнопка «Показать оригинал / перевод»
  function langNote(hasTr, showingTr) {
    if (!isRu()) return "";
    if (!hasTr) return '<div class="callout callout--warn">' + esc(t("talents.untranslated.note")) + '</div>';
    return '<p class="langnote"><button type="button" class="linkbtn" id="t-toggle">' +
      esc(showingTr ? t("talents.show.original") : t("talents.show.translation")) + '</button></p>';
  }

  function detailView(slug) {
    var x = bySlug[decodeURIComponent(slug)];
    if (!x) return null;

    var hasTr = !!trans(x);
    var tr = showOriginal ? null : trans(x);
    var infoItems = tr ? x.info.map(function (it, i) {
      return { level: it.level, text: tr.info[i] != null ? tr.info[i] : it.text };
    }) : x.info;
    var description = tr ? tr.description : x.description;
    var bonus = tr && tr.stats ? tr.stats : x.stats;

    var rows = [];
    if (x.requirements.raw) rows.push([t("talents.requirements"), reqText(x.requirements.raw)]);
    if (bonus) rows.push([t("talents.bonus"), bonus]);
    if (x.equipment) rows.push([t("talents.equipment"), x.equipment]);
    if (x.extra && x.extra.mutual_exclusives) rows.push([t("talents.exclusive"), x.extra.mutual_exclusives]);
    if (x.extra && x.extra.condition) rows.push([t("talents.condition"), x.extra.condition]);

    var related = x.category ? data.filter(function (o) {
      return o.category === x.category && o.slug !== x.slug;
    }).slice(0, 14) : [];

    return {
      title: x.name,
      html:
        '<p class="eyebrow"><a href="#/talents">' + esc(t("nav.talents")) + '</a>' +
          (x.category ? ' · ' + esc(x.category) : "") + '</p>' +
        '<h1>' + esc(x.name) + '</h1>' +
        '<div class="row">' +
          '<span class="tag rarity rarity--' + slugify(x.rarityKey) + '">' + esc(rarityLabel(x.rarityKey)) + '</span>' +
          x.tags.map(function (g) { return '<span class="tag">' + esc(term(g)) + '</span>'; }).join("") +
        '</div>' + langNote(hasTr, !!tr) +
        '<div class="ornament" aria-hidden="true">❖</div>' +
        '<p class="lead lead--plain">' + esc(description) + '</p>' +
        (rows.length ? '<dl class="meta">' + rows.map(function (r) {
          return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>';
        }).join("") + '</dl>' : "") +
        infoHtml(infoItems) +
        (related.length ? '<h2>' + esc(t("talents.related")) + '</h2><div class="row">' +
          related.map(function (o) {
            return '<a class="tag tag--link" href="#/talents/' + o.slug + '">' + esc(o.name) + '</a>';
          }).join("") + '</div>' : "") +
        '<div class="ornament" aria-hidden="true">❖</div>' +
        '<p class="source">' + esc(t("talents.source")) + ' <a href="' + esc(x.wiki_url) + '" target="_blank" rel="noopener">Deepwoken Wiki</a> (CC BY-SA 3.0).</p>' +
        '<p><a class="btn btn--ghost" href="#/talents">← ' + esc(t("talents.back")) + '</a></p>',
      afterRender: function (root) {
        var b = root.querySelector("#t-toggle");
        if (b) b.addEventListener("click", function () {
          showOriginal = !showOriginal;
          document.dispatchEvent(new CustomEvent("langchange")); // перерисовать страницу
        });
      }
    };
  }

  // Возвращает страницу или null, если данные ещё не загружены
  function render(arg) {
    if (!data) return null;
    if (!arg) return listView();
    return detailView(arg) || {
      title: t("notfound.title"),
      html: '<h1>' + esc(t("notfound.title")) + '</h1><p><a class="btn btn--ghost" href="#/talents">' + esc(t("talents.back")) + '</a></p>'
    };
  }

  window.TALENTS_VIEW = { load: load, render: render };
})();
