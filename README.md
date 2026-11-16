# BrainStorm

Panel webowy do tworzenia edytowalnych schematów technicznych z pomocą AI. Użytkownik opisuje problem, asystent AI (OpenAI) generuje koncepcję i rysunek, a wynik otwiera się w osadzonym draw.io, gdzie można go dalej edytować ręcznie.

Status: wczesny etap. Kod bazowy pochodzi z projektu next-ai-draw-io (Apache 2.0), a rozwijamy go w kierunku opisanym w dokumentacji.

## Dokumentacja

Dokumentacja jest częścią repozytorium i jest aktualizowana razem z kodem.

| Plik | Zawartość |
| --- | --- |
| [docs/project/01-opis-projektu.md](docs/project/01-opis-projektu.md) | Cel, funkcje, zakres MVP |
| [docs/project/02-architektura.md](docs/project/02-architektura.md) | Stack, przepływ danych, hosting |
| [docs/project/03-decyzje.md](docs/project/03-decyzje.md) | Rejestr decyzji technicznych |
| [docs/project/04-dziennik-zmian.md](docs/project/04-dziennik-zmian.md) | Dziennik zmian, co i kiedy zrobiono |
| [docs/project/05-plan.md](docs/project/05-plan.md) | Plan prac i otwarte zadania |
| [docs/upstream/README.md](docs/upstream/README.md) | Oryginalny README projektu bazowego |

Integracja z Operations, zakładki dokumentów i konfiguracja wdrożenia: [09-operations-integration.md](docs/project/09-operations-integration.md).

## Stack

- Next.js (React) z draw.io hostowanym z własnej domeny aplikacji
- OpenAI API (wywoływane z serwera, klucz nigdy w przeglądarce)
- Cloudflare (build i hosting, adapter OpenNext)
- Supabase Storage i uprawnienia Operations przez integrację z panelem EMC
- GitHub: gałąź `main` to produkcja, `dev` to bieżąca praca

## Uruchomienie lokalne

```bash
cp env.example .env.local   # ustaw AI_PROVIDER=openai, AI_MODEL, OPENAI_API_KEY
npm install
npm run dev                 # http://localhost:6002
```

Skrypt `predev` pobiera draw.io do `public/drawio`. Pliku `.env.local` nie commitujemy.

## Pochodzenie kodu i licencja

Projekt jest pochodną next-ai-draw-io (Apache License 2.0). Szczegóły w pliku [NOTICE](NOTICE), a pełny tekst licencji w [LICENSE](LICENSE).
