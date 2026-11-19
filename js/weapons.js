// Раздел «Оружие» справочника: каталог с фильтрами и карточка оружия
(function () {
  var I18N = window.I18N;
  var PAGE_SIZE = 60;
  var state = { q: "", cls: "", type: "", rarity: "", dmg: "", sort: "name", limit: PAGE_SIZE };
  var data = null;
  var bySlug = {};
  var options = null;
  var loading = null;
  var RARITY_ORDER = ["Common", "Uncommon", "Rare", "Legendary", "Mythical", "Relic", "Unique", "Named"];
  // Коды статов в требованиях оружия
  var CODES = {
    ru: { LHT: "Лёгкое оружие", MED: "Среднее оружие", HVY: "Тяжёлое оружие", STR: "Сила", FTD: "Телосложение" },
    en: { LHT: "Light Weapon", MED: "Medium Weapon", HVY: "Heavy Weapon", STR: "Strength", FTD: "Fortitude" }
  };
  // Дополнительные поля инфобокса, которые показываем в карточке
  var EXTRA_FIELDS = ["penetration", "chip damage", "endlag", "stances", "special effect", "talent",
    "oath", "faction", "alloy", "alloyed name", "capacity", "offhand cd", "droppable", "bankable", "enchantable"];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function t(k) { return I18N.t(k); }
  function lbl(prefix, key) {
    var k = prefix + "." + key;
    var v = t(k);
    return v === k ? key : v;
  }
  function reqText(raw) {
    var map = CODES[I18N.lang] || CODES.en;
    return raw.replace(/\b(LHT|MED|HVY|STR|FTD)\b/g, function (m) { return map[m]; });
  }
  function clsKey(x) { return x.class || "Other"; }

  function init() {
    data = window.DEEPWOKEN_DATA.weapons.weapons;
    var types = {}, rar = {}, dt = {};
    data.forEach(function (x) {
      bySlug[x.slug] = x;
      x.hay = (x.name + " " + x.type + " " + x.description + " " + x.obtainment.join(" ")).toLowerCase();
      if (x.type && x.type !== "?") types[x.type] = 1;
      if (x.rarity && x.rarity !== "?" && x.rarity !== "N/A") rar[x.rarity] = 1;
      if (x.damage_type && x.damage_type !== "?") dt[x.damage_type] = 1;
    });
    options = {
      classes: ["Light", "Medium", "Heavy", "Other"],
      types: Object.keys(types).sort(),
      rarities: RARITY_ORDER.filter(function (r) { return rar[r]; }),
      dmgTypes: Object.keys(dt).sort()
    };
  }

  function load() {
    if (data) return Promise.resolve();
    if (!loading) {
      loading = new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = "data/weapons.js";
        s.onload = function () { init(); resolve(); };
        s.onerror = function () { loading = null; reject(new Error("weapons.js")); };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = data.filter(function (x) {
      if (state.cls && clsKey(x) !== state.cls) return false;
      if (state.type && x.type !== state.type) return false;
      if (state.rarity && x.rarity !== state.rarity) return false;
      if (state.dmg && x.damage_type !== state.dmg) return false;
      if (q && x.hay.indexOf(q) === -1) return false;
      return true;
    });
    var by = {
      name: function (a, b) { return a.name.localeCompare(b.name); },
      damage: function (a, b) { return (b.damage || 0) - (a.damage || 0) || a.name.localeCompare(b.name); },
      posture: function (a, b) { return (b.posture_damage || 0) - (a.posture_damage || 0) || a.name.localeCompare(b.name); },
      range: function (a, b) { return (b.range || 0) - (a.range || 0) || a.name.localeCompare(b.name); }
    }[state.sort];
    return list.sort(by);
  }

  function selectHtml(id, label, values, current, fmt, noAny) {
    var opts = (noAny ? "" : '<option value="">' + esc(t("talents.any")) + '</option>') + values.map(function (v) {
      return '<option value="' + esc(v) + '"' + (v === current ? " selected" : "") + '>' + esc(fmt ? fmt(v) : v) + '</option>';
    }).join("");
    return '<label class="field"><span>' + esc(label) + '</span><select id="' + id + '">' + opts + '</select></label>';
  }

  function num(v) { return v == null ? "—" : String(v); }

  function cardHtml(x) {
    var stats = [
      [t("weapons.damage"), num(x.damage)],
      [t("weapons.posture"), num(x.posture_damage)],
      [t("weapons.range"), num(x.range)]
    ].map(function (r) { return '<span>' + esc(r[0]) + ' <strong>' + esc(r[1]) + '</strong></span>'; }).join(" · ");
    return '<a class="card card--talent" href="#/reference/weapons/' + x.slug + '">' +
      (x.rarity && x.rarity !== "?" && x.rarity !== "N/A"
        ? '<span class="tag">' + esc(lbl("weapons.rarity", x.rarity)) + '</span> ' : "") +
      '<span class="tag">' + esc(lbl("weapons.class", clsKey(x))) + '</span>' +
      '<h3 class="card__title">' + esc(x.name) + '</h3>' +
      '<p class="card__cat">' + esc(x.type || "") + (x.damage_type && x.damage_type !== "?" ? " · " + esc(lbl("weapons.dtype", x.damage_type)) : "") + '</p>' +
      '<p class="card__text">' + stats + '</p>' +
      (x.requirements && x.requirements !== "N/A" && x.requirements !== "None"
        ? '<p class="card__req">' + esc(reqText(x.requirements)) + '</p>' : "") +
    '</a>';
  }

  function resultsHtml() {
    var list = filtered();
    var shown = list.slice(0, state.limit);
    var html = '<p class="count" role="status">' + esc(t("talents.found")) + ': <strong>' + list.length + '</strong> / ' + data.length + '</p>';
    if (!list.length) return html + '<div class="callout">' + esc(t("talents.empty")) + '</div>';
    html += '<div class="grid">' + shown.map(cardHtml).join("") + '</div>';
    if (list.length > shown.length) {
      html += '<p class="more"><button type="button" class="btn btn--ghost" id="w-more">' +
        esc(t("talents.more")) + ' (' + (list.length - shown.length) + ')</button></p>';
    }
    return html;
  }

  function listView() {
    var sorts = ["name", "damage", "posture", "range"];
    return {
      title: t("weapons.title"),
      html:
        '<p class="eyebrow"><a href="#/reference">' + esc(t("nav.reference")) + '</a></p>' +
        '<h1>' + esc(t("weapons.title")) + '</h1>' +
        '<p class="lead">' + esc(t("weapons.lead")) + '</p>' +
        '<form class="filters" id="w-filters" onsubmit="return false">' +
          '<label class="field field--wide"><span>' + esc(t("talents.search")) + '</span>' +
            '<input type="search" id="w-q" value="' + esc(state.q) + '" placeholder="' + esc(t("weapons.search.ph")) + '" autocomplete="off"></label>' +
          selectHtml("w-cls", t("weapons.class"), options.classes, state.cls, function (v) { return lbl("weapons.class", v); }) +
          selectHtml("w-type", t("weapons.type"), options.types, state.type) +
          selectHtml("w-rarity", t("weapons.rarity"), options.rarities, state.rarity, function (v) { return lbl("weapons.rarity", v); }) +
          selectHtml("w-dmg", t("weapons.dtype"), options.dmgTypes, state.dmg, function (v) { return lbl("weapons.dtype", v); }) +
          selectHtml("w-sort", t("weapons.sort"), sorts, state.sort, function (v) { return t("weapons.sort." + v); }, true) +
          '<button type="button" class="btn btn--ghost btn--sm" id="w-reset">' + esc(t("talents.reset")) + '</button>' +
        '</form>' +
        '<div id="w-results">' + resultsHtml() + '</div>',
      afterRender: function (root) {
        var results = root.querySelector("#w-results");
        var ids = [["#w-q", "q"], ["#w-cls", "cls"], ["#w-type", "type"], ["#w-rarity", "rarity"], ["#w-dmg", "dmg"], ["#w-sort", "sort"]];
        function refresh() { results.innerHTML = resultsHtml(); }
        ids.forEach(function (p) {
          var el = root.querySelector(p[0]);
          el.addEventListener(p[1] === "q" ? "input" : "change", function () {
            state[p[1]] = el.value;
            state.limit = PAGE_SIZE;
            refresh();
          });
        });
        root.querySelector("#w-reset").addEventListener("click", function () {
          state = { q: "", cls: "", type: "", rarity: "", dmg: "", sort: "name", limit: PAGE_SIZE };
          ids.forEach(function (p) { root.querySelector(p[0]).value = p[1] === "sort" ? "name" : ""; });
          refresh();
        });
        results.addEventListener("click", function (e) {
          if (e.target.id === "w-more") { state.limit += PAGE_SIZE; refresh(); }
        });
      }
    };
  }

  function detailView(slug) {
    var x = bySlug[decodeURIComponent(slug)];
    if (!x) return null;
    var rows = [];
    function add(label, v) { if (v != null && v !== "" && v !== "?" && v !== "N/A") rows.push([label, String(v)]); }
    add(t("weapons.type"), x.type);
    add(t("weapons.class"), lbl("weapons.class", clsKey(x)));
    add(t("weapons.rarity"), x.rarity ? lbl("weapons.rarity", x.rarity) : "");
    add(t("weapons.requirements"), x.requirements && x.requirements !== "None" ? reqText(x.requirements) : "");
    add(t("weapons.damage"), x.damage);
    add(t("weapons.dtype"), x.damage_type ? lbl("weapons.dtype", x.damage_type) : "");
    add(t("weapons.scaling"), x.scaling);
    add(t("weapons.posture"), x.posture_damage);
    add(t("weapons.range"), x.range != null ? x.range + (x.range_type ? " (" + x.range_type + ")" : "") : "");
    add(t("weapons.speed"), x.swing_speed);
    add(t("weapons.duration"), x.attack_duration);
    add(t("weapons.price"), x.selling_price);
    var ex = x.extra || {};
    EXTRA_FIELDS.forEach(function (k) {
      if (!ex[k]) return;
      var v = ex[k];
      if (I18N.lang === "ru") v = v.replace(/^yes$/i, "Да").replace(/^no$/i, "Нет");
      add(lbl("weapons.extra", k), v);
    });
    var related = data.filter(function (o) { return o.type === x.type && o.slug !== x.slug; }).slice(0, 14);

    return {
      title: x.name,
      html:
        '<p class="eyebrow"><a href="#/reference">' + esc(t("nav.reference")) + '</a> · <a href="#/reference/weapons">' + esc(t("weapons.title")) + '</a></p>' +
        '<h1>' + esc(x.name) + '</h1>' +
        '<div class="ornament" aria-hidden="true">❖</div>' +
        (x.description ? '<p class="lead lead--plain">' + esc(x.description) + '</p>' : "") +
        '<dl class="meta">' + rows.map(function (r) {
          return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>';
        }).join("") + '</dl>' +
        (x.obtainment.length ? '<h2>' + esc(t("weapons.obtain")) + '</h2><div class="info-list"><ul>' +
          x.obtainment.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join("") + '</ul></div>' : "") +
        (related.length ? '<h2>' + esc(t("weapons.related")) + '</h2><div class="row">' +
          related.map(function (o) { return '<a class="tag tag--link" href="#/reference/weapons/' + o.slug + '">' + esc(o.name) + '</a>'; }).join("") + '</div>' : "") +
        '<div class="ornament" aria-hidden="true">❖</div>' +
        '<p class="source">' + esc(t("talents.source")) + ' <a href="' + esc(x.wiki_url) + '" target="_blank" rel="noopener">Deepwoken Wiki</a> (CC BY-SA 3.0).</p>' +
        '<p><a class="btn btn--ghost" href="#/reference/weapons">← ' + esc(t("weapons.back")) + '</a></p>'
    };
  }

  function render(arg) {
    if (!data) return null;
    if (!arg) return listView();
    return detailView(arg) || {
      title: t("notfound.title"),
      html: '<h1>' + esc(t("notfound.title")) + '</h1><p><a class="btn btn--ghost" href="#/reference/weapons">' + esc(t("weapons.back")) + '</a></p>'
    };
  }

  window.WEAPONS_VIEW = { load: load, render: render };
})();
