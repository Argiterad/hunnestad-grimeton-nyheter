/**
 * Uppdaterar data/news.json med nyheter om Hunnestad och Grimeton.
 *
 * Kör: npm run update-news
 *
 * Med någon av dessa nycklar i miljön söker skriptet på nätet:
 *   TAVILY_API_KEY, SERPER_API_KEY, BRAVE_SEARCH_API_KEY, NEWS_API_KEY
 * Välj källa med NEWS_PROVIDER=tavily|serper|brave|newsapi.
 * NEWS_MAX_AGE_DAYS (standard 400) styr hur gamla träffar som behålls.
 *
 * Utan nyckel, eller om sökningen inte ger något och listan saknar riktiga
 * artiklar, fylls filen med exempel märkta example: true. Datum på exemplen
 * är fasta, så att en daglig körning utan nyckel inte skriver om filen i onödan.
 *
 * Dubbletter (samma sourceUrl eller titel) slås ihop. Högst 30 poster.
 * En Grok-bot ska köra skriptet en gång per dag och, om filen ändrats,
 * committa data/news.json. Se README.md.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const newsPath = resolve(root, "data/news.json");
const MAX_ITEMS = 30;
const PLACES = new Set(["Hunnestad", "Grimeton", "Varberg", "Båda"]);
const SECTIONS = new Set(["Samhälle", "Ekonomi och Företag", "Sport", "Kultur"]);

const QUERIES = [
  "Hunnestad Varberg",
  "Hunnestad Halland",
  "Grimeton Varberg",
  "Grimeton radiostation",
];

const PROVIDER_LABEL = {
  tavily: "Tavily",
  serper: "Serper",
  brave: "Brave",
  newsapi: "NewsAPI",
};

const MONTHS = {
  januari: 0,
  februari: 1,
  mars: 2,
  april: 3,
  maj: 4,
  juni: 5,
  juli: 6,
  augusti: 7,
  september: 8,
  oktober: 9,
  november: 10,
  december: 11,
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  okt: 9,
  nov: 10,
  dec: 11,
  may: 4,
  june: 5,
  july: 6,
  october: 9,
};

const DISCLAIMER = "Exempel. Påhittad text, inte en verifierad nyhet.";

const SEEDS = [
  {
    id: "ex-grimeton-visning",
    title: "Extra visning i sändarsalen i Grimeton",
    summary: `${DISCLAIMER} En sådan här notis kan berätta om en visning för allmänheten, med tid och plats hämtade från en riktig källa.`,
    source: "Exempelkälla",
    sourceUrl: "https://example.com/hunnestad-grimeton/exempel/grimeton-visning",
    publishedAt: "2026-09-30T10:00:00+02:00",
    place: "Grimeton",
    tags: ["exempel", "världsarv"],
    example: true,
  },
  {
    id: "ex-hunnestad-hosttraff",
    title: "Hunnestads byalag kallar till höstträff",
    summary: `${DISCLAIMER} En sådan här notis kan berätta att byalaget ses i bygdegården och tar upp vägförening, belysning och vem som kokar kaffet.`,
    source: "Exempelkälla",
    sourceUrl: "https://example.com/hunnestad-grimeton/exempel/hunnestad-hosttraff",
    publishedAt: "2026-09-26T11:00:00+02:00",
    place: "Hunnestad",
    tags: ["exempel", "förening"],
    example: true,
  },
  {
    id: "ex-bada-loppis",
    title: "Loppis mellan Hunnestad och Grimeton",
    summary: `${DISCLAIMER} En sådan här notis kan handla om en gemensam loppis på gränsen mellan byarna, utan att påstå att just den dagen är verklig.`,
    source: "Exempelkälla",
    sourceUrl: "https://example.com/hunnestad-grimeton/exempel/bada-loppis",
    publishedAt: "2026-09-20T09:00:00+02:00",
    place: "Båda",
    tags: ["exempel", "förening"],
    example: true,
  },
  {
    id: "ex-varberg-bibliotek",
    title: "Varberg berättar om biblioteksbussen i öster",
    summary: `${DISCLAIMER} En kommunnotis kan nämna boende i Hunnestad och Grimeton även när själva händelsen hör hemma i Varberg. Då syns den bara under filtret Alla.`,
    source: "Exempelkälla",
    sourceUrl: "https://example.com/hunnestad-grimeton/exempel/varberg-bibliotek",
    publishedAt: "2026-09-15T08:00:00+02:00",
    place: "Varberg",
    tags: ["exempel", "kommun"],
    example: true,
  },
  {
    id: "ex-grimeton-bildkvall",
    title: "Bildkväll om radiostationen i Grimeton",
    summary: `${DISCLAIMER} En sådan här notis kan peka på en bildvisning om världsarvet, med länk till den förening som faktiskt bjuder in.`,
    source: "Exempelkälla",
    sourceUrl: "https://example.com/hunnestad-grimeton/exempel/grimeton-bildkvall",
    publishedAt: "2026-09-09T18:30:00+02:00",
    place: "Grimeton",
    tags: ["exempel", "världsarv"],
    example: true,
  },
  {
    id: "ex-hunnestad-vag",
    title: "Hunnestads vägförening tar upp byvägens belysning",
    summary: `${DISCLAIMER} En sådan här notis kan sammanfatta ett möte om belysning eller diken, när det finns ett protokoll eller ett inlägg att länka till.`,
    source: "Exempelkälla",
    sourceUrl: "https://example.com/hunnestad-grimeton/exempel/hunnestad-vag",
    publishedAt: "2026-09-03T16:00:00+02:00",
    place: "Hunnestad",
    tags: ["exempel", "trafik"],
    example: true,
  },
  {
    id: "ex-bada-skorde",
    title: "Föreningarna i de båda byarna planerar skördefika",
    summary: `${DISCLAIMER} En sådan här notis kan gälla både Hunnestad och Grimeton, till exempel en gemensam fika efter skörden.`,
    source: "Exempelkälla",
    sourceUrl: "https://example.com/hunnestad-grimeton/exempel/bada-skorde",
    publishedAt: "2026-08-27T15:00:00+02:00",
    place: "Båda",
    tags: ["exempel", "förening"],
    example: true,
  },
  {
    id: "ex-grimeton-tradgard",
    title: "Trädgårdsdag vid radiostationen i Grimeton",
    summary: `${DISCLAIMER} En sådan här notis kan efterlysa frivilliga till en trädgårdsdag, med anmälan via arrangörens egen sida.`,
    source: "Exempelkälla",
    sourceUrl: "https://example.com/hunnestad-grimeton/exempel/grimeton-tradgard",
    publishedAt: "2026-08-20T10:00:00+02:00",
    place: "Grimeton",
    tags: ["exempel", "världsarv"],
    example: true,
  },
];

function safeError(value) {
  return String(value && value.message ? value.message : value)
    .replace(/apiKey=[^&\s]+/gi, "apiKey=***")
    .replace(/api_key=[^&\s"]+/gi, "api_key=***")
    .replace(/X-Subscription-Token:\s*\S+/gi, "X-Subscription-Token: ***");
}

function decodeBasic(value) {
  let text = String(value || "");
  for (let pass = 0; pass < 2; pass += 1) {
    text = text
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safePoint(Number.parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, num) => safePoint(Number(num)))
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">");
  }
  return text;
}

function safePoint(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function cleanText(value) {
  return decodeBasic(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trim()}…`;
}

function hostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Okänd källa";
  }
}

function parseRelative(value, now = new Date()) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  if (text === "yesterday" || text === "igår" || text === "igar") {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  if (text === "today" || text === "i dag" || text === "idag") return new Date(now);
  const match = text.match(/(\d+)\s*(minut|minute|min|timme|timmar|hour|hours|dag|dagar|day|days|vecka|veckor|week|weeks|månad|månader|manad|month|months)\b/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  let step = day;
  if (unit.startsWith("min")) step = 60 * 1000;
  else if (unit.startsWith("tim") || unit.startsWith("hour")) step = hour;
  else if (unit.startsWith("vec") || unit.startsWith("week")) step = 7 * day;
  else if (unit.startsWith("må") || unit.startsWith("man") || unit.startsWith("mon")) step = 30 * day;
  return new Date(now.getTime() - amount * step);
}

function parseSwedishDate(value) {
  const match = String(value || "").trim().toLowerCase().match(/(\d{1,2})\s+([a-zåäö]+)\.?\s+(\d{4})/);
  if (!match) return null;
  const month = MONTHS[match[2]];
  if (month == null) return null;
  const day = Number(match[1]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day, 7, 0, 0));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date;
}

function canonicalDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) {
    if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text;
    return new Date(parsed).toISOString();
  }
  const swedish = parseSwedishDate(text);
  if (swedish) return swedish.toISOString();
  const relative = parseRelative(text);
  return relative ? relative.toISOString() : null;
}

function inferPlace(text) {
  const haystack = text.toLowerCase();
  const hunnestad = haystack.includes("hunnestad");
  const grimeton = haystack.includes("grimeton");
  if (hunnestad && grimeton) return "Båda";
  if (hunnestad) return "Hunnestad";
  if (grimeton) return "Grimeton";
  return "Varberg";
}

function inferTags(text) {
  const haystack = String(text || "").toLowerCase();
  const tags = [];
  if (/världsarv|varldsarv|radiostation|unesco|alexanderson/.test(haystack)) tags.push("världsarv");
  if (haystack.includes("kommun")) tags.push("kommun");
  if (/skola|förskola|forskola/.test(haystack)) tags.push("skola");
  if (/väg|trafik|buss/.test(haystack)) tags.push("trafik");
  if (/förening|forening|byalag|\blrf\b/.test(haystack)) tags.push("förening");
  if (/\b(sport|fotboll|idrott)\b|grimeton ik|serieseger|division\s+[0-9]/.test(haystack)) tags.push("sport");
  if (/\b(ab|bolagsverket|aktiekapital)\b|företagsnytt|foretagsnytt|näringsliv|naringsliv/.test(haystack)) tags.push("företag");
  if (/\b(konsert|teater|vernissage|museum|utställning|utstallning)\b/.test(haystack)) tags.push("kultur");
  return tags;
}

function inferSection(raw) {
  if (typeof raw.section === "string" && SECTIONS.has(raw.section)) return raw.section;
  const tags = new Set(Array.isArray(raw.tags) ? raw.tags : []);
  const titleBlob = `${raw.id || ""} ${raw.title || ""}`.toLowerCase();
  const blob = `${titleBlob} ${raw.summary || ""}`.toLowerCase();
  if (tags.has("sport") || /grimeton[\s-]+ik|serieseger|division\s+[0-9]/.test(blob)) return "Sport";
  const ekonomiTag = ["ekonomi", "företag", "foretag", "näringsliv", "naringsliv", "bolag", "affärer", "affarer"].some((tag) => tags.has(tag));
  if (ekonomiTag || /\b(ab|bolagsverket|aktiekapital)\b|företagsnytt|foretagsnytt/.test(blob)) {
    return "Ekonomi och Företag";
  }
  const kulturTag = ["kultur", "musik", "teater", "konsert", "konst", "museum", "utställning", "utstallning"].some((tag) => tags.has(tag));
  if (kulturTag || /\b(konsert|teater|vernissage|museum|utställning)\b/.test(titleBlob)) return "Kultur";
  return "Samhälle";
}

function normTitle(title) {
  return cleanText(title)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[«»"“”'’.,!?:;–—\-()[\]/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || key === "fbclid" || key === "oc") {
        parsed.searchParams.delete(key);
      }
    }
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    let text = parsed.toString();
    if (text.endsWith("/")) text = text.slice(0, -1);
    return text;
  } catch {
    return "";
  }
}

function makeId(sourceUrl, title) {
  const basis = normUrl(sourceUrl) || normTitle(title);
  return createHash("sha1").update(basis).digest("hex").slice(0, 12);
}

function validId(id) {
  return typeof id === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{2,80}$/.test(id);
}

function normalizeTags(tags, example) {
  const clean = [];
  const list = Array.isArray(tags) ? tags : [];
  for (const tag of list) {
    const text = cleanText(tag).toLowerCase();
    if (!text || text.length > 24 || clean.includes(text)) continue;
    clean.push(text);
  }
  if (example && !clean.includes("exempel")) clean.unshift("exempel");
  return clean.slice(0, 5);
}

function normalizeArticle(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = cleanText(raw.title);
  const sourceUrl = cleanText(raw.sourceUrl);
  if (title.length < 8 || !/^https?:\/\//i.test(sourceUrl)) return null;
  if (/google\s+nyheter|google news|^\[removed\]$/i.test(title)) return null;
  const publishedAt = canonicalDate(raw.publishedAt);
  if (!publishedAt) return null;
  const source = cleanText(raw.source) || hostLabel(sourceUrl);
  const summary = truncate(
    cleanText(raw.summary) || `Kort notis från ${source}. Öppna länken för hela artikeln.`,
    360,
  );
  const example = Boolean(raw.example);
  const place = PLACES.has(raw.place) ? raw.place : inferPlace(`${title} ${summary}`);
  const tags = normalizeTags(raw.tags, example);
  const id = validId(raw.id) ? raw.id : makeId(sourceUrl, title);
  const article = {
    id,
    title: truncate(title, 180),
    summary,
    source,
    sourceUrl,
    publishedAt,
    place,
    section: inferSection({ section: raw.section, id, title, summary, tags }),
    tags,
    example,
  };
  const imageUrl = cleanText(raw.imageUrl);
  // Keep only site-relative paths (e.g. images/foo.jpg), not remote URLs.
  if (
    imageUrl
    && !/^https?:\/\/|^\/\/|^\/|\.\./i.test(imageUrl)
    && !/^[a-z][a-z0-9+.-]*:/i.test(imageUrl)
  ) {
    article.imageUrl = imageUrl.replace(/^\.\//, "");
  }
  const imageCredit = cleanText(raw.imageCredit) || cleanText(raw.imageSource);
  if (imageCredit) article.imageCredit = truncate(imageCredit, 240);
  return article;
}

function mentionsPlace(article) {
  const haystack = `${article.title} ${article.summary}`.toLowerCase();
  return haystack.includes("hunnestad") || haystack.includes("grimeton");
}

function maxAgeMs() {
  const days = Number(process.env.NEWS_MAX_AGE_DAYS || 400);
  const safeDays = Number.isFinite(days) && days > 0 ? days : 400;
  return safeDays * 24 * 60 * 60 * 1000;
}

function isFresh(article, now = Date.now()) {
  const time = Date.parse(article.publishedAt);
  if (Number.isNaN(time)) return false;
  return now - time <= maxAgeMs();
}

function prefer(current, incoming) {
  if (Boolean(current.example) !== Boolean(incoming.example)) {
    return current.example ? incoming : current;
  }
  const currentTime = Date.parse(current.publishedAt);
  const incomingTime = Date.parse(incoming.publishedAt);
  if (incomingTime !== currentTime) return incomingTime > currentTime ? incoming : current;
  if ((incoming.summary || "").length !== (current.summary || "").length) {
    return incoming.summary.length > current.summary.length ? incoming : current;
  }
  return current;
}

function mergeArticles(groups) {
  const byUrl = new Map();
  const byTitle = new Map();
  const items = [];

  for (const raw of groups.flat()) {
    const article = normalizeArticle(raw);
    if (!article) continue;
    const urlKey = normUrl(article.sourceUrl);
    const titleKey = normTitle(article.title);
    const prev = (urlKey && byUrl.get(urlKey)) || byTitle.get(titleKey);
    if (!prev) {
      items.push(article);
      if (urlKey) byUrl.set(urlKey, article);
      if (titleKey) byTitle.set(titleKey, article);
      continue;
    }

    let chosen = prefer(prev, article);
    const other = chosen === prev ? article : prev;
    if (!chosen.imageUrl && other.imageUrl) chosen = { ...chosen, imageUrl: other.imageUrl };
    if (!chosen.imageCredit && other.imageCredit) chosen = { ...chosen, imageCredit: other.imageCredit };
    if (chosen !== prev) {
      const keepPreviousId = !(prev.example && !chosen.example);
      chosen = { ...chosen, id: keepPreviousId ? (prev.id || chosen.id) : (chosen.id || prev.id) };
      const index = items.indexOf(prev);
      if (index >= 0) items[index] = chosen;
      const prevUrl = normUrl(prev.sourceUrl);
      const prevTitle = normTitle(prev.title);
      if (prevUrl) byUrl.set(prevUrl, chosen);
      if (prevTitle) byTitle.set(prevTitle, chosen);
    }
    if (urlKey) byUrl.set(urlKey, items.includes(chosen) ? chosen : (byUrl.get(urlKey) || chosen));
    if (titleKey) byTitle.set(titleKey, chosen === prev ? prev : chosen);
  }

  return items;
}

function sortAndCap(list) {
  return [...list].sort((a, b) => {
    const delta = Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    if (delta) return delta;
    return a.title.localeCompare(b.title, "sv");
  }).slice(0, MAX_ITEMS);
}

function toJsonShape(article) {
  const shaped = {
    id: article.id,
    title: article.title,
    summary: article.summary,
    source: article.source,
    sourceUrl: article.sourceUrl,
    publishedAt: article.publishedAt,
    place: article.place,
    section: article.section,
  };
  if (article.tags?.length) shaped.tags = article.tags;
  if (article.example) shaped.example = true;
  if (article.imageUrl) shaped.imageUrl = article.imageUrl;
  if (article.imageCredit) shaped.imageCredit = article.imageCredit;
  return shaped;
}

function validate(list) {
  if (!Array.isArray(list)) throw new Error("news.json ska vara en array.");
  if (list.length > MAX_ITEMS) throw new Error("För många artiklar.");
  const ids = new Set();
  for (let index = 0; index < list.length; index += 1) {
    const article = list[index];
    for (const key of ["id", "title", "summary", "source", "sourceUrl", "publishedAt", "place"]) {
      if (typeof article[key] !== "string" || !article[key].trim()) {
        throw new Error(`Artikel ${index} saknar ${key}.`);
      }
    }
    if (!PLACES.has(article.place)) throw new Error(`Ogiltig ort: ${article.place}`);
    if (article.section !== undefined && !SECTIONS.has(article.section)) {
      throw new Error(`Ogiltig sektion i ${article.id}.`);
    }
    if (!/^https?:\/\//i.test(article.sourceUrl)) throw new Error(`Ogiltig länk i ${article.id}.`);
    if (Number.isNaN(Date.parse(article.publishedAt))) throw new Error(`Ogiltigt datum i ${article.id}.`);
    if (ids.has(article.id)) throw new Error(`Dubblett av id ${article.id}.`);
    ids.add(article.id);
    if (article.tags && !article.tags.every((tag) => typeof tag === "string")) {
      throw new Error(`Ogiltiga taggar i ${article.id}.`);
    }
    if (article.example !== undefined && article.example !== true) {
      throw new Error(`example ska vara true eller utelämnas (${article.id}).`);
    }
    if (index > 0 && Date.parse(article.publishedAt) > Date.parse(list[index - 1].publishedAt)) {
      throw new Error("Listan är inte sorterad med nyast först.");
    }
  }
}

function chooseProvider() {
  const available = [];
  if (process.env.TAVILY_API_KEY) available.push("tavily");
  if (process.env.SERPER_API_KEY) available.push("serper");
  if (process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY) available.push("brave");
  if (process.env.NEWS_API_KEY || process.env.NEWSAPI_KEY) available.push("newsapi");

  const requested = (process.env.NEWS_PROVIDER || "").trim().toLowerCase();
  if (requested) {
    if (!available.includes(requested)) {
      throw new Error(`NEWS_PROVIDER=${requested} men motsvarande API-nyckel saknas.`);
    }
    return { provider: requested, available };
  }
  return { provider: available[0] || null, available };
}

async function getJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20000),
    headers: {
      Accept: "application/json",
      "User-Agent": "hunnestad-grimeton-nyheter/1.0",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${safeError(text).slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Svaret var inte JSON.");
  }
}

async function searchTavily(query) {
  const days = Math.min(Math.round(maxAgeMs() / (24 * 60 * 60 * 1000)), 365);
  const data = await getJson("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      topic: "news",
      search_depth: "basic",
      days,
      max_results: 8,
      include_answer: false,
      include_raw_content: false,
    }),
  });
  return (data.results || []).map((item) => ({
    title: item.title,
    summary: item.content,
    sourceUrl: item.url,
    source: hostLabel(item.url),
    publishedAt: item.published_date,
    tags: inferTags(`${item.title || ""} ${item.content || ""}`),
  }));
}

async function searchSerper(query) {
  const data = await getJson("https://google.serper.dev/news", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": process.env.SERPER_API_KEY,
    },
    body: JSON.stringify({ q: query, gl: "se", hl: "sv", num: 10 }),
  });
  return (data.news || []).map((item) => ({
    title: item.title,
    summary: item.snippet,
    sourceUrl: item.link,
    source: item.source,
    publishedAt: item.date,
    tags: inferTags(`${item.title || ""} ${item.snippet || ""}`),
  }));
}

async function searchBrave(query) {
  const url = new URL("https://api.search.brave.com/res/v1/news/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "10");
  url.searchParams.set("search_lang", "sv");
  url.searchParams.set("country", "SE");
  const token = process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY;
  const data = await getJson(url, {
    headers: { "X-Subscription-Token": token },
  });
  return (data.results || []).map((item) => ({
    title: item.title,
    summary: item.description,
    sourceUrl: item.url,
    source: item.meta_url?.hostname || hostLabel(item.url),
    publishedAt: item.page_age || item.age,
    tags: inferTags(`${item.title || ""} ${item.description || ""}`),
  }));
}

async function searchNewsApi(query) {
  const key = process.env.NEWS_API_KEY || process.env.NEWSAPI_KEY;
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", query);
  url.searchParams.set("searchIn", "title,description");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("language", "sv");
  const from = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  url.searchParams.set("from", from.toISOString().slice(0, 10));
  url.searchParams.set("apiKey", key);
  const data = await getJson(url);
  if (data.status && data.status !== "ok") throw new Error(data.message || "NewsAPI-fel");
  return (data.articles || []).map((item) => ({
    title: item.title,
    summary: item.description,
    sourceUrl: item.url,
    source: item.source?.name,
    publishedAt: item.publishedAt,
    tags: inferTags(`${item.title || ""} ${item.description || ""}`),
  }));
}

async function searchQuery(provider, query) {
  if (provider === "tavily") return searchTavily(query);
  if (provider === "serper") return searchSerper(query);
  if (provider === "brave") return searchBrave(query);
  if (provider === "newsapi") return searchNewsApi(query);
  throw new Error(`Okänd källa: ${provider}`);
}

async function search(provider) {
  const found = [];
  const errors = [];
  for (const query of QUERIES) {
    try {
      found.push(...await searchQuery(provider, query));
    } catch (err) {
      errors.push(err);
      console.error(`Sökningen "${query}" misslyckades: ${safeError(err)}`);
    }
  }
  if (!found.length && errors.length) throw errors[0];
  const normalized = found.map(normalizeArticle).filter(Boolean);
  const relevant = normalized.filter(mentionsPlace).filter((article) => isFresh(article));
  const dropped = found.length - relevant.length;
  if (dropped > 0) {
    console.log(`Hoppade över ${dropped} träffar utan tydlig koppling, datum eller giltig länk.`);
  }
  return relevant;
}

async function readNews() {
  let text;
  try {
    text = await readFile(newsPath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return { articles: [], raw: null };
    throw err;
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("data/news.json är inte giltig JSON. Filen lämnas orörd.");
  }
  if (!Array.isArray(data)) {
    throw new Error("data/news.json ska vara en JSON-array. Filen lämnas orörd.");
  }

  const articles = [];
  for (const item of data) {
    const article = normalizeArticle(item);
    if (!article) {
      throw new Error("En post i data/news.json saknar obligatoriska fält. Filen lämnas orörd.");
    }
    articles.push(article);
  }
  return { articles, raw: text };
}

async function writeNews(raw, shaped) {
  const next = `${JSON.stringify(shaped, null, 2)}\n`;
  if (raw === next) {
    console.log("Ingen ändring i data/news.json.");
    return;
  }
  await mkdir(dirname(newsPath), { recursive: true });
  const tmp = `${newsPath}.tmp`;
  await writeFile(tmp, next, "utf8");
  await rename(tmp, newsPath);
  console.log(`Skrev ${shaped.length} artiklar till data/news.json.`);
}

function hasReal(articles) {
  return articles.some((article) => !article.example);
}

async function main() {
  console.log("Hunnestad & Grimeton — uppdaterar nyheter");
  const { articles: existing, raw } = await readNews();
  let choice;
  try {
    choice = chooseProvider();
  } catch (err) {
    console.error(safeError(err));
    process.exitCode = 1;
    return;
  }

  const { provider, available } = choice;
  let incoming = [];
  let liveOk = false;

  if (!provider) {
    console.log("Ingen API-nyckel är satt (TAVILY_API_KEY, SERPER_API_KEY, BRAVE_SEARCH_API_KEY eller NEWS_API_KEY).");
    console.log("Utan nyckel söker skriptet inte. Exempel läggs bara in om det saknas riktiga artiklar.");
  } else {
    if (available.length > 1) {
      console.log(`Flera API-nycklar är satta. Använder ${PROVIDER_LABEL[provider]}. Sätt NEWS_PROVIDER för att välja.`);
    } else {
      console.log(`Söker via ${PROVIDER_LABEL[provider]} …`);
    }
    try {
      incoming = await search(provider);
      liveOk = true;
      console.log(`Hittade ${incoming.length} relevanta artiklar.`);
      for (const article of sortAndCap(incoming)) {
        console.log(` · ${article.publishedAt.slice(0, 10)} ${article.place}: ${article.title}`);
      }
    } catch (err) {
      console.error(`Sökningen misslyckades: ${safeError(err)}`);
      if (hasReal(existing)) {
        console.error("Behåller data/news.json oförändrad.");
        process.exitCode = 1;
        return;
      }
      console.error("Filen har inga riktiga artiklar. Fyller på med exempel i stället.");
    }
  }

  let merged;
  if (liveOk && incoming.length > 0) {
    merged = mergeArticles([existing, incoming]).filter((article) => !article.example);
    console.log("Tog bort eventuella exempelartiklar.");
  } else if (liveOk) {
    const real = existing.filter((article) => !article.example);
    if (real.length) {
      console.log("Inga nya träffar. Behåller de artiklar som redan finns.");
      merged = real;
    } else {
      console.log("Inga träffar. Lägger in exempelartiklar så att sidan inte är tom.");
      merged = mergeArticles([existing, SEEDS]);
    }
  } else if (hasReal(existing)) {
    console.log("Utan lyckad sökning lämnas riktiga artiklar orörda.");
    merged = existing.filter((article) => !article.example);
  } else {
    console.log("Lägger in exempelartiklar märkta som exempel.");
    merged = mergeArticles([existing.filter((article) => article.example), SEEDS]);
  }

  const shaped = sortAndCap(merged).map(toJsonShape);
  validate(shaped);
  await writeNews(raw, shaped);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runSelfTest() {
  const now = Date.parse("2026-10-02T12:00:00Z");
  assert(SEEDS.length >= 6, "för få exempel");
  for (const seed of SEEDS) {
    const article = normalizeArticle(seed);
    assert(article, `exempel ogiltigt: ${seed.id}`);
    assert(article.example === true, "exempel ska vara märkt");
    assert(article.summary.startsWith("Exempel."), "sammanfattning ska säga Exempel");
    assert(PLACES.has(article.place), "ogiltig ort i exempel");
  }

  assert(inferPlace("Möte i Hunnestad") === "Hunnestad", "ort Hunnestad");
  assert(inferPlace("Tornen i Grimeton") === "Grimeton", "ort Grimeton");
  assert(inferPlace("Hunnestad och Grimeton") === "Båda", "ort båda");
  assert(inferPlace("Bara Varberg") === "Varberg", "ort Varberg");

  const duplicateTitle = mergeArticles([
    [{ ...SEEDS[0], id: "a" }],
    [{ ...SEEDS[0], id: "b", sourceUrl: "https://example.com/annan" }],
  ]);
  assert(duplicateTitle.length === 1, "samma titel ska slås ihop");

  const duplicateUrl = mergeArticles([
    [{ ...SEEDS[1], title: "Första rubriken om Hunnestad byalag" }],
    [{ ...SEEDS[1], title: "Andra rubriken om Hunnestad byalag är längre", publishedAt: "2026-09-27T11:00:00+02:00" }],
  ]);
  assert(duplicateUrl.length === 1, "samma länk ska slås ihop");
  assert(duplicateUrl[0].title.includes("Andra"), "nyare post vinner vid samma länk");

  const realWins = mergeArticles([
    [SEEDS[2]],
    [{
      title: SEEDS[2].title,
      summary: "En riktig notis om loppis mellan Hunnestad och Grimeton.",
      source: "Hallands Nyheter",
      sourceUrl: "https://www.hn.se/loppis-exempel",
      publishedAt: "2026-09-20T09:00:00+02:00",
      place: "Båda",
    }],
  ]);
  assert(realWins.length === 1 && realWins[0].example === false, "riktig artikel ersätter exempel");

  const many = [];
  for (let index = 0; index < 34; index += 1) {
    const day = String((index % 27) + 1).padStart(2, "0");
    many.push({
      id: `n${index}`,
      title: `Nyhet nummer ${index} från Grimeton`,
      summary: "Kort notis från Grimeton.",
      source: "Test",
      sourceUrl: `https://example.org/nyhet-${index}`,
      publishedAt: `2026-09-${day}T08:00:00+02:00`,
      place: "Grimeton",
    });
  }
  const capped = sortAndCap(many.map(normalizeArticle));
  assert(capped.length === 30, "max 30");
  assert(Date.parse(capped[0].publishedAt) >= Date.parse(capped[29].publishedAt), "nyast först");

  const fresh = isFresh({ publishedAt: "2026-09-01T00:00:00Z" }, now);
  const stale = isFresh({ publishedAt: "2024-01-01T00:00:00Z" }, now);
  assert(fresh && !stale, "åldersfilter");

  const shaped = toJsonShape(normalizeArticle(SEEDS[0]));
  assert(
    JSON.stringify(Object.keys(shaped)) === JSON.stringify([
      "id", "title", "summary", "source", "sourceUrl", "publishedAt", "place", "section", "tags", "example",
    ]),
    "fältordning",
  );
  assert(shaped.section === "Samhälle", "exempel utan tydlig sektion blir Samhälle");

  const sport = normalizeArticle({
    id: "grimeton-ik-serieseger-div6-2026",
    title: "Grimeton IK seriesegrare – klart för division 5",
    summary: "Grimeton IK är seriesegrare i division 6.",
    source: "Test",
    sourceUrl: "https://example.org/grimeton-ik",
    publishedAt: "2026-09-26T18:21:00+02:00",
    place: "Grimeton",
    tags: ["förening", "sport"],
  });
  assert(sport.section === "Sport", "Grimeton IK ska vara Sport");

  const bolag = normalizeArticle({
    id: "hn-hunnestad-bostad-ab-2026",
    title: "Hunnestad Bostad AB registrerat",
    summary: "Bolaget registrerades hos Bolagsverket.",
    source: "Hallands Nyheter",
    sourceUrl: "https://www.hn.se/exempel-ab",
    publishedAt: "2026-04-20T08:00:00+02:00",
    place: "Hunnestad",
    tags: ["kommun"],
  });
  assert(bolag.section === "Ekonomi och Företag", "AB och Bolagsverket är Ekonomi och Företag");

  const bygd = normalizeArticle({
    id: "hn-ledare-grimeton-omradesbestammelser-2026",
    title: "Unik anläggning kräver ett unikt samarbete",
    summary: "Kommun, radiostation, lantbruk och företag måste hitta en gemensam lösning i Grimeton.",
    source: "Hallands Nyheter",
    sourceUrl: "https://www.hn.se/exempel-ledare",
    publishedAt: "2026-05-19T08:00:00+02:00",
    place: "Grimeton",
    tags: ["världsarv", "kommun"],
  });
  assert(bygd.section === "Samhälle", "samarbete och företag i löptext är inte företagssida");

  const biljett = normalizeArticle({
    id: "grimeton-biljettshop-storningar-2026",
    title: "Biljettshopen strular – världsarvet öppet som vanligt",
    summary: "Utställningar och visningar fungerar i Grimeton.",
    source: "Världsarvet Grimeton",
    sourceUrl: "https://grimeton.org/",
    publishedAt: "2026-09-30T15:00:00+02:00",
    place: "Grimeton",
    tags: ["världsarv"],
  });
  assert(biljett.section === "Samhälle", "världsarv utan kulturtagg stannar i Samhälle");

  const explicit = normalizeArticle({
    ...SEEDS[0],
    section: "Kultur",
  });
  assert(explicit.section === "Kultur", "satt sektion ska behållas");
  console.log("Självtestet gick igenom.");
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (process.argv.includes("--self-test")) {
  try {
    runSelfTest();
  } catch (err) {
    console.error(safeError(err));
    process.exitCode = 1;
  }
} else if (isDirectRun()) {
  main().catch((err) => {
    console.error(safeError(err));
    process.exitCode = 1;
  });
}
