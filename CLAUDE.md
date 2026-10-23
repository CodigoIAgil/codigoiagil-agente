# CLAUDE.md — regras deste repositório

- **Nunca** commitar nem dar push direto na `main`. Todo trabalho acontece em uma branch
  `feat/…`, `fix/…`, `docs/…` ou `chore/…` e chega à `main` só por Pull Request.
- Commits no padrão Conventional Commits (`feat: …`, `fix: …`, `docs: …`, `chore: …`).
- Antes de abrir o PR: rodar `npm run check` e mostrar a saída. Nunca usar `--no-verify`.
- **Quem faz o merge é o dono do repositório**, depois do CI verde. A IA não aprova nem faz merge.
- **Segredos:** a chave da Anthropic e o segredo do Turnstile só existem como segredos da
  Cloudflare (`wrangler secret put`) e no `.dev.vars` local, ignorado pelo Git. Nunca no código,
  no `wrangler.toml`, em logs ou no chat.
- **O deploy é ação do dono** (`npm run deploy`, após `wrangler login`). A IA não publica.
- Mudanças em `src/conhecimento.ts` mudam o que o agente diz ao público: o dono revisa o texto.
- Decisão de rumo (design, escopo, nova dependência, troca de modelo): parar e perguntar.
