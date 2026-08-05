(function () {
  "use strict";

  const PRODUCT_ENDPOINT = "/api/store-products";
  const STORE_BASE = "https://www.shop.tarteel.co.za";
  const BRIDGE_ENDPOINT = STORE_BASE + "/wp-admin/admin-post.php";
  const CART_URL = STORE_BASE + "/cart/";
  const DONATION_PRESETS = [50, 100, 250, 500];
  const MIN_AMOUNT = 1;
  const MAX_AMOUNT = 100000;

  const state = {
    product: null,
    loaded: false,
    loading: false,
    amount: 100,
    popup: null,
    previousFocus: null
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
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

  function isDonationProduct(product) {
    const categories = Array.isArray(product && product.categories)
      ? product.categories.map(function (category) {
          return (category.name || "") + " " + (category.slug || "");
        }).join(" ")
      : "";
    const haystack = [
      product && product.name,
      product && product.slug,
      product && product.short_description,
      product && product.description,
      categories
    ].join(" ").toLowerCase();
    return /donat|sponsor|contribut|sadaq|zaka|lillah|waqf/.test(haystack);
  }

  function findDonationProduct(products) {
    if (!Array.isArray(products)) return null;
    return products.find(function (product) {
      return String(product.slug || "").toLowerCase() === "donte";
    }) || products.find(isDonationProduct) || null;
  }

  function productImage(product) {
    const image = Array.isArray(product && product.images) ? product.images[0] : null;
    if (image && image.src) {
      return '<img class="store-donation__image" src="' + escapeHtml(image.src) + '" alt="' +
        escapeHtml(image.alt || product.name || "General Donation") + '" loading="eager" decoding="async">';
    }
    return '<div class="store-donation__image-placeholder" aria-hidden="true">♡</div>';
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
            <img class="store-modal__brand-logo" src="assets/images/tarteel-white-logo.png" alt="Tarteel Academy">
            <div>
              <h2 id="tarteelStoreTitle">Tarteel Store &amp; Donations</h2>
              <p>Products and contributions securely managed through WooCommerce</p>
            </div>
          </div>
          <button class="store-modal__close" type="button" data-close-store aria-label="Close Tarteel store">×</button>
        </header>

        <div class="store-modal__toolbar">
          <button class="store-modal__back" type="button" data-back-to-catalogue><span aria-hidden="true">←</span> Back to catalogue</button>
        </div>

        <div class="store-modal__body">
          <div class="store-modal__status" data-store-status role="status">
            <span class="store-modal__spinner" aria-hidden="true"></span>
            <p>Loading donation options…</p>
          </div>
          <div class="store-modal__content" data-store-content hidden></div>
        </div>
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
      options.insertAdjacentHTML(
        "afterend",
        '<div class="involvement-store-cta"><button class="button--store" type="button" data-open-store="donations">Visit Tarteel Store <span aria-hidden="true">→</span></button></div>'
      );
    }
  }

  function selectedPresetClass(value) {
    return Number(value) === Number(state.amount) ? " is-active" : "";
  }

  function renderDonation() {
    const product = state.product;
    const content = document.querySelector("[data-store-content]");
    const status = document.querySelector("[data-store-status]");
    if (!product || !content || !status) return;

    const summary = stripHtml(product.short_description || product.description) ||
      "Support Tarteel Academy through this secure WooCommerce contribution option.";
    const category = Array.isArray(product.categories) && product.categories[0]
      ? product.categories[0].name || "Donations"
      : "Donations";

    content.innerHTML = `
      <div class="store-donation">
        <div class="store-donation__success" data-cart-success hidden>
          <span class="store-donation__success-icon" aria-hidden="true">✓</span>
          <span>“${escapeHtml(product.name || "General Donation")}” has been added to your cart.</span>
          <a href="${CART_URL}" target="_blank" rel="noopener noreferrer">View cart</a>
        </div>

        <div class="store-donation__layout">
          <div class="store-donation__visual">
            ${productImage(product)}
          </div>

          <div class="store-donation__details">
            <h3>${escapeHtml(product.name || "General Donation")}</h3>
            <p class="store-donation__suggested">Suggested Price: R100,00</p>
            <p class="store-donation__summary">${escapeHtml(summary)}</p>

            <fieldset class="store-donation__fieldset">
              <legend>Choose a donation amount</legend>
              <div class="store-donation__presets">
                ${DONATION_PRESETS.map(function (value) {
                  return '<button type="button" class="store-donation__preset' + selectedPresetClass(value) +
                    '" data-donation-amount="' + value + '">R' + value + '</button>';
                }).join("")}
                <button type="button" class="store-donation__preset store-donation__preset--other" data-donation-other>Other amount</button>
              </div>
            </fieldset>

            <label class="store-donation__amount-label" for="tarteelDonationAmount">Name Your Price (R)</label>
            <input class="store-donation__amount" id="tarteelDonationAmount" type="number" inputmode="decimal"
              min="${MIN_AMOUNT}" max="${MAX_AMOUNT}" step="0.01" value="${escapeHtml(state.amount.toFixed(2))}">

            <p class="store-donation__error" data-donation-error hidden></p>
            <button class="store-donation__submit" type="button" data-add-donation>Add to cart</button>

            <p class="store-donation__meta">Category: <span>${escapeHtml(category)}</span> <span class="store-donation__meta-separator">Tag:</span> <span>Donate</span></p>
          </div>
        </div>
      </div>`;

    status.hidden = true;
    content.hidden = false;
  }

  async function loadDonation(force) {
    if (state.loading || (state.loaded && !force)) {
      if (state.loaded) renderDonation();
      return;
    }

    state.loading = true;
    const status = document.querySelector("[data-store-status]");
    const content = document.querySelector("[data-store-content]");
    if (content) content.hidden = true;
    if (status) {
      status.hidden = false;
      status.innerHTML = '<span class="store-modal__spinner" aria-hidden="true"></span><p>Loading donation options…</p>';
    }

    try {
      const response = await fetch(PRODUCT_ENDPOINT, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error("Catalogue returned " + response.status);
      const payload = await response.json();
      state.product = findDonationProduct(payload && payload.products);
      if (!state.product) throw new Error("General Donation product was not found");
      state.loaded = true;
      renderDonation();
    } catch (error) {
      state.loaded = false;
      if (status) {
        status.hidden = false;
        status.innerHTML = '<div class="store-modal__error"><strong>Donation options could not be loaded.</strong><p>Please try again.</p><button type="button" data-retry-store>Try again</button></div>';
      }
    } finally {
      state.loading = false;
    }
  }

  function validateAmount(value) {
    const normalized = String(value || "").replace(",", ".").trim();
    const amount = Number(normalized);
    if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) return null;
    return Math.round(amount * 100) / 100;
  }

  function showAmountError(message) {
    const error = document.querySelector("[data-donation-error]");
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  }

  function clearAmountError() {
    const error = document.querySelector("[data-donation-error]");
    if (error) error.hidden = true;
  }

  function submitDonation() {
    const product = state.product;
    const amountInput = document.querySelector("#tarteelDonationAmount");
    if (!product || !amountInput) return;

    const amount = validateAmount(amountInput.value);
    if (amount === null) {
      showAmountError("Enter a donation amount between R1 and R100 000.");
      amountInput.focus();
      return;
    }

    clearAmountError();
    state.amount = amount;

    const popupName = "tarteelDonationBridge";
    const popup = window.open("about:blank", popupName, "popup=yes,width=520,height=620");
    if (!popup) {
      showAmountError("Please allow pop-ups for this website, then try again.");
      return;
    }
    state.popup = popup;

    const form = document.createElement("form");
    form.method = "POST";
    form.action = BRIDGE_ENDPOINT;
    form.target = popupName;
    form.hidden = true;

    const fields = {
      action: "tarteel_donation_bridge",
      product_id: String(product.id || ""),
      amount: amount.toFixed(2),
      return_origin: window.location.origin
    };

    Object.keys(fields).forEach(function (name) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = fields[name];
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    form.remove();
  }

  function handleBridgeMessage(event) {
    if (!/^https:\/\/(www\.)?shop\.tarteel\.co\.za$/i.test(event.origin)) return;
    if (!state.popup || event.source !== state.popup) return;
    const payload = event.data || {};
    if (payload.source !== "tarteel-donation-bridge") return;

    if (payload.status === "success") {
      const success = document.querySelector("[data-cart-success]");
      if (success) success.hidden = false;
    } else {
      showAmountError(payload.message || "The donation could not be added. Please try again.");
    }
    state.popup = null;
  }

  function syncBodyLock() {
    const openModal = document.querySelector(".faculty-modal.is-open, .involvement-modal.is-open, .store-modal.is-open");
    document.body.classList.toggle("modal-open", Boolean(openModal));
  }

  function openStore(trigger) {
    const modal = document.querySelector("#tarteelStoreModal");
    if (!modal) return;

    const involvement = document.querySelector("#involvementModal");
    if (involvement) {
      involvement.classList.remove("is-open");
      involvement.setAttribute("aria-hidden", "true");
    }

    state.previousFocus = trigger || document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    syncBodyLock();
    loadDonation(false);

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
    if (state.previousFocus && document.contains(state.previousFocus)) state.previousFocus.focus();
  }

  function bindEvents() {
    document.addEventListener("click", function (event) {
      const opener = event.target.closest("[data-open-store]");
      if (opener) {
        event.preventDefault();
        openStore(opener);
        return;
      }

      if (event.target.closest("[data-close-store]")) {
        closeStore();
        return;
      }

      if (event.target.closest("[data-back-to-catalogue]")) {
        closeStore();
        return;
      }

      const preset = event.target.closest("[data-donation-amount]");
      if (preset) {
        state.amount = Number(preset.dataset.donationAmount);
        const input = document.querySelector("#tarteelDonationAmount");
        if (input) input.value = state.amount.toFixed(2);
        document.querySelectorAll("[data-donation-amount]").forEach(function (button) {
          button.classList.toggle("is-active", button === preset);
        });
        clearAmountError();
        return;
      }

      if (event.target.closest("[data-donation-other]")) {
        const input = document.querySelector("#tarteelDonationAmount");
        document.querySelectorAll("[data-donation-amount]").forEach(function (button) {
          button.classList.remove("is-active");
        });
        if (input) {
          input.focus();
          input.select();
        }
        return;
      }

      if (event.target.closest("[data-add-donation]")) {
        submitDonation();
        return;
      }

      if (event.target.closest("[data-retry-store]")) loadDonation(true);
    });

    document.addEventListener("input", function (event) {
      if (event.target && event.target.id === "tarteelDonationAmount") {
        document.querySelectorAll("[data-donation-amount]").forEach(function (button) {
          button.classList.remove("is-active");
        });
        clearAmountError();
      }
    });

    document.addEventListener("keydown", function (event) {
      const modal = document.querySelector("#tarteelStoreModal");
      if (!modal || !modal.classList.contains("is-open")) return;
      if (event.key === "Escape") closeStore();
    });

    window.addEventListener("message", handleBridgeMessage);
  }

  function init() {
    injectStylesheet();
    createModal();
    addStoreEntryPoints();
    bindEvents();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
