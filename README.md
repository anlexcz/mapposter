# MapPoster Studio 3.0

Generátor mapových plakátů s průvodcem v pěti krocích. Zdrojový kód je veřejný, nasazuje se přes GitHub Pages.

## Architektura

- React + Vite, MapLibre GL JS
- Vektorový podklad OpenFreeMap ve stylu Liberty nebo Bright
- Žádné požadavky na Overpass API a žádné plošné přepisování všech vrstev podkladu
- Možnost zvýraznění kolejí jednoduchou doplňkovou vrstvou (pokud jsou potřebné informace ve vector tiles)
- Výběr lokality přes Nominatim, ruční posouvání a přiblížení přímo na mapě uvnitř plakátu
- Samostatný textový a barevný rám plakátu
- Export PNG ze současného WebGL náhledu (není to vektorový export)
- Automatické ukládání nastavení lokálně v prohlížeči do `mapposter-clean-v3`

## Spuštění

```bash
npm install
npm run dev
npm run build
```

Build vytváří složku `dist` a GitHub Actions ji publikuje na GitHub Pages. V repozitáři musí být v Settings → Pages nastaveno **Source: GitHub Actions**.

## Průvodce

1. Lokalita – vyhledávání místa nebo přímé posouvání mapy
2. Kompozice – formát, zoom, natočení
3. Vrstvy – výchozí mapový styl a volitelné zvýraznění kolejí
4. Vzhled – Anlex červená, barva pozadí plakátu a texty
5. Export – PNG

## Co ještě není hotové

- Detailní selektor jednotlivých kolejí a zaručeně úplná geometrie vozoven
- Plně černobílá mapa v původním plakátovém stylu
- Tiskově přesný SVG nebo PDF export
- Nezávislý render mapy ve vysokém rozlišení: PNG používá aktuální WebGL viewport, který je při exportu zvětšen
- Automatické integrační testy s živými geografickými dlaždicemi

Při potížích s načtením mapy lze zobrazit diagnostický stav přímo uvnitř plakátu a zkusit načtení znovu.

## Mapová data

© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL). Mapové dlaždice z veřejné infrastruktury OpenFreeMap. Vyhledávání Nominatim je určené k příležitostnému použití, nikoli k automatickému dotazování při každém stisku klávesy.
