const SECTION_ORDER = ["Samhälle", "Näringsliv", "Sport", "Kultur", "Debatt", "Tips"];
const SECTIONS = new Set(SECTION_ORDER);
const HOME_PUFF_SECTIONS = ["Samhälle", "Näringsliv", "Sport", "Kultur", "Debatt"];
const ZONE = "Europe/Stockholm";

const FALLBACK_EXAMPLE = {
  id: "ex-layout",
  title: "Exempel: så ser en notis ut i Supernytt",
  summary: "Exempel. Påhittad text, inte en verifierad nyhet. Raden ligger kvar så att sidan inte blir tom när listan saknar riktiga notiser.",
  source: "Exempelkälla",
  sourceUrl: "https://example.com/hunnestad-grimeton/exempel/layout",
  publishedAt: "2026-09-30T10:00:00+02:00",
  place: "Grimeton",
  tags: ["exempel"],
  example: true,
  section: "Samhälle",
};

let loadPromise = null;
let catalog = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function shorten(text, max) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const last = cut.lastIndexOf(" ");
  const base = last > max * 0.6 ? cut.slice(0, last) : cut;
  return `${base.trim()}…`;
}

function isExample(raw, tags) {
  return raw.example === true || tags.includes("exempel");
}

function isTip(raw, tags) {
  const section = typeof raw.section === "string" ? raw.section.trim() : "";
  if (section === "Tips") return true;
  if (typeof raw.kind === "string" && raw.kind.trim().toLowerCase() === "tips") return true;
  if (tags.includes("tips")) return true;
  if (typeof raw.id === "string" && raw.id.toLowerCase().startsWith("tips-")) return true;
  return false;
}

function normalizeSectionName(section) {
  if (section === "Ekonomi och Företag") return "Näringsliv";
  return section;
}

function inferSection(raw, tags) {
  if (isTip(raw, tags)) return "Tips";
  if (typeof raw.section === "string") {
    const mapped = normalizeSectionName(raw.section.trim());
    if (SECTIONS.has(mapped)) return mapped;
  }
  if (typeof raw.kind === "string") {
    const kind = raw.kind.trim().toLowerCase();
    if (kind === "debatt") return "Debatt";
    if (kind === "tips") return "Tips";
  }
  const tagset = new Set(tags);
  const titleBlob = `${raw.id || ""} ${raw.title || ""}`.toLowerCase();
  const blob = `${titleBlob} ${raw.summary || ""}`.toLowerCase();
  if (tagset.has("debatt") || tagset.has("ledare") || tagset.has("insändare") || tagset.has("insandare")) return "Debatt";
  if (tagset.has("sport") || /grimeton[\s-]+ik|serieseger|division\s+[0-9]/.test(blob)) return "Sport";
  const naringslivTag = ["ekonomi", "företag", "foretag", "näringsliv", "naringsliv", "bolag", "affärer", "affarer"].some((tag) => tagset.has(tag));
  if (naringslivTag || /\b(ab|bolagsverket|aktiekapital)\b|företagsnytt|foretagsnytt/.test(blob)) {
    return "Näringsliv";
  }
  const kulturTag = ["kultur", "musik", "teater", "konsert", "konst", "museum", "utställning", "utstallning"].some((tag) => tagset.has(tag));
  if (kulturTag || /\b(konsert|teater|vernissage|museum|utställning)\b/.test(titleBlob)) return "Kultur";
  return "Samhälle";
}

function imageSrc(url) {
  if (typeof url !== "string") return "";
  const clean = url.trim();
  if (!clean || clean.includes("..") || /^(https?:)?\/\//i.test(clean) || /^[a-z][a-z0-9+.-]*:/i.test(clean)) return "";
  return clean.startsWith("./") ? clean : `./${clean.replace(/^\//, "")}`;
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  const source = typeof raw.source === "string" ? raw.source.trim() : "";
  const sourceUrl = typeof raw.sourceUrl === "string" ? raw.sourceUrl.trim() : "";
  const publishedAt = typeof raw.publishedAt === "string" ? raw.publishedAt.trim() : "";
  const place = typeof raw.place === "string" ? raw.place.trim() : "";
  if (!id || !title || !summary || !source || !/^https?:\/\//i.test(sourceUrl) || Number.isNaN(Date.parse(publishedAt))) return null;
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((tag) => typeof tag === "string" && tag.trim()).map((tag) => tag.trim()) : [];
  const tagsLower = tags.map((tag) => tag.toLowerCase());
  const tip = isTip(raw, tagsLower);
  const item = {
    id,
    title,
    summary,
    source,
    sourceUrl,
    publishedAt,
    place: place || "Grimeton",
    tags,
    example: isExample(raw, tagsLower),
    tip,
    section: inferSection(raw, tagsLower),
  };
  if (typeof raw.kind === "string" && raw.kind.trim()) item.kind = raw.kind.trim();
  else if (tip) item.kind = "tips";
  const src = imageSrc(raw.imageUrl);
  if (src) item.imageUrl = src;
  if (typeof raw.imageCredit === "string" && raw.imageCredit.trim()) item.imageCredit = raw.imageCredit.trim();
  if (typeof raw.imageAlt === "string" && raw.imageAlt.trim()) item.imageAlt = raw.imageAlt.trim();
  if (typeof raw.quote === "string" && raw.quote.trim()) item.quote = raw.quote.trim();
  if (typeof raw.quoteBy === "string" && raw.quoteBy.trim()) item.quoteBy = raw.quoteBy.trim();
  if (raw.emailSource === true) item.emailSource = true;
  if (raw.critical === true) item.critical = true;
  return item;
}

function byDateDesc(a, b) {
  const delta = Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  if (delta) return delta;
  return a.title.localeCompare(b.title, "sv");
}

function prepare(list) {
  const items = (Array.isArray(list) ? list : []).map(normalizeItem).filter(Boolean);
  const real = items.filter((item) => !item.example).sort(byDateDesc);
  const examples = items.filter((item) => item.example).sort(byDateDesc);
  if (!real.length && !examples.length) {
    return { items: [FALLBACK_EXAMPLE], real: [], examples: [FALLBACK_EXAMPLE], fallback: true };
  }
  return { items: [...real, ...examples], real, examples, fallback: false };
}

function homeNews(items) {
  return items.filter((item) => !item.tip && item.section !== "Tips");
}

function isJustNuItem(item) {
  const tip = item.tags.some((tag) => tag.toLowerCase() === "tips") || item.emailSource === true;
  return tip || item.critical === true;
}

function articleHref(id) {
  return `./artikel.html?id=${encodeURIComponent(id)}`;
}

function kickerText(item) {
  return item.example ? `Exempel · ${item.section}` : item.section;
}

function formatClock(iso) {
  return new Intl.DateTimeFormat("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: ZONE,
  }).format(new Date(iso)).replace(":", ".");
}

function formatLong(iso) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: ZONE,
  }).format(new Date(iso));
}

function formatMedium(iso) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: ZONE,
  }).format(new Date(iso)).replace(".", "");
}

function formatList(iso) {
  const date = new Date(iso);
  const key = new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  if (key.format(date) === key.format(new Date())) return formatClock(iso);
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    timeZone: ZONE,
  }).format(date).replace(".", "");
}

function byline(item) {
  return `${item.source} · ${formatMedium(item.publishedAt)} · ${formatClock(item.publishedAt)}`;
}

function selectPuffs(real, lead) {
  const pool = homeNews(real);
  const puffs = [];
  for (const section of HOME_PUFF_SECTIONS) {
    const next = pool.find((item) => item.id !== lead.id && item.section === section);
    if (next) puffs.push(next);
  }
  for (const item of pool) {
    if (puffs.length >= 4) break;
    if (item.id === lead.id || puffs.some((puff) => puff.id === item.id)) continue;
    puffs.push(item);
  }
  return puffs.slice(0, 4);
}

function relatedItems(items, current) {
  const rest = items.filter((item) => item.id !== current.id);
  const same = rest.filter((item) => !item.example && item.section === current.section);
  const other = rest.filter((item) => !item.example && item.section !== current.section);
  const examples = rest.filter((item) => item.example);
  return [...same, ...other, ...examples].slice(0, 3);
}

function makeImage(item, alt) {
  if (!item.imageUrl) return null;
  const img = document.createElement("img");
  img.src = item.imageUrl;
  img.width = 1600;
  img.height = 1000;
  img.alt = item.imageAlt || alt || "";
  return img;
}

function renderStory(item, items) {
  const story = document.createElement("article");
  story.className = "story";

  const head = document.createElement("header");
  head.className = "story-head";
  head.append(el("p", "kicker", kickerText(item)));
  head.append(el("h1", null, item.title));
  const deck = shorten(item.summary, 220);
  head.append(el("p", "deck", deck));
  head.append(el("p", "byline", `${item.source} · ${formatLong(item.publishedAt)} · ${formatClock(item.publishedAt)} · ${item.place}`));
  story.append(head);

  const img = makeImage(item, item.title);
  if (img) {
    const figure = document.createElement("figure");
    figure.className = "story-figure";
    figure.append(img);
    if (item.imageCredit) figure.append(el("figcaption", null, item.imageCredit));
    story.append(figure);
  }

  const body = document.createElement("div");
  body.className = "story-body";
  if (deck !== item.summary) body.append(el("p", null, item.summary));
  if (item.example && !item.summary.startsWith("Exempel.")) {
    body.append(el("p", null, "Exempel. Påhittad text, inte en verifierad nyhet."));
  }
  if (item.quote) {
    const quote = document.createElement("blockquote");
    quote.append(el("p", null, item.quote));
    if (item.quoteBy) quote.append(el("footer", null, item.quoteBy));
    body.append(quote);
  }
  const sourceP = document.createElement("p");
  if (item.emailSource) {
    sourceP.textContent = `Källa: mejl från ${item.source} till redaktionen, ${formatLong(item.publishedAt)}.`;
  } else if (/^https?:\/\//i.test(item.sourceUrl)) {
    const sourceA = document.createElement("a");
    sourceA.href = item.sourceUrl;
    sourceA.rel = "noopener noreferrer";
    sourceA.target = "_blank";
    sourceA.textContent = `Läs hela hos ${item.source}`;
    sourceP.append(sourceA);
  }
  if (sourceP.childNodes.length || sourceP.textContent) body.append(sourceP);
  story.append(body);

  const related = relatedItems(items, item);
  if (related.length) {
    const aside = document.createElement("aside");
    aside.className = "related";
    aside.setAttribute("aria-labelledby", "relaterat-rubrik");
    const heading = el("h2", null, "Relaterade historier");
    heading.id = "relaterat-rubrik";
    aside.append(heading);
    const ul = document.createElement("ul");
    for (const other of related) {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.className = "js-artikel";
      link.href = articleHref(other.id);
      link.append(document.createTextNode(other.example ? `Exempel: ${other.title}` : other.title));
      const arrow = el("span", "arrow", "→");
      arrow.setAttribute("aria-hidden", "true");
      link.append(arrow);
      li.append(link);
      ul.append(li);
    }
    aside.append(ul);
    story.append(aside);
  }

  const tipsa = el("p", "tipsa");
  const mail = document.createElement("a");
  mail.href = "mailto:matsbotsson@gmail.com";
  mail.textContent = "Tipsa redaktionen";
  tipsa.append(mail);
  story.append(tipsa);
  return story;
}

function renderPuff(item) {
  const article = document.createElement("article");
  article.className = item.imageUrl ? "puff puff--thumb" : "puff";
  const link = document.createElement("a");
  link.className = "js-artikel";
  link.href = articleHref(item.id);
  const copy = document.createElement("div");
  copy.className = "puff-copy";
  copy.append(el("p", "kicker", kickerText(item)));
  copy.append(el("h2", null, item.title));
  copy.append(el("p", "ingress", shorten(item.summary, 140)));
  copy.append(el("p", "byline", byline(item)));
  link.append(copy);
  const img = makeImage(item, "");
  if (img) {
    img.width = 240;
    img.height = 180;
    link.append(img);
  }
  article.append(link);
  return article;
}

function renderHome(data) {
  const home = homeNews(data.real);
  const lead = home[0] || data.examples[0] || data.items[0];
  const justNu = [...data.real, ...data.examples].filter(isJustNuItem).sort(byDateDesc)[0] || null;
  if (!lead) return;

  const leadHost = document.querySelector("[data-lead]");
  if (leadHost) {
    leadHost.replaceChildren();
    const link = document.createElement("a");
    link.className = "lead-link js-artikel";
    link.href = articleHref(lead.id);
    const img = makeImage(lead, "");
    if (img) link.append(img);
    link.append(el("p", "kicker", kickerText(lead)));
    link.append(el("h1", null, lead.title));
    link.append(el("p", "deck", shorten(lead.summary, 220)));
    link.append(el("p", "byline", byline(lead)));
    leadHost.append(link);
  }

  const now = document.querySelector("[data-now]");
  if (now) {
    const line = now.querySelector(".now-line");
    if (justNu) {
      now.hidden = false;
      now.href = articleHref(justNu.id);
      now.classList.add("js-artikel");
      if (line) line.textContent = justNu.example ? `Exempel: ${justNu.title}` : justNu.title;
    } else {
      now.hidden = true;
      if (line) line.textContent = "";
    }
  }

  const puffHost = document.querySelector("[data-puffs]");
  if (puffHost) {
    const puffs = home.length ? selectPuffs(data.real, lead) : [];
    puffHost.replaceChildren(...puffs.map((item) => renderPuff(item)));
    puffHost.hidden = puffHost.childElementCount === 0;
  }

  const listHost = document.querySelector("[data-news-list]");
  if (listHost) {
    const rows = home.length
      ? [...home.filter((item) => item.id !== lead.id), ...data.examples]
      : data.examples.filter((item) => item.id !== lead.id);
    listHost.replaceChildren(...rows.map((item) => {
      const li = document.createElement("li");
      const time = document.createElement("time");
      time.dateTime = item.publishedAt;
      time.textContent = formatList(item.publishedAt);
      const link = document.createElement("a");
      link.className = "js-artikel";
      link.href = articleHref(item.id);
      link.append(el("span", "kicker", kickerText(item)));
      link.append(el("span", "m-hed", item.title));
      li.append(time, link);
      return li;
    }));
  }
}

function renderSection(data) {
  const main = document.querySelector("[data-section]");
  if (!main) return;
  const section = main.dataset.section;
  const status = main.querySelector("[data-section-status]");
  const leadHost = main.querySelector("[data-section-lead]");
  const listHost = main.querySelector("[data-section-list]");
  const rows = [
    ...data.real.filter((item) => item.section === section),
    ...data.examples.filter((item) => item.section === section),
  ];
  if (!rows.length) {
    if (leadHost) {
      leadHost.hidden = true;
      leadHost.replaceChildren();
    }
    if (listHost) listHost.replaceChildren();
    if (status) {
      status.hidden = false;
      status.textContent = `Inga notiser i ${section} just nu.`;
    }
    return;
  }

  const [lead, ...rest] = rows;
  if (status) status.hidden = true;
  if (leadHost) {
    leadHost.hidden = false;
    leadHost.replaceChildren();
    const link = document.createElement("a");
    link.className = "js-artikel";
    link.href = articleHref(lead.id);
    const img = makeImage(lead, "");
    if (img) link.append(img);
    const copy = document.createElement("div");
    copy.append(el("p", "kicker", kickerText(lead)));
    copy.append(el("h2", null, lead.title));
    copy.append(el("p", "ingress", shorten(lead.summary, 180)));
    copy.append(el("p", "byline", byline(lead)));
    link.append(copy);
    leadHost.append(link);
  }
  if (listHost) {
    listHost.replaceChildren(...rest.map((item) => {
      const li = document.createElement("li");
      const time = document.createElement("time");
      time.dateTime = item.publishedAt;
      time.textContent = formatList(item.publishedAt);
      const div = document.createElement("div");
      const link = document.createElement("a");
      link.className = "js-artikel";
      link.href = articleHref(item.id);
      link.textContent = item.title;
      div.append(link, el("p", null, shorten(item.summary, 180)));
      li.append(time, div);
      return li;
    }));
  }
}

function showArticleMessage(text) {
  const main = document.querySelector('[data-page="artikel"]');
  if (!main) return;
  main.replaceChildren(el("p", "lede", text));
}

function renderArticlePage(data) {
  const main = document.querySelector('[data-page="artikel"]');
  if (!main) return;
  const id = new URL(window.location.href).searchParams.get("id");
  const item = id ? data.items.find((entry) => entry.id === id) : null;
  if (!item) {
    showArticleMessage(id ? "Den här notisen finns inte." : "Välj en notis från startsidan.");
    document.title = "Notis saknas — Supernytt — Grimeton & Hunnestad";
    return;
  }
  document.title = `${item.title} — Supernytt — Grimeton & Hunnestad`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute("content", shorten(item.summary, 180));
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", document.title);
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) ogDescription.setAttribute("content", shorten(item.summary, 180));
  main.replaceChildren(renderStory(item, data.items));
}

function markFallback(data) {
  if (!data.fallback) return;
  document.querySelectorAll(".footer-note").forEach((note) => {
    note.textContent = "Exempel visas för att sidan inte ska vara tom. Inga publicerade nyheter i listan.";
  });
}

function showLoadError() {
  const lead = document.querySelector("[data-lead]");
  if (lead) lead.replaceChildren(el("p", "deck", "Nyheterna kunde inte hämtas just nu."));
  const status = document.querySelector("[data-section-status]");
  if (status) status.textContent = "Nyheterna kunde inte hämtas just nu.";
  if (document.querySelector('[data-page="artikel"]')) showArticleMessage("Nyheten kunde inte hämtas just nu.");
  const line = document.querySelector("[data-now] .now-line");
  if (line) line.textContent = "Nyheterna kunde inte hämtas";
}

async function fetchNews() {
  const url = new URL("../data/news.json", import.meta.url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  return prepare(await response.json());
}

function ensureNews() {
  if (!loadPromise) {
    loadPromise = fetchNews().then((data) => {
      catalog = data;
      return data;
    });
  }
  return loadPromise;
}

function setupToday() {
  const node = document.querySelector("[data-today]");
  if (!node) return;
  const now = new Date();
  node.textContent = new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: ZONE,
  }).format(now);
  node.setAttribute("datetime", new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now));
}

function setupMer(desktop) {
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

function setupPanel(desktop) {
  const dialog = document.querySelector("#artikel-panel");
  if (!(dialog instanceof HTMLDialogElement)) return { syncPopup() {} };
  const sheetBody = dialog.querySelector(".panel-body");
  const closeButton = dialog.querySelector("[data-close]");
  const ownPage = dialog.querySelector(".panel-bar a");
  let lastOpener = null;

  const syncPopup = () => {
    document.querySelectorAll("a.js-artikel").forEach((link) => {
      if (desktop.matches) link.setAttribute("aria-haspopup", "dialog");
      else link.removeAttribute("aria-haspopup");
    });
  };

  const openFrom = async (link) => {
    lastOpener = link;
    const id = new URL(link.href, window.location.href).searchParams.get("id");
    if (ownPage) ownPage.href = id ? articleHref(id) : "./artikel.html";
    if (sheetBody) sheetBody.replaceChildren(el("p", "panel-status", "Öppnar notisen …"));
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("panel-open");
    try {
      const data = catalog || await ensureNews();
      const item = id ? data.items.find((entry) => entry.id === id) : null;
      if (!sheetBody) throw new Error("missing");
      if (!item) {
        sheetBody.replaceChildren(el("p", "panel-status", "Den här notisen finns inte."));
        return;
      }
      sheetBody.replaceChildren(renderStory(item, data.items));
      syncPopup();
      if (closeButton instanceof HTMLElement) closeButton.focus();
    } catch {
      if (id) window.location.assign(articleHref(id));
      else if (sheetBody) sheetBody.replaceChildren(el("p", "panel-status", "Notisen kunde inte öppnas."));
    }
  };

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest("a.js-artikel");
    if (!link) return;
    if (!desktop.matches) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    openFrom(link);
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
  return { syncPopup };
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

function boot() {
  const desktop = window.matchMedia("(min-width: 801px)");
  setupToday();
  setupMer(desktop);
  setupFilters();
  const panel = setupPanel(desktop);
  const needsNews = document.querySelector("[data-lead], [data-section], [data-page='artikel']");
  if (!needsNews) return;
  ensureNews().then((data) => {
    markFallback(data);
    if (document.querySelector("[data-lead]")) renderHome(data);
    if (document.querySelector("[data-section]")) renderSection(data);
    if (document.querySelector('[data-page="artikel"]')) renderArticlePage(data);
    panel.syncPopup();
  }).catch(() => {
    showLoadError();
  });
}

boot();
