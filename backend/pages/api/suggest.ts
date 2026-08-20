import type { NextApiRequest, NextApiResponse } from "next";
import { gerarSugestao, type Sugestao } from "../../lib/claude";
import { tokenValido } from "../../lib/auth";
import { aplicarCors } from "../../lib/cors";

// Contador simples em memória, só pra acompanhar consumo durante testes locais.
let chamadasNestaSessao = 0;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Sugestao | { error: string }>
) {
  if (aplicarCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  if (!tokenValido(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { transcriptWindow } = req.body ?? {};
  if (!transcriptWindow || typeof transcriptWindow !== "string") {
    return res.status(400).json({ error: "transcriptWindow is required" });
  }

  const inicio = Date.now();
  try {
    const sugestao = await gerarSugestao(transcriptWindow);
    const duracaoMs = Date.now() - inicio;
    chamadasNestaSessao += 1;
    console.log(`[api/suggest] chamada #${chamadasNestaSessao} (${transcriptWindow.length} chars) — fase: ${sugestao.fase} — ${duracaoMs}ms`);
    return res.status(200).json(sugestao);
  } catch (err) {
    console.error("[api/suggest] falha ao gerar sugestão", err);
    return res.status(500).json({ error: "Falha ao gerar sugestão" });
  }
}
