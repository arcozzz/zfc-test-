// ==UserScript==
// @name        Zen folder colors
// @description Couleur persistante des zen-folder + "Modifier…" au clic droit + panneau à la création
// @include     main
// ==/UserScript==
console.log("[zfc] fichier lu");

(() => {
  if (window.__zenFolderColors) return;
  window.__zenFolderColors = true;

  const DEBUG = true;
  const AUTO_OPEN_ON_CREATE = true;
  const STARTUP_GRACE_MS = 6000;

  const PREF = "arc.zen-folder-colors";
  const COLORS = ["blue","purple","cyan","orange","yellow","pink","green","gray","red"];
  const t0 = Date.now();
  const log = (...a) => DEBUG && console.log("[zfc]", ...a);

  const load = () => {
    try { return JSON.parse(Services.prefs.getStringPref(PREF, "{}")); }
    catch { return {}; }
  };
  const save = (id, color) => {
    const data = load();
    data[id] = color;
    Services.prefs.setStringPref(PREF, JSON.stringify(data));
  };

  const colorOf = (f) => {
    const m = /--tab-group-color:\s*var\(--tab-group-([a-z]+)\)/.exec(f.getAttribute("style") || "");
    return m && COLORS.includes(m[1]) ? m[1] : null;
  };

  const sync = (f) => {
    if (!f.id) return;
    const current = colorOf(f);
    const saved = load()[f.id];
    if (current) {
      if (saved !== current) save(f.id, current);
    } else if (saved) {
      f.color = saved;
    }
  };

  const seen = new Set();

  const openPanel = (f) => {
    try { gBrowser.tabGroupMenu.openEditModal(f); }
    catch (e) { log("ouverture du panneau impossible :", e); }
  };

  const handleFolder = (f) => {
    if (!f.id) return;
    const isNew = !seen.has(f.id);
    seen.add(f.id);
    sync(f);
    if (isNew && AUTO_OPEN_ON_CREATE && Date.now() - t0 > STARTUP_GRACE_MS) {
      log("nouveau dossier", f.id);
      setTimeout(() => openPanel(f), 400);
    }
  };

  const syncAll = () => document.querySelectorAll("zen-folder").forEach(handleFolder);

  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === "attributes") {
        if (m.target.localName === "zen-folder") sync(m.target);
      } else {
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (n.localName === "zen-folder") handleFolder(n);
          n.querySelectorAll?.("zen-folder").forEach(handleFolder);
        });
      }
    }
  }).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["style"],
  });

  syncAll();
  setTimeout(syncAll, 1500);
  setTimeout(syncAll, 4000);

  let ctxFolder = null;
  document.addEventListener("contextmenu", (e) => {
    const box = e.target.closest?.("zen-folder > .tab-group-label-container");
    ctxFolder = box ? box.parentElement : null;
    log("clic droit, dossier :", ctxFolder?.id || "aucun");
  }, true);

  document.addEventListener("popupshowing", (e) => {
    const popup = e.target;
    if (typeof popup.insertBefore !== "function" || popup.localName !== "menupopup") return;

    let item = popup.querySelector(":scope > .zfc-edit");

    if (!ctxFolder) {
      if (item) item.hidden = true;
      return;
    }

    log("menu sur un dossier :", popup.localName, "id =", popup.id || "(aucun)");
    popup.__zfcFolder = ctxFolder;

    if (!item) {
      item = document.createXULElement("menuitem");
      item.className = "zfc-edit";
      item.setAttribute("label", "Modifier…");
      item.addEventListener("command", () => {
        const f = popup.__zfcFolder;
        if (f) openPanel(f);
      });
      popup.insertBefore(item, popup.firstElementChild);
    }
    item.hidden = false;
  }, true);

  log("chargé (v4)");
})();
