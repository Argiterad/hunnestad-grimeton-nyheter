# Hunnestad & Grimeton Nyheter

En liten statisk nyhetssida för Hunnestad och Grimeton i Varbergs kommun. Nyast först, med filter för Hunnestad, Grimeton och alla orter. En bot kan uppdatera `data/news.json` en gång om dagen.

Sidan är vanlig HTML, CSS och JavaScript. Den behöver ingen server när den väl är publicerad.

## Köra lokalt

Kräver Node.js 18 eller nyare.

```bash
npm install
npm run dev
```

Öppna adressen som Vite skriver ut, oftast [http://localhost:5173](http://localhost:5173). Öppna inte `index.html` som fil i webbläsaren. Då kan listan inte läsa `data/news.json`.

Andra kommandon:

```bash
npm run update-news
npm run build
npm run preview
```

`npm run build` skriver en färdig sajt till `dist/`, inklusive `data/news.json`. `npm run preview` visar den byggda sajten.

Uppdateringsskriptet har inga egna paket. Det går att köra med `node scripts/update-news.mjs` även utan `npm install`.

## Så uppdateras nyheterna

Artiklarna ligger i `data/news.json`. Det är en array. Varje post har:

| Fält | Betydelse |
| --- | --- |
| `id` | Stabilt id |
| `title` | Rubrik |
| `summary` | Kort sammanfattning |
| `source` | Källans namn |
| `sourceUrl` | Länk till artikeln |
| `publishedAt` | Datum i ISO-format |
| `place` | `Hunnestad`, `Grimeton`, `Varberg` eller `Båda` |
| `tags` | Valfria etiketter |
| `example` | `true` om posten är påhittad exempeltext |

`npm run update-news` läser filen, söker efter nya träffar, slår ihop dubbletter och skriver tillbaka högst 30 artiklar. Nyast hamnar först. Samma `sourceUrl` eller samma rubrik räknas som dubblett. Riktiga artiklar behålls framför exempel.

Sökningen använder den första nyckel som finns, i den här ordningen:

1. `TAVILY_API_KEY` (Tavily)
2. `SERPER_API_KEY` (Serper, Google News)
3. `BRAVE_SEARCH_API_KEY` eller `BRAVE_API_KEY` (Brave)
4. `NEWS_API_KEY` eller `NEWSAPI_KEY` (NewsAPI)

Sätt `NEWS_PROVIDER` till `tavily`, `serper`, `brave` eller `newsapi` om flera nycklar finns och du vill välja. `NEWS_MAX_AGE_DAYS` styr hur gamla träffar som behålls. Standard är 400 dagar. NewsAPI:s gratiskonto når bara ungefär en månad bakåt. Det är en gräns hos dem, inte hos sidan.

Utan nyckel söker skriptet inte. Om filen saknar riktiga artiklar fylls den med åtta påhittade exempel, tydligt märkta. Datum på exemplen är fasta, så att en ny körning utan nyckel inte ändrar filen igen. Exemplen tas bort så fort en riktig sökning ger träffar.

Kontrollera skriptet utan att skriva filen:

```bash
node scripts/update-news.mjs --self-test
```

## Daglig rutin för en Grok-bot

Boten ska köra en gång per dygn, i arkivets rot. Den ska inte ändra andra filer än `data/news.json`.

1. Hämta senaste koden.
2. Sätt en söknyckel i miljön. Utan nyckel blir det bara exempel, och bara om det inte redan finns riktiga artiklar.
3. Kör `npm run update-news`.
4. Om `data/news.json` har ändrats: committa just den filen och pusha till grenen som publiceras, oftast `main`.

```bash
cd /väg/till/hunnestad-grimeton-nyheter
git pull --ff-only
export TAVILY_API_KEY="..."   # eller SERPER_API_KEY, BRAVE_SEARCH_API_KEY, NEWS_API_KEY
npm run update-news
git add data/news.json
if ! git diff --cached --quiet; then
  git commit -m "Uppdatera nyheter"
  git push
fi
```

Samma rutin finns som GitHub Action i `.github/workflows/daglig-uppdatering.yml`. Den körs 05:15 UTC (cirka 07:15 svensk sommartid och 06:15 svensk normaltid) och kan också startas för hand. Lägg nyckeln som en Actions-hemlighet med något av namnen ovan. Action behöver rätt att skriva till arkivet (`contents: write`). På en skyddad gren måste actions få skapa commits.

## Publicera

Enklast är att publicera arkivets rot. Då behövs inget byggsteg, och boten kan uppdatera den levande sidan genom att bara committa `data/news.json`.

GitHub Pages:

1. Pusha till GitHub.
2. Under Settings → Pages, välj Deploy from a branch.
3. Välj grenen `main` och mappen `/` (root).
4. Spara. Efter någon minut ligger sidan på `https://<användare>.github.io/<repo>/`.

Filen `.nojekyll` finns så att Pages inte kör Jekyll och hoppar över filer.

Vill du i stället publicera byggresultatet:

```bash
npm run build
```

Ladda upp innehållet i `dist/` till vilken statisk värd som helst (GitHub Pages via Actions, Netlify, Cloudflare Pages eller en vanlig webbmapp). Relativa sökvägar gör att sidan fungerar både på en egen domän och i en undermapp.

## Kod och källor

Koden till sidan får användas fritt. Nyhetstexterna tillhör respektive källa. Sidan återpublicerar inte hela artiklar, bara rubrik, kort sammanfattning och länk.
