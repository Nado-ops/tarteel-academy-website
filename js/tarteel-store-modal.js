(function () {
  "use strict";

  const PRODUCT_ENDPOINT = "/api/store-products";
  const FALLBACK_STORE_BASE = "https://www.shop.tarteel.co.za";
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
    return (node.textContent || "").trim();
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
      <section class="store-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="tarteelStoreTitle" tabindex="-1">
        <header class="store-modal__header">
          <div class="store-modal__brand">
            <span class="store-modal__brand-mark" aria-hidden="true">✦</span>
            <div>
              <h2 id="tarteelStoreTitle">Tarteel Store &amp; Donations</h2>
              <p>Products and contributions securely managed through WooCommerce</p>
            </div>
          </div>
          <div class="store-modal__header-actions">
            <a class="store-modal__external" data-store-link href="${FALLBACK_STORE_BASE}/shop/" target="_blank" rel="noopener noreferrer">Open full store <span aria-hidden="true">↗</span></a>
            <button class="store-modal__close" type="button" data-close-store aria-label="Close Tarteel store">×</button>
          </div>
        </header>

        <div class="store-modal__notice">
          Only public product information is shown here. Cart, checkout, payments and order records remain securely inside WooCommerce.
        </div>

        <div class="store-modal__tabs" role="tablist" aria-label="Store sections">
          <button class="store-modal__tab is-active" type="button" role="tab" aria-selected="true" data-store-tab="shop">Shop <span class="store-modal__tab-count" data-shop-count>0</span></button>
          <button class="store-modal__tab" type="button" role="tab" aria-selected="false" data-store-tab="donations">Donations <span class="store-modal__tab-count" data-donation-count>0</span></button>
        </div>

        <div class="store-modal__body">
          <div class="store-modal__status" data-store-status>
            <div class="store-modal__status-inner">
              <span class="store-modal__status-icon" aria-hidden="true">⌛</span>
              <h3>Loading Tarteel products…</h3>
              <p>Please wait while the current WooCommerce catalogue is retrieved.</p>
            </div>
          </div>
          <div class="store-product-grid" data-product-grid hidden></div>
        </div>

        <footer class="store-modal__footer">
          <p>Products, donations, pricing and availability are controlled from WordPress.</p>
          <div class="store-modal__footer-actions">
            <a class="store-modal__footer-button" data-cart-link href="${FALLBACK_STORE_BASE}/cart/" target="_blank" rel="noopener noreferrer">View cart</a>
            <a class="store-modal__footer-button store-modal__footer-button--checkout" data-checkout-link href="${FALLBACK_STORE_BASE}/checkout/" target="_blank" rel="noopener noreferrer">Secure checkout</a>
          </div>
        </footer>
      </section>`;

    document.body.appendChild(modal);
  }

  function addStoreEntryPoints() {
    const donationButton = document.querySelector(".involvement-option--donate .button");
    if (donationButton) {
      donationButton.setAttribute("href", "#tarteel-store-donations");
      donationButton.dataset.openStore = "donations";
      donationButton.innerHTML = 'View Donation Options <span aria-hidden="true">→</span>';
    }

    const options = document.querySelector(".involvement-options");
    if (options && !document.querySelector(".involvement-store-cta")) {
      const wrapper = document.createElement("div");
      wrapper.className = "involvement-store-cta";
      wrapper.innerHTML = '<button class="button--store" type="button" data-open-store="shop">Visit Tarteel Store <span aria-hidden="true">→</span></button>';
      options.insertAdjacentElement("afterend", wrapper);
    }
  }

  function isDonationProduct(product) {
    const categories = Array.isArray(product.categories)
      ? product.categories.map(function (category) {
          return (category.name || "") + " " + (category.slug || "");
        }).join(" ")
      : "";

    const text = [
      product.name,
      product.slug,
      product.short_description,
      product.description,
      categories
    ].join(" ").toLowerCase();

    return DONATION_TERMS.some(function (term) {
      return text.includes(term);
    });
  }

  function formatPrice(product) {
    const prices = product.prices || {};
    const raw = prices.price;
    if (raw === undefined || raw === null || raw === "") return "View options";

    const minorUnit = Number(prices.currency_minor_unit || 2);
    const value = Number(raw) / Math.pow(10, minorUnit);
    if (!Number.isFinite(value)) return "View options";

    try {
      return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: prices.currency_code || "ZAR",
        minimumFractionDigits: 0
      }).format(value);
    } catch (error) {
      return "R" + value.toFixed(0);
    }
  }

  function productUrl(product) {
    if (product.permalink && /^https:\/\//i.test(product.permalink)) return product.permalink;
    return state.storeBase + "/product/" + encodeURIComponent(product.slug || "") + "/";
  }

  function productImage(product, donation) {
    const image = Array.isArray(product.images) ? product.images[0] : null;
    if (image && image.src) {
      return '<img class="store-product-card__image" src="' + escapeHtml(image.src) + '" alt="' + escapeHtml(image.alt || product.name || "Tarteel product") + '" loading="lazy" decoding="async">';
    }
    return '<span class="store-product-card__placeholder" aria-hidden="true">' + (donation ? "♡" : "✦") + "</span>";
  }

  function productCard(product) {
    const donation = isDonationProduct(product);
    const url = productUrl(product);
    const summary = stripHtml(product.short_description || product.description) || (
      donation
        ? "Support Tarteel Academy through this secure WooCommerce contribution option."
        : "View this item and complete your order securely through WooCommerce."
    );

    return `
      <article class="store-product-card">
        <a class="store-product-card__image-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
          ${productImage(product, donation)}
          <span class="store-product-card__badge">${donation ? "Donation" : "Product"}</span>
        </a>
        <div class="store-product-card__body">
          <h3>${escapeHtml(product.name || "Tarteel item")}</h3>
          <p class="store-product-card__summary">${escapeHtml(summary)}</p>
          <div class="store-product-card__footer">
            <span class="store-product-card__price">${escapeHtml(formatPrice(product))}</span>
            <a class="store-product-card__action" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${donation ? "Donate securely" : "View product"}</a>
          </div>
        </div>
      </article>`;
  }

  function filteredProducts(tab) {
    return state.products.filter(function (product) {
      return tab === "donations" ? isDonationProduct(product) : !isDonationProduct(product);
    });
  }

  function setStoreLinks() {
    document.querySelectorAll("[data-store-link]").forEach(function (link) {
      link.href = state.storeBase + "/shop/";
    });
    document.querySelectorAll("[data-cart-link]").forEach(function (link) {
      link.href = state.storeBase + "/cart/";
    });
    document.querySelectorAll("[data-checkout-link]").forEach(function (link) {
      link.href = state.storeBase + "/checkout/";
    });
  }

  function render() {
    const grid = document.querySelector("[data-product-grid]");
    const status = document.querySelector("[data-store-status]");
    if (!grid || !status) return;

    const shopProducts = filteredProducts("shop");
    const donationProducts = filteredProducts("donations");
    const currentProducts = state.activeTab === "donations" ? donationProducts : shopProducts;

    const shopCount = document.querySelector("[data-shop-count]");
    const donationCount = document.querySelector("[data-donation-count]");
    if (shopCount) shopCount.textContent = String(shopProducts.length);
    if (donationCount) donationCount.textContent = String(donationProducts.length);

    document.querySelectorAll("[data-store-tab]").forEach(function (tab) {
      const active = tab.dataset.storeTab === state.activeTab;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    if (!currentProducts.length) {
      grid.hidden = true;
      status.hidden = false;
      status.innerHTML = `
        <div class="store-modal__status-inner">
          <span class="store-modal__status-icon" aria-hidden="true">${state.activeTab === "donations" ? "♡" : "✦"}</span>
          <h3>${state.activeTab === "donations" ? "Donation options are being prepared" : "No shop products are available yet"}</h3>
          <p>${state.activeTab === "donations"
            ? "Add or categorise donation products in WooCommerce and they will appear here automatically."
            : "Add normal products in WooCommerce and they will appear here automatically."}</p>
          <a class="store-modal__retry" href="${escapeHtml(state.storeBase + "/shop/")}" target="_blank" rel="noopener noreferrer">Open full WooCommerce store</a>
        </div>`;
      return;
    }

    status.hidden = true;
    grid.hidden = false;
    grid.innerHTML = currentProducts.map(productCard).join("");
  }

  async function loadProducts(force) {
    if (state.loading || (state.loaded && !force)) return;
    state.loading = true;

    const grid = document.querySelector("[data-product-grid]");
    const status = document.querySelector("[data-store-status]");
    if (grid) grid.hidden = true;
    if (status) {
      status.hidden = false;
      status.innerHTML = '<div class="store-modal__status-inner"><span class="store-modal__status-icon" aria-hidden="true">⌛</span><h3>Loading Tarteel products…</h3><p>Please wait while the current WooCommerce catalogue is retrieved.</p></div>';
    }

    try {
      const response = await fetch(PRODUCT_ENDPOINT, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });

      if (!response.ok) throw new Error("Catalogue returned " + response.status);
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.products)) throw new Error("Unexpected catalogue response");

      state.products = payload.products;
      state.storeBase = /^https:\/\//i.test(payload.store_base || "")
        ? payload.store_base
        : FALLBACK_STORE_BASE;
      state.loaded = true;
      setStoreLinks();
      render();
    } catch (error) {
      state.loaded = false;
      if (status) {
        status.hidden = false;
        status.innerHTML = `
          <div class="store-modal__status-inner">
            <span class="store-modal__status-icon" aria-hidden="true">!</span>
            <h3>The product catalogue could not be loaded</h3>
            <p>The store may be temporarily unavailable or under maintenance. No customer or payment information was affected.</p>
            <button class="store-modal__retry" type="button" data-retry-store>Try again</button>
          </div>`;
      }
    } finally {
      state.loading = false;
    }
  }

  function syncBodyLock() {
    const openModal = document.querySelector(".faculty-modal.is-open, .involvement-modal.is-open, .store-modal.is-open");
    document.body.classList.toggle("modal-open", Boolean(openModal));
  }

  function openStore(tab, trigger) {
    const modal = document.querySelector("#tarteelStoreModal");
    if (!modal) return;

    const involvement = document.querySelector("#involvementModal");
    if (involvement) {
      involvement.classList.remove("is-open");
      involvement.setAttribute("aria-hidden", "true");
    }

    state.previousFocus = trigger || document.activeElement;
    state.activeTab = tab === "donations" ? "donations" : "shop";
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    syncBodyLock();

    if (state.loaded) render();
    else loadProducts(false);

    window.requestAnimationFrame(function () {
      const closeButton = modal.querySelector(".store-modal__close");
      if (closeButton) closeButton.focus();
    });
  }

  function closeStore() {
    const modal = document.querySelector("#tarteelStoreModal");
    if (!modal || !modal.classList.contains("is-open")) return;

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    syncBodyLock();

    if (state.previousFocus && document.contains(state.previousFocus)) {
      state.previousFocus.focus();
    }
  }

  function bindEvents() {
    document.addEventListener("click", function (event) {
      const opener = event.target.closest("[data-open-store]");
      if (opener) {
        event.preventDefault();
        openStore(opener.dataset.openStore, opener);
        return;
      }

      if (event.target.closest("[data-close-store]")) {
        closeStore();
        return;
      }

      const tab = event.target.closest("[data-store-tab]");
      if (tab) {
        state.activeTab = tab.dataset.storeTab === "donations" ? "donations" : "shop";
        render();
        return;
      }

      if (event.target.closest("[data-retry-store]")) loadProducts(true);
    });

    document.addEventListener("keydown", function (event) {
      const modal = document.querySelector("#tarteelStoreModal");
      if (!modal || !modal.classList.contains("is-open")) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeStore();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = Array.from(modal.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])'))
        .filter(function (element) {
          return !element.disabled && element.offsetParent !== null;
        });

      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function init() {
    injectStylesheet();
    addStoreEntryPoints();
    createModal();
    bindEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
