# Copiloto de Vendas — Quebra Objeção (Insider)

Extensão de Chrome que lê as legendas ao vivo de uma call no Google Meet, manda o trecho recente
pra um backend que consulta o Claude, e mostra a sugestão de próxima pergunta/resposta numa janela
flutuante sobre a tela do closer. Quando a call termina, o transcript completo é salvo via uma task
assíncrona no Trigger.dev.

Veja o plano completo em `C:\Users\user\.claude\plans\agile-tinkering-ripple.md`.

## Estrutura

Duas partes que rodam em lugares diferentes (veja o "porquê" na seção **Arquitetura** abaixo):
um caminho **quente** (tempo real, roda toda vez que alguém fala) e um caminho **frio**
(assíncrono, roda só uma vez, no fim da call).

### `extension/` — a extensão Chrome (o que o closer vê)

| Arquivo | O que faz |
|---|---|
| `manifest.json` | Configuração da extensão (Manifest V3): em quais páginas ela roda (`meet.google.com`), quais domínios ela pode chamar (`host_permissions`), e qual arquivo é o content-script. |
| `content-script.js` | O coração da extensão. Roda dentro da aba do Meet: lê as legendas do DOM a cada `pollIntervalMs`, monta o texto novo desde o último envio, manda pro backend (`/api/suggest`), e desenha/atualiza a janela flutuante com a resposta. Também detecta o fim da call (`pagehide`) e manda o transcript completo pro `/api/call-ended`. |
| `overlay.css` | Estilo da janela flutuante (a caixinha escura que aparece sobre o Meet). |
| `background.js` | Service worker da extensão — só define valores padrão de configuração na primeira instalação (URL do backend, intervalo, etc). |
| `popup.html` / `popup.js` | A telinha que abre ao clicar no ícone da extensão: liga/desliga o copiloto, define a URL do backend, o token de autenticação e o intervalo de polling. Tudo fica salvo em `chrome.storage.local`. |

### `backend/` — a API que fala com o Claude (Next.js, hospedada na Vercel)

| Arquivo | O que faz |
|---|---|
| `pages/api/suggest.ts` | Rota chamada pela extensão a cada trecho novo de fala. Valida o token, chama `gerarSugestao()` e devolve `{fase, sinal_detectado, sugestao}` em JSON. Este é o **caminho quente** — precisa responder rápido, por isso não passa pelo Trigger.dev. |
| `pages/api/call-ended.ts` | Rota chamada uma vez, quando a call termina (via `sendBeacon`, que funciona mesmo com a aba fechando). Recebe o transcript completo e dispara a task `save-call-transcript` no Trigger.dev — esse sim é o **caminho frio**, assíncrono. |
| `lib/claude.ts` | Cliente da Anthropic: monta a chamada pro modelo (hoje `claude-haiku-4-5`, escolhido por velocidade), usa prompt caching pra não reprocessar o `SYSTEM_PROMPT` inteiro a cada chamada, e extrai o JSON da resposta. |
| `lib/prompt-template.ts` | O "cérebro" do copiloto — todas as regras de diagnóstico, objeções e formato de resposta, definidas pelo usuário. |
| `lib/auth.ts` | Confere se o token que a extensão mandou bate com `COPILOTO_API_TOKEN` — sem isso, qualquer pessoa na internet poderia chamar seu backend e gastar seu crédito da Anthropic. |
| `lib/cors.ts` | Libera o navegador a deixar a extensão (que roda na origem `https://meet.google.com`) chamar este backend, que fica em outro domínio — sem isso o Chrome bloqueia a chamada por CORS. |

### `src/trigger/quebra-objecao/` — trabalho assíncrono (Trigger.dev)

| Arquivo | O que faz |
|---|---|
| `save-call-transcript.ts` | Task disparada pelo `/api/call-ended` no fim de cada call. Hoje só loga o transcript recebido — o destino final (Notion? planilha? banco?) ainda é uma decisão em aberto. |

### Raiz do projeto

| Arquivo | O que faz |
|---|---|
| `trigger.config.ts` | Configuração do projeto Trigger.dev (qual projeto na nuvem, onde ficam as tasks, política de retry). |
| `package.json` (raiz) | Scripts pra rodar o worker do Trigger.dev (`trigger:dev`) e o backend (`backend:dev`) localmente. |
| `.env.example` / `backend/.env.local.example` | Modelos das variáveis de ambiente — nunca colocar valores reais aqui, só nos arquivos `.env`/`.env.local` (esses ficam fora do git, veja `.gitignore`). |

## Arquitetura — por que o backend não é 100% Trigger.dev

O `/api/suggest` precisa responder em ~1-2 segundos, durante uma call ao vivo — o Trigger.dev é
ótimo pra automações em background/agendadas, mas não é feito pra esse tipo de resposta síncrona
imediata. Por isso só o `/api/call-ended` (que não precisa de resposta na hora) usa o Trigger.dev;
o caminho de sugestão em tempo real fica direto na Vercel, chamando a Anthropic sem intermediário.

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
