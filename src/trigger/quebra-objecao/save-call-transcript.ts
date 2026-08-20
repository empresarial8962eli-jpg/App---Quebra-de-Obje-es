import { task } from "@trigger.dev/sdk";

type Payload = {
  transcript: string;
  endedAt: string;
};

export const saveCallTranscript = task({
  id: "save-call-transcript",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10_000,
    factor: 2,
  },
  run: async (payload: Payload) => {
    // TODO (Fase 3 do plano): decidir onde o transcript deve ser salvo de fato
    // (Notion, planilha, banco) e substituir o log abaixo pela chamada real.
    console.log(`Transcript recebido (${payload.transcript.length} caracteres), call encerrada em ${payload.endedAt}`);

    return { savedChars: payload.transcript.length };
  },
});
