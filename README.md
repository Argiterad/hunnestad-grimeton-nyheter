# Supernytt Grimeton & Hunnestad

Lokala nyheter för Grimeton och Hunnestad. Startsida, sektioner och artiklar läses från `data/news.json`. Väder och programtider är fortfarande platshållare. Utseendet är fast.

Sidorna ligger i roten och publiceras med GitHub Pages: <https://argiterad.github.io/hunnestad-grimeton-nyheter/>

`data/news.json` driver ledare, puffar, sektionslistor och artikelsidan (`artikel.html?id=...`). På stor skärm öppnas samma notis i panelen.

## Köra lokalt

Kräver Node.js 18 eller nyare.

```bash
npm install
npm run dev
```

`npm run build` skriver en kopia till `dist/`. Publiceringen använder filerna i roten, med `base: './'`.

## Sidor

- Startsida, med artikel som egen adress och som panel på stor skärm
- Artikel
- Samhälle, Ekonomi och Företag, Sport, Kultur (samma sektionsmall)
- Program
- Om redaktionen, annonsera, integritet

Tips och redaktionskontakt går bara till matsbotsson@gmail.com.
