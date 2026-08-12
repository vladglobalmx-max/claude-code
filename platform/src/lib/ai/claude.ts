import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Único punto de contacto con la API de Claude en todo el proyecto.
 * Server-only: la API key nunca sale del servidor, y este módulo no puede
 * importarse desde un componente "use client" (bloqueado por ESLint).
 */
let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY no está configurada. Agrégala a .env.local (nunca al código fuente)."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface ClaudeCallParams {
  systemPrompt: string;
  userMessage: string;
  model: string;
  temperature: number;
  maxTokens?: number;
}

export interface ClaudeCallResult {
  text: string;
  tokensInput: number;
  tokensOutput: number;
}

/** Llamada simple de un turno — usada por el orquestador de herramientas (run-tool.ts). */
export async function callClaude(params: ClaudeCallParams): Promise<ClaudeCallResult> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: params.model,
    max_tokens: params.maxTokens ?? 2048,
    temperature: params.temperature,
    system: params.systemPrompt,
    messages: [{ role: "user", content: params.userMessage }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return {
    text,
    tokensInput: response.usage.input_tokens,
    tokensOutput: response.usage.output_tokens,
  };
}

export interface ClaudeConversationTurn {
  role: "user" | "assistant";
  content: string;
}

/** Llamada multi-turno — usada por el chat de agentes. */
export async function callClaudeConversation(params: {
  systemPrompt: string;
  history: ClaudeConversationTurn[];
  model: string;
  temperature: number;
  maxTokens?: number;
}): Promise<ClaudeCallResult> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: params.model,
    max_tokens: params.maxTokens ?? 2048,
    temperature: params.temperature,
    system: params.systemPrompt,
    messages: params.history.map((turn) => ({ role: turn.role, content: turn.content })),
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return {
    text,
    tokensInput: response.usage.input_tokens,
    tokensOutput: response.usage.output_tokens,
  };
}

/** Costo estimado en USD — tarifas placeholder, ajustar en Configuración cuando existan reales. */
const COST_PER_MILLION_INPUT_TOKENS = 3.0;
const COST_PER_MILLION_OUTPUT_TOKENS = 15.0;

export function estimateCostUsd(tokensInput: number, tokensOutput: number): number {
  return (
    (tokensInput / 1_000_000) * COST_PER_MILLION_INPUT_TOKENS +
    (tokensOutput / 1_000_000) * COST_PER_MILLION_OUTPUT_TOKENS
  );
}
