/* ============================================
   DOMINGO ADMIN — Dashboard logic
   Domingo-only CMS. No old website admin code,
   no old localStorage keys (only ss_auth session),
   no stale cache. Every UI refresh happens from
   the live /api/domingo server response.
   ============================================ */

(function () {
  "use strict";

  /* ---------- Auth guard ---------- */
  const auth = JSON.parse(localStorage.getItem("ss_auth") || "null");
  if (!auth || !auth.loggedIn) {
    window.location.href = "login.html";
    return;
  }

  /* ---------- Live state ---------- */
  const state = {
    hero: { name: "", image: "", updatedAt: null },
    pendingImageUrl: null,   // computed data URL from a newly chosen file
    pendingRemoved: false,   // user asked to remove the current image
  };

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById(id);

  const sections = {
    dashboard: $("view-dashboard"),
    hero: $("view-hero"),
    preview: $("view-preview"),
    publish: $("view-publish"),
  };

  const navItems = Array.from(document.querySelectorAll(".nav__item"));

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(message, isError) {
    const el = $("toast");
    el.textContent = message;
    el.classList.toggle("toast--error", !!isError);
    el.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 4200);
  }

  /* ---------- View switching ---------- */
  function showView(name) {
    Object.keys(sections).forEach((key) => {
      sections[key].classList.toggle("is-active", key === name);
    });
    navItems.forEach((item) => {
      item.classList.toggle("is-active", item.dataset.nav === name);
    });
  }

  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav && sections[nav.dataset.nav]) {
      showView(nav.dataset.nav);
    }
    const go = e.target.closest("[data-nav-go]");
    if (go && sections[go.dataset.navGo]) {
      showView(go.dataset.navGo);
    }
  });

  /* ---------- Helpers ---------- */
  function formatTime(iso) {
    if (!iso) return "Not published yet";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function setPlaceholderImage(imgEl, emptyEl, url) {
    if (url) {
      imgEl.src = url;
      imgEl.hidden = false;
      emptyEl.style.display = "none";
    } else {
      imgEl.removeAttribute("src");
      imgEl.hidden = true;
      emptyEl.style.display = "";
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function feedJSON(obj) {
    return JSON.stringify(obj, null, 2);
  }

  /* ---------- Render from live server state ---------- */
  function applyHero(hero) {
    state.hero = {
      name: hero.name || "",
      image: hero.image || "",
      updatedAt: hero.updatedAt || null,
    };

    // Dashboard
    $("dashName").textContent = state.hero.name || "—";
    $("dashUpdated").textContent = formatTime(state.hero.updatedAt);
    setPlaceholderImage($("dashThumb"), $("dashThumbEmpty"), state.hero.image);

    // Hero editor
    $("heroNameInput").value = state.hero.name;
    setPlaceholderImage($("heroPreviewImg"), $("heroPreviewEmpty"), heroPreviewUrl());
    $("pubName").textContent = state.hero.name || "—";
    $("pubUpdated").textContent = formatTime(state.hero.updatedAt);
    setPlaceholderImage($("pubThumb"), $("pubThumbEmpty"), state.hero.image);

    // Publish pending
    $("pendingName").textContent = state.hero.name || "—";
    $("pendingImageState").textContent = pendingImageLabel();
  }

  function heroPreviewUrl() {
    // Preview shows the chosen pending image when one is picked,
    // otherwise the currently published image, otherwise nothing.
    if (state.pendingRemoved) return "";
    if (state.pendingImageUrl) return state.pendingImageUrl;
    return state.hero.image || "";
  }

  function pendingImageLabel() {
    if (state.pendingRemoved) return "Removed";
    if (state.pendingImageUrl) return "New image selected";
    if (state.hero.image) return "Current image stays";
    return "No image";
  }

  /* ---------- Image selection ---------- */
  $("heroImageInput").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    handleImageFile(file);
  });

  async function handleImageFile(file) {
    try {
      // Existing, working image mechanism: ImageService compresses in-browser.
      const result = await ImageService.upload(file, { maxDim: 1400, quality: 0.8 });
      state.pendingImageUrl = result.url;
      state.pendingRemoved = false;
      applyHero(state.hero);
      toast("Image ready. Publish to save it to the site.");
    } catch (err) {
      toast(err.message || "Could not process that image", true);
    }
  }

  $("heroRemoveImageBtn").addEventListener("click", () => {
    state.pendingImageUrl = null;
    state.pendingRemoved = true;
    $("heroImageInput").value = "";
    applyHero(state.hero);
    toast("Image will be removed when you publish.");
  });

  /* ---------- Publish flow ---------- */
  async function publish() {
    hideError();

    const name = $("heroNameInput").value.trim();
    if (!name) {
      showError("Please enter a dessert name before publishing.");
      return;
    }

    let image = state.hero.image || "";
    if (state.pendingRemoved) image = "";
    if (state.pendingImageUrl) image = state.pendingImageUrl;

    setPublishing(true);
    try {
      // Server saves name + image together and returns the full hero object.
      const saved = await DomingoService.save({ name, image });
      if (!saved || !saved.hero) throw new Error("Server returned an invalid response.");

      const hero = saved.hero;
      state.pendingImageUrl = null;
      state.pendingRemoved = false;
      $("heroImageInput").value = "";

      applyHero(hero);
      renderResult(hero);
      renderPreview(hero);

      $("apiStatus").textContent = "Connected — last update " + formatTime(hero.updatedAt);
      toast("Published: " + hero.name + " is live.");

      // Keep the state in sync by re-reading from the server.
      refreshFromServer(true);
    } catch (err) {
      toast(err.message || "Publish failed. Please try again.", true);
      $("apiStatus").textContent = "Publish failed — " + (err.message || "unknown error");
      $("apiStatus").classList.add("status-chip--error");
    } finally {
      setPublishing(false);
    }
  }

  function setPublishing(busy) {
    [$("heroPublishBtn"), $("publishBtn")].forEach((btn) => {
      btn.disabled = busy;
      btn.textContent = busy ? "Publishing…" : "Publish Changes";
    });
  }

  /* ---------- Publish result panel ---------- */
  function renderResult(hero) {
    $("publishResultIdle").hidden = true;
    $("publishResultFill").hidden = false;
    $("resultName").textContent = hero.name || "—";
    $("resultUpdated").textContent = formatTime(hero.updatedAt);
    setPlaceholderImage($("resultThumb"), $("resultThumbEmpty"), hero.image);

    const feed = $("publishResultFeed");
    feed.hidden = false;
    feed.textContent = feedJSON(hero);
  }

  /* ---------- Preview section ---------- */
  function renderPreview(hero) {
    setPlaceholderImage($("previewHeroImg"), $("previewHeroEmpty"), hero.image || "");
    $("previewHeroName").textContent = hero.name || "—";
    $("previewApiStatus").textContent = "Connected — last update " + formatTime(hero.updatedAt);
    $("previewApiStatus").classList.remove("status-chip--error");
  }

  $("previewRefreshBtn").addEventListener("click", () => {
    const frame = $("siteFrame");
    frame.src = frame.src; // forces a reload
    refreshFromServer(true);
  });

  /* ---------- Dashboard feed ---------- */
  function renderFeed(hero) {
    $("dashFeed").textContent = feedJSON({
      hero: {
        name: hero.name,
        image: hero.image ? "[image set — " + hero.image.length + " chars]" : "",
        updatedAt: hero.updatedAt,
      },
    });
  }

  /* ---------- Server refresh ---------- */
  async function refreshFromServer(quiet) {
    try {
      const hero = await DomingoService.get();
      applyHero(hero);
      renderFeed(hero);
      renderPreview(hero);

      $("apiStatus").textContent = "Connected to live data"
        + (hero.updatedAt ? " — last update " + formatTime(hero.updatedAt) : "");
      $("apiStatus").classList.remove("status-chip--error");
    } catch (err) {
      $("apiStatus").textContent = "Offline — " + (err.message || "cannot reach /api/domingo");
      $("apiStatus").classList.add("status-chip--error");
      if (!quiet) toast("Could not reach the live data source.", true);
    }
  }

  /* ---------- Errors ---------- */
  function showError(msg) {
    $("heroError").textContent = msg;
    $("heroError").classList.add("show");
    $("publishError").textContent = msg;
    $("publishError").classList.add("show");
  }

  function hideError() {
    $("heroError").classList.remove("show");
    $("publishError").classList.remove("show");
  }

  /* ---------- Sign out ---------- */
  $("signOutBtn").addEventListener("click", () => {
    localStorage.removeItem("ss_auth");
    window.location.href = "login.html";
  });

  /* ---------- Wire publish buttons ---------- */
  $("heroPublishBtn").addEventListener("click", publish);
  $("publishBtn").addEventListener("click", publish);

  /* ---------- Drag & drop ---------- */
  const dropzone = $("heroDropzone");
  dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.style.background = "var(--cream-2)"; });
  dropzone.addEventListener("dragleave", () => { dropzone.style.background = ""; });
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.style.background = "";
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  });

  /* ---------- Boot ---------- */
  showView("dashboard");
  refreshFromServer();
})();