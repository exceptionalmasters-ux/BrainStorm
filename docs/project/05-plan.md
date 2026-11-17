# Plan prac

Stan: 17 listopada 2026. Bieżącą podstawą wydań jest `main`.

## Obecny etap

Zintegrowane MVP EMC Operations; dalsza stabilizacja i ocena jakości schematów.
Produkcja: https://brainstorm-worker.exceptionalmasters.workers.dev/en.
Własna domena jest opcjonalna.

## Wdrożone

- Ręczny edytor draw.io, narzędzia i biblioteki, wiele niezależnych dokumentów.
- Uruchamianie z Client Request i Project z wybranym Technical Brief albo bez Brief.
- Prywatny zapis XML i sesji w Supabase, AutoSave, Save As, niezmienne rewizje,
  ochrona konfliktów i odtwarzanie zapisu po utracie potwierdzenia.
- Udostępnianie ekspertom wyłącznie wybranych, zatwierdzonych rewizji XML przez
  istniejący Project Access; rozmowy pozostają Operations-only.
- EMC OpenAI przez bramkę Supabase; klucz OpenAI pozostaje w backendzie.
- Web za zgodą, analiza źródeł PDF/obrazów i prywatnych plików, podgląd oraz
  osobne zatwierdzanie symboli z udokumentowanymi portami.
- Biblioteka symboli EMC dostępna także z lewego paska przy zamkniętym czacie.
- Krótkotrwały dostęp w pamięci i Reconnect EMC po zamknięciu źródłowej karty.
- Bezpośredni transport zarządzanego AI i dokumentów do Supabase, omijający
  hostingowy Worker. Limity aplikacyjne czasu pozostają dla Web; Stop nadal działa.
- Układ tabletowy z czatem obok rysunku i zachowanie rozmowy na telefonie.
- Przeniesienie pełnej historii do main i potwierdzony udany Workers Build
  dla `62e8ded91f95478620fce89a8b3aaa9a71e1fb52`.
  GitHub Actions #44125078627 zakończył się sukcesem.

## Następny proponowany etap: akceptacja rzeczywistego przepływu

Poniższe scenariusze wymagają konta Operations i rzeczywistej sesji. Zielone testy
z atrapami transportu nie potwierdzają jakości odpowiedzi modelu dla konkretnego pliku.

1. Request: wybrać fragment Brief, wygenerować diagram, zlecić kolejną poprawkę,
   zapisać i ponownie otworzyć; sprawdzić rysunek i zapisaną rozmowę.
2. Project: wykonać zapis, Save As i ponowne otwarcie obu dokumentów; sprawdzić
   odziedziczone rysunki po konwersji Request do Project.
3. Prywatny PDF: z Web wyłączonym utworzyć propozycję symbolu, sprawdzić geometrię,
   oznaczenia i dowody, zatwierdzić oraz ponownie wstawić z biblioteki.
4. Dwa okna: potwierdzić konflikt rewizji i zachowanie niezapisanych zmian.
5. Telefon/tablet: kolejna odpowiedź AI, AutoSave i Reconnect po zamknięciu
   źródłowej karty; sprawdzić również wygaśnięcie dostępu.
6. Expert: udostępnić konkretną rewizję, potwierdzić brak rozmowy JSON i utratę
   dostępu po cofnięciu zgody.

Wyniki zapisywać jako potwierdzone, niezaliczone albo niewykonane, z urządzeniem
i wersją. Nie oznaczać tych scenariuszy jako zaliczonych na podstawie samego CI.

## Dalsze prace do ustalenia po akceptacji

- Jakość schematów i wierność geometrii/pinów na reprezentatywnych dokumentach.
- Porządki brandingu i dokumentacji odziedziczonej z projektu bazowego.
- Zweryfikować politykę sprzątania niezatwierdzonych obiektów Storage.
- Wspólna edycja i whiteboard podczas rozmów pozostają odłożone.
- Własna subdomena oraz zakres Electron/MCP są opcjonalnymi decyzjami.

## Zasady wydawania

Cloudflare publikuje produkcję z `main` istniejącego workera `brainstorm-worker`.
Zmiana gałęzi nie wymaga zmiany adresu, sekretów ani schematu Supabase.
`dev` pozostaje gałęzią rozwojową; przed nową pracą należy uwzględnić najnowsze main.
Stare wpisy dziennika opisują historyczny stan; aktualny opis transportu znajduje się
na końcu [instrukcji integracji](09-operations-integration.md).
