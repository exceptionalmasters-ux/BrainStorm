# Opis projektu

## Cel

Narzędzie w formie panelu webowego, w którym użytkownik opisuje problem techniczny, a asystent AI generuje koncepcję i rysunek (np. schemat techniczny). Rysunek trafia do edytowalnej formy w draw.io osadzonym w naszej aplikacji, więc można go poprawiać ręcznie albo prosić AI o zmiany.

## Układ interfejsu

- Biała płaszczyzna rysunku jak w draw.io.
- Po lewej pionowy pasek podstawowych narzędzi rysowania (okrojony zestaw względem pełnego draw.io).
- Po prawej rozwijany panel asystenta AI.
- Styl aplikacji: ciemny motyw, czarne tło, białe i złote przyciski, zielone akcenty w stylu Matrix.

## Funkcje docelowe

- Generowanie schematu z opisu tekstowego.
- Modyfikacja istniejącego rysunku poleceniem do AI (także dla zaznaczonych kształtów) lub narysowanie go od nowa.
- Przełącznik "Szukaj w sieci": włączony pozwala AI wyszukiwać informacje (np. konkretne urządzenie), wyłączony używa samego modelu.
- Wstawianie komponentów (mikrokontroler, czujnik) jako edytowalnych symboli z pinami, do których użytkownik sam dołącza konektory.
- Zapis i wczytywanie projektów, eksport `.drawio`, PNG i SVG.

## Zakres MVP

Panel z draw.io, czat AI na OpenAI, zapis projektów, eksport SVG i XML. Pozostałe funkcje dodajemy z czasem (patrz plan prac).

## Prywatność

Diagram zostaje w przeglądarce użytkownika, ale prompt i wygenerowany XML trafiają do dostawcy AI (OpenAI). Na obecnym etapie jest to akceptowane. Przejście na własny model jest możliwe później (projekt bazowy obsługuje wielu dostawców, w tym endpointy zgodne z OpenAI).

## Uwaga prawna dotycząca obrazów z dokumentacji

Obrazy z kart katalogowych producentów są chronione prawem autorskim. Preferowane podejście to symbole generowane przez AI na podstawie pinoutu oraz biblioteki o otwartej licencji (np. symbole KiCad). Wstawianie obrazów 1:1 wymaga adnotacji źródła i oceny licencji.
