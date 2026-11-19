# MapPoster Studio

Webový generátor minimalistických mapových plakátů se zvýrazněním železničních a tramvajových kolejí.

## Aktuální funkce (MVP)
- Vyhledání míst pomocí Nominatim / OpenStreetMap.
- Interaktivní lokalizační mapka a přímé posouvání mapové části plakátu myší či prstem; kolečko myši nebo tlačítka ± mění přiblížení.
- Načtení skutečných kolejí, silnic a budov jedním dotazem Overpass API, se třemi záložními servery, timeouty a stavovou diagnostikou.
- Tmavý/světlý styl, volitelné barvy, vrstvy, natočení, záběr a poměr stran.
- Editace názvu a podtitulu, zobrazení souřadnic.
- Export do SVG a PNG (2400 px na šířku), povolený jen po získání geografických dat.
- Responzivní editor bez backendu.

## Spuštění
Statické HTML/CSS/JS: otevřete web přes lokální HTTP server, například `python -m http.server 8080` a `http://localhost:8080`. Pro běh v produkci použijte GitHub Pages.

## Publikace
Workflow `.github/workflows/pages.yml` nasazuje větev `main` do GitHub Pages. V nastavení repozitáře **Settings → Pages → Build and deployment → Source** vyberte **GitHub Actions**.

Po publikaci: https://anlexcz.github.io/mapposter/

## Omezení a další kroky
- Nyní se zvýrazňují všechny železniční a tramvajové cesty ve zvoleném záběru; ruční výběr jednotlivých kolejí ještě není implementován.
- Přesnost dat závisí na OpenStreetMap. Rozsáhlé oblasti mohou překročit limity Overpass API; API může být dočasně nedostupné.
- Přetažení plakátu nebo lokalizační mapky změní souřadnice výřezu a po krátké prodlevě načte nová data. Rozsah červeného rámečku je orientační; skutečný výřez zohledňuje i případné natočení plakátu.
- Načítání Overpass je rozděleno do rychlejšího dotazu pro koleje a samostatného dotazu pro budovy/ulice, s náhradními servery a chybovým stavem. Při výpadku všech veřejných serverů mapa nemůže být vykreslena.
- Export SVG používá systémové náhradní fonty, pokud není instalován Barlow Condensed; plné vložení fontů do SVG není hotové.
- Tiskové PDF a ukládání projektů budou následovat později.
- Aplikace neposílá vybraná místa na vlastní server, ale komunikuje s veřejnými službami Nominatim a Overpass. Respektujte jejich provozní a rate-limit zásady.
- Úspěšné dotazy se dočasně uchovávají v paměti pro posouvání a přiblížení v již načtené oblasti. Veřejná API mohou být nedostupná; žádná data se v takovém případě nevymýšlejí.

## Testování
Offline testy běží přes \`node --test tests/*.test.cjs\`. Kontrolují vykreslení modelových OSM geometrických dat, cache, přepnutí záložního serveru a chybové stavy. Jsou součástí GitHub Actions před nasazením. Neověřují dostupnost živých serverů Overpass.

## Data a licence
Mapová data © [přispěvatelé OpenStreetMap](https://www.openstreetmap.org/copyright), [ODbL](https://opendatacommons.org/licenses/odbl/). Aplikace musí zachovat atribuci v exportech. Vlastní kód pod licencí repozitáře.
