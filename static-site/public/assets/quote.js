// Photo-quote form: shrinks photos in the browser (phone photos are 3–8 MB each),
// then posts everything to /api/quote, which the intake service turns into a Job in the CRM.
(function () {
  "use strict";
  var form = document.getElementById("quote-form");
  if (!form) return;
  var input = document.getElementById("photos");
  var thumbs = document.getElementById("thumbs");
  var statusEl = document.getElementById("form-status");
  var btn = document.getElementById("submit-btn");
  var MAX_FILES = 8, MAX_EDGE = 1800, QUALITY = 0.82;
  var prepared = []; // Blobs ready to upload

  // Preselect the job type from ?type=drywall-repair etc.
  var type = new URLSearchParams(location.search).get("type");
  if (type) {
    var box = form.querySelector('input[name="jobTypes"][value="' + CSS.escape(type) + '"]');
    if (box) box.checked = true;
  }

  function shrink(file) {
    return new Promise(function (resolve) {
      if (!/^image\//.test(file.type) || file.type === "image/gif") return resolve(file);
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s);
        c.height = Math.round(img.naturalHeight * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { resolve(b && b.size < file.size ? b : file); }, "image/jpeg", QUALITY);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); }; // e.g. HEIC on desktop: send as-is
      img.src = url;
    });
  }

  input.addEventListener("change", function () {
    var files = Array.prototype.slice.call(input.files, 0, MAX_FILES);
    thumbs.innerHTML = "";
    prepared = [];
    statusEl.className = "form-status";
    if (input.files.length > MAX_FILES) show("err", "Only the first " + MAX_FILES + " photos will be sent.");
    Promise.all(files.map(shrink)).then(function (blobs) {
      prepared = blobs;
      blobs.forEach(function (b) {
        var t = document.createElement("img");
        t.alt = "";
        t.src = URL.createObjectURL(b);
        thumbs.appendChild(t);
      });
    });
  });

  function show(kind, msg) {
    statusEl.className = "form-status " + kind;
    statusEl.textContent = msg;
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var phone = form.phone.value.trim(), email = form.email.value.trim();
    if (!form.firstName.value.trim()) return show("err", "Please add your first name.");
    if (!form.description.value.trim()) return show("err", "Please describe the job.");
    if (!/^\d{5}$/.test(form.zip.value.trim())) return show("err", "Please enter a 5-digit ZIP code.");
    if (!phone && !email) return show("err", "Please add a phone number or email so I can send the quote.");
    if (form.ackUninsured && !form.ackUninsured.checked) return show("err", "Please tick the box confirming you've read the insurance note.");

    var fd = new FormData(form);
    fd.delete("photos");
    prepared.forEach(function (b, i) { fd.append("photos", b, "photo-" + (i + 1) + ".jpg"); });

    btn.disabled = true;
    btn.textContent = "Sending…";
    fetch(form.action, { method: "POST", body: fd, headers: { Accept: "application/json" } })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j.error || "Something went wrong.");
        form.reset();
        thumbs.innerHTML = "";
        prepared = [];
        if (window.gtag) gtag("event", "generate_lead", { form: "photo_quote", contact_via: res.j.via || "" });
        show("ok", "Got it, thanks! I'll send your quote by " + (res.j.via || "text or email") +
          ", usually within 24 hours. Reference #" + (res.j.ref || "") + ".");
        btn.textContent = "Sent ✓";
      })
      .catch(function (err) {
        show("err", err.message + " You can also text photos to (740) 703-2110.");
        btn.disabled = false;
        btn.textContent = "Send for a quote";
      });
  });
})();
