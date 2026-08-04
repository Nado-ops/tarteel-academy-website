const STORE_BASES = [
  "https://www.shop.tarteel.co.za",
  "https://shop.tarteel.co.za"
];

const PRODUCT_PATHS = [
  "/wp-json/wc/store/v1/products?per_page=100&orderby=menu_order&order=asc",
  "/wp-json/wc/store/v1/products?per_page=100"
];

function jsonResponse(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": status === 200
        ? "public, max-age=120, s-maxage=300, stale-while-revalidate=600"
        : "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders
    }
  });
}

async function fetchCatalogue() {
  let lastError = "WooCommerce catalogue unavailable";

  for (const base of STORE_BASES) {
    for (const productPath of PRODUCT_PATHS) {
      try {
        const upstream = await fetch(base + productPath, {
          method: "GET",
          headers: {
            accept: "application/json",
            "user-agent": "Tarteel-Academy-Store-Proxy/1.0"
          },
          cf: {
            cacheEverything: true,
            cacheTtl: 300
          }
        });

        if (!upstream.ok) {
          lastError = `WooCommerce returned ${upstream.status}`;
          continue;
        }

        const payload = await upstream.json();
        const products = Array.isArray(payload)
          ? payload
          : (Array.isArray(payload && payload.products) ? payload.products : null);

        if (!products) {
          const code = payload && typeof payload === "object" ? payload.code : null;
          lastError = code
            ? `WooCommerce returned ${code}`
            : "WooCommerce returned an unexpected response";
          continue;
        }

        return jsonResponse({
          store_base: base,
          products
        }, 200);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
  }

  return jsonResponse({
    error: "catalogue_unavailable",
    message: lastError
  }, 502);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/store-products") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return jsonResponse({ error: "method_not_allowed" }, 405, {
          allow: "GET, HEAD"
        });
      }

      const response = await fetchCatalogue();
      return request.method === "HEAD"
        ? new Response(null, { status: response.status, headers: response.headers })
        : response;
    }

    return env.ASSETS.fetch(request);
  }
};
