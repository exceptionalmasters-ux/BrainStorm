# Dziennik zmian

Najnowsze na górze. Starsze wpisy zachowują historyczne ograniczenia i wyniki.

## 2026-11-17 — editor refinements (issue #19)

- Assistant opens on Operations launch, including Skip Brief; no automatic AI request.
- Desktop primary drawing controls move beside the menus; phone controls retain their current location. Rectangle/Ellipse shortcuts are removed, Freehand uses a pencil and Diagram is last.
- View options are consolidated in the menu. Line colour/style/width share a control; native transactions retain undo.
- File → Exit discards unsaved open documents without requesting Save. Already submitted/completed saves are not rolled back. Browsers that reject window.close show a closed-editor screen.
- EMC library uses symbol previews and short model labels, click insertion and pointer drag placement; rail icon reads EM.
- Black-and-white brain app icon, with Lucide ISC attribution. Duplicate chat title/rename menu removed; the main header retains the title menu.
- Connection control shows Connected / Reconnect EMC / Connecting, with a reconnect action beside connection errors. Valid short-lived access is not rejected 30 seconds early; expired access still requires secure renewal. Tab visibility does not clear the drawing or authentication. Actual backend session/permission checks remain authoritative.
- Drawing guidelines remain deferred. Automated tests use mocked network boundaries; live authenticated tab-switch/expiry behaviour still needs acceptance.

## 2026-11-17 — main i aktualizacja planu

- Pełna historia dev przeniesiona do main bez zmiany plików aplikacji.
- Właściciel potwierdził przełączenie gałęzi produkcyjnej Cloudflare na main.
- Pusty commit 62e8ded wywołał udany Workers Build; GitHub Actions #44125078627 zakończył się sukcesem.
- Plan i README opisują wdrożone AI, prywatne dokumenty, symbole, bezpośredni transport i niezależne sesje.
- Scenariusze rzeczywistej akceptacji pozostają do wykonania; nie są zastępowane przez testy z atrapami sieci.
- Własna domena pozostaje opcjonalna. Wspólna edycja nadal odłożona.

## 2026-11-15 — document tabs and Operations integration

- Internal bottom document tabs replace browser popups; phone Canvas/Chat footer removed, assistant remains in the header.
- Independent document frames preserve undo, chat and unsent drafts while switching.
- Operations bridge adds authenticated private Storage persistence with optimistic revisions and explicit save/close acknowledgement.
- API access uses existing Operations membership/MFA; read-only workspaces and revoked access are enforced by the database.
- Supabase schema deployed and verified; frontend activation still requires the actual Cloudflare editor URL and deployment variables. See `09-operations-integration.md` for validation and limits.


## 2026-11-14 (model AI i narzędzia draw.io)

- `env.example` ustawiony pod OpenAI: `AI_PROVIDER=openai`, `AI_MODEL=gpt-5.4,gpt-5.4-mini` (pierwszy to domyślny, drugi trafia do wyboru modelu), pusty `OPENAI_API_KEY`. Dodano uwagi: klucz tylko po stronie serwera, `ACCESS_CODE_LIST` do ustawienia przed udostępnieniem aplikacji w internecie.
- Sprawdzono, że kod bazowy już daje modelowi narzędzia draw.io (`lib/chat-tools.ts`): `display_diagram`, `edit_diagram`, `append_diagram`, `get_shape_library` (w tym biblioteki elektryczne, P&ID, hydrauliczne) oraz `get_diagram_guide`. Nie wymagało zmian w kodzie.
- ID modeli pochodzą z katalogu kodu bazowego (`lib/model-catalog.json`) i nie były sprawdzane na koncie OpenAI. Nie uruchamiano aplikacji.

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
