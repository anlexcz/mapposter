# MapPoster Studio

Webový generátor minimalistických mapových plakátů se zvýrazněním železničních a tramvajových kolejí.

## Aktuální funkce (MVP)
- Vyhledání míst pomocí Nominatim / OpenStreetMap.
- Interaktivní lokalizační mapka s přetažením, přiblížením a vyznačeným výřezem plakátu.
- Načtení skutečných kolejí, silnic a budov z Overpass API (s náhradním endpointem).
- Tmavý/světlý styl, volitelné barvy, vrstvy, natočení, záběr a poměr stran.
- Editace názvu a podtitulu, zobrazení souřadnic.
- Export do SVG a PNG (2400 px na šířku).
- Responzivní editor bez backendu.

## Spuštění
Statické HTML/CSS/JS: otevřete web přes lokální HTTP server, například `python -m http.server 8080` a `http://localhost:8080`. Pro běh v produkci použijte GitHub Pages.

## Publikace
Workflow `.github/workflows/pages.yml` nasazuje větev `main` do GitHub Pages. V nastavení repozitáře **Settings → Pages → Build and deployment → Source** vyberte **GitHub Actions**.

Po publikaci: https://anlexcz.github.io/mapposter/

## Omezení a další kroky
- Nyní se zvýrazňují všechny železniční a tramvajové cesty ve zvoleném záběru; ruční výběr jednotlivých kolejí ještě není implementován.
- Přesnost dat závisí na OpenStreetMap. Rozsáhlé oblasti mohou překročit limity Overpass API; API může být dočasně nedostupné.
- Přetažení lokální mapky změní souřadnice plakátu a po krátké prodlevě načte nová data. Rozsah červeného rámečku je orientační; skutečný výřez zohledňuje i případné natočení plakátu.
- Export SVG používá systémové náhradní fonty, pokud není instalován Barlow Condensed; plné vložení fontů do SVG není hotové.
- Tiskové PDF a ukládání projektů budou následovat později.
- Aplikace neposílá vybraná místa na vlastní server, ale komunikuje s veřejnými službami Nominatim a Overpass. Respektujte jejich provozní a rate-limit zásady.

## Data a licence
Mapová data © [přispěvatelé OpenStreetMap](https://www.openstreetmap.org/copyright), [ODbL](https://opendatacommons.org/licenses/odbl/). Aplikace musí zachovat atribuci v exportech. Vlastní kód pod licencí repozitáře.
