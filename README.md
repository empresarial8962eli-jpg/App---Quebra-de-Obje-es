# Copiloto de Vendas — Quebra Objeção (Insider)

Extensão de Chrome que lê as legendas ao vivo de uma call no Google Meet, manda o trecho recente
pra um backend que consulta o Claude, e mostra a sugestão de próxima pergunta/resposta numa janela
flutuante sobre a tela do closer. Quando a call termina, o transcript completo é salvo via uma task
assíncrona no Trigger.dev.

Veja o plano completo em `C:\Users\user\.claude\plans\agile-tinkering-ripple.md`.

## Estrutura

- `extension/` — extensão Chrome (Manifest V3): captura legendas + overlay flutuante
- `backend/` — API Next.js hospedada na Vercel: `/api/suggest` (chama Claude) e `/api/call-ended`
  (dispara a task do Trigger.dev)
- `src/trigger/quebra-objecao/` — tasks do Trigger.dev (trabalho assíncrono, pós-call)

## Fase 0 — Contas necessárias (fazer antes de rodar)

1. **Chave da Anthropic**: crie em [console.anthropic.com](https://console.anthropic.com) →
   API Keys. Vai virar `ANTHROPIC_API_KEY`.
2. **Token do copiloto**: qualquer string aleatória longa que só você e a extensão conhecem
   (protege o backend de ser chamado por estranhos). Vira `COPILOTO_API_TOKEN`. Pode gerar com:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. **Conta no Trigger.dev**: crie um projeto em [cloud.trigger.dev](https://cloud.trigger.dev).
   Pegue o **Project Ref** (cole em `trigger.config.ts`, campo `project`) e a **Secret Key**
   (Project → API Keys) → vira `TRIGGER_SECRET_KEY`.
4. **Repositório no GitHub**: crie um repo vazio e conecte este projeto a ele (necessário pro
   deploy automático via GitHub Actions, quando chegarmos na Fase 6).
5. **Projeto na Vercel**: conecte o repo do GitHub a um projeto na Vercel, com **Root Directory**
   apontando pra `backend/` (é ali que mora o Next.js).

## Variáveis de ambiente

Preencha com os valores da Fase 0:

- Raiz do projeto: copie `.env.example` → `.env`
- Backend: copie `backend/.env.local.example` → `backend/.env.local`

Depois do deploy, adicione as mesmas variáveis em:
- **Vercel** → seu projeto → Settings → Environment Variables (`ANTHROPIC_API_KEY`,
  `COPILOTO_API_TOKEN`, `TRIGGER_SECRET_KEY`)
- **Trigger.dev** → seu projeto → Environment Variables (nenhuma variável extra é necessária pra
  `save-call-transcript` no momento, além do que o próprio Trigger.dev já configura)

## Testar localmente

1. Instale as dependências na raiz e no backend:
   ```
   npm install
   cd backend && npm install && cd ..
   ```
2. Suba o backend: `npm run backend:dev` (fica em `http://localhost:3000`)
3. Suba o worker do Trigger.dev: `npm run trigger:dev`
4. Carregue a extensão no Chrome:
   - Acesse `chrome://extensions`, ative o "Modo do desenvolvedor"
   - "Carregar sem compactação" → selecione a pasta `extension/`
5. Clique no ícone da extensão, confirme a URL do backend (`http://localhost:3000`) e cole o
   `COPILOTO_API_TOKEN` que você gerou na Fase 0. Salve.
6. Entre numa call de teste no Google Meet, **ative as legendas** (botão "cc" do Meet) e fale
   algumas frases. A janela flutuante deve aparecer no canto da tela com sugestões.

   > Se a janela não atualizar: abra o DevTools da aba do Meet (F12) → Console, procure por
   > `[copiloto]`. Se aparecer aviso de seletor não encontrado, o Google mudou o HTML das legendas
   > — inspecione o elemento das legendas e ajuste `CAPTION_SELECTOR_CANDIDATES` em
   > `extension/content-script.js`, ou cole o seletor certo no campo "Seletor de legendas" do popup.

7. Ao sair da call, confira no terminal do `trigger:dev` se a task `save-call-transcript` rodou.

## Deploy

Só depois de testar localmente e você confirmar que está funcionando (nunca fazemos deploy sem
essa confirmação explícita — ver `CLAUDE.md.md`). Quando estiver pronto, é só avisar.
