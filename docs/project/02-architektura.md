# Architektura

## Stack

| Warstwa | Technologia | Uwagi |
| --- | --- | --- |
| Aplikacja | Next.js (React) | z projektu bazowego next-ai-draw-io |
| Edytor | draw.io | pobierany skryptem `scripts/fetch-drawio.mjs` do `public/drawio`, serwowany z tej samej domeny |
| AI | OpenAI API | przez Vercel AI SDK (`@ai-sdk/openai`), wywołania z serwera |
| Hosting | Cloudflare | adapter OpenNext, konfiguracja w `wrangler.jsonc`, worker `brainstorm-worker` |
| Dane | Supabase | planowane: konta, projekty, historia rozmów |
| Kod | GitHub | `main` produkcja, `dev` praca |

## Przepływ danych

1. Użytkownik wpisuje polecenie w panelu asystenta.
2. Przeglądarka wysyła je do API route w Next.js (razem z aktualnym XML diagramu).
3. Serwer wywołuje model OpenAI kluczem trzymanym w zmiennych środowiskowych.
4. Model zwraca zmiany diagramu jako XML draw.io (wywołanie narzędzia).
5. Aplikacja waliduje XML i ładuje go do osadzonego draw.io. Zmiany są zapisywane jako wersje z możliwością cofnięcia.

Ponieważ draw.io działa z tej samej domeny co aplikacja, strona może sterować edytorem bezpośrednio (podświetlanie zmian AI, odczyt zaznaczenia, cofanie, własny pasek narzędzi).

## Narzędzia AI w draw.io

Model dostaje zestaw narzędzi (`lib/chat-tools.ts`): `display_diagram` (nowy diagram z XML), `edit_diagram` (operacje po ID komórek), `append_diagram` (dokończenie ucięcia), `get_shape_library` (nazwy kształtów i składnia stylów bibliotek, m.in. `electrical`, `pid`, `fluidpower`, `cabinets`) oraz `get_diagram_guide` (wskazówki rysowania dla wybranych typów diagramów). Dokumentacja bibliotek leży w `docs/shape-libraries`. Model musi obsługiwać wywoływanie narzędzi. Modele generujące obrazy się do tego nie nadają (patrz D-006).

## Konfiguracja

Zmienne środowiskowe opisuje `env.example`. Minimalnie dla OpenAI: `AI_PROVIDER=openai`, `AI_MODEL`, `OPENAI_API_KEY`. Lokalnie w `.env.local`, na produkcji w ustawieniach Cloudflare. Nigdy w repozytorium.

## Znane ryzyka i ograniczenia

- Darmowy plan Cloudflare ma limity liczby i rozmiaru plików oraz rozmiaru workera. Po pierwszym buildzie trzeba sprawdzić, czy bundlowane draw.io się mieści.
- Eksport PDF i konwersje po stronie serwera wymagałyby osobnego serwera eksportu. Na start wystarczą SVG, PNG i `.drawio`.
- Projekt bazowy zawiera elementy specyficzne dla autora (adresy `jiang.jp` w tekstach i SEO, aplikacja desktopowa Electron, pakiety MCP). Do uporządkowania w ramach prac nad brandingiem.
