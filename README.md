# Tarteel Academy Homepage

A responsive, framework-free implementation of the approved Tarteel Academy homepage reference. The page uses semantic HTML, CSS custom properties, local image assets, and a small navigation script.

## Local preview

The simplest option is to open `index.html` directly in a browser. All images, CSS, and JavaScript use relative local paths.

For a local web-server preview, run this command from the repository root:

```sh
python3 -m http.server 4173
```

Then visit `http://localhost:4173/`.

The Google fonts requested by the design load from the internet. If you preview offline, the page falls back to Georgia and Arial without affecting the layout structure.

## Files

- `index.html` — complete standalone homepage markup
- `css/tarteel-home.css` — desktop, tablet, and mobile styles
- `js/tarteel-home.js` — accessible mobile-menu behaviour
- `wordpress/divi-code-module.html` — Divi Code Module markup with WordPress asset paths
- `wordpress/custom-css.css` — Divi/WordPress stylesheet
- `assets/` — supplied logos, imagery, badges, ornaments, and patterns

## WordPress Divi installation

1. Upload the complete local `assets` folder to `/wp-content/uploads/tarteel-academy/assets/` using SFTP, your host file manager, or an equivalent media-file workflow. Keep the subfolder structure unchanged.
2. Create a new blank page in WordPress and select the Divi blank-page template so the theme header and footer are not duplicated.
3. Open the Divi Builder, add one full-width section/row, set row width and max width to `100%`, and set all row/section padding to `0`.
4. Add a Code Module and paste the complete contents of `wordpress/divi-code-module.html`.
5. Paste the complete contents of `wordpress/custom-css.css` into **Divi > Theme Options > General > Custom CSS** (or enqueue it in a child theme).
6. Disable Divi static CSS caching or clear Divi and site caches once, then check the page on desktop, tablet, and phone.
7. Replace placeholder `#` links and the example street address with the academy’s final URLs/details before publishing.

If WordPress uses a different uploads path, replace `/wp-content/uploads/tarteel-academy/assets/` in both WordPress files.

## Asset quality notes

All design assets listed in `assets/manifest.json` are present. Several were supplied as low-resolution reference crops:

- Programme images are approximately `193–198 × 93 px`.
- The CTA mosque image is `317 × 89 px`.
- The logo is `200 × 71 px`.
- Faculty badges are approximately `125–131 × 104 px`.
- The centre ornament is `83 × 82 px`.
- The repeating patterns are `125 × 310 px` and `154 × 185 px`.

These files are used at conservative display sizes, but the programme and CTA images may look soft on high-density screens. Replace them with higher-resolution versions at the same aspect ratios when available.

## Accessibility and behaviour

- Semantic landmarks and headings
- Descriptive image alternative text
- Keyboard-visible focus states
- Skip link
- Accessible, Escape-dismissable mobile navigation
- Reduced-motion preference support

No files are committed or pushed by this project setup.

## Layout repair (2026-07-23)

The extracted screenshot pattern crops were replaced with clean SVG geometric patterns to prevent duplicated text and tiled content. The Vision/Mission panels, CTA banner, arch decoration, footer logo sizing, overflow handling, and Divi CSS were aligned with the standalone preview.
