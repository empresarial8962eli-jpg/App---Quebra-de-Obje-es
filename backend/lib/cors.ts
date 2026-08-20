import type { NextApiRequest, NextApiResponse } from "next";

// A extensão roda content-script.js no contexto de origem https://meet.google.com,
// então o fetch/sendBeacon pro backend está sujeito à política de CORS do navegador.
const ALLOWED_ORIGIN = "https://meet.google.com";

/**
 * Aplica os headers de CORS e responde o preflight OPTIONS.
 * Retorna true se a request já foi respondida (era um OPTIONS) — nesse caso, o handler
 * chamador deve parar de processar e não continuar com a lógica da rota.
 */
export function aplicarCors(req: NextApiRequest, res: NextApiResponse): boolean {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }

  return false;
}
