// Ponto de entrada do Cloudflare Worker.
import Anthropic from "@anthropic-ai/sdk";
import { atender, type Env } from "./agente";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    return atender(request, env, {
      criarMensagem: (params) => client.messages.create(params),
      fetch: (input, init) => fetch(input, init),
    });
  },
};
