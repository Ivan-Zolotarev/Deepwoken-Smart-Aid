(function () {
  var I18N = window.I18N;
  var P = window.PAGES;
  var book = document.getElementById("book");
  var nav = document.getElementById("nav");
  var view = document.getElementById("view");

  // "#/talents/some-slug" -> { name: "talents", arg: "some-slug" }
  function currentRoute() {
    var h = location.hash.replace(/^#\/?/, "");
    var i = h.indexOf("/");
    return i === -1 ? { name: h, arg: "" } : { name: h.slice(0, i), arg: h.slice(i + 1) };
  }

  function renderNav(route) {
    nav.setAttribute("aria-label", I18N.t("contents.eyebrow"));
    nav.innerHTML = P.SECTIONS.map(function (s) {
      var cur = route === s.id ? ' aria-current="page"' : "";
      return '<a class="bookmark" href="#/' + s.id + '"' + cur + '>' +
        '<span class="bookmark__glyph" aria-hidden="true">' + s.glyph + '</span>' +
        '<span>' + I18N.t("nav." + s.id) + '</span></a>';
    }).join("");
  }

  function referenceHub() {
    var items = [
      { href: "#/reference/weapons", title: I18N.t("weapons.title"), text: I18N.t("ref.weapons.desc") },
      { href: "#/reference/mantras", title: I18N.t("mantras.title"), text: I18N.t("ref.mantras.desc") }
    ];
    return {
      title: I18N.t("nav.reference"),
      html:
        '<p class="eyebrow">' + I18N.t("nav.reference") + '</p>' +
        '<h1>' + I18N.t("nav.reference") + '</h1>' +
        '<p class="lead">' + I18N.t("sec.reference.desc") + '</p>' +
        '<div class="grid">' + items.map(function (it) {
          return it.href
            ? '<a class="card card--talent" href="' + it.href + '"><h3 class="card__title">' + it.title + '</h3><p class="card__text">' + it.text + '</p></a>'
            : '<div class="card card--talent"><h3 class="card__title">' + it.title + '</h3><p class="card__text">' + it.text + '</p></div>';
        }).join("") + '</div>'
    };
  }

  function render(focus) {
    var r = currentRoute();
    var route = r.name;
    var page;

    // Обложка занимает место книги целиком
    if (route === "") {
      nav.hidden = true;
      book.innerHTML = '<nav class="bookmarks" id="nav" hidden></nav>' + P.cover();
      nav = document.getElementById("nav");
      view = document.getElementById("view");
      document.title = "Deepwoken Smart Aid";
      if (focus) view.focus({ preventScroll: true });
      return;
    }

    var section = P.SECTIONS.filter(function (s) { return s.id === route; })[0];
    var dataView = { talents: window.TALENTS_VIEW, quests: window.QUESTS_VIEW }[route];
    var viewArg = r.arg;
    // Справочник: «#/reference/weapons/<slug>»; без подраздела — оглавление справочника
    if (route === "reference") {
      var parts = r.arg.split("/");
      var sub = { weapons: window.WEAPONS_VIEW, mantras: window.MANTRAS_VIEW }[parts[0]];
      if (sub) {
        dataView = sub;
        viewArg = parts.slice(1).join("/");
      }
    }
    if (route === "reference" && !dataView) page = referenceHub();
    else if (dataView) {
      page = dataView.render(viewArg);
      if (!page) {
        page = { title: I18N.t("nav." + route), html: '<p class="loading">' + I18N.t("loading") + "</p>" };
        dataView.load().then(function () {
          if (currentRoute().name === route) render(focus);
        }, function () {
          if (currentRoute().name === route) {
            view.innerHTML = '<div class="callout callout--warn">' + I18N.t("load.error") + "</div>";
          }
        });
      }
    }
    else if (route === "contents") page = P.contents();
    else if (route === "styleguide") page = P.styleguide();
    else if (section) page = P.soon(section);
    else page = P.notFound();

    book.innerHTML =
      '<nav class="bookmarks" id="nav"></nav>' +
      '<article class="page' + (page.spread ? " page--spread" : "") + '" id="view" tabindex="-1">' +
        page.html +
      '</article>';
    nav = document.getElementById("nav");
    view = document.getElementById("view");

    renderNav(route);
    if (page.afterRender) page.afterRender(view);
    document.title = page.title + " — Deepwoken Smart Aid";
    if (focus) {
      window.scrollTo(0, 0);
      view.focus({ preventScroll: true });
    }
  }

  document.querySelectorAll(".lang button").forEach(function (b) {
    b.addEventListener("click", function () { I18N.setLang(b.dataset.lang); });
  });

  window.addEventListener("hashchange", function () { render(true); });
  document.addEventListener("langchange", function () { render(false); });

  I18N.apply(document);
  render(false);
})();
