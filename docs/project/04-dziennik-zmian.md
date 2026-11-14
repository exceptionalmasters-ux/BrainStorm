# Dziennik zmian

Najnowsze na górze.

## 2026-11-14 (motyw i branding)

- Nowa paleta ciemnego motywu w `app/globals.css`: czarne tło, złoty kolor akcji głównych (`--primary`), zielone akcenty w stylu Matrix (obramowania, podświetlenie zmian AI, sukces). Płótno rysunku pozostaje białe. Motyw jasny bez zmian.
- Ciemny motyw jest teraz domyślny (`stores/settings-store.ts` i skrypt `THEME_INIT_SCRIPT`). Wybór użytkownika w ustawieniach (jasny, ciemny, systemowy) nadal działa i jest zapamiętywany.
- Tło wokół arkusza w draw.io w trybie ciemnym ustawione na czerń (`lib/drawio/drawio-config.ts`, `DRAWIO_CSS`).
- Okrojona paleta kształtów draw.io: `defaultLibraries` = general, basic, arrows2, flowchart, electrical. Identyfikatory bibliotek nie zostały jeszcze sprawdzone na dołączonej kopii draw.io.
- Zmieniono nazwę aplikacji na BrainStorm w powłoce aplikacji (manifest, tytuły, strona startowa, pasek startowy). Strony marketingowe oryginału (about, docs, mcp, teksty galerii) zostają bez zmian do osobnego porządkowania.
- Nie uruchamiano buildu ani testów. Sprawdzono tylko składnię zmienionych plików TypeScript. Testy e2e mogą zakładać wcześniejszy domyślny motyw systemowy i wymagają przeglądu przy pierwszym uruchomieniu.

## 2026-11-14

- Wgrano kod bazowy next-ai-draw-io (commit 9534a668e3bd53f9c08aa5b8d2d77f409ccd09d4, wersja 0.5.1) do gałęzi `dev`.
- Oryginalny README przeniesiono do `docs/upstream/README.md`, dodano nowy README, NOTICE i CLAUDE.md (zasady pracy).
- Usunięto workflowy GitHub Actions dotyczące publikacji i wydań oryginału (publish-mcp, publish-dsh, electron-release, docker-build, wait-for-confirmation, auto-format) oraz FUNDING.yml. Zostawiono `test.yml` i rozszerzono go o gałąź `dev`.
- Zmieniono nazwę workera Cloudflare na `brainstorm-worker` w `wrangler.jsonc`.
- Założono dokumentację projektu w `docs/project/`.
- Nie uruchamiano buildu ani testów (w środowisku pracy instalacja pakietów jest zablokowana). Weryfikacja przy pierwszym buildzie na Cloudflare lub lokalnie.
