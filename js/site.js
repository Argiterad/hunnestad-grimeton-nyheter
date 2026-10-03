const desktop = window.matchMedia("(min-width: 801px)");

function setupToday() {
  const el = document.querySelector("[data-today]");
  if (!el) return;
  const now = new Date();
  el.textContent = new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  el.setAttribute("datetime", now.toISOString().slice(0, 10));
}

function setupMer() {
  const button = document.querySelector("[data-mer]");
  const panel = document.querySelector("#mer-panel");
  if (!button || !panel) return;

  const close = () => {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };

  const open = () => {
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    panel.querySelector("a")?.focus();
  };

  button.addEventListener("click", () => {
    if (panel.hidden) open();
    else close();
  });

  document.addEventListener("click", (event) => {
    if (panel.hidden) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (panel.contains(target) || button.contains(target)) return;
    close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || panel.hidden) return;
    const dialog = document.querySelector("#artikel-panel");
    if (dialog instanceof HTMLDialogElement && dialog.open) return;
    close();
    button.focus();
  });

  desktop.addEventListener("change", (event) => {
    if (event.matches) close();
  });
}

function setupPanel() {
  const dialog = document.querySelector("#artikel-panel");
  if (!(dialog instanceof HTMLDialogElement)) return;
  const sheetBody = dialog.querySelector(".panel-body");
  const closeButton = dialog.querySelector("[data-close]");
  let lastOpener = null;

  const syncPopup = () => {
    document.querySelectorAll("a.js-artikel").forEach((link) => {
      if (desktop.matches) link.setAttribute("aria-haspopup", "dialog");
      else link.removeAttribute("aria-haspopup");
    });
  };

  const openFrom = async (link) => {
    lastOpener = link;
    if (sheetBody) sheetBody.innerHTML = '<p class="panel-status">Öppnar platshållaren …</p>';
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("panel-open");
    try {
      const response = await fetch(link.href);
      if (!response.ok) throw new Error(String(response.status));
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const story = doc.querySelector("article.story");
      if (!story || !sheetBody) throw new Error("missing");
      sheetBody.replaceChildren(document.importNode(story, true));
      if (closeButton instanceof HTMLElement) closeButton.focus();
    } catch {
      window.location.assign(link.href);
    }
  };

  document.querySelectorAll("a.js-artikel").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!desktop.matches) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      openFrom(link);
    });
  });

  closeButton?.addEventListener("click", () => dialog.close());

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener("close", () => {
    document.body.classList.remove("panel-open");
    sheetBody?.replaceChildren();
    if (lastOpener instanceof HTMLElement) lastOpener.focus();
  });

  desktop.addEventListener("change", (event) => {
    syncPopup();
    if (!event.matches && dialog.open) dialog.close();
  });

  syncPopup();
}

function setupFilters() {
  const buttons = [...document.querySelectorAll(".filters button")];
  if (!buttons.length) return;
  const events = [...document.querySelectorAll(".event")];
  const days = [...document.querySelectorAll(".day")];

  const apply = (section) => {
    buttons.forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.sektion === section ? "true" : "false");
    });
    events.forEach((item) => {
      const show = section === "alla" || item.dataset.sektion === section;
      item.hidden = !show;
    });
    days.forEach((day) => {
      day.hidden = !day.querySelector(".event:not([hidden])");
    });
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => apply(button.dataset.sektion || "alla"));
  });
}

setupToday();
setupMer();
setupPanel();
setupFilters();
