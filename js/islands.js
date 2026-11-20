// Раздел «Острова»: каталог локаций (острова, зоны, данжи, арены) и страница локации
(function () {
  var I18N = window.I18N;
  var PAGE_SIZE = 60;
  var CONTACT = "cryptoknopka1@gmail.com";
  var HIDDEN_FLAGS = ["cut", "noncanon"];       // по умолчанию скрыты
  var state = { q: "", region: "", kind: "", territory: "", all: false, limit: PAGE_SIZE };
  var data = null;
  var bySlug = {};
  var byTitle = {};     // нижний регистр названия -> локация (для ссылок)
  var options = null;
  var loading = null;
  var tr = {};          // переводы: slug -> {caption, titles:[...], blocks:[...]}
  var LO = "⟦", LC = "⟧";

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
  function trans(x) { return I18N.lang === "ru" ? (tr[x.slug] || null) : null; }
  function regionOf(x) { return x.region || "Other"; }
  function hidden(x) { return x.name.charAt(0) === "[" || x.flags.some(function (f) { return HIDDEN_FLAGS.indexOf(f) !== -1; }); }

  // Текст с маркерами ссылок ⟦страница|подпись⟧ -> HTML со ссылками на наши страницы
  function richText(s) {
    var out = "", i = 0, re = new RegExp(LO + "([^|" + LC + "]+)\\|([^" + LC + "]*)" + LC, "g"), m;
    while ((m = re.exec(s))) {
      out += esc(s.slice(i, m.index));
      var loc = byTitle[m[1].trim().toLowerCase()];
      out += loc ? '<a href="#/islands/' + loc.slug + '">' + esc(m[2]) + '</a>' : esc(m[2]);
      i = m.index + m[0].length;
    }
    return out + esc(s.slice(i));
  }
  function plain(s) { return String(s).replace(new RegExp(LO + "[^|" + LC + "]+\\|([^" + LC + "]*)" + LC, "g"), "$1"); }

  function allBlocks(x) {
    var list = x.intro.slice();
    x.sections.forEach(function (s) { list = list.concat(s.blocks); });
    return list;
  }

  function init() {
    if (window.DEEPWOKEN_DATA.locationsRu) tr = window.DEEPWOKEN_DATA.locationsRu;
    data = window.DEEPWOKEN_DATA.locations.locations;
    var regions = {}, kinds = {}, terr = {};
    data.forEach(function (x) {
      bySlug[x.slug] = x;
      byTitle[x.title.toLowerCase()] = x;
      byTitle[x.name.toLowerCase()] = byTitle[x.name.toLowerCase()] || x;
      var r = tr[x.slug];
      x.hay = (x.name + " " + x.caption + " " + x.territory + " " + x.region + " " + x.enemies.join(" ") + " " +
        allBlocks(x).map(function (b) { return plain(b.x); }).join(" ") +
        (r ? " " + (r.caption || "") + " " + (r.blocks || []).map(plain).join(" ") : "")).toLowerCase();
      regions[regionOf(x)] = 1;
      x.kinds.forEach(function (k) { kinds[k] = 1; });
      if (x.territory) terr[x.territory] = 1;
    });
    var order = ["Etrean Luminant", "Eastern Luminant", "First Layer", "First Floor of the Second Layer", "Second Floor of the Second Layer", "Other"];
    options = {
      regions: order.filter(function (r) { return regions[r]; }),
      kinds: Object.keys(kinds).sort(),
      territories: Object.keys(terr).sort()
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
        var loadData = function () {
          addScript("data/locations.js",
            function () { init(); resolve(); },
            function () { loading = null; reject(new Error("locations.js")); });
        };
        // Переводы необязательны: без файла показываем оригинал
        addScript("data/locations.ru.js", loadData, loadData);
      });
    }
    return loading;
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return data.filter(function (x) {
      if (!state.all && hidden(x)) return false;
      if (state.region && regionOf(x) !== state.region) return false;
      if (state.kind && x.kinds.indexOf(state.kind) === -1) return false;
      if (state.territory && x.territory !== state.territory) return false;
      if (q && x.hay.indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  function selectHtml(id, label, values, current, fmt) {
    var opts = '<option value="">' + esc(t("talents.any")) + '</option>' + values.map(function (v) {
      return '<option value="' + esc(v) + '"' + (v === current ? " selected" : "") + '>' + esc(fmt ? fmt(v) : v) + '</option>';
    }).join("");
    return '<label class="field"><span>' + esc(label) + '</span><select id="' + id + '">' + opts + '</select></label>';
  }

  function cardHtml(x) {
    var T = trans(x);
    var cap = (T && T.caption) || x.caption;
    var firstP = allBlocks(x).filter(function (b) { return b.t === "p"; })[0];
    var snippet = cap || plain(firstP ? firstP.x : "");
    if (snippet.length > 180) snippet = snippet.slice(0, 177) + "…";
    return '<a class="card card--talent" href="#/islands/' + x.slug + '">' +
      '<span class="tag">' + esc(lbl("islands.region", regionOf(x))) + '</span>' +
      (x.kinds[0] ? ' <span class="tag">' + esc(lbl("islands.kind", x.kinds[0])) + '</span>' : "") +
      '<h3 class="card__title">' + esc(x.name) + '</h3>' +
      (snippet ? '<p class="card__text">' + esc(snippet) + '</p>' : "") +
      (x.territory ? '<p class="card__req">' + esc(x.territory) + '</p>' : "") +
    '</a>';
  }

  function resultsHtml() {
    var list = filtered();
    var shown = list.slice(0, state.limit);
    var html = '<p class="count" role="status">' + esc(t("talents.found")) + ': <strong>' + list.length + '</strong> / ' + data.length + '</p>';
    if (!list.length) return html + '<div class="callout">' + esc(t("talents.empty")) + '</div>';
    html += '<div class="grid">' + shown.map(cardHtml).join("") + '</div>';
    if (list.length > shown.length) {
      html += '<p class="more"><button type="button" class="btn btn--ghost" id="i-more">' +
        esc(t("talents.more")) + ' (' + (list.length - shown.length) + ')</button></p>';
    }
    return html;
  }

  function listView() {
    return {
      title: t("islands.title"),
      html:
        '<p class="eyebrow">' + esc(t("nav.islands")) + '</p>' +
        '<h1>' + esc(t("islands.title")) + '</h1>' +
        '<p class="lead">' + esc(t("islands.lead")) + '</p>' +
        '<form class="filters" id="i-filters" onsubmit="return false">' +
          '<label class="field field--wide"><span>' + esc(t("talents.search")) + '</span>' +
            '<input type="search" id="i-q" value="' + esc(state.q) + '" placeholder="' + esc(t("islands.search.ph")) + '" autocomplete="off"></label>' +
          selectHtml("i-region", t("islands.region"), options.regions, state.region, function (v) { return lbl("islands.region", v); }) +
          selectHtml("i-kind", t("islands.kind"), options.kinds, state.kind, function (v) { return lbl("islands.kind", v); }) +
          selectHtml("i-territory", t("islands.territory"), options.territories, state.territory) +
          '<label class="field field--check"><input type="checkbox" id="i-all"' + (state.all ? " checked" : "") + '> <span>' + esc(t("islands.showall")) + '</span></label>' +
          '<button type="button" class="btn btn--ghost btn--sm" id="i-reset">' + esc(t("talents.reset")) + '</button>' +
        '</form>' +
        '<div id="i-results">' + resultsHtml() + '</div>',
      afterRender: function (root) {
        var results = root.querySelector("#i-results");
        var ids = [["#i-q", "q"], ["#i-region", "region"], ["#i-kind", "kind"], ["#i-territory", "territory"]];
        function refresh() { results.innerHTML = resultsHtml(); }
        ids.forEach(function (p) {
          var el = root.querySelector(p[0]);
          el.addEventListener(p[1] === "q" ? "input" : "change", function () {
            state[p[1]] = el.value;
            state.limit = PAGE_SIZE;
            refresh();
          });
        });
        root.querySelector("#i-all").addEventListener("change", function (e) {
          state.all = e.target.checked;
          state.limit = PAGE_SIZE;
          refresh();
        });
        root.querySelector("#i-reset").addEventListener("click", function () {
          state = { q: "", region: "", kind: "", territory: "", all: false, limit: PAGE_SIZE };
          ids.forEach(function (p) { root.querySelector(p[0]).value = ""; });
          root.querySelector("#i-all").checked = false;
          refresh();
        });
        results.addEventListener("click", function (e) {
          if (e.target.id === "i-more") { state.limit += PAGE_SIZE; refresh(); }
        });
      }
    };
  }

  // Блоки -> HTML; texts — переведённые тексты в том же порядке (или null)
  function blocksHtml(blocks, texts, from) {
    var html = "", depth = 0;
    function closeTo(d) { while (depth > d) { html += "</ul>"; depth--; } }
    blocks.forEach(function (b, i) {
      var text = texts ? texts[from + i] : b.x;
      if (b.t === "li") {
        var d = Math.min(b.d || 1, 4);
        while (depth < d) { html += "<ul>"; depth++; }
        closeTo(d);
        html += "<li>" + richText(text) + "</li>";
      } else {
        closeTo(0);
        if (b.t === "h") {
          var lv = Math.min(Math.max(b.l, 3), 5);
          html += "<h" + lv + ">" + esc(plain(text)) + "</h" + lv + ">";
        } else {
          html += "<p>" + richText(text) + "</p>";
        }
      }
    });
    closeTo(0);
    return html;
  }

  function detailView(slug) {
    var x = bySlug[decodeURIComponent(slug)];
    if (!x) return null;
    var T = trans(x);
    var total = allBlocks(x).length;
    var texts = T && T.blocks && T.blocks.length === total ? T.blocks : null;
    var titles = T && T.titles && T.titles.length === x.sections.length ? T.titles : null;
    var caption = (T && T.caption) || x.caption;
    var rows = [];
    function add(label, v) { if (v) rows.push([label, v]); }
    add(t("islands.region"), lbl("islands.region", regionOf(x)));
    add(t("islands.kind"), x.kinds.map(function (k) { return lbl("islands.kind", k); }).join(", "));
    add(t("islands.territory"), x.territory);
    add(t("islands.lawless"), x.lawless ? t("islands.yes") : "");
    var flagTags = x.flags.map(function (f) { return '<span class="tag">' + esc(lbl("islands.flag", f)) + '</span>'; }).join(" ");

    var offset = x.intro.length;
    var body = blocksHtml(x.intro, texts, 0);
    x.sections.forEach(function (s, i) {
      body += '<h2>' + esc(titles ? titles[i] : s.title) + '</h2>' + blocksHtml(s.blocks, texts, offset);
      offset += s.blocks.length;
    });

    return {
      title: x.name,
      html:
        '<p class="eyebrow"><a href="#/islands">' + esc(t("islands.title")) + '</a></p>' +
        '<h1>' + esc(x.name) + '</h1>' +
        '<div class="ornament" aria-hidden="true">❖</div>' +
        (caption ? '<p class="lead lead--plain"><em>' + esc(caption) + '</em></p>' : "") +
        (flagTags ? '<p>' + flagTags + '</p>' : "") +
        (I18N.lang === "ru" && !texts && total ? '<div class="callout">' + esc(t("islands.untranslated")) + '</div>' : "") +
        (rows.length ? '<dl class="meta">' + rows.map(function (r) {
          return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>';
        }).join("") + '</dl>' : "") +
        (x.enemies.length ? '<h2>' + esc(t("islands.enemies")) + '</h2><div class="row">' +
          x.enemies.map(function (e) { return '<span class="tag">' + esc(e) + '</span>'; }).join("") + '</div>' : "") +
        body +
        '<div class="ornament" aria-hidden="true">❖</div>' +
        (texts ? '<p class="source">' + esc(t("talents.report")) + ' <a href="mailto:' + CONTACT +
          '?subject=' + encodeURIComponent(t("talents.report.subject") + ": " + x.name) + '">' + CONTACT + '</a></p>' : "") +
        '<p class="source">' + esc(t("talents.source")) + ' <a href="' + esc(x.wiki_url) + '" target="_blank" rel="noopener">Deepwoken Wiki</a> (CC BY-SA 3.0).</p>' +
        '<p><a class="btn btn--ghost" href="#/islands">← ' + esc(t("islands.back")) + '</a></p>'
    };
  }

  function render(arg) {
    if (!data) return null;
    if (!arg) return listView();
    return detailView(arg) || {
      title: t("notfound.title"),
      html: '<h1>' + esc(t("notfound.title")) + '</h1><p><a class="btn btn--ghost" href="#/islands">' + esc(t("islands.back")) + '</a></p>'
    };
  }

  window.ISLANDS_VIEW = { load: load, render: render };
})();
