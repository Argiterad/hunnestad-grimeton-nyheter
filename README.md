# Supernytt Grimeton & Hunnestad

Det här är en designmall för en statisk lokaltidning. Rubriker, ingresser, bylines, tider, väder och bilder är platshållare, inte publicerade nyheter. Innehållet ska kunna bytas senare utan att layouten ändras.

Sidorna ligger i roten och publiceras med GitHub Pages: <https://argiterad.github.io/hunnestad-grimeton-nyheter/>

`data/news.json` driver inte längre sidan.

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
