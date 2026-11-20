// Раздел «Мантры» справочника: каталог с фильтрами и карточка мантры
(function () {
  var I18N = window.I18N;
  var PAGE_SIZE = 60;
  var CONTACT = "cryptoknopka1@gmail.com";
  var KINDS = ["attunement", "neutral", "hybrid", "oath", "origin", "monster"];
  var state = { q: "", kind: "", source: "", type: "", sort: "name", limit: PAGE_SIZE };
  var data = null;
  var bySlug = {};
  var options = null;
  var loading = null;
  var tr = {};            // русские переводы: slug -> {desc, effect_intro}
  var PLACEHOLDERS = ["", "...", "..", "tba", "tbd", "n/a", "na", "none", "?", "-", "???", '""'];
  function real(s) { return PLACEHOLDERS.indexOf(String(s || "").trim().toLowerCase()) === -1 ? s : ""; }
  function trans(x) { return I18N.lang === "ru" ? (tr[x.slug] || null) : null; }

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
  function etherText(s) {
    return I18N.lang === "ru" ? String(s).replace(/\bEther\b/g, "эфира") : s;
  }
  function etherNum(x) {
    var m = /(\d+(?:\.\d+)?)/.exec(x.ether || "");
    return m ? parseFloat(m[1]) : null;
  }
  function dmgText(x) {
    var v = real(x.damage_type);
    return v ? v.replace(/\s*\n\s*/g, "; ") : "";
  }
  function stars(n) {
    if (n == null) return "";
    return new Array(n + 1).join("★") + new Array(4 - n).join("☆");
  }
  function sourceLabel(x) {
    return x.source_kind === "neutral" || x.source_kind === "hybrid" || x.source_kind === "monster"
      ? lbl("mantras.kind", x.source_kind) : x.source;
  }

  function init() {
    if (window.DEEPWOKEN_DATA.mantrasRu) tr = window.DEEPWOKEN_DATA.mantrasRu;
    data = window.DEEPWOKEN_DATA.mantras.mantras;
    var sources = {}, types = {};
    data.forEach(function (x) {
      bySlug[x.slug] = x;
      var r = tr[x.slug];
      x.hay = (x.name + " " + x.desc + " " + x.effect_intro + " " + x.source + " " + x.requirements +
        (r ? " " + (r.desc || "") + " " + (r.effect_intro || "") + " " + (r.effect || []).join(" ") : "")).toLowerCase();
      (sources[x.source_kind] = sources[x.source_kind] || {})[x.source] = 1;
      if (x.type) types[x.type] = 1;
    });
    options = {
      kinds: KINDS.filter(function (k) { return sources[k]; }),
      sources: sources,
      types: Object.keys(types).sort()
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
        var loadMantras = function () {
          addScript("data/mantras.js",
            function () { init(); resolve(); },
            function () { loading = null; reject(new Error("mantras.js")); });
        };
        // Переводы необязательны: без файла показываем оригинал
        addScript("data/mantras.ru.js", loadMantras, loadMantras);
      });
    }
    return loading;
  }

  function sourceOptions() {
    var out = [];
    KINDS.forEach(function (k) {
      if (state.kind && state.kind !== k) return;
      if (k === "neutral" || k === "hybrid" || k === "monster") return;
      Object.keys(options.sources[k] || {}).sort().forEach(function (s) { out.push(s); });
    });
    return out;
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = data.filter(function (x) {
      if (state.kind && x.source_kind !== state.kind) return false;
      if (state.source && x.source !== state.source) return false;
      if (state.type && x.type !== state.type) return false;
      if (q && x.hay.indexOf(q) === -1) return false;
      return true;
    });
    var by = {
      name: function (a, b) { return a.name.localeCompare(b.name); },
      ether: function (a, b) {
        var ea = etherNum(a), eb = etherNum(b);
        return (ea == null ? 1e9 : ea) - (eb == null ? 1e9 : eb) || a.name.localeCompare(b.name);
      }
    }[state.sort];
    return list.sort(by);
  }

  function selectHtml(id, label, values, current, fmt, noAny) {
    var opts = (noAny ? "" : '<option value="">' + esc(t("talents.any")) + '</option>') + values.map(function (v) {
      return '<option value="' + esc(v) + '"' + (v === current ? " selected" : "") + '>' + esc(fmt ? fmt(v) : v) + '</option>';
    }).join("");
    return '<label class="field"><span>' + esc(label) + '</span><select id="' + id + '">' + opts + '</select></label>';
  }

  function cardHtml(x) {
    var T = trans(x);
    var desc = real(T && T.desc ? T.desc : x.desc).split("\n")[0];
    return '<a class="card card--talent" href="#/reference/mantras/' + x.slug + '">' +
      '<span class="tag">' + esc(sourceLabel(x)) + '</span>' +
      (x.type ? ' <span class="tag">' + esc(lbl("mantras.type", x.type)) + '</span>' : "") +
      '<h3 class="card__title">' + esc(x.name) + '</h3>' +
      (desc ? '<p class="card__text">' + esc(desc) + '</p>' : "") +
      (x.ether ? '<p class="card__req">' + esc(etherText(x.ether)) + '</p>' : "") +
    '</a>';
  }

  function resultsHtml() {
    var list = filtered();
    var shown = list.slice(0, state.limit);
    var html = '<p class="count" role="status">' + esc(t("talents.found")) + ': <strong>' + list.length + '</strong> / ' + data.length + '</p>';
    if (!list.length) return html + '<div class="callout">' + esc(t("talents.empty")) + '</div>';
    html += '<div class="grid">' + shown.map(cardHtml).join("") + '</div>';
    if (list.length > shown.length) {
      html += '<p class="more"><button type="button" class="btn btn--ghost" id="m-more">' +
        esc(t("talents.more")) + ' (' + (list.length - shown.length) + ')</button></p>';
    }
    return html;
  }

  function listView() {
    return {
      title: t("mantras.title"),
      html:
        '<p class="eyebrow"><a href="#/reference">' + esc(t("nav.reference")) + '</a></p>' +
        '<h1>' + esc(t("mantras.title")) + '</h1>' +
        '<p class="lead">' + esc(t("mantras.lead")) + '</p>' +
        '<form class="filters" id="m-filters" onsubmit="return false">' +
          '<label class="field field--wide"><span>' + esc(t("talents.search")) + '</span>' +
            '<input type="search" id="m-q" value="' + esc(state.q) + '" placeholder="' + esc(t("mantras.search.ph")) + '" autocomplete="off"></label>' +
          selectHtml("m-kind", t("mantras.kind"), options.kinds, state.kind, function (v) { return lbl("mantras.kind", v); }) +
          '<span id="m-source-wrap">' +
            selectHtml("m-source", t("mantras.source"), sourceOptions(), state.source) + '</span>' +
          selectHtml("m-type", t("mantras.type"), options.types, state.type, function (v) { return lbl("mantras.type", v); }) +
          selectHtml("m-sort", t("weapons.sort"), ["name", "ether"], state.sort, function (v) { return t("mantras.sort." + v); }, true) +
          '<button type="button" class="btn btn--ghost btn--sm" id="m-reset">' + esc(t("talents.reset")) + '</button>' +
        '</form>' +
        '<div id="m-results">' + resultsHtml() + '</div>',
      afterRender: function (root) {
        var results = root.querySelector("#m-results");
        var ids = [["#m-q", "q"], ["#m-kind", "kind"], ["#m-source", "source"], ["#m-type", "type"], ["#m-sort", "sort"]];
        function refresh() { results.innerHTML = resultsHtml(); }
        function refreshSource() {
          var wrap = root.querySelector("#m-source-wrap");
          wrap.innerHTML = selectHtml("m-source", t("mantras.source"), sourceOptions(), state.source);
          bind(root.querySelector("#m-source"), "source");
        }
        function bind(el, key) {
          el.addEventListener(key === "q" ? "input" : "change", function () {
            state[key] = el.value;
            if (key === "kind") { state.source = ""; refreshSource(); }
            state.limit = PAGE_SIZE;
            refresh();
          });
        }
        ids.forEach(function (p) { bind(root.querySelector(p[0]), p[1]); });
        root.querySelector("#m-reset").addEventListener("click", function () {
          state = { q: "", kind: "", source: "", type: "", sort: "name", limit: PAGE_SIZE };
          ["#m-q", "#m-kind", "#m-type"].forEach(function (s) { root.querySelector(s).value = ""; });
          root.querySelector("#m-sort").value = "name";
          refreshSource();
          refresh();
        });
        results.addEventListener("click", function (e) {
          if (e.target.id === "m-more") { state.limit += PAGE_SIZE; refresh(); }
        });
      }
    };
  }

  function effectHtml(x, T) {
    var html = "", open = false, i = 0;
    var texts = T && T.effect && T.effect.length === x.effect.filter(function (e) { return e.text; }).length ? T.effect : null;
    x.effect.forEach(function (e) {
      if (e.heading) {
        if (open) html += "</ul>";
        var h = I18N.lang === "ru" && e.heading.toLowerCase() === "base" ? t("mantras.base") : e.heading;
        html += '<h3>' + esc(h) + '</h3><ul>';
        open = true;
      } else {
        if (!open) { html += "<ul>"; open = true; }
        var text = texts ? texts[i] : e.text;
        i++;
        html += '<li' + (e.depth > 1 ? ' style="margin-left:' + (e.depth - 1) * 1.4 + 'em"' : "") + '>' + esc(text) + '</li>';
      }
    });
    return open ? html + "</ul>" : html;
  }

  function detailView(slug) {
    var x = bySlug[decodeURIComponent(slug)];
    if (!x) return null;
    var T = trans(x);
    var desc = real(T && T.desc ? T.desc : x.desc);
    var intro = real(T && T.effect_intro ? T.effect_intro : x.effect_intro);
    var rows = [];
    function add(label, v) { if (v != null && v !== "" && v !== "?" && v !== "N/A") rows.push([label, String(v)]); }
    add(t("mantras.source"), lbl("mantras.kind", x.source_kind) + (x.source_kind === "attunement" || x.source_kind === "oath" || x.source_kind === "origin" ? ": " + x.source : ""));
    add(t("mantras.type"), x.type ? lbl("mantras.type", x.type) : "");
    add(t("mantras.stars"), x.stars != null ? stars(x.stars) : "");
    add(t("mantras.ether"), x.ether ? etherText(x.ether) : "");
    add(t("mantras.dtype"), dmgText(x));
    add(t("mantras.requirements"), x.requirements);
    var related = data.filter(function (o) { return o.source === x.source && o.slug !== x.slug; }).slice(0, 16);

    return {
      title: x.name,
      html:
        '<p class="eyebrow"><a href="#/reference">' + esc(t("nav.reference")) + '</a> · <a href="#/reference/mantras">' + esc(t("mantras.title")) + '</a></p>' +
        '<h1>' + esc(x.name) + '</h1>' +
        '<div class="ornament" aria-hidden="true">❖</div>' +
        (desc ? desc.split("\n").map(function (p, i) {
          return '<p' + (i === 0 ? ' class="lead lead--plain"' : "") + '>' + esc(p) + '</p>';
        }).join("") : "") +
        (I18N.lang === "ru" && !T && (desc || intro) ? '<div class="callout">' + esc(t("mantras.untranslated")) + '</div>' : "") +
        '<dl class="meta">' + rows.map(function (r) {
          return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>';
        }).join("") + '</dl>' +
        (intro || x.effect.length ? '<h2>' + esc(t("mantras.effect")) + '</h2>' +
          (intro ? '<p><em>' + esc(intro) + '</em></p>' : "") +
          (x.effect.length ? '<div class="info-list">' + effectHtml(x, T) + '</div>' : "") +
          (I18N.lang === "ru" && x.effect.length && !(T && T.effect) ? '<p class="source">' + esc(t("mantras.effect.en")) + '</p>' : "") : "") +
        (related.length ? '<h2>' + esc(t("mantras.related")) + '</h2><div class="row">' +
          related.map(function (o) { return '<a class="tag tag--link" href="#/reference/mantras/' + o.slug + '">' + esc(o.name) + '</a>'; }).join("") + '</div>' : "") +
        '<div class="ornament" aria-hidden="true">❖</div>' +
        (T ? '<p class="source">' + esc(t("talents.report")) + ' <a href="mailto:' + CONTACT +
          '?subject=' + encodeURIComponent(t("talents.report.subject") + ": " + x.name) + '">' + CONTACT + '</a></p>' : "") +
        '<p class="source">' + esc(t("talents.source")) + ' <a href="' + esc(x.wiki_url) + '" target="_blank" rel="noopener">Deepwoken Wiki</a> (CC BY-SA 3.0).</p>' +
        '<p><a class="btn btn--ghost" href="#/reference/mantras">← ' + esc(t("mantras.back")) + '</a></p>'
    };
  }

  function render(arg) {
    if (!data) return null;
    if (!arg) return listView();
    return detailView(arg) || {
      title: t("notfound.title"),
      html: '<h1>' + esc(t("notfound.title")) + '</h1><p><a class="btn btn--ghost" href="#/reference/mantras">' + esc(t("mantras.back")) + '</a></p>'
    };
  }

  window.MANTRAS_VIEW = { load: load, render: render };
})();
