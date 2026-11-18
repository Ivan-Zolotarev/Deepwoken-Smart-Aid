(function () {
  var t = function (k) { return window.I18N.t(k); };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Разделы книги: id, глиф, этап roadmap, на котором раздел наполняется
  var SECTIONS = [
    { id: "talents",   glyph: "✦", stage: 2 },
    { id: "quests",    glyph: "⚑", stage: 3 },
    { id: "islands",   glyph: "⚓", stage: 3 },
    { id: "beginners", glyph: "☙", stage: 4 },
    { id: "builds",    glyph: "⚔", stage: 5 },
    { id: "reference", glyph: "❦", stage: 3 },
    { id: "assistant", glyph: "◉", stage: 6 }
  ];

  var SCHOOLS = ["flamecharm", "frostdraw", "thundercall", "galebreathe", "shadowcast", "ironsing", "bloodrend"];

  var PALETTE = [
    ["--leather-2", "Кожа"], ["--gold", "Золото"], ["--gold-bright", "Золото+"],
    ["--parchment-1", "Пергамент"], ["--ink", "Чернила"], ["--rune", "Руна"],
    ["--bg-0", "Стол"], ["--blood", "Кровь"]
  ];

  function cover() {
    return '' +
      '<section class="cover" id="view" tabindex="-1">' +
        '<div class="cover__inner">' +
          '<svg class="cover__emblem" viewBox="0 0 32 32" aria-hidden="true"><use href="#emblem"/></svg>' +
          '<p class="cover__kicker">' + esc(t("home.kicker")) + '</p>' +
          '<h1 class="cover__title">' + esc(t("home.title")) + '</h1>' +
          '<p class="cover__subtitle">' + esc(t("home.subtitle")) + '</p>' +
          '<a class="btn" href="#/contents">' + esc(t("home.open")) + '</a>' +
        '</div>' +
      '</section>';
  }

  function contents() {
    var cards = SECTIONS.map(function (s) {
      return '<a class="card" href="#/' + s.id + '">' +
        '<div class="card__glyph" aria-hidden="true">' + s.glyph + '</div>' +
        '<h3 class="card__title">' + esc(t("nav." + s.id)) + '</h3>' +
        '<p class="card__text">' + esc(t("sec." + s.id + ".desc")) + '</p>' +
      '</a>';
    }).join("");

    return {
      spread: true,
      title: t("contents.eyebrow"),
      html:
        '<section>' +
          '<p class="eyebrow">' + esc(t("contents.eyebrow")) + '</p>' +
          '<h1>' + esc(t("contents.title")) + '</h1>' +
          '<p class="lead">' + esc(t("contents.lead")) + '</p>' +
          '<div class="callout"><strong>' + esc(t("contents.note")) + '</strong></div>' +
          '<p><a class="btn btn--ghost" href="#/styleguide">' + esc(t("home.styleguide")) + '</a></p>' +
        '</section>' +
        '<section><div class="grid">' + cards + '</div></section>'
    };
  }

  function soon(section) {
    var items = t("plan." + section.id).map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("");
    return {
      title: t("nav." + section.id),
      html:
        '<p class="eyebrow">' + esc(t("nav." + section.id)) + '</p>' +
        '<h1>' + esc(t("soon.title")) + '</h1>' +
        '<p><span class="tag tag--stage">' + esc(t("stage")) + ' ' + section.stage + '</span></p>' +
        '<div class="ornament" aria-hidden="true">❖</div>' +
        '<p>' + esc(t("soon.text")) + '</p>' +
        '<ul class="plan">' + items + '</ul>'
    };
  }

  function styleguide() {
    var sw = PALETTE.map(function (p) {
      return '<div class="swatch"><i style="background:var(' + p[0] + ')"></i>' + esc(p[1]) + '<br>' + p[0] + '</div>';
    }).join("");
    var schools = SCHOOLS.map(function (s) {
      var name = s.charAt(0).toUpperCase() + s.slice(1);
      return '<span class="school school--' + s + '">' + name + '</span>';
    }).join("");

    return {
      spread: true,
      title: t("sg.title"),
      html:
        '<section>' +
          '<p class="eyebrow">' + esc(t("sg.eyebrow")) + '</p>' +
          '<h1>' + esc(t("sg.title")) + '</h1>' +
          '<p class="lead">' + esc(t("sg.lead")) + '</p>' +
          '<h2>' + esc(t("sg.colors")) + '</h2>' +
          '<div class="swatches">' + sw + '</div>' +
          '<h2>' + esc(t("sg.schools")) + '</h2>' +
          '<div class="row">' + schools + '</div>' +
        '</section>' +
        '<section>' +
          '<h2>' + esc(t("sg.buttons")) + '</h2>' +
          '<div class="row">' +
            '<a class="btn" href="#/styleguide">' + esc(t("sg.btn.primary")) + '</a>' +
            '<a class="btn btn--ghost" href="#/styleguide">' + esc(t("sg.btn.ghost")) + '</a>' +
            '<span class="tag">Common</span><span class="tag tag--stage">' + esc(t("stage")) + ' 0</span>' +
          '</div>' +
          '<h2>' + esc(t("sg.cards")) + '</h2>' +
          '<a class="card" href="#/styleguide"><div class="card__glyph" aria-hidden="true">✦</div>' +
            '<h3 class="card__title">' + esc(t("sg.card.sample.title")) + '</h3>' +
            '<p class="card__text">' + esc(t("sg.card.sample.text")) + '</p></a>' +
          '<h2>' + esc(t("sg.callouts")) + '</h2>' +
          '<div class="callout">' + esc(t("sg.callout.info")) + '</div>' +
          '<div class="callout callout--warn">' + esc(t("sg.callout.warn")) + '</div>' +
        '</section>'
    };
  }

  function notFound() {
    return {
      title: t("notfound.title"),
      html:
        '<h1>' + esc(t("notfound.title")) + '</h1>' +
        '<p>' + esc(t("notfound.text")) + '</p>' +
        '<p><a class="btn btn--ghost" href="#/contents">' + esc(t("notfound.back")) + '</a></p>'
    };
  }

  window.PAGES = {
    SECTIONS: SECTIONS,
    cover: cover,
    contents: contents,
    soon: soon,
    styleguide: styleguide,
    notFound: notFound
  };
})();
