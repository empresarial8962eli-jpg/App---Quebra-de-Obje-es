import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompt-template";

export type Sugestao = {
  fase: "diagnostico" | "objecao" | "pitch" | "fechamento";
  sinal_detectado: string;
  sugestao: string;
};

let client: Anthropic | null = null;

function getClient() {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  client = new Anthropic({ apiKey });
  return client;
}

export async function gerarSugestao(transcriptWindow: string): Promise<Sugestao> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    // 300 truncava o JSON no meio de "sinal_detectado" em objeções mais longas,
    // o que quebrava o parse e gerava 500 (visto nos logs do teste ao vivo). 500 dá margem.
    max_tokens: 500,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // O prompt é fixo entre chamadas da mesma call — cachear evita reprocessar
        // esse bloco (~700-900 tokens) a cada sugestão, reduzindo a latência.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Trecho mais recente da transcrição da call:\n\n"""\n${transcriptWindow}\n"""\n\nResponda apenas com o JSON pedido.`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Resposta da Anthropic sem conteúdo de texto");
  }

  // O modelo às vezes envolve o JSON em texto/markdown apesar da instrução — extrai só o objeto.
  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Resposta da Anthropic não contém JSON: " + textBlock.text);

  return JSON.parse(jsonMatch[0]) as Sugestao;
}
