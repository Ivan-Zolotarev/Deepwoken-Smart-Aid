(function () {
  var I18N = window.I18N;
  var P = window.PAGES;
  var book = document.getElementById("book");
  var nav = document.getElementById("nav");
  var view = document.getElementById("view");

  function currentRoute() {
    var h = location.hash.replace(/^#\/?/, "");
    return h || "";
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

  function render(focus) {
    var route = currentRoute();
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
    if (route === "contents") page = P.contents();
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
