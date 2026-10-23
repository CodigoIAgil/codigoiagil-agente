# codigoiagil-agente

Agente de atendimento do site [CódigoIAgil](https://codigoiagil.github.io/portfolio/): responde
perguntas sobre a empresa e sobre como o desenvolvimento é feito. Para qualquer outro assunto
(preço, prazo, orçamento, temas fora do escopo), passa o link do WhatsApp.

Roda como **Cloudflare Worker** (serverless: sem servidor para manter) e usa o modelo
**Claude Haiku 5.5** (`claude-haiku-5-5`).

## Como o pedido é protegido

```
site (codigoiagil.github.io)
  │  POST /chat { messages, turnstileToken }
  ▼
Worker ── 1. origem é o site? ............ senão 403 (CORS fechado)
       ── 2. corpo ≤ 16 KB? .............. senão 413
       ── 3. conversa válida? ............ até 10 mensagens, ≤ 1.000 caracteres, sem papel "system"
       ── 4. Turnstile aprovou? .......... e o token foi emitido no próprio site? senão 403
       ── 5. Claude Haiku 5.5 ............ instruções fixas: só os temas da CódigoIAgil
       ── 6. resposta só com texto ....... recusa ou falha → link do WhatsApp, sem detalhes do erro
```

- **Segredos** (`ANTHROPIC_API_KEY`, `TURNSTILE_SECRET`) só como segredos da Cloudflare.
- **Conversas não são guardadas:** o código não registra o conteúdo e a observabilidade do Worker está desligada.
- **Disjuntor de custo:** o limite de gasto mensal fica configurado na conta da Anthropic.

## Comandos

| Comando               | O que faz                                                   |
| --------------------- | ----------------------------------------------------------- |
| `npm run check`       | tipos (TypeScript), testes (Vitest) e formatação            |
| `npm run build:check` | empacota o Worker sem publicar                              |
| `npm run dev`         | roda localmente (precisa de `.dev.vars`, veja o exemplo)    |
| `npm run deploy`      | publica na Cloudflare (ação do dono, após `wrangler login`) |

## Publicar pela primeira vez (passos do dono)

```bash
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put TURNSTILE_SECRET
npm run deploy
```

O que o agente sabe e as regras dele estão em [src/conhecimento.ts](src/conhecimento.ts).
