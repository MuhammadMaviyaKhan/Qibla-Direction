/* =====================================================================
   Qibla Direction — Premium Islamic Compass
   script.js — Vanilla JS, modular IIFE structure
   ===================================================================== */
"use strict";

(() => {

  /* ============================ Constants ============================ */
  const KAABA = { lat: 21.422487, lon: 39.826206 };
  const EARTH_RADIUS_KM = 6371.0088;
  const ALADHAN_METHOD = 4; // Umm Al-Qura, Makkah

  /* ============================== Helpers ============================ */
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const normalizeHeading = (d) => ((d % 360) + 360) % 360;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const fmtCoord = (v, axis) => {
    if (v == null || Number.isNaN(+v)) return "--";
    const dir = axis === "lat" ? (v >= 0 ? "N" : "S") : (v >= 0 ? "E" : "W");
    return `${Math.abs(v).toFixed(5)}° ${dir}`;
  };

  const fmtDistance = (km) => {
    if (km == null || Number.isNaN(+km)) return "--";
    return km < 10
      ? `${km.toFixed(2)} km`
      : `${Math.round(km).toLocaleString()} km`;
  };

  const fmtAccuracy = (m) => (m == null ? "--" : `±${Math.round(m)} m`);

  /* Detect whether the project is opened via the file:// protocol. */
  const runningViaFile = () =>
    typeof window.location !== "undefined" && window.location.protocol === "file:";

  /* ============================ Application =========================== */
  const App = {
    location: null,
    qiblaBearing: null,
    distanceKm: null,
    deviceHeading: null,
    compassMode: "pending", // pending | active | calibrating | fallback | unsupported
    state: {
      reverseGeocoded: false,
      prayersLoaded: false,
      qiblaApiUsed: false,
    },

    /* Central entry point invoked every time a location becomes known. */
    async onLocationKnown() {
      try {
        if (
          !this.location ||
          typeof this.location.lat !== "number" ||
          typeof this.location.lon !== "number"
        ) {
          throw new Error("Invalid location");
        }
        const { lat, lon } = this.location;

        const badge = $("#locStatus");
        if (badge) {
          badge.className = "badge badge--ok";
          badge.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Locked';
        }

        try {
          ReverseGeocode.lookup(lat, lon);
        } catch (e) { /* non-fatal */ }

        App.qiblaBearing = await QiblaApi.fetchOrCompute(lat, lon);
        App.distanceKm = QiblaMath.distanceKm(lat, lon);

        const bearingEl = $("#bearingValue");
        if (bearingEl) bearingEl.textContent = `${Math.round(App.qiblaBearing)}°`;
        const distEl = $("#distanceValue");
        if (distEl) distEl.textContent = fmtDistance(App.distanceKm);
        const faceEl = $("#faceDirection");
        if (faceEl) faceEl.textContent = QiblaMath.cardinal(App.qiblaBearing);

        if (App.state.qiblaApiUsed) {
          Toast.show("Qibla direction synced with AlAdhan", "info", 2000);
        }

        try {
          MapModule.init();
          MapModule.render();
        } catch (e) { /* non-fatal */ }

        try {
          Prayers.load(lat, lon);
        } catch (e) { /* non-fatal */ }

        Compass.scheduleRender();
      } catch (err) {
        Toast.show("Could not compute the Qibla — tap Refresh to retry.", "error");
      }
    },

    refreshAll() {
      Geolocation.request();
    },
  };

  /* ============================ Preloader ============================= */
  const hidePreloader = () => {
    const pre = $("#preloader");
    if (pre) pre.classList.add("is-hidden");
  };

  /* ============================== Toasts ============================== */
  const Toast = {
    show(message, type = "info", timeout = 3500) {
      const container = $("#toastContainer");
      if (!container) return;
      const el = document.createElement("div");
      el.className = `toast toast--${type}`;
      const icon =
        type === "success" ? "circle-check" :
        type === "error"   ? "circle-exclamation" : "circle-info";
      el.innerHTML = `<i class="fa-solid fa-${icon}" aria-hidden="true"></i><span>${message}</span>`;
      container.appendChild(el);
      setTimeout(() => {
        el.classList.add("toast--out");
        el.addEventListener("animationend", () => el.remove(), { once: true });
      }, timeout);
    },
  };

  /* ============================ Status banner ========================= */
  const setBanner = (message, type = "") => {
    const banner = $("#statusBanner");
    if (!banner) return;
    if (!message) { banner.hidden = true; return; }
    banner.hidden = false;
    banner.textContent = message;
    banner.className = `status-banner status-banner--${type}`;
  };

  /* ===================== file:// protocol warning ===================== */
  const showFileProtocolWarning = () => {
    const banner = $("#statusBanner");
    if (!banner) return;
    banner.hidden = false;
    banner.className = "status-banner status-banner--danger";
    banner.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
      <span><strong>Please run this project using Live Server or localhost.</strong>
      Opening via file:// can break the map, compass and online prayer times.</span>
      <button class="banner-dismiss" type="button" aria-label="Dismiss warning">&times;</button>`;
    const dismiss = banner.querySelector(".banner-dismiss");
    if (dismiss) {
      dismiss.addEventListener("click", () => { banner.hidden = true; });
    }
    Toast.show("Please run this project using Live Server or localhost.", "error", 5000);
  };

  /* =========================== Offline detect ========================= */
  const isOnline = () => typeof navigator !== "undefined" && navigator.onLine;

  window.addEventListener("online", () => {
    setBanner("", "");
    Toast.show("You are back online", "success");
    if (App.location) App.refreshAll();
  });
  window.addEventListener("offline", () => {
    setBanner("Network offline — some services are unavailable.", "warn");
    Toast.show("You are offline", "error");
  });

  /* ============================= Theme ================================ */
  const Theme = {
    KEY: "qibla-theme",
    init() {
      let saved = null;
      try { saved = localStorage.getItem(this.KEY); } catch (e) { saved = null; }
      const prefersDark =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme = saved || (prefersDark ? "dark" : "light");
      document.documentElement.dataset.theme = theme;
      this.syncIcon();
    },
    toggle() {
      const current = document.documentElement.dataset.theme;
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(this.KEY, next); } catch (e) { /* storage may be blocked */ }
      this.syncIcon();
      Toast.show(next === "dark" ? "Dark mode enabled" : "Light mode enabled", "info", 1600);
    },
    syncIcon() {
      const btn = $("#themeBtn");
      if (!btn) return;
      const dark = document.documentElement.dataset.theme === "dark";
      btn.innerHTML =
        dark
          ? '<i class="fa-solid fa-sun" aria-hidden="true"></i>'
          : '<i class="fa-solid fa-moon" aria-hidden="true"></i>';
    },
  };

  /* ===================== IP fallback geolocation ====================== */
  const IPLocation = {
    async locate() {
      if (!isOnline() || typeof fetch !== "function") return null;
      const endpoints = [
        "https://ipapi.co/json/",
        "https://ipinfo.io/json",
      ];
      for (const url of endpoints) {
        try {
          const res = await fetch(url, { method: "GET" });
          if (!res.ok) continue;
          const data = await res.json();
          const lat = parseFloat(data.latitude ?? (data.loc ? data.loc.split(",")[0] : null));
          const lon = parseFloat(data.longitude ?? (data.loc ? data.loc.split(",")[1] : null));
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            return { lat, lon, accuracy: 5000, ipBased: true };
          }
        } catch (e) { /* try the next endpoint */ }
      }
      return null;
    },
  };

  /* ============================ Geolocation =========================== */
  const Geolocation = {
    isRequesting: false,

    request() {
      try {
        if (this.isRequesting) return;
        if (!("geolocation" in navigator)) {
          this.fail("Your browser does not support geolocation.");
          return;
        }
        this.isRequesting = true;
        this.setStatus("locating");
        const refreshBtn = $("#refreshBtn");
        const locBtn = $("#locBtn");
        if (refreshBtn) refreshBtn.classList.add("is-spinning");
        if (locBtn) locBtn.classList.add("is-spinning");

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            this.isRequesting = false;
            if (refreshBtn) refreshBtn.classList.remove("is-spinning");
            if (locBtn) locBtn.classList.remove("is-spinning");
            const { latitude, longitude, accuracy } = pos.coords;
            App.location = { lat: latitude, lon: longitude, accuracy: accuracy || null };
            this.render();
            this.renderCoords();
            App.onLocationKnown().catch(() => {});
          },
          (err) => {
            this.isRequesting = false;
            if (refreshBtn) refreshBtn.classList.remove("is-spinning");
            if (locBtn) locBtn.classList.remove("is-spinning");
            this.handleError(err);
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
        );
      } catch (e) {
        this.isRequesting = false;
        this.fail("Geolocation is unavailable right now.");
      }
    },

    async handleError(err) {
      const codes = {
        1: { title: "Permission Denied", msg: "Location access was blocked. Enable location permissions in your browser settings, then tap Refresh." },
        2: { title: "Location Unavailable", msg: "GPS could not determine your position. Try moving to an open area with a clear sky." },
        3: { title: "GPS Timed Out", msg: "The request timed out. Check that GPS / location services are enabled on your device." },
      };
      const info = codes[err.code] || { title: "Location Error", msg: err.message || "An unknown error occurred." };
      this.setStatus("error", info.title);

      try {
        const fallback = await IPLocation.locate();
        if (fallback) {
          this.useIpFallback(fallback);
          return;
        }
      } catch (e) { /* continue to the error card */ }

      this.renderEmpty();
      const card = buildErrorCard(info.title, info.msg, () => this.request());
      const slot = $("#locationError");
      if (slot) { slot.innerHTML = ""; slot.appendChild(card); }
      Toast.show(info.title, "error");
      if (MapModule.map) MapModule.map.setView([KAABA.lat, KAABA.lon], 3);
    },

    async fail(msg) {
      this.setStatus("error", "Unsupported");
      try {
        const fallback = await IPLocation.locate();
        if (fallback) {
          this.useIpFallback(fallback);
          return;
        }
      } catch (e) { /* continue below */ }
      this.renderEmpty();
      Toast.show(msg, "error");
    },

    useIpFallback(fallback) {
      App.location = fallback;
      this.setStatus("approx");
      this.render();
      this.renderCoords();
      Toast.show("Using approximate location from your IP address", "info", 4000);
      App.onLocationKnown().catch(() => {});
    },

    setStatus(kind, text = "") {
      const badge = $("#locStatus");
      if (!badge) return;
      const map = {
        locating: ["badge--neutral", '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Locating…'],
        ok: ["badge--ok", '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Locked'],
        approx: ["badge--ok", '<i class="fa-solid fa-globe" aria-hidden="true"></i> Approximate'],
        error: ["badge--warn", `<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${text || "Error"}`],
      };
      const cfg = map[kind] || map.error;
      badge.className = `badge ${cfg[0]}`;
      badge.innerHTML = cfg[1];
    },

    render() {
      if (!App.location) return;
      const latEl = $("#latValue");
      const lonEl = $("#lonValue");
      const accEl = $("#accValue");
      if (latEl) latEl.textContent = fmtCoord(App.location.lat, "lat");
      if (lonEl) lonEl.textContent = fmtCoord(App.location.lon, "lon");
      if (accEl) accEl.textContent = fmtAccuracy(App.location.accuracy);
    },

    renderEmpty() {
      const latEl = $("#latValue");
      const lonEl = $("#lonValue");
      const accEl = $("#accValue");
      const placeEl = $("#placeValue");
      const cityEl = $("#cityValue");
      const countryEl = $("#countryValue");
      if (latEl) latEl.textContent = "--";
      if (lonEl) lonEl.textContent = "--";
      if (accEl) accEl.textContent = "--";
      if (placeEl) placeEl.textContent = "Location unavailable";
      if (cityEl) cityEl.textContent = "--";
      if (countryEl) countryEl.textContent = "--";
    },

    renderCoords() {
      const placeEl = $("#placeValue");
      if (!placeEl) return;
      placeEl.textContent = App.state.reverseGeocoded
        ? App.state.placeName
        : "Resolving place name…";
    },
  };

  /* ========================= Reverse geocoding ======================== */
  const ReverseGeocode = {
    async lookup(lat, lon) {
      try {
        if (!isOnline()) {
          const placeEl = $("#placeValue");
          if (placeEl) placeEl.textContent = "Offline — place name unavailable";
          return;
        }
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        );
        if (!res.ok) throw new Error("Nominatim failed");
        const data = await res.json();
        if (!data || typeof data !== "object") throw new Error("Bad response");
        const addr = data.address || {};
        const city =
          addr.city || addr.town || addr.village || addr.county || addr.state || "";
        const country = addr.country || "";
        const name =
          [city, country].filter(Boolean).join(", ") ||
          (data.display_name || "").split(",").slice(0, 2).join(",");
        App.state.reverseGeocoded = true;
        App.state.placeName = name;
        const placeEl = $("#placeValue");
        const cityEl = $("#cityValue");
        const countryEl = $("#countryValue");
        if (placeEl) placeEl.textContent = name;
        if (cityEl) cityEl.textContent = city || "--";
        if (countryEl) countryEl.textContent = country || "--";
      } catch (e) {
        const placeEl = $("#placeValue");
        if (placeEl) placeEl.textContent = "City lookup failed";
      }
    },
  };

  /* ============================= Qibla math =========================== */
  const QiblaMath = {
    bearing(lat, lon) {
      const phi1 = toRad(lat);
      const phi2 = toRad(KAABA.lat);
      const dLon = toRad(KAABA.lon - lon);
      const y = Math.sin(dLon);
      const x = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(dLon);
      return normalizeHeading(toDeg(Math.atan2(y, x)));
    },
    distanceKm(lat, lon) {
      const dLat = toRad(KAABA.lat - lat);
      const dLon = toRad(KAABA.lon - lon);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat)) * Math.cos(toRad(KAABA.lat)) * Math.sin(dLon / 2) ** 2;
      return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },
    cardinal(bearing) {
      const dirs = ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"];
      return dirs[Math.round(bearing / 45) % 8];
    },
  };

  /* ============================== Qibla API =========================== */
  const QiblaApi = {
    async fetchOrCompute(lat, lon) {
      if (isOnline()) {
        try {
          const res = await fetch(`https://api.aladhan.com/v1/qibla/${lat}/${lon}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.code === 200 && data.data && data.data.direction != null) {
              App.state.qiblaApiUsed = true;
              return normalizeHeading(Number(data.data.direction));
            }
          }
        } catch (e) { /* fall back below */ }
      }
      App.state.qiblaApiUsed = false;
      return QiblaMath.bearing(lat, lon);
    },
  };

  /* ============================== Compass ============================= */
  const Compass = {
    init() {
      this.buildDial($("#mainDial"), $("#mainCompass"));
      this.buildDial($("#fullscreenDial"), $("#fullscreenCompass"));
    },

    /* Render degree ticks + numerals + cardinals */
    buildDial(dial, compass) {
      if (!dial || !compass) return;
      dial.innerHTML = "";
      const frag = document.createDocumentFragment();

      for (let deg = 0; deg < 360; deg += 5) {
        const cls = deg % 90 === 0 ? "tick tick--major" : deg % 15 === 0 ? "tick tick--mid" : "tick";
        const tick = document.createElement("span");
        tick.className = cls;
        tick.style.setProperty("--d", `${deg}deg`);
        frag.appendChild(tick);
      }

      for (let deg = 30; deg < 360; deg += 30) {
        if (deg % 90 === 0) continue; // cardinals cover these
        const num = document.createElement("span");
        num.className = "compass-num";
        num.textContent = deg;
        num.style.setProperty("--r", `${deg}deg`);
        frag.appendChild(num);
      }

      const cardinals = ["N", "E", "S", "W"];
      cardinals.forEach((letter, i) => {
        const deg = i * 90;
        const el = document.createElement("span");
        el.className = "compass-cardinal";
        el.dataset.letter = letter;
        el.textContent = letter;
        el.style.setProperty("--r", `${deg}deg`);
        frag.appendChild(el);
      });

      dial.appendChild(frag);
    },

    /* Debounced via requestAnimationFrame */
    scheduleRender() {
      if (this._pending) return;
      this._pending = true;
      requestAnimationFrame(() => {
        this._pending = false;
        this.render();
      });
    },

    render() {
      try {
        const q = App.qiblaBearing;
        const h = App.deviceHeading;

        if (q == null) return;

        const rot = normalizeHeading(q - (h || 0));

        const mainNeedle = $("#mainNeedle");
        const fullNeedle = $("#fullscreenNeedle");
        if (mainNeedle) mainNeedle.style.setProperty("--needle-rot", `${rot}deg`);
        if (fullNeedle) fullNeedle.style.setProperty("--needle-rot", `${rot}deg`);

        if (h != null) {
          const dialRot = normalizeHeading(-h);
          const mainDial = $("#mainDial");
          const fullDial = $("#fullscreenDial");
          if (mainDial) mainDial.style.setProperty("--dial-rot", `${dialRot}deg`);
          if (fullDial) fullDial.style.setProperty("--dial-rot", `${dialRot}deg`);
        }

        const heading = h != null ? Math.round(h) : "--";
        const devH = $("#deviceHeading");
        const fullDevH = $("#fullDeviceHeading");
        if (devH) devH.textContent = heading === "--" ? "--" : `${heading}°`;
        if (fullDevH) fullDevH.textContent = heading === "--" ? "--" : `${heading}°`;

        const qiblaEl = $("#qiblaAngle");
        const fullQiblaEl = $("#fullQiblaAngle");
        if (qiblaEl) qiblaEl.textContent = `${Math.round(q)}°`;
        if (fullQiblaEl) fullQiblaEl.textContent = `${Math.round(q)}°`;
      } catch (e) { /* non-fatal */ }
    },

    setMode(mode, text = "") {
      App.compassMode = mode;
      const status = $("#compassStatus");
      if (!status) return;
      const icon = mode === "active" ? "fa-circle-check" : mode === "calibrating" ? "fa-circle-info" : mode === "fallback" ? "fa-hand" : "fa-circle-exclamation";
      const msg = {
        active: "Compass active — pointing towards the Kaaba.",
        calibrating: text || "Calibrating compass — move your device in a figure-eight motion.",
        fallback: text || "Compass unavailable. Use the manual heading slider to align.",
        unsupported: text || "This device does not support a compass. Using manual heading.",
      }[mode] || "Compass status unavailable.";

      status.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><span>${msg}</span>`;
      status.className = `compass-status compass-status--${mode === "active" ? "ok" : mode === "calibrating" ? "cal" : mode === "fallback" || mode === "unsupported" ? "warn" : "err"}`;
    },

    /* -------- Device orientation listeners -------- */
    start() {
      try {
        if (typeof DeviceOrientationEvent === "undefined") {
          this.enableFallback("Device orientation is not supported.");
          return;
        }

        const onOrientation = (e) => {
          try {
            let heading = null;
            let isAbsolute = e.absolute === true;
            if (typeof e.webkitCompassHeading === "number" && Number.isFinite(e.webkitCompassHeading)) {
              heading = e.webkitCompassHeading;
              isAbsolute = true;
            } else if (typeof e.alpha === "number" && Number.isFinite(e.alpha)) {
              if (isAbsolute) {
                heading = (360 - e.alpha) % 360;
                this._hasAbsolute = true;
              } else if (!this._hasAbsolute) {
                heading = (360 - e.alpha) % 360;
              }
            }

            if (heading != null) {
              App.deviceHeading = normalizeHeading(heading);
              clearTimeout(this._calTimeout);
              this._calTimeout = setTimeout(() => this.setMode("calibrating"), 4000);
              this.setMode("active");
              Compass.scheduleRender();
            } else if (App.compassMode === "pending") {
              this.setMode("calibrating");
            }
          } catch (e) { /* non-fatal */ }
        };

        const bind = () => {
          try {
            window.removeEventListener("pointerdown", tryPermission);
            window.removeEventListener("keydown", tryPermission);
            window.addEventListener("deviceorientation", onOrientation, true);
            window.addEventListener("deviceorientationabsolute", onOrientation, true);
          } catch (e) { /* non-fatal */ }
        };

        const tryPermission = () => {
          try {
            DeviceOrientationEvent.requestPermission()
              .then((res) => {
                if (res === "granted") {
                  bind();
                  this.setMode("calibrating");
                } else {
                  this.enableFallback("Compass permission was denied. Use the manual heading slider.");
                }
              })
              .catch(() => {
                // iOS: requestPermission must be triggered from a user gesture.
                window.addEventListener("pointerdown", tryPermission, { once: true });
                window.addEventListener("keydown", tryPermission, { once: true });
                this.setMode("calibrating", "Tap anywhere to enable the compass sensor.");
              });
          } catch (e) {
            // iOS Safari: permission must be requested from a user gesture.
            window.addEventListener("pointerdown", tryPermission, { once: true });
            window.addEventListener("keydown", tryPermission, { once: true });
            this.setMode("calibrating", "Tap anywhere to enable the compass sensor.");
          }
        };

        if (typeof DeviceOrientationEvent.requestPermission === "function") {
          tryPermission();
        } else {
          bind();
          this.setMode("calibrating");
        }

        this._calTimeout = setTimeout(() => {
          if (App.compassMode === "calibrating" || App.compassMode === "pending") {
            this.setMode("calibrating", "No movement detected — rotate your device slowly to calibrate the compass.");
          }
        }, 6000);
      } catch (e) {
        this.enableFallback("Compass could not start. Use the manual heading slider.");
      }
    },

    enableFallback(reason) {
      try {
        this.setMode("fallback", reason);
        const panel = $("#manualPanel");
        if (!panel) return;
        panel.hidden = false;
        const slider = $("#headingSlider");
        if (!slider) return;
        const sync = () => {
          App.deviceHeading = normalizeHeading(parseFloat(slider.value) || 0);
          const val = $("#headingSliderVal");
          if (val) val.textContent = `${Math.round(App.deviceHeading)}°`;
          Compass.scheduleRender();
        };
        slider.addEventListener("input", sync);
        sync();
      } catch (e) { /* non-fatal */ }
    },
  };

  /* =============================== Map ================================ */
  const MapModule = {
    map: null,
    layers: {},

    init() {
      if (!window.L) {
        setBanner("Map library failed to load — map unavailable.", "warn");
        return;
      }
      if (this.map) return;

      this.map = L.map("map", {
        zoomControl: true,
        attributionControl: true,
      }).setView([KAABA.lat, KAABA.lon], 3);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(this.map);
    },

    render() {
      try {
        if (!this.map || !App.location) return;

        const user = [App.location.lat, App.location.lon];
        const kaaba = [KAABA.lat, KAABA.lon];

        if (this.layers.user) this.map.removeLayer(this.layers.user);
        if (this.layers.kaaba) this.map.removeLayer(this.layers.kaaba);
        if (this.layers.line) this.map.removeLayer(this.layers.line);

        const userIcon = L.divIcon({
          className: "",
          html: '<div class="map-marker map-marker--user"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        const kaabaIcon = L.divIcon({
          className: "",
          html: '<div class="map-marker map-marker--kaaba"><i class="fa-solid fa-kaaba" aria-hidden="true"></i></div>',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        this.layers.user = L.marker(user, { icon: userIcon, title: "You are here" })
          .addTo(this.map)
          .bindPopup("<strong>Your location</strong><br>" + fmtCoord(App.location.lat, "lat") + ", " + fmtCoord(App.location.lon, "lon"));

        this.layers.kaaba = L.marker(kaaba, { icon: kaabaIcon, title: "The Holy Kaaba" })
          .addTo(this.map)
          .bindPopup("<strong>The Holy Kaaba</strong><br>Makka al-Mukarrama, Saudi Arabia");

        this.layers.line = L.polyline([user, kaaba], {
          color: "#d4af37",
          weight: 3,
          opacity: .9,
          dashArray: "8 8",
          lineCap: "round",
        }).addTo(this.map);

        this.map.fitBounds([user, kaaba], { padding: [40, 40], maxZoom: 8 });
      } catch (e) { /* non-fatal */ }
    },
  };

  /* ============================ Prayer times =========================== */
  const Prayers = {
    load(lat, lon) {
      try {
        if (!isOnline()) {
          const grid = $("#prayerGrid");
          if (grid) grid.innerHTML = '<div class="prayer-note"><i class="fa-solid fa-wifi-slash" aria-hidden="true"></i> Offline — prayer times unavailable.</div>';
          return;
        }
        const today = new Date();
        const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        fetch(`https://api.aladhan.com/v1/timings/${date}?latitude=${lat}&longitude=${lon}&method=${ALADHAN_METHOD}`)
          .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Prayer API failed"))))
          .then((data) => {
            if (!data || data.code !== 200 || !data.data || !data.data.timings) {
              throw new Error("Prayer API error");
            }
            const t = data.data.timings;
            const mapping = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
            mapping.forEach((name) => {
              const el = $(`.prayer-time[data-prayer="${name}"]`);
              if (el && t[name]) el.textContent = String(t[name]).slice(0, 5);
            });
            const prayerDate = $("#prayerDate");
            if (prayerDate) {
              prayerDate.textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
            }
            App.state.prayersLoaded = true;
            this.highlightNext(t);
          })
          .catch(() => {
            const grid = $("#prayerGrid");
            if (grid) grid.innerHTML = '<div class="prayer-note"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Prayer times could not be loaded. Check your connection and refresh.</div>';
            Toast.show("Prayer times failed to load", "error");
          });
      } catch (e) { /* non-fatal */ }
    },

    highlightNext(timings) {
      try {
        const order = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        let next = null;
        let nextMin = Infinity;
        let endOfDay = null;

        for (const name of order) {
          if (!timings[name]) continue;
          const parts = String(timings[name]).split(":").map(Number);
          if (parts.length < 2) continue;
          const mins = parts[0] * 60 + parts[1];
          if (mins > nowMin && mins < nextMin) { next = name; nextMin = mins; }
          if (name === "Isha") endOfDay = mins;
        }

        const box = $("#nextPrayer");
        $$(".prayer-item").forEach((el) => el.classList.remove("prayer-item--next"));

        if (!next && endOfDay != null) {
          next = "Fajr";
          nextMin = 24 * 60; // tomorrow's Fajr
        }
        if (next) {
          const timeStr = timings[next] ? String(timings[next]).slice(0, 5) : "--:--";
          if (nextMin < 24 * 60) {
            const target = $(`.prayer-time[data-prayer="${next}"]`);
            if (target && target.closest) target.closest(".prayer-item").classList.add("prayer-item--next");
            const nameEl = $("#nextPrayerName");
            const timeEl = $("#nextPrayerTime");
            if (nameEl) nameEl.textContent = next;
            if (timeEl) timeEl.textContent = timeStr;
          } else {
            const nameEl = $("#nextPrayerName");
            const timeEl = $("#nextPrayerTime");
            if (nameEl) nameEl.textContent = next;
            if (timeEl) timeEl.textContent = `${timeStr} · tomorrow`;
          }
          if (box) box.hidden = false;
        }
      } catch (e) { /* non-fatal */ }
    },
  };

  /* ============================ Error card ============================= */
  const buildErrorCard = (title, message, onRetry) => {
    const card = document.createElement("div");
    card.className = "card glass error-card";
    card.setAttribute("role", "alert");
    card.innerHTML = `
      <div class="error-icon"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></div>
      <div class="error-body">
        <h3>${title}</h3>
        <p>${message}</p>
        <button class="btn btn--ghost" type="button"><i class="fa-solid fa-rotate" aria-hidden="true"></i> Try again</button>
      </div>`;
    const btn = card.querySelector("button");
    if (btn && typeof onRetry === "function") btn.addEventListener("click", onRetry);
    return card;
  };

  /* ===================== Fullscreen compass modal ===================== */
  const Fullscreen = {
    init() {
      const modal = $("#fullscreenModal");
      if (!modal) return;
      const openBtn = $("#fullscreenBtn");
      const closeBtn = $("#closeFullscreen");
      if (openBtn) {
        openBtn.addEventListener("click", () => {
          modal.hidden = false;
          document.body.style.overflow = "hidden";
          Compass.scheduleRender();
        });
      }
      if (closeBtn) closeBtn.addEventListener("click", () => this.close());
      modal.querySelectorAll("[data-close-modal]").forEach((el) =>
        el.addEventListener("click", () => this.close())
      );
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !modal.hidden) this.close();
      });
    },
    close() {
      const modal = $("#fullscreenModal");
      if (modal) modal.hidden = true;
      document.body.style.overflow = "";
    },
  };

  /* ======================== Copy coordinates ========================== */
  const copyCoordinates = async () => {
    if (!App.location) { Toast.show("No location available to copy", "error"); return; }
    const { lat, lon } = App.location;
    const text = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      Toast.show("Coordinates copied to clipboard", "success");
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        Toast.show("Coordinates copied", "success");
      } catch (err) {
        Toast.show("Copy failed — select the coordinates manually", "error");
      }
      ta.remove();
    }
  };

  /* ============================ Global guards ========================= */
  window.addEventListener("error", (e) => {
    try {
      if (Toast && typeof Toast.show === "function") {
        Toast.show("An unexpected error occurred", "error", 4000);
      }
    } catch (err) { /* never throw here */ }
  });

  window.addEventListener("unhandledrejection", (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    try {
      if (Toast && typeof Toast.show === "function") {
        Toast.show("A network request failed", "error", 4000);
      }
    } catch (err) { /* never throw here */ }
  });

  /* ============================ Init ================================== */
  const init = () => {
    try {
      Theme.init();
      Compass.init();
      Fullscreen.init();
      MapModule.init();

      const themeBtn = $("#themeBtn");
      if (themeBtn) themeBtn.addEventListener("click", () => Theme.toggle());

      const refreshBtn = $("#refreshBtn");
      if (refreshBtn) refreshBtn.addEventListener("click", () => App.refreshAll());

      const locBtn = $("#locBtn");
      if (locBtn) locBtn.addEventListener("click", () => App.refreshAll());

      const copyBtn = $("#copyBtn");
      if (copyBtn) copyBtn.addEventListener("click", copyCoordinates);

      if (runningViaFile()) {
        showFileProtocolWarning();
      }

      Compass.start();

      // Preloader
      window.addEventListener("load", () => {
        setTimeout(hidePreloader, 500);
        // Give browser a tick to render map tiles
        setTimeout(() => {
          try {
            if (MapModule.map) MapModule.map.invalidateSize();
          } catch (e) { /* non-fatal */ }
        }, 600);
      });
      // Safety: never trap user behind the loader
      setTimeout(hidePreloader, 6000);

      // Request location on first interaction-friendly path
      Geolocation.request();
    } catch (e) {
      hidePreloader();
    }
  };

  document.addEventListener("DOMContentLoaded", init);
})();
