// Раздел «Квесты»: список с фильтрами и страница квеста
(function () {
  var I18N = window.I18N;
  var state = { q: "", kind: "", trait: "", location: "" };
  var data = null;
  var bySlug = {};
  var talentSlugs = {};   // таланты, которые есть в каталоге: на них ставим ссылки
  var options = null;
  var loading = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function slugify(n) {
    return String(n).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function t(k) { return I18N.t(k); }

  function init() {
    data = window.DEEPWOKEN_DATA.quests.quests;
    var tal = window.DEEPWOKEN_DATA.talents;
    if (tal) tal.talents.forEach(function (x) { talentSlugs[slugify(x.name)] = 1; });
    var loc = {};
    data.forEach(function (q) {
      bySlug[q.slug] = q;
      q.hay = (q.name + " " + q.locations.join(" ") + " " + q.rewards + " " + q.npcs.join(" ") + " " +
        q.guide.map(function (g) { return g.text; }).join(" ")).toLowerCase();
      q.locations.forEach(function (l) { if (l.length > 1 && l !== "N/A") loc[l] = 1; });
    });
    options = {
      kinds: ["talent", "one-time", "repeatable"],
      traits: ["bravery", "compassion", "curiosity", "miscellaneous"],
      locations: Object.keys(loc).sort()
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
        var loadQuests = function () {
          addScript("data/quests.js",
            function () { init(); resolve(); },
            function () { loading = null; reject(new Error("quests.js")); });
        };
        // Каталог талантов нужен только для ссылок из наград
        addScript("data/talents.js", loadQuests, loadQuests);
      });
    }
    return loading;
  }

  function kindLabel(k) { return t("quests.kind." + k); }
  function traitLabel(k) { return t("quests.trait." + k); }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return data.filter(function (x) {
      if (state.kind && x.kind !== state.kind) return false;
      if (state.trait && x.trait !== state.trait) return false;
      if (state.location && x.locations.indexOf(state.location) === -1) return false;
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
    var first = x.guide.length ? x.guide[0].text : "";
    return '<a class="card card--talent" href="#/quests/' + x.slug + '">' +
      '<span class="tag">' + esc(kindLabel(x.kind)) + '</span> ' +
      '<span class="tag">' + esc(traitLabel(x.trait)) + '</span>' +
      '<h3 class="card__title">' + esc(x.name) + '</h3>' +
      '<p class="card__cat">' + esc(x.location_text) + '</p>' +
      '<p class="card__text card__text--clamp">' + esc(first) + '</p>' +
      (x.rewards ? '<p class="card__req">' + esc(x.rewards) + '</p>' : "") +
    '</a>';
  }

  function resultsHtml() {
    var list = filtered();
    var html = '<p class="count" role="status">' + esc(t("talents.found")) + ': <strong>' + list.length + '</strong> / ' + data.length + '</p>';
    if (!list.length) return html + '<div class="callout">' + esc(t("talents.empty")) + '</div>';
    return html + '<div class="grid">' + list.map(cardHtml).join("") + '</div>';
  }

  function listView() {
    return {
      title: t("nav.quests"),
      html:
        '<p class="eyebrow">' + esc(t("nav.quests")) + '</p>' +
        '<h1>' + esc(t("quests.title")) + '</h1>' +
        '<p class="lead">' + esc(t("quests.lead")) + '</p>' +
        '<form class="filters" id="q-filters" onsubmit="return false">' +
          '<label class="field field--wide"><span>' + esc(t("talents.search")) + '</span>' +
            '<input type="search" id="q-q" value="' + esc(state.q) + '" placeholder="' + esc(t("quests.search.ph")) + '" autocomplete="off"></label>' +
          selectHtml("q-kind", t("quests.kind"), options.kinds, state.kind, kindLabel) +
          selectHtml("q-trait", t("quests.trait"), options.traits, state.trait, traitLabel) +
          selectHtml("q-location", t("quests.location"), options.locations, state.location) +
          '<button type="button" class="btn btn--ghost btn--sm" id="q-reset">' + esc(t("talents.reset")) + '</button>' +
        '</form>' +
        '<div id="q-results">' + resultsHtml() + '</div>',
      afterRender: function (root) {
        var results = root.querySelector("#q-results");
        function refresh() { results.innerHTML = resultsHtml(); }
        [["#q-q", "q"], ["#q-kind", "kind"], ["#q-trait", "trait"], ["#q-location", "location"]].forEach(function (p) {
          var el = root.querySelector(p[0]);
          el.addEventListener(p[1] === "q" ? "input" : "change", function () {
            state[p[1]] = el.value;
            refresh();
          });
        });
        root.querySelector("#q-reset").addEventListener("click", function () {
          state = { q: "", kind: "", trait: "", location: "" };
          ["#q-q", "#q-kind", "#q-trait", "#q-location"].forEach(function (id) { root.querySelector(id).value = ""; });
          refresh();
        });
      }
    };
  }

  function guideHtml(guide) {
    var html = "", inList = false;
    guide.forEach(function (g) {
      if (g.step && !inList) { html += "<ol>"; inList = true; }
      if (!g.step && inList) { html += "</ol>"; inList = false; }
      html += g.step ? "<li>" + esc(g.text) + "</li>" : "<p>" + esc(g.text) + "</p>";
    });
    if (inList) html += "</ol>";
    return html;
  }

  function detailView(slug) {
    var x = bySlug[decodeURIComponent(slug)];
    if (!x) return null;
    var talents = x.reward_talents.map(function (n) {
      var s = slugify(n);
      return talentSlugs[s]
        ? '<a class="tag tag--link" href="#/talents/' + s + '">' + esc(n) + '</a>'
        : '<span class="tag">' + esc(n) + '</span>';
    }).join("");
    var rows = [
      [t("quests.location"), x.location_text],
      [t("quests.rewards"), x.rewards]
    ];
    if (x.npcs.length) rows.push([t("quests.npcs"), x.npcs.join(", ")]);

    return {
      title: x.name,
      html:
        '<p class="eyebrow"><a href="#/quests">' + esc(t("nav.quests")) + '</a> · ' + esc(kindLabel(x.kind)) + '</p>' +
        '<h1>' + esc(x.name) + '</h1>' +
        '<div class="row"><span class="tag">' + esc(traitLabel(x.trait)) + '</span></div>' +
        (I18N.lang === "ru" ? '<div class="callout">' + esc(t("quests.en.note")) + '</div>' : "") +
        '<div class="ornament" aria-hidden="true">❖</div>' +
        '<dl class="meta">' + rows.filter(function (r) { return r[1]; }).map(function (r) {
          return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>';
        }).join("") + '</dl>' +
        (talents ? '<h2>' + esc(t("quests.talents")) + '</h2><div class="row">' + talents + '</div>' : "") +
        '<h2>' + esc(t("quests.guide")) + '</h2><div class="info-list">' + guideHtml(x.guide) + '</div>' +
        (x.afterwards ? '<h2>' + esc(t("quests.afterwards")) + '</h2><p>' + esc(x.afterwards) + '</p>' : "") +
        '<div class="ornament" aria-hidden="true">❖</div>' +
        '<p class="source">' + esc(t("talents.source")) + ' <a href="https://deepwoken.fandom.com/wiki/Quests" target="_blank" rel="noopener">Deepwoken Wiki</a> (CC BY-SA 3.0).</p>' +
        '<p><a class="btn btn--ghost" href="#/quests">← ' + esc(t("quests.back")) + '</a></p>'
    };
  }

  function render(arg) {
    if (!data) return null;
    if (!arg) return listView();
    return detailView(arg) || {
      title: t("notfound.title"),
      html: '<h1>' + esc(t("notfound.title")) + '</h1><p><a class="btn btn--ghost" href="#/quests">' + esc(t("quests.back")) + '</a></p>'
    };
  }

  window.QUESTS_VIEW = { load: load, render: render };
})();
