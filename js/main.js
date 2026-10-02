const PLACE_LABEL = {
  Hunnestad: "Hunnestad",
  Grimeton: "Grimeton",
  Varberg: "Varberg",
  Båda: "Hunnestad och Grimeton",
};

const listEl = document.querySelector("#news-list");
const countEl = document.querySelector("#count");
const chips = [...document.querySelectorAll(".chip")];

let articles = [];
let filter = readFilter();
let ready = false;

function readFilter() {
  const params = new URLSearchParams(window.location.search);
  const raw = (params.get("ort") || window.location.hash.replace("#", "")).toLowerCase();
  if (raw === "hunnestad" || raw === "grimeton") return raw;
  return "alla";
}

function writeFilter(next) {
  const url = new URL(window.location.href);
  if (next === "alla") url.searchParams.delete("ort");
  else url.searchParams.set("ort", next);
  url.hash = "";
  history.replaceState(null, "", url);
}

function matches(article, current) {
  if (current === "hunnestad") return article.place === "Hunnestad" || article.place === "Båda";
  if (current === "grimeton") return article.place === "Grimeton" || article.place === "Båda";
  return true;
}

function countLabel(count) {
  if (count === 0) return "Inga nyheter";
  if (count === 1) return "1 nyhet";
  return `${count} nyheter`;
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function monthLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Okänt datum";
  const text = new Intl.DateTimeFormat("sv-SE", {
    month: "long",
    year: "numeric",
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function isExample(article) {
  const tags = Array.isArray(article.tags) ? article.tags : [];
  return article.example === true
    || tags.some((tag) => String(tag).toLowerCase() === "exempel")
    || /example\.com/i.test(article.sourceUrl || "");
}

function syncChips() {
  for (const chip of chips) {
    chip.setAttribute("aria-pressed", chip.dataset.ort === filter ? "true" : "false");
  }
  const titles = {
    alla: "Hunnestad & Grimeton Nyheter",
    hunnestad: "Hunnestad · Hunnestad & Grimeton Nyheter",
    grimeton: "Grimeton · Hunnestad & Grimeton Nyheter",
  };
  document.title = titles[filter] || titles.alla;
}

function safeHref(url) {
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
  } catch {
    return null;
  }
  return null;
}

/** Local site path only, e.g. images/foo.jpg — no remote or parent traversal. */
function safeImageUrl(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim().replace(/^\.\//, "");
  if (!trimmed) return null;
  if (
    trimmed.includes("..")
    || trimmed.includes("\\")
    || trimmed.startsWith("/")
    || trimmed.startsWith("//")
    || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

function badge(className, text) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function renderCard(article, isLead) {
  const card = document.createElement("article");
  card.className = `card${isLead ? " card-lead" : ""}${isExample(article) ? " card-example" : ""}`;
  card.dataset.place = article.place || "";
  card.dataset.example = isExample(article) ? "true" : "false";

  const meta = document.createElement("div");
  meta.className = "card-meta";
  const place = article.place && PLACE_LABEL[article.place] ? article.place : "Varberg";
  const placeClass = {
    Hunnestad: "badge badge-hunnestad",
    Grimeton: "badge badge-grimeton",
    Båda: "badge badge-bada",
    Varberg: "badge badge-varberg",
  }[place];
  meta.append(badge(placeClass, PLACE_LABEL[place]));
  if (isExample(article)) meta.append(badge("badge badge-example", "Exempel"));

  const time = document.createElement("time");
  time.dateTime = article.publishedAt;
  time.textContent = formatDate(article.publishedAt);
  meta.append(time);

  const heading = document.createElement("h3");
  const href = safeHref(article.sourceUrl);
  if (href) {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = isExample(article) ? "nofollow noopener noreferrer" : "noopener noreferrer";
    link.referrerPolicy = "no-referrer";
    link.textContent = article.title;
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = " (öppnas i ny flik)";
    link.append(sr);
    heading.append(link);
  } else {
    heading.textContent = article.title;
  }

  const summary = document.createElement("p");
  summary.className = "summary";
  summary.textContent = article.summary;

  const foot = document.createElement("div");
  foot.className = "card-foot";
  const source = document.createElement("p");
  source.className = "source";
  source.textContent = `Källa: ${article.source}`;
  foot.append(source);

  const tags = (Array.isArray(article.tags) ? article.tags : [])
    .map((tag) => String(tag).trim())
    .filter((tag) => tag && tag.toLowerCase() !== "exempel");
  if (tags.length) {
    const list = document.createElement("ul");
    list.className = "tags";
    for (const tag of tags) {
      const item = document.createElement("li");
      item.textContent = tag;
      list.append(item);
    }
    foot.append(list);
  }

  const nodes = [meta];
  const imageUrl = safeImageUrl(article.imageUrl);
  if (imageUrl) {
    const media = document.createElement("figure");
    media.className = "card-media";
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = article.title ? String(article.title) : "";
    img.loading = "lazy";
    img.decoding = "async";
    media.append(img);
    const credit = typeof article.imageCredit === "string"
      ? article.imageCredit.trim()
      : (typeof article.imageSource === "string" ? article.imageSource.trim() : "");
    if (credit) {
      const caption = document.createElement("figcaption");
      caption.className = "card-credit";
      caption.textContent = credit;
      media.append(caption);
    }
    nodes.push(media);
  }
  nodes.push(heading, summary, foot);
  card.append(...nodes);
  return card;
}

function emptyText() {
  if (filter === "hunnestad") return "Inga nyheter om Hunnestad just nu.";
  if (filter === "grimeton") return "Inga nyheter om Grimeton just nu.";
  return "Det finns inga nyheter i listan ännu.";
}

function render() {
  const visible = articles.filter((article) => matches(article, filter));
  countEl.textContent = countLabel(visible.length);
  if (!visible.length) {
    const status = document.createElement("p");
    status.className = "status";
    status.textContent = emptyText();
    listEl.replaceChildren(status);
  } else {
    const nodes = [];
    let lastMonth = "";
    visible.forEach((article, index) => {
      const month = monthLabel(article.publishedAt);
      if (month !== lastMonth) {
        const heading = document.createElement("h2");
        heading.className = "month";
        heading.textContent = month;
        nodes.push(heading);
        lastMonth = month;
      }
      nodes.push(renderCard(article, index === 0));
    });
    listEl.replaceChildren(...nodes);
  }
  listEl.setAttribute("aria-busy", "false");
}

function showError() {
  countEl.textContent = "Nyheterna kunde inte hämtas.";
  const status = document.createElement("p");
  status.className = "status";
  status.textContent = "Kontrollera att data/news.json finns och att sidan öppnas via en webbserver, till exempel npm run dev. Att öppna HTML-filen direkt brukar inte fungera.";
  listEl.replaceChildren(status);
  listEl.setAttribute("aria-busy", "false");
}

function isArticle(item) {
  return Boolean(item && typeof item.title === "string" && item.title.trim() && item.sourceUrl);
}

async function loadArticles() {
  const response = await fetch("data/news.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(String(response.status));
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("fel format");
  return data
    .filter(isArticle)
    .slice()
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

if (listEl && countEl) {
  syncChips();
  for (const chip of chips) {
    chip.addEventListener("click", () => {
      filter = chip.dataset.ort || "alla";
      writeFilter(filter);
      syncChips();
      if (ready) render();
    });
  }

  loadArticles()
    .then((loaded) => {
      articles = loaded;
      ready = true;
      render();
    })
    .catch(() => {
      showError();
    });
}
