export function tokenValido(recebido: string | undefined | null): boolean {
  const esperado = process.env.COPILOTO_API_TOKEN;
  if (!esperado) throw new Error("COPILOTO_API_TOKEN is not set");
  return recebido === esperado;
}
