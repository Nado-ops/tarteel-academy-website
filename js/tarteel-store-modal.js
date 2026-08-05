(function () {
  "use strict";

  const PRODUCT_ENDPOINT = "/api/store-products";
  const FALLBACK_STORE_BASE = "https://shop.tarteel.co.za";
  const DONATION_TERMS = [
    "donate", "donation", "sponsor", "sponsorship", "contribution", "contribute",
    "zakaat", "zakat", "sadaqah", "sadaqa", "lillah", "waqf", "charity"
  ];

  const state = {
    products: [],
    activeTab: "shop",
    loaded: false,
    loading: false,
    storeBase: FALLBACK_STORE_BASE,
    journeyOpen: false,
    journeyTimer: null,
    previousFocus: null
  };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function stripHtml(value) {
    const node = document.createElement("div");
    node.innerHTML = value || "";
    return (node.textContent || "").replace(/\s+/g, " ").trim();
  }

  function safeStoreUrl(value) {
    try {
      const url = new URL(value, state.storeBase + "/");
      if (url.protocol !== "https:") return "";
      if (!/^([a-z0-9-]+\.)*shop\.tarteel\.co\.za$/i.test(url.hostname)) return "";
      return url.href;
    } catch (error) {
      return "";
    }
  }

  function injectStylesheet() {
    if (document.querySelector('link[data-tarteel-store-styles]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "css/tarteel-store-modal.css";
    link.dataset.tarteelStoreStyles = "true";
    document.head.appendChild(link);
  }

  function createModal() {
    if (document.querySelector("#tarteelStoreModal")) return;
    const modal = document.createElement("div");
    modal.className = "store-modal";
    modal.id = "tarteelStoreModal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="store-modal__backdrop" data-close-store></div>
      <section class="store-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="tarteelStoreTitle" tabindex="-1" data-product-count="loading">
        <header class="store-modal__header">
          <div class="store-modal__brand">
            <img class="store-modal__brand-logo" src="assets/images/tarteel-white-logo.png" alt="Tarteel Academy">
            <div>
              <h2 id="tarteelStoreTitle">Tarteel Store &amp; Donations</h2>
              <p>Products and contributions securely managed through WooCommerce</p>
            </div>
          </div>
          <button class="store-modal__close" type="button" data-close-store aria-label="Close Tarteel store">×</button>
        </header>

        <div class="store-modal__catalogue" data-store-catalogue>
          <div class="store-modal__notice" data-store-notice>
            Public product information is shown here. The secure donation, cart and checkout journey remains inside this Tarteel modal.
          </div>
          <div class="store-modal__tabs" role="tablist" aria-label="Store sections">
            <button class="store-modal__tab is-active" id="tarteelShopTab" type="button" role="tab" aria-selected="true" aria-controls="tarteelCatalogueContent" data-store-tab="shop">Shop <span class="store-modal__tab-count" data-shop-count>0</span></button>
            <button class="store-modal__tab" id="tarteelDonationsTab" type="button" role="tab" aria-selected="false" aria-controls="tarteelCatalogueContent" data-store-tab="donations">Donations <span class="store-modal__tab-count" data-donation-count>0</span></button>
          </div>
          <div class="store-modal__body" id="tarteelCatalogueContent" role="tabpanel" aria-labelledby="tarteelShopTab">
            <div class="store-modal__status" data-store-status></div>
            <div class="store-product-grid" data-product-grid hidden></div>
          </div>
          <footer class="store-modal__footer" data-store-footer>
            <p>Products, donations, pricing and availability are controlled from WordPress.</p>
            <div class="store-modal__footer-actions">
              <button class="store-modal__footer-button" type="button" data-open-store-page="cart">View cart</button>
              <button class="store-modal__footer-button store-modal__footer-button--checkout" type="button" data-open-store-page="checkout">Secure checkout</button>
            </div>
          </footer>
        </div>

        <section class="store-journey" data-store-journey hidden aria-label="Secure WooCommerce journey">
          <div class="store-journey__toolbar">
            <button class="store-journey__back" type="button" data-close-store-page><span aria-hidden="true">←</span> Back to catalogue</button>
          </div>
          <div class="store-journey__viewport">
            <div class="store-journey__loading" data-journey-loading role="status">
              <span class="store-journey__spinner" aria-hidden="true"></span>
              <p>Loading secure WooCommerce page…</p>
            </div>
            <div class="store-journey__error" data-journey-error role="alert" hidden>
              <strong>The secure page could not be displayed.</strong>
              <p>Please return to the catalogue and try again.</p>
            </div>
            <iframe class="store-journey__frame" data-store-frame src="about:blank" title="Tarteel Academy secure WooCommerce store" allow="payment" hidden></iframe>
          </div>
        </section>
      </section>`;
    document.body.appendChild(modal);
  }

  function addStoreEntryPoints() {
    const donationButton = document.querySelector(".involvement-option--donate .button");
    if (donationButton) {
      donationButton.setAttribute("href", "#tarteel-store-donations");
      donationButton.removeAttribute("target");
      donationButton.removeAttribute("rel");
      donationButton.dataset.openStore = "donations";
      donationButton.innerHTML = 'View Donation Options <span aria-hidden="true">→</span>';
    }
    const options = document.querySelector(".involvement-options");
    if (options && !document.querySelector(".involvement-store-cta")) {
      options.insertAdjacentHTML("afterend", '<div class="involvement-store-cta"><button class="button--store" type="button" data-open-store="shop">Visit Tarteel Store <span aria-hidden="true">→</span></button></div>');
    }
  }

  function isDonationProduct(product) {
    const categories = Array.isArray(product.categories)
      ? product.categories.map((category) => `${category.name || ""} ${category.slug || ""}`).join(" ")
      : "";
    const text = [product.name, product.slug, product.short_description, product.description, categories].join(" ").toLowerCase();
    return DONATION_TERMS.some((term) => text.includes(term));
  }

  function formatPrice(product, donation) {
    const prices = product.prices || {};
    if (prices.price === undefined || prices.price === null || prices.price === "") return "View options";
    const minorUnit = Number(prices.currency_minor_unit || 2);
    const value = Number(prices.price) / Math.pow(10, minorUnit);
    if (!Number.isFinite(value)) return "View options";
    if (donation && value === 0) return "Choose an amount";
    let formatted;
    try {
      formatted = new Intl.NumberFormat("en-ZA", { style: "currency", currency: prices.currency_code || "ZAR", minimumFractionDigits: 0 }).format(value);
    } catch (error) {
      formatted = `R${value.toFixed(0)}`;
    }
    if ((prices.currency_code || "ZAR") === "ZAR") formatted = formatted.replace(/\s/g, "");
    return donation ? `Suggested ${formatted}` : formatted;
  }

  function productUrl(product) {
    const direct = safeStoreUrl(product.permalink || "");
    if (direct) return direct;
    return safeStoreUrl(`${state.storeBase}/product/${encodeURIComponent(product.slug || "")}/`);
  }

  function productImage(product, donation) {
    const image = Array.isArray(product.images) ? product.images[0] : null;
    if (image && image.src) return `<img class="store-product-card__image" src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || product.name || "Tarteel product")}" loading="lazy" decoding="async">`;
    return `<span class="store-product-card__placeholder" aria-hidden="true"><span class="store-product-card__placeholder-mark">${donation ? "♡" : "✦"}</span><span class="store-product-card__placeholder-label">${donation ? "Tarteel Giving" : "Tarteel Store"}</span></span>`;
  }

  function productCard(product) {
    const donation = isDonationProduct(product);
    const url = productUrl(product);
    const summary = stripHtml(product.short_description || product.description) || (donation
      ? "Support Tarteel Academy through this secure WooCommerce contribution option."
      : "View this product and continue securely inside the Tarteel store modal.");
    return `
      <article class="store-product-card">
        <button class="store-product-card__image-link" type="button" data-product-url="${escapeHtml(url)}" aria-label="Open ${escapeHtml(product.name || "product")} inside the Tarteel store">
          ${productImage(product, donation)}
          <span class="store-product-card__badge">${donation ? "Donation" : "Product"}</span>
        </button>
        <div class="store-product-card__body">
          <h3><button class="store-product-card__title" type="button" data-product-url="${escapeHtml(url)}">${escapeHtml(product.name || "Tarteel item")}</button></h3>
          <p class="store-product-card__summary">${escapeHtml(summary)}</p>
          <div class="store-product-card__footer">
            <span class="store-product-card__price">${escapeHtml(formatPrice(product, donation))}</span>
            <button class="store-product-card__action" type="button" data-product-url="${escapeHtml(url)}">${donation ? "Choose donation amount" : "View product"}</button>
          </div>
        </div>
      </article>`;
  }

  function filteredProducts(tab) {
    return state.products.filter((product) => tab === "donations" ? isDonationProduct(product) : !isDonationProduct(product));
  }

  function statusMarkup(icon, heading, copy, retry) {
    return `<div class="store-modal__status-inner"><span class="store-modal__status-icon" aria-hidden="true">${icon}</span><h3>${heading}</h3><p>${copy}</p>${retry ? '<button class="store-modal__retry" type="button" data-retry-store>Try again</button>' : ""}</div>`;
  }

  function render() {
    const grid = document.querySelector("[data-product-grid]");
    const status = document.querySelector("[data-store-status]");
    const dialog = document.querySelector(".store-modal__dialog");
    if (!grid || !status || !dialog) return;
    const shop = filteredProducts("shop");
    const donations = filteredProducts("donations");
    if (state.loaded && state.activeTab === "shop" && !shop.length && donations.length) state.activeTab = "donations";
    const current = state.activeTab === "donations" ? donations : shop;
    document.querySelector("[data-shop-count]").textContent = String(shop.length);
    document.querySelector("[data-donation-count]").textContent = String(donations.length);
    document.querySelectorAll("[data-store-tab]").forEach((tab) => {
      const active = tab.dataset.storeTab === state.activeTab;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.disabled = state.loaded && ((tab.dataset.storeTab === "shop" ? shop : donations).length === 0);
    });
    document.querySelector("#tarteelCatalogueContent").setAttribute("aria-labelledby", state.activeTab === "shop" ? "tarteelShopTab" : "tarteelDonationsTab");
    if (state.loading) {
      dialog.dataset.productCount = "loading";
      grid.hidden = true;
      status.hidden = false;
      status.innerHTML = statusMarkup("⌛", "Loading Tarteel products…", "Please wait while the current WooCommerce catalogue is retrieved.", false);
      return;
    }
    if (!state.loaded) return;
    if (!current.length) {
      dialog.dataset.productCount = "0";
      grid.hidden = true;
      status.hidden = false;
      status.innerHTML = statusMarkup(state.activeTab === "donations" ? "♡" : "✦", "Nothing is available in this section yet", "Please try again later.", false);
      return;
    }
    const count = current.length >= 4 ? "many" : String(current.length);
    dialog.dataset.productCount = count;
    status.hidden = true;
    grid.hidden = false;
    grid.dataset.productCount = count;
    grid.innerHTML = current.map(productCard).join("");
  }

  function clearJourneyTimer() {
    if (state.journeyTimer) window.clearTimeout(state.journeyTimer);
    state.journeyTimer = null;
  }

  function showJourneyLoaded() {
    clearJourneyTimer();
    const loading = document.querySelector("[data-journey-loading]");
    const error = document.querySelector("[data-journey-error]");
    const frame = document.querySelector("[data-store-frame]");
    if (loading) loading.hidden = true;
    if (error) error.hidden = true;
    if (frame) frame.hidden = false;
  }

  function showJourneyError() {
    clearJourneyTimer();
    const loading = document.querySelector("[data-journey-loading]");
    const error = document.querySelector("[data-journey-error]");
    const frame = document.querySelector("[data-store-frame]");
    if (loading) loading.hidden = true;
    if (error) error.hidden = false;
    if (frame) frame.hidden = true;
  }

  function openStorePage(url) {
    const safeUrl = safeStoreUrl(url);
    if (!safeUrl) return;
    const catalogue = document.querySelector("[data-store-catalogue]");
    const journey = document.querySelector("[data-store-journey]");
    const frame = document.querySelector("[data-store-frame]");
    const loading = document.querySelector("[data-journey-loading]");
    const error = document.querySelector("[data-journey-error]");
    if (!catalogue || !journey || !frame) return;
    state.journeyOpen = true;
    catalogue.hidden = true;
    journey.hidden = false;
    loading.hidden = false;
    error.hidden = true;
    frame.hidden = true;
    frame.src = safeUrl;
    clearJourneyTimer();
    state.journeyTimer = window.setTimeout(showJourneyError, 15000);
    const back = journey.querySelector("[data-close-store-page]");
    if (back) back.focus();
  }

  function closeStorePage() {
    const catalogue = document.querySelector("[data-store-catalogue]");
    const journey = document.querySelector("[data-store-journey]");
    const frame = document.querySelector("[data-store-frame]");
    clearJourneyTimer();
    state.journeyOpen = false;
    if (frame) { frame.hidden = true; frame.src = "about:blank"; }
    if (journey) journey.hidden = true;
    if (catalogue) catalogue.hidden = false;
    const activeTab = document.querySelector('[data-store-tab][aria-selected="true"]');
    if (activeTab) activeTab.focus();
  }

  async function loadProducts(force) {
    if (state.loading || (state.loaded && !force)) return;
    state.loading = true;
    render();
    try {
      const response = await fetch(PRODUCT_ENDPOINT, { method: "GET", credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Catalogue request failed");
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.products)) throw new Error("Unexpected catalogue response");
      state.products = payload.products;
      state.storeBase = (safeStoreUrl(payload.store_base || "") || FALLBACK_STORE_BASE).replace(/\/$/, "");
      state.loaded = true;
    } catch (error) {
      state.loaded = false;
      const status = document.querySelector("[data-store-status]");
      if (status) {
        status.hidden = false;
        status.innerHTML = statusMarkup("!", "The catalogue could not be loaded", "The store may be temporarily unavailable. No customer or payment information was affected.", true);
      }
    } finally {
      state.loading = false;
      if (state.loaded) render();
    }
  }

  function syncBodyLock() {
    document.body.classList.toggle("modal-open", Boolean(document.querySelector(".faculty-modal.is-open, .involvement-modal.is-open, .store-modal.is-open")));
  }

  function openStore(tab, trigger) {
    const modal = document.querySelector("#tarteelStoreModal");
    const involvement = document.querySelector("#involvementModal");
    if (!modal) return;
    if (involvement) { involvement.classList.remove("is-open"); involvement.setAttribute("aria-hidden", "true"); }
    state.previousFocus = trigger || document.activeElement;
    state.activeTab = tab === "donations" ? "donations" : "shop";
    closeStorePage();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    syncBodyLock();
    if (state.loaded) render(); else loadProducts(false);
    window.requestAnimationFrame(() => modal.querySelector("[data-close-store]").focus());
  }

  function closeStore() {
    const modal = document.querySelector("#tarteelStoreModal");
    if (!modal || !modal.classList.contains("is-open")) return;
    closeStorePage();
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    syncBodyLock();
    if (state.previousFocus && document.contains(state.previousFocus)) state.previousFocus.focus();
  }

  function bindEvents() {
    const frame = document.querySelector("[data-store-frame]");
    if (frame) {
      frame.addEventListener("load", () => { if (state.journeyOpen && frame.src !== "about:blank") showJourneyLoaded(); });
      frame.addEventListener("error", showJourneyError);
    }
    document.addEventListener("click", (event) => {
      const opener = event.target.closest("[data-open-store]");
      if (opener) { event.preventDefault(); openStore(opener.dataset.openStore, opener); return; }
      if (event.target.closest("[data-close-store]")) { closeStore(); return; }
      if (event.target.closest("[data-close-store-page]")) { closeStorePage(); return; }
      const product = event.target.closest("[data-product-url]");
      if (product) { openStorePage(product.dataset.productUrl); return; }
      const destination = event.target.closest("[data-open-store-page]");
      if (destination) { openStorePage(`${state.storeBase}/${destination.dataset.openStorePage}/`); return; }
      const tab = event.target.closest("[data-store-tab]");
      if (tab && !tab.disabled) { state.activeTab = tab.dataset.storeTab === "donations" ? "donations" : "shop"; render(); return; }
      if (event.target.closest("[data-retry-store]")) loadProducts(true);
    });
    document.addEventListener("keydown", (event) => {
      const modal = document.querySelector("#tarteelStoreModal");
      if (!modal || !modal.classList.contains("is-open")) return;
      if (event.key === "Escape") { event.preventDefault(); closeStore(); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(modal.querySelectorAll('button:not(:disabled), iframe:not([hidden]), [tabindex]:not([tabindex="-1"])')).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    });
  }

  function init() {
    injectStylesheet();
    addStoreEntryPoints();
    createModal();
    bindEvents();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}());
