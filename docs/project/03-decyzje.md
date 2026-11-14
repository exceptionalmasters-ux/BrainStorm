# Rejestr decyzji

Najnowsze na górze. Każda decyzja: data, kontekst, wybór, konsekwencje.

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
