/* bushhike — lekki skrypt strony (bez zależności, ładowany z defer). */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  /* ---------- nawigacja mobilna ---------- */
  function initNav() {
    var wrap = document.querySelector(".site-nav-wrap");
    var toggle = document.querySelector(".site-nav-toggle");
    var links = document.getElementById("site-nav-links");
    if (!wrap || !toggle || !links) return;

    function close() {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) close();
    });
  }

  /* ---------- wspólne: arkusz z trasami ---------- */
  var SHEET_CSV =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTDzGqu23B8c8HJsILIcILdcmuW-JWGvkN7w9JtDwXOde2zD1gbzxweHx1KGimxKMhgsgZutKhBx8qd/pub?output=csv";
  var IG = "https://www.instagram.com/bushhike/";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function parseCSV(text) {
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c !== "\r") cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    return rows.slice(1)
      .filter(function (r) { return r.some(function (v) { return v.trim() !== ""; }); })
      .map(function (r) {
        var o = {};
        head.forEach(function (h, i) { o[h] = (r[i] || "").trim(); });
        return o;
      });
  }

  function fetchRows() {
    return fetch(SHEET_CSV, { cache: "default" })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function (t) {
        return parseCSV(t).filter(function (r) {
          if (!r.nazwa) return false;
          var p = (r.pokazuj || "tak").toLowerCase();
          return p !== "nie" && p !== "no" && p !== "false" && p !== "0";
        });
      });
  }

  var norm = function (s) {
    return s.toLowerCase()
      .replace(/ą/g, "a").replace(/ć/g, "c").replace(/ę/g, "e").replace(/ł/g, "l")
      .replace(/ń/g, "n").replace(/ó/g, "o").replace(/ś/g, "s").replace(/ź/g, "z").replace(/ż/g, "z");
  };

  // arkusz podaje ścieżki typu "img/g8.jpg" — normalizujemy do "/img/g8.jpg"
  function imgUrl(src) {
    src = String(src || "").trim();
    if (/^https?:\/\//i.test(src)) return src;
    if (src.charAt(0) !== "/") src = "/" + src.replace(/^\.?\//, "");
    return src;
  }
  function smThumb(src) {
    src = imgUrl(src);
    return /^\/img\/[^/]+\.jpg$/i.test(src) ? src.replace(/\.jpg$/i, "-sm.jpg") : src;
  }

  /* ---------- strona główna: podgląd tras ---------- */
  function initHomePreview() {
    var box = document.getElementById("home-preview");
    if (!box) return;
    fetchRows().then(function (rows) {
      if (!rows.length) return;
      box.innerHTML = rows.slice(0, 4).map(function (r) {
        var img = smThumb(r.zdjecie || "img/g5.jpg");
        var meta = [r.pasmo, r.czas].filter(Boolean).join(" · ");
        return (
          '<a href="' + esc(r.link_do_rolki || IG) + '" target="_blank" rel="noopener" class="preview-card">' +
            '<div class="preview-card__img"><img src="' + esc(img) + '" alt="' + esc(r.nazwa) + '" width="420" height="280" loading="lazy" decoding="async"></div>' +
            '<div class="preview-card__name">' + esc(r.nazwa) + "</div>" +
            '<div class="preview-card__meta">' + esc(meta) + "</div>" +
          "</a>"
        );
      }).join("");
    }).catch(function () {});
  }

  /* ---------- /trasy/: wyszukiwarka ---------- */
  function initTrasy() {
    var listEl = document.getElementById("trasy-list");
    if (!listEl) return;
    var searchEl = document.getElementById("trasy-search");
    var regionsEl = document.getElementById("trasy-regions");
    var countEl = document.getElementById("trasy-count");
    var emptyEl = document.getElementById("trasy-empty");

    var REGION_ORDER = ["Tatry", "Pieniny", "Bieszczady", "Gorce", "Beskid Żywiecki", "Beskid Sądecki", "Beskid Niski", "Słowacja", "Poza Europą"];
    var state = { q: "", region: "Wszystkie", rows: [] };

    function countLabel(n) {
      if (n === 1) return "1 trasa";
      if (n >= 2 && n <= 4) return n + " trasy";
      return n + " tras";
    }

    function card(r) {
      var img = smThumb(r.zdjecie || "img/g5.jpg");
      var meta = [r.czas, r.dlugosc_km ? r.dlugosc_km + " km" : ""].filter(Boolean).join(" · ");
      return (
        '<a href="' + esc(r.link_do_rolki || IG) + '" target="_blank" rel="noopener" class="trasa-card">' +
          '<div class="trasa-card__img">' +
            '<img src="' + esc(img) + '" alt="' + esc(r.nazwa) + '" width="420" height="280" loading="lazy" decoding="async">' +
            '<span class="trasa-card__region">' + esc(r.pasmo || "") + "</span>" +
            '<span class="trasa-card__play" aria-hidden="true">▶</span>' +
          "</div>" +
          '<div class="trasa-card__name">' + esc(r.nazwa) + "</div>" +
          '<div class="trasa-card__meta">' + esc(meta) + "</div>" +
        "</a>"
      );
    }

    function render() {
      if (!state.rows.length) return; // brak danych z arkusza — zostaw statyczny fallback
      var q = norm(state.q.trim());
      var reg = state.region;
      var shown = state.rows.filter(function (r) {
        if (reg !== "Wszystkie" && (r.pasmo || "") !== reg) return false;
        if (!q) return true;
        return norm([r.nazwa, r.pasmo, r.czas, r.dlugosc_km].join(" ")).indexOf(q) !== -1;
      });

      listEl.innerHTML = shown.map(card).join("");
      if (countEl) countEl.textContent = countLabel(shown.length);
      if (emptyEl) emptyEl.hidden = shown.length !== 0;
      listEl.hidden = shown.length === 0;
    }

    function renderRegions() {
      if (!regionsEl) return;
      var present = [];
      state.rows.forEach(function (r) {
        if (r.pasmo && present.indexOf(r.pasmo) === -1) present.push(r.pasmo);
      });
      present.sort(function (a, b) {
        var ia = REGION_ORDER.indexOf(a), ib = REGION_ORDER.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "pl");
      });
      var all = ["Wszystkie"].concat(present);
      regionsEl.innerHTML = all.map(function (label) {
        var on = label === state.region;
        return '<button type="button" class="btn trasa-region" data-region="' + esc(label) + '"' +
          (on ? ' aria-pressed="true"' : ' aria-pressed="false"') + ">" + esc(label) + "</button>";
      }).join("");
    }

    if (searchEl) {
      searchEl.addEventListener("input", function () {
        state.q = searchEl.value;
        render();
      });
    }
    if (regionsEl) {
      regionsEl.addEventListener("click", function (e) {
        var b = e.target.closest(".trasa-region");
        if (!b) return;
        state.region = b.getAttribute("data-region");
        renderRegions();
        render();
      });
    }

    fetchRows().then(function (rows) {
      if (!rows.length) return;
      state.rows = rows;
      renderRegions();
      render();
    }).catch(function () {});
  }

  /* ---------- /kontakt/: formularz -> mailto ---------- */
  function initKontakt() {
    var form = document.getElementById("kontakt-form");
    if (!form) return;
    var TARGET = "bushhike.contact@gmail.com";

    form.addEventListener("click", function (e) {
      var b = e.target.closest(".temat-opcja");
      if (!b) return;
      form.querySelectorAll(".temat-opcja").forEach(function (x) {
        x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var val = function (id) {
        var el = form.querySelector("#" + id);
        return el ? el.value.trim() : "";
      };
      var pressed = form.querySelector('.temat-opcja[aria-pressed="true"]');
      var temat = pressed ? pressed.textContent.trim() : "Zapytanie";
      var body = [
        "Imię: " + val("k-imie"),
        "E-mail: " + val("k-mail"),
        "Telefon: " + val("k-tel"),
        "Temat: " + temat,
        "Liczba osób: " + val("k-osoby"),
        "Termin: " + val("k-termin"),
        "",
        val("k-tresc"),
      ].join("\n");
      window.location.href =
        "mailto:" + TARGET +
        "?subject=" + encodeURIComponent("Zapytanie: " + temat) +
        "&body=" + encodeURIComponent(body);
    });
  }

  initNav();
  initHomePreview();
  initTrasy();
  initKontakt();
})();
