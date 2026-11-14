# Rejestr decyzji

Najnowsze na górze. Każda decyzja: data, kontekst, wybór, konsekwencje.

## D-005 (2026-11-14): ciemny motyw domyślny, białe płótno

- Kontekst: wymagany styl: czarne tło, białe i złote przyciski, zielone akcenty. Rysunek ma wyglądać jak w draw.io, na białym tle.
- Decyzja: ciemny motyw jest domyślny, główne akcje są złote, zielień oznacza obramowania, sukces i zmiany wprowadzone przez AI. Arkusz rysunku pozostaje biały. Motyw jasny zostaje dostępny w ustawieniach.
- Konsekwencje: kolory definiujemy wyłącznie przez zmienne CSS w `app/globals.css`, więc korekty palety są jednoplikowe.

## D-004 (2026-11-14): nazwa aplikacji BrainStorm w powłoce, strony oryginału później

- Kontekst: kod bazowy zawiera nazwę i teksty autora oryginału.
- Decyzja: zmieniamy nazwę tylko w powłoce aplikacji (manifest, tytuły, pasek startowy). Strony marketingowe i dokumentacja oryginału wymagają osobnej decyzji (usunąć lub przepisać).
- Konsekwencje: do czasu porządków część tekstów nadal wspomina oryginalny projekt.

## D-003 (2026-11-14): wyszukiwanie w sieci jako opcja włączana przełącznikiem

- Kontekst: asystent ma szukać urządzeń i dokumentacji, ale użytkownik chce mieć możliwość pracy samym modelem.
- Decyzja: wyszukiwanie dołączamy do zapytania tylko po włączeniu przełącznika w panelu asystenta.
- Konsekwencje: wymaga wyboru narzędzia wyszukiwania (do ustalenia) i obsługi cytowania źródeł.

## D-002 (2026-11-14): AI przez OpenAI API

- Kontekst: na tym etapie prywatność nie jest twardym wymogiem.
- Decyzja: używamy OpenAI API wywoływanego z serwera. Klucz trzymamy w zmiennych środowiskowych.
- Konsekwencje: prompt i XML diagramu trafiają do OpenAI. Projekt bazowy obsługuje innych dostawców, więc zmiana jest możliwa bez przebudowy.

## D-001 (2026-11-14): kod bazowy z next-ai-draw-io

- Kontekst: projekt bazowy już realizuje czat AI, edycję diagramów na płótnie draw.io, wersje zmian i wdrożenie na Cloudflare.
- Decyzja: kopiujemy jego kod (bez historii) do tego repozytorium i rozwijamy. Zachowujemy LICENSE i NOTICE (Apache 2.0), remote `upstream` pozwala porównywać zmiany z oryginałem.
- Konsekwencje: dziedziczymy jego strukturę i zależności. Usunięto workflowy publikacji i wydań, które dotyczyły tylko oryginału. Pozostawiono workflow testów.
