// Progressive enhancement for published Strata sites: collapsible navigation on small screens.
// Without JavaScript the navigation links simply stay visible.
(function () {
  document.documentElement.classList.add("st-js");
  document.addEventListener("click", function (event) {
    var toggle = event.target instanceof Element ? event.target.closest(".st-nav__toggle") : null;
    if (!toggle) return;
    var nav = toggle.closest(".st-nav");
    if (!nav) return;
    var open = nav.classList.toggle("st-nav--open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
})();
