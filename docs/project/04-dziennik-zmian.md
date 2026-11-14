# Dziennik zmian

Najnowsze na górze.

## 2026-11-14

- Wgrano kod bazowy next-ai-draw-io (commit 9534a668e3bd53f9c08aa5b8d2d77f409ccd09d4, wersja 0.5.1) do gałęzi `dev`.
- Oryginalny README przeniesiono do `docs/upstream/README.md`, dodano nowy README, NOTICE i CLAUDE.md (zasady pracy).
- Usunięto workflowy GitHub Actions dotyczące publikacji i wydań oryginału (publish-mcp, publish-dsh, electron-release, docker-build, wait-for-confirmation, auto-format) oraz FUNDING.yml. Zostawiono `test.yml` i rozszerzono go o gałąź `dev`.
- Zmieniono nazwę workera Cloudflare na `brainstorm-worker` w `wrangler.jsonc`.
- Założono dokumentację projektu w `docs/project/`.
- Nie uruchamiano buildu ani testów (w środowisku pracy instalacja pakietów jest zablokowana). Weryfikacja przy pierwszym buildzie na Cloudflare lub lokalnie.
