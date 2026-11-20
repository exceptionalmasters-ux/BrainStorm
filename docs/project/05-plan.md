# Plan prac

Stan: 20 listopada 2026.

[OIL — wspólny rejestr EMC i BrainStorm](OIL.md) zawiera aktualne zadania, statusy i kryteria odbioru. Obecnie spisujemy wymagania; diagnoza płynności oraz dalsza realizacja są odłożone. Bieżącą podstawą wydań jest `main`.

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

## Aktualizacja 20 listopada 2026

Wdrożono poprawki klienta z PR #35 oraz backendu EMC z PR #76/#77. Personal jest przestrzenią Supabase; eksport lokalnego .storm istnieje. Foldery Desktop, limity 10 MB Expert / 50 MB Leader oraz wybór Personal/urządzenie dla autozapisu są planowane. Wejście z projektu ma zachować docelowy zapis w przestrzeni projektu. Szczegóły, placeholdery undefined i wyrównanie etykiet: OIL-001–016. Wdrożenia nie zastępują odbioru na rzeczywistym telefonie.

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
- Wspólne tablice podczas rozmów są już dostępne. Zgłoszenie pogorszenia płynności i odbiór ostatnich poprawek pozostają otwarte w OIL.
- Własna subdomena oraz zakres Electron/MCP są opcjonalnymi decyzjami.

## Zasady wydawania

Cloudflare publikuje produkcję z `main` istniejącego workera `brainstorm-worker`.
Zmiana gałęzi nie wymaga zmiany adresu, sekretów ani schematu Supabase.
`dev` pozostaje gałęzią rozwojową; przed nową pracą należy uwzględnić najnowsze main.
Stare wpisy dziennika opisują historyczny stan; aktualny opis transportu znajduje się
na końcu [instrukcji integracji](09-operations-integration.md).
