(function () {
  var DEFAULT = "ru";
  var KEY = "dsa.lang";
  var lang = DEFAULT;

  try {
    var saved = localStorage.getItem(KEY);
    if (saved && window.LANGS[saved]) lang = saved;
  } catch (e) { /* хранилище может быть недоступно */ }

  function t(key) {
    var dict = window.LANGS[lang] || {};
    if (key in dict) return dict[key];
    var fallback = window.LANGS[DEFAULT] || {};
    return key in fallback ? fallback[key] : key;
  }

  function setLang(next) {
    if (!window.LANGS[next] || next === lang) return;
    lang = next;
    try { localStorage.setItem(KEY, lang); } catch (e) { /* ignore */ }
    document.documentElement.lang = lang;
    apply(document);
    document.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
  }

  // Подставляет переводы в элементы с data-i18n
  function apply(root) {
    root.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });
  }

  document.documentElement.lang = lang;

  window.I18N = {
    t: t,
    get lang() { return lang; },
    setLang: setLang,
    apply: apply
  };
})();
