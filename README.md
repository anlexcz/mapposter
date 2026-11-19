# MapPoster Studio 2.0

Interaktivní generátor mapových plakátů. Pětikrokový průvodce a živý náhled mapy přímo v plakátu.

## Stack
- React 19 + TypeScript + Vite
- MapLibre GL JS
- OpenFreeMap vector tiles, založené na datech OpenStreetMap
- GitHub Pages (statický web, bez backendu)

## Wizard
1. **Lokalita:** vyhledání v Nominatim, kliknutím na výsledek přejde mapa na místo
2. **Kompozice:** poměr stran 2:3, 3:4, 1:1; přiblížení, otočení a posunutí přímo na mapě
3. **Mapové vrstvy:** přepínače kolejí, silnic, budov a popisků
4. **Vzhled:** dark/light, barva zvýraznění, nadpis a podtitulek
5. **Export:** aktuální mapový výřez + textové prvky do PNG

Nastavení se automaticky ukládá do localStorage.

## Spuštění
```bash
npm install
npm run dev
npm run build
```
Nasazení GitHub Pages zajišťuje `.github/workflows/pages.yml` (build do `dist/`).

## Omezení
- Živé mapové dlaždice vyžadují internet a WebGL. Při nedostupnosti zdroje se zobrazí stav načítání.
- Vyhledávání používá Nominatim a mělo by se používat šetrně, bez automatického dotazování při každém stisku klávesy.
- Zvýraznění kolejí závisí na obsahu vektorových dlaždic OpenFreeMap. Detail odstavných kolejí nemusí být v každé úrovni přiblížení dostupný.
- **Export je zatím PNG**, nikoli skutečně vektorové SVG ani PDF.
- PNG export skládá živý WebGL canvas a texty do 1600px plátna; podklad z mapy je zvětšen z rozlišení aktuálního náhledu.
- Není zde záložní samostatný server a data se nevyžadují přes Overpass API.
- Textový export používá dostupné webové fonty s náhradními systémovými fonty.
- Copyright: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), data ODbL. Připsání je součástí plakátu.

## Stav
První funkční implementace wizardu. Před produkčním použitím ověřit běh GitHub Actions a export PNG v prohlížeči.
