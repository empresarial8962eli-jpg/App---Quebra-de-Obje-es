import type { NextApiRequest, NextApiResponse } from "next";
import { tasks } from "@trigger.dev/sdk";
import { tokenValido } from "../../lib/auth";
import { aplicarCors } from "../../lib/cors";

// O payload esperado é {transcript: string, endedAt: string}, igual ao definido em
// src/trigger/quebra-objecao/save-call-transcript.ts. Sem tipagem cruzada com o task aqui
// (não usamos tasks.trigger<typeof saveCallTranscript>) porque o backend é deployado
// isoladamente na Vercel — só a pasta backend/ vai pro build, um import pra fora dela quebra.

// A extensão usa navigator.sendBeacon() pra chamar esta rota quando a call termina.
// sendBeacon não permite headers customizados, então o token vem via query string.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (aplicarCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = typeof req.query.token === "string" ? req.query.token : undefined;
  if (!tokenValido(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { transcript, endedAt } = req.body ?? {};
  if (!transcript || typeof transcript !== "string") {
    return res.status(400).json({ error: "transcript is required" });
  }

  await tasks.trigger("save-call-transcript", {
    transcript,
    endedAt: endedAt ?? new Date().toISOString(),
  });

  return res.status(202).json({ ok: true });
}
