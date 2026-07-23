(function () {
  "use strict";
  const button = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".primary-nav");
  if (!button || !nav) return;

  function closeMenu() {
    nav.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
  }

  button.addEventListener("click", function () {
    const open = nav.classList.toggle("open");
    button.setAttribute("aria-expanded", String(open));
  });

  nav.addEventListener("click", function (event) {
    if (event.target.closest("a")) closeMenu();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeMenu();
      button.focus();
    }
  });
}());
