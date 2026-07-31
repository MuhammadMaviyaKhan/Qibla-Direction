# 🕋 Qibla Direction — Premium Islamic Compass

A production-ready, mobile-first web application that accurately points toward the Holy Kaaba using your device's GPS and compass — built with **pure HTML5, CSS3 and Vanilla JavaScript**. No frameworks, no build tools.

> **Live demo:** open `index.html` in any modern browser.
> **Important:** Geolocation, compass sensors and most web APIs require a **secure (HTTPS) context**. Use GitHub Pages / Netlify / any HTTPS host, or `http://localhost`.

---

## ✨ Features

| Category | Details |
| --- | --- |
| **Qibla Compass** | Live needle that always points to the Kaaba using the device magnetometer. Smooth, debounced updates. |
| **Qibla Math** | Spherical trigonometry bearing from your coordinates to the Kaaba `(21.422487, 39.826206)` + Haversine distance. Verified against the **AlAdhan Qibla API** (used when online, local math is the fallback). |
| **Location** | `navigator.geolocation.getCurrentPosition` with high accuracy, accuracy readout, and **OpenStreetMap Nominatim** reverse geocoding for City & Country. |
| **Map** | Interactive **Leaflet + OpenStreetMap** map with your location marker, Kaaba marker and a golden dashed great-circle line between them. |
| **Prayer Times** | **AlAdhan API** (method 4 / Umm al-Qura). Shows Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha in your local timezone, with the **next prayer highlighted**. |
| **Device Compass** | Android Chrome (`absolute` alpha) and iPhone Safari (`webkitCompassHeading` + `DeviceOrientationEvent.requestPermission()`). **Manual heading slider fallback** when no compass exists. |
| **Design** | Premium **glassmorphism** UI, Islamic **green & gold** palette, **dark / light mode** (persisted), Google Fonts **Poppins + Amiri**, Font Awesome icons, animated star-lattice background. |
| **Extras** | Toast notifications, offline detection banner, copy coordinates, fullscreen compass, location refresh, animated preloader, location accuracy, compass calibration messages, beautiful error cards. |

---

## 📁 Files

```
qibla-direction/
├── index.html     # Semantic HTML structure (header, cards, compass, map, prayers, modal)
├── style.css      # Glassmorphism design system, dark/light themes, compass visuals, animations
├── script.js      # Modular vanilla JS (geolocation, qibla math, compass, map, prayers, UI)
└── README.md      # This file
```

No package manager, no build step — just open the page.

---

## 🚀 Getting started

### Host it (recommended — sensors require HTTPS)

```bash
# Option A: any static host
# upload the 4 files to GitHub Pages / Netlify / Vercel / Cloudflare Pages

# Option B: local HTTPS test with Python
python -m http.server 8080        # works at http://localhost:8080

# Option C: local HTTPS with npx (for phone testing on LAN)
npx serve --ssl 8443
```

Open the URL on **your phone** for the full experience (GPS + magnetometer).

---

## 🧭 How the Qibla angle is calculated

Given your position `(φ1, λ1)` and the Kaaba `(φ2, λ2)`:

```
θ = atan2( sin(Δλ),  cos(φ1)·tan(φ2) − sin(φ1)·cos(Δλ) )
```

Distance uses the **Haversine formula** with Earth radius `R = 6371.0088 km`.

The app calls `GET https://api.aladhan.com/v1/qibla/{lat}/{lon}` first; if that fails (offline/API down) it falls back to the same math computed locally — the needle always works.

### Compass heading sources
- **iOS Safari** → `event.webkitCompassHeading` (degrees clockwise from north), permission requested via `DeviceOrientationEvent.requestPermission()`.
- **Android Chrome** → `event.alpha` corrected when `event.absolute === true`.
- **Neither** → manual heading slider appears so you can still orient yourself.

The needle rotation = `(Qibla bearing − device heading)`, so it stays on the Kaaba as you turn.

---

## 🔌 Third-party services (all free, no keys)

| Service | Purpose |
| --- | --- |
| [AlAdhan](https://aladhan.com/prayer-times-api) | Qibla direction + daily prayer timings |
| [Nominatim / OSM](https://nominatim.org/) | Reverse geocoding (city & country) |
| [Leaflet](https://leafletjs.com/) + [OpenStreetMap](https://www.openstreetmap.org/) | Interactive map |
| [Google Fonts](https://fonts.google.com/) | Poppins + Amiri |
| [Font Awesome](https://fontawesome.com/) | Icons |

---

## ⚙️ Configuration

Everything worth tweaking lives at the top of `script.js`:

```js
const KAABA = { lat: 21.422487, lon: 39.826206 };
const ALADHAN_METHOD = 4;          // Umm Al-Qura (Makkah) — see AlAdhan docs
```

Palette, glass opacity and compass sizing live in the CSS variables at the top of `style.css` (`--green`, `--gold`, `--card-bg`, `--dial-r`, …).

---

## ♿ Accessibility & performance

- Semantic landmarks (`header`, `main`, `footer`, `nav`), `role="dialog"` modal, `aria-live` toast region, ARIA labels on all icon buttons.
- Full keyboard navigation + visible `:focus-visible` gold focus ring, `Esc` closes fullscreen.
- `prefers-reduced-motion` support.
- `requestAnimationFrame`-debounced compass rendering, deferred scripts, lazy-loaded map/prayer data, tiny inline SVG favicon, minimal DOM writes.

---

## 🛠 Browser support

Chrome / Edge / Safari / Firefox (recent 2 versions), Android & iOS. Compass behaviour varies by device — see the in-app calibration messages for guidance.

---

## 📄 License

MIT — free to use, modify and share.
