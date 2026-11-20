# OIL — EMC i BrainStorm: planowane zmiany

Stan: 20 listopada 2026. OIL = Open Items List (rejestr otwartych prac).

Dokument obejmuje ustalenia z bieżącego przeglądu oraz odnośniki do wcześniejszych otwartych prac. Nie stanowi pełnego audytu całej platformy.
**Obecny tryb: dokumentowanie. Realizacja zmian aplikacji, bazy i konfiguracji pozostaje odłożona.**
Zapis wymagania nie oznacza wdrożenia ani pozytywnej akceptacji na urządzeniu.

## Prowadzenie rejestru

- Każde zadanie ma stałe ID, obszar, status i kryterium odbioru.
- Statusy: planowane, do diagnozy, w realizacji, do akceptacji, zamknięte, odłożone.
- Zamknięcie wymaga linku do zmiany i wyniku właściwej weryfikacji; testy z atrapami nie zastępują rzeczywistej akceptacji.
- Aktualizować ten rejestr w obu repozytoriach w jednej sesji dokumentacyjnej. Pełny rejestr EMC: https://github.com/exceptionalmasters-ux/emc-website/blob/main/docs/OIL.md. Kopia wspólnego zakresu: https://github.com/exceptionalmasters-ux/BrainStorm/blob/main/docs/project/OIL.md.
- Wcześniejsze raporty zachowują wartość historyczną. Nowszy, datowany wpis ma pierwszeństwo w swoim zakresie; nie powtarzać wykonanych migracji.
- Kolejność realizacji zostanie ustalona osobno; numery ID nie są priorytetami.

## Otwarte zadania

| ID | Obszar / odpowiedzialne repozytorium | Status | Zakres i kryterium odbioru |
| --- | --- | --- | --- |
| OIL-001 | Płynność wspólnej tablicy / EMC + BrainStorm | Do diagnozy — później | Użytkownik zgłasza pogorszenie płynności po ostatnich zmianach. Porównać komunikację i odświeżanie przed/po, Realtime i fallback, heartbeat, nakładanie żądań, kolejki zapisów, postMessage, przesyłanie rysunku/widoku/adnotacji i renderowanie. Oddzielnie mierzyć lokalną płynność i aktualizację u drugiego uczestnika na telefonie i komputerze. Poprawa nie może pogorszyć synchronizacji ani utracić pracy. Przyczyna nieustalona. |
| OIL-002 | Sesje i timeouty / EMC + BrainStorm | Do diagnozy | Ustalić źródła Session access denied, timeoutów i communication_get_directory; korelować z logami i sesją. Nie zakładać wspólnej przyczyny i nie omijać uprawnień. Sprawdzić także powtarzanie Could not refresh Operations drawings przy aktywnej sesji po wdrożonej poprawce. |
| OIL-003 | Nieczytelne piny / BrainStorm + EMC AI | Planowane | Potwierdzony pin pozostaje w swoim miejscu. Nieczytelna nazwa → undefined w nazwie; nieczytelny numer → undefined w numerze; oba nieczytelne → oba undefined. Zachować czytelne dane, liczbę, stronę i kolejność. Nie zgadywać i nie dodawać niepotwierdzonych pinów. Wiele placeholderów ma osobne wewnętrzne ID, bez wymyślania numerów fizycznych. |
| OIL-004 | Wyrównanie napisów symbolu / BrainStorm | Planowane | Zastosować prawidłową zasadę z górnej krawędzi także po bokach i na dole: jedna linia odniesienia na stronę niezależnie od długości nazwy. Zachować obecny prawidłowy kierunek tekstu. Odbiór: krótkie/długie nazwy i undefined na czterech stronach. |
| OIL-005 | Toolbox Desktop / EMC | Planowane | Kafelek Desktop otwiera osobiste foldery i pliki zamiast dostępu wyłącznie przez Recent files. Prosty system tworzenia, nazywania i porządkowania folderów oraz zmiany nazw/przenoszenia plików; pobieranie na urządzenie. Zachować prywatność kont i oddzielenie projektów. Nie jest to pełny klon SharePointa. |
| OIL-006 | Udostępnienie pliku / EMC chat | Planowane | Wybrany plik można świadomie udostępnić do wskazanego czatu EMC. Sprawdzić uprawnienia i zasady retencji wybranego trybu czatu; nie udostępniać całej przestrzeni Personal ani automatycznie zmieniać dostępu do oryginału. |
| OIL-007 | Limity Personal / EMC backend + UI | Planowane — uzgodnione wartości początkowe | Expert: 10 MB na użytkownika; Leader: 50 MB na użytkownika, dla całej przestrzeni Personal, nie pojedynczego pliku. Widoczny pasek wykorzystano / limit. Egzekwowanie po stronie serwera, także dla równoległych zapisów. Po przekroczeniu zachować odczyt i pobieranie; blokować wzrost wykorzystania. Projekty na razie bez limitu aplikacyjnego, nadal podlegają pojemności dostawcy. |
| OIL-008 | Zapisz jako i autozapis / BrainStorm + EMC | Planowane | Wybór Personal w Supabase Storage albo urządzenie. Autozapis korzysta z wybranego celu; lokalny nie tworzy samoczynnie kopii w chmurze. Wejście z projektu domyślnie kieruje zapis i autozapis do przestrzeni tego projektu. Pokazywać miejsce i status zapisu. Pobranie kopii projektowej nie zmienia niejawnie celu autozapisu. |
| OIL-009 | Trwały zapis lokalny na telefonie / BrainStorm | Do sprawdzenia przy OIL-008 | Sprawdzić możliwości i uprawnienia przeglądarek do automatycznego zapisu do wybranego pliku. Przy braku obsługi jasno poinformować i zaoferować ręczne pobranie .storm. Nie przedstawiać pamięci przeglądarki jako trwałego pliku i nie przełączać celu po cichu na chmurę. |
| OIL-010 | Wersje, kosz i naliczanie przestrzeni / EMC | Planowane | Przed limitami określić liczenie rewizji, sesji JSON, rysunków, źródeł, symboli i kosza. Ustalić bezpieczną retencję/sprzątanie niezatwierdzonych obiektów z poszanowaniem historii zatwierdzonych udostępnień. Rozmiar eksportu nie jest pełnym kosztem przechowywania. Nie wykonywać czyszczenia na podstawie tego wpisu. |
| OIL-011 | SharePoint / EMC | Odłożone | Przyszła integracja folderów i plików. Obecnie Supabase pozostaje magazynem; nie migrować danych ani nie włączać Microsoft Graph. Zachować możliwość późniejszego mapowania stabilnych identyfikatorów. |
| OIL-012 | Odbiór ostatnich poprawek mobilnych i AI / oba | Do akceptacji | Sprawdzić JPG/JPG z wielkimi literami i PDF 2,79 MB, retry uploadu, przejście plik → Web, jedno pole wyszukiwania, węższą bibliotekę EM z widocznym papierem, nazwę pliku przy ikonie BrainStorm i Connect/Reconnect przy prawej krawędzi pierwszej linii. Z pliku odtwarzać wskazany rysunek/strony bez wymuszania SKU; w Web doprecyzować rzeczywistą wieloznaczność. |
| OIL-013 | Eksport i adnotacje tablicy / EMC + BrainStorm | Do akceptacji po wdrożeniu | Potwierdzić zamknięcie menu po eksporcie, nazwę BrainStorm, pojedyncze rozszerzenie .storm zamiast .storm.xml oraz działanie Allow annotation bez Unknown session action. |
| OIL-014 | Wyniki CI i rzeczywisty przepływ / oba | Do weryfikacji | Odnotować końcowy wynik ostatniej części szerokiego CI. Zachować scenariusze Request/Project: utworzenie, zapis, ponowne otwarcie, konwersja Request, konflikty dwóch okien, cofnięcie dostępu, mobilne wygaśnięcie/reconnect i zatwierdzona rewizja Expert bez ujawnienia rozmowy JSON. |
| OIL-015 | Starsze zadania EMC / EMC | Odłożone lub wymagające świeżej weryfikacji | Zachować otwarte pozycje z current-project-status.md i powiązanych przewodników: backup/restore i legal, świadomie odłożone globalne Leader MFA, dopracowanie Word, rzeczywiste media/prywatny chat/wiele urządzeń i retry QR na zgłoszonym Androidzie, bramki bezpieczeństwa prototypu oraz odłożone Teams/Graph, recording/transcription i pełna rentowność księgowa. Ich historyczny status nie jest nową zgodą na aktywację. Przed realizacją uzgodnić z nowszym kodem i raportami. |
| OIL-016 | Starszy plan BrainStorm / BrainStorm | Odłożone lub wymagające akceptacji | Zachować ocenę jakości geometrii i pinów na rzeczywistych plikach, porządki odziedziczonego brandingu/dokumentacji i decyzję o Electron/MCP. Wspólna tablica jest już dostępna — nie traktować jej jako niewdrożonego modułu. |

## Punkt odniesienia — wdrożone, nie nowe zadania

- BrainStorm PR #35: poprawki uploadu i ponawiania, generacji z rysunku/stron bez wymuszania SKU, widoków bez pinów, wyszukiwania, mobilnego układu i obsługi wyniku narzędzia AI.
- EMC PR #77: poprawki bramki AI; PR #76: eksport .storm, menu, uprawnienia adnotacji i komunikacja tablicy.
- Ostatni potwierdzony stan klienta: aa09a6ce265d879318adcb85447c06ba6daf89d4. Usługa AI: wdrożona wersja 20 według zapisu sesji wdrożeniowej.
- Potwierdzono 1388 testów jednostkowych i kluczowe scenariusze przeglądarkowe; nie jest to pełna akceptacja działania na telefonie. Nowe zgłoszenie płynności pozostaje otwarte.
- Personal jest już zapisywany w Supabase; Recent files jest widokiem listy. Eksport .storm na urządzenie istnieje. Wybór miejsca autozapisu i limity z OIL-007–009 nie są jeszcze wdrożone.
- Liczb wykorzystania Storage nie traktować jako stałej dokumentacji pojemności; są pomiarem chwilowym i wymagają świeżego sprawdzenia.

## Dokumentacja powiązana

- EMC: https://github.com/exceptionalmasters-ux/emc-website/blob/main/docs/current-project-status.md
- Integracja: https://github.com/exceptionalmasters-ux/emc-website/blob/main/docs/brainstorm-integration.md
- Plan i scenariusze BrainStorm: https://github.com/exceptionalmasters-ux/BrainStorm/blob/main/docs/project/05-plan.md
- Dziennik BrainStorm: https://github.com/exceptionalmasters-ux/BrainStorm/blob/main/docs/project/04-dziennik-zmian.md

Zakres odnośników do repozytorium EMC wymaga jego uprawnień. Rejestr nie przechowuje danych dokumentów użytkowników, sekretów ani tokenów.
