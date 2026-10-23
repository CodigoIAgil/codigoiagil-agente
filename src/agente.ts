// Lógica do agente, separada do runtime para poder ser testada sem rede.
import type Anthropic from "@anthropic-ai/sdk";
import { RESPOSTA_RESERVA, SYSTEM_PROMPT } from "./conhecimento";

export const MODELO = "claude-haiku-5-5";
export const MAX_CORPO_BYTES = 16_000;
export const MAX_MENSAGENS = 10;
export const MAX_CARACTERES_MENSAGEM = 1_000;

export interface Env {
  ANTHROPIC_API_KEY: string; // segredo: wrangler secret put ANTHROPIC_API_KEY
  TURNSTILE_SECRET: string; // segredo: wrangler secret put TURNSTILE_SECRET
  ALLOWED_ORIGIN: string; // ex.: https://codigoiagil.github.io
}

export interface Dependencias {
  // Chamada ao modelo (injetada para testes).
  criarMensagem: (
    params: Anthropic.MessageCreateParamsNonStreaming,
  ) => Promise<Anthropic.Message>;
  // fetch usado para validar o Turnstile (injetado para testes).
  fetch: typeof fetch;
}

type Mensagem = { role: "user" | "assistant"; content: string };

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function cabecalhos(origem: string | null, env: Env): Headers {
  const h = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (origem === env.ALLOWED_ORIGIN) {
    h.set("Access-Control-Allow-Origin", env.ALLOWED_ORIGIN);
    h.set("Vary", "Origin");
  }
  return h;
}

function json(
  status: number,
  corpo: unknown,
  origem: string | null,
  env: Env,
): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: cabecalhos(origem, env),
  });
}

// Aceita só uma conversa curta, alternando usuário/assistente e terminando no usuário.
export function validarMensagens(valor: unknown): Mensagem[] | null {
  if (!Array.isArray(valor) || valor.length === 0) return null;
  if (valor.length > MAX_MENSAGENS) return null;
  const mensagens: Mensagem[] = [];
  for (const [i, m] of valor.entries()) {
    if (typeof m !== "object" || m === null) return null;
    const { role, content } = m as Record<string, unknown>;
    const esperado: Mensagem["role"] = i % 2 === 0 ? "user" : "assistant";
    if (role !== esperado) return null;
    if (typeof content !== "string") return null;
    const texto = content.trim();
    if (texto.length === 0 || texto.length > MAX_CARACTERES_MENSAGEM) {
      return null;
    }
    mensagens.push({ role: esperado, content: texto });
  }
  if (mensagens[mensagens.length - 1].role !== "user") return null;
  return mensagens;
}

async function turnstileValido(
  token: unknown,
  ip: string | null,
  env: Env,
  deps: Dependencias,
): Promise<boolean> {
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return false;
  }
  try {
    const corpo = new FormData();
    corpo.append("secret", env.TURNSTILE_SECRET);
    corpo.append("response", token);
    if (ip) corpo.append("remoteip", ip);
    const resposta = await deps.fetch(SITEVERIFY, {
      method: "POST",
      body: corpo,
    });
    const resultado = (await resposta.json()) as {
      success?: boolean;
      hostname?: string;
    };
    // O token precisa ter sido emitido no próprio site.
    return (
      resultado.success === true &&
      resultado.hostname === new URL(env.ALLOWED_ORIGIN).hostname
    );
  } catch {
    return false;
  }
}

export async function atender(
  request: Request,
  env: Env,
  deps: Dependencias,
): Promise<Response> {
  const origem = request.headers.get("Origin");
  const url = new URL(request.url);

  if (url.pathname !== "/chat") {
    return json(404, { erro: "não encontrado" }, origem, env);
  }

  // Só o site da CódigoIAgil pode usar o agente.
  if (origem !== env.ALLOWED_ORIGIN) {
    return json(403, { erro: "origem não permitida" }, origem, env);
  }

  if (request.method === "OPTIONS") {
    const h = cabecalhos(origem, env);
    h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    h.set("Access-Control-Allow-Headers", "Content-Type");
    h.set("Access-Control-Max-Age", "86400");
    return new Response(null, { status: 204, headers: h });
  }

  if (request.method !== "POST") {
    return json(405, { erro: "método não permitido" }, origem, env);
  }

  const texto = await request.text();
  if (new TextEncoder().encode(texto).length > MAX_CORPO_BYTES) {
    return json(413, { erro: "mensagem grande demais" }, origem, env);
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = JSON.parse(texto) as Record<string, unknown>;
  } catch {
    return json(400, { erro: "JSON inválido" }, origem, env);
  }
  if (typeof corpo !== "object" || corpo === null) {
    return json(400, { erro: "JSON inválido" }, origem, env);
  }

  const mensagens = validarMensagens(corpo.messages);
  if (!mensagens) {
    return json(400, { erro: "conversa inválida" }, origem, env);
  }

  const ip = request.headers.get("CF-Connecting-IP");
  if (!(await turnstileValido(corpo.turnstileToken, ip, env, deps))) {
    return json(403, { erro: "verificação anti-robô falhou" }, origem, env);
  }

  try {
    const resposta = await deps.criarMensagem({
      model: MODELO,
      max_tokens: 1024, // inclui espaço para o raciocínio do modelo
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: mensagens,
    });

    // Recusa dos classificadores de segurança: sem fallback no Haiku.
    if (resposta.stop_reason === "refusal") {
      return json(200, { reply: RESPOSTA_RESERVA }, origem, env);
    }

    // A resposta pode começar com blocos de raciocínio: lê só os de texto.
    const reply = resposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return json(200, { reply: reply || RESPOSTA_RESERVA }, origem, env);
  } catch {
    // Nunca devolve detalhes do erro (podem conter dados internos).
    return json(502, { reply: RESPOSTA_RESERVA }, origem, env);
  }
}
