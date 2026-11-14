// Job-photo galleries. The HTML already contains the photos that existed at build time
// (for search engines). This script reloads the published set from Sanity on every visit,
// so photos uploaded in the Studio appear without a site rebuild.
(function () {
  "use strict";
  var boxes = document.querySelectorAll("[data-work]");
  if (!boxes.length) return;

  var PROJECT = "9678id5i", DATASET = "production", API = "2025-02-19";
  var QUERY = '*[_type == "workProject" && customerPermission == true && defined(afterImage.asset)]' +
    ' | order(coalesce(completedOn, _createdAt) desc)[0...60]' +
    '{_id, title, service, neighborhood, completedOn, summary, featured,' +
    ' "after": afterImage{alt, hotspot, "url": asset->url},' +
    ' "before": beforeImage{alt, hotspot, "url": asset->url}}';
  var SERVICES = {
    "drywall-repair": "Drywall & Plaster Repair", "painting": "Interior Painting",
    "tile": "Tile, Grout & Caulk Repair", "interior-finishing": "Trim & Interior Finishing",
    "small-repairs": "General Small Repairs"
  };
  var AREAS = {
    "clintonville": "Clintonville", "linden": "Linden & North Columbus", "university-district": "University District",
    "short-north-italian-village": "Short North & Italian Village", "westerville": "Westerville",
    "worthington": "Worthington", "gahanna": "Gahanna", "bexley": "Bexley"
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function imgUrl(img, w, h) {
    var q = "w=" + w + (h ? "&h=" + h + "&fit=crop" : "") + "&auto=format&q=75";
    if (h && img.hotspot) q += "&crop=focalpoint&fp-x=" + img.hotspot.x.toFixed(3) + "&fp-y=" + img.hotspot.y.toFixed(3);
    return img.url + "?" + q;
  }
  function shot(img, label, title) {
    return '<a class="shot" href="' + esc(imgUrl(img, 1600)) + '" target="_blank" rel="noopener">' +
      '<img src="' + esc(imgUrl(img, 600, 450)) + '" alt="' + esc(img.alt || label + " photo: " + title) +
      '" width="600" height="450" loading="lazy"><span class="tag">' + label + "</span></a>";
  }
  function card(p) {
    var pair = p.before && p.before.url;
    var meta = [SERVICES[p.service], AREAS[p.neighborhood]].filter(Boolean).join(" · ");
    return '<figure class="work-card" data-service="' + esc(p.service) + '"><div class="work-imgs' + (pair ? " pair" : "") + '">' +
      (pair ? shot(p.before, "Before", p.title) : "") + shot(p.after, pair ? "After" : "Finished", p.title) +
      "</div><figcaption><strong>" + esc(p.title) + '</strong><span class="meta">' + esc(meta) + "</span>" +
      (p.summary ? "<p>" + esc(p.summary) + "</p>" : "") + "</figcaption></figure>";
  }
  function pick(all, box) {
    var svc = box.dataset.service, area = box.dataset.area, feat = box.dataset.featured === "1";
    var limit = parseInt(box.dataset.limit || "0", 10);
    var items = all.filter(function (p) {
      return (!svc || p.service === svc) && (!area || p.neighborhood === area) && (!feat || p.featured);
    });
    if (feat && !items.length) items = all.slice();
    return limit ? items.slice(0, limit) : items;
  }
  function render(all) {
    boxes.forEach(function (box) {
      var items = pick(all, box), grid = box.querySelector(".work-grid"), empty = box.querySelector(".work-empty");
      grid.innerHTML = items.map(card).join("");
      if (box.dataset.empty) { if (empty) empty.hidden = items.length > 0; }
      else box.hidden = items.length === 0;
    });
    applyFilter(currentFilter);
  }

  // Service filter buttons on /handyman/work
  var currentFilter = "";
  function applyFilter(f) {
    currentFilter = f;
    document.querySelectorAll(".work-filters .chip-btn").forEach(function (b) { b.classList.toggle("on", b.dataset.filter === f); });
    document.querySelectorAll("[data-empty] .work-card").forEach(function (c) { c.hidden = !!f && c.dataset.service !== f; });
  }
  document.querySelectorAll(".work-filters .chip-btn").forEach(function (b) {
    b.addEventListener("click", function () { applyFilter(b.dataset.filter); });
  });

  var url = "https://" + PROJECT + ".apicdn.sanity.io/v" + API + "/data/query/" + DATASET +
    "?query=" + encodeURIComponent(QUERY);
  fetch(url).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { if (j && Array.isArray(j.result)) render(j.result); })
    .catch(function () { /* keep the build-time photos */ });
})();
