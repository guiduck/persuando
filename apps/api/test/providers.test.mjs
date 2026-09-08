import assert from "node:assert/strict";
import test from "node:test";

import { MockProviderAdapter } from "../dist/src/modules/providers/mock-provider.adapter.js";
import { OpenAiCompatibleProviderAdapter } from "../dist/src/modules/providers/openai-compatible-provider.adapter.js";
import { ProviderAdapterError, toSafeProviderError } from "../dist/src/modules/providers/provider-adapter.js";
import { ProvidersService } from "../dist/src/modules/providers/providers.service.js";

const transcriptionInput = {
  apiKey: "sk-provider-secret",
  audio: new Uint8Array([1, 2, 3]),
  codec: "webm-opus",
  language: "pt-BR",
  model: "gpt-4o-mini-transcribe",
  sessionId: "session-1"
};

const practiceStepsFixture = [{
  title: "Implement the complete function",
  objective: "Produce a coherent working stage.",
  completeCode: "function solve(input) { return input; }",
  testCode: "console.assert(solve('ok') === 'ok');",
  expectedResult: "The assertion passes.",
  explanation: "This test validates the complete stage.",
  interviewerSpeech: "I will validate the smallest complete behavior before optimizing."
}];

function validSystemDesignGuidance() {
  const stages = [
    "Passo 1 — Requisitos funcionais e não funcionais",
    "Passo 2 — Padrões de acesso",
    "Passo 3 — Escala horizontal e vertical",
    "Passo 4 — Dados",
    "Passo 5 — Design de alto nível",
    "Passo 6 — Gargalos",
    "Passo 7 — Consistência",
    "Passo 8 — Falhas",
    "Passo 9 — Trade-offs"
  ].map((title, index) => `## ${title}\n\n### Problema\nPressão arquitetônica ${index + 1}.\n\n### Solução\nDecisão justificada ${index + 1}.\n\n### Trade-off\nBenefício e custo ${index + 1}.\n\n> **Fala para entrevista:** Vou explicar a decisão ${index + 1} e seu custo.`).join("\n\n");
  return `## O que eu entendi\nUm serviço recebe URLs e devolve endereços curtos.\n\n## Perguntas de clarificação do escopo\n> **Fala para entrevista:** Quais requisitos e padrões de acesso são prioritários?\n> **Fala para entrevista:** Qual escala horizontal ou vertical esperamos?\n> **Fala para entrevista:** Quais dados e integrações definem o design de alto nível?\n> **Fala para entrevista:** Quais gargalos e garantias de consistência importam?\n> **Fala para entrevista:** Quais falhas e trade-offs são aceitáveis?\n\n## Diagrama inicial\n\n\`\`\`mermaid\nflowchart LR\n  Client["Client"] --> API["API"]\n\`\`\`\n\n## Legenda do diagrama\n- **Client → API:** envia as solicitações para o serviço mínimo.\n\n${stages}\n\n## Diagrama final\n\n\`\`\`mermaid\nflowchart LR\n  Client["Client"] --> API["API"]\n  API --> Cache["Cache"]\n  API --> DB["Database"]\n\`\`\`\n\n## Legenda do diagrama\n- **Client → API:** envia criação e redirecionamento.\n- **API → Cache:** consulta mapeamentos frequentes.\n- **API → Database:** persiste a fonte de verdade.`;
}

test("ProvidersService selects mock adapter by configuration", async () => {
  const service = new ProvidersService({
    env: {
      providerAdapter: "mock"
    }
  });

  const output = await service.transcribe(transcriptionInput);

  assert.equal(service.getAdapter().name, "mock");
  assert.equal(output.transcript.language, "pt-BR");
  assert.equal(output.transcript.provisional, false);
});

test("MockProviderAdapter generates deterministic summaries, insights, and suggestions", async () => {
  const adapter = new MockProviderAdapter();
  const output = await adapter.generate({
    analysisModel: "gpt-4o-mini",
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    transcriptText: "Precisamos decidir o prazo e o dono da proxima etapa."
  });

  assert.match(output.summary.content, /Precisamos decidir/);
  assert.equal(output.insights[0]?.type, "question");
  assert.equal(output.suggestions[0]?.category, "response");
});

test("OpenAiCompatibleProviderAdapter sends transcription request with bearer auth and safe output", async () => {
  const requests = [];
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async (url, init) => {
    requests.push({ url, init });
    return jsonResponse(200, { text: "ola mundo", language: "pt-BR" });
  });

  const output = await adapter.transcribe(transcriptionInput);

  assert.equal(requests[0].url, "https://provider.example/v1/audio/transcriptions");
  assert.equal(requests[0].init.headers.authorization, "Bearer sk-provider-secret");
  assert.equal(output.transcript.text, "ola mundo");
  assert.equal(JSON.stringify(output).includes("sk-provider-secret"), false);
});

test("OpenAiCompatibleProviderAdapter parses generation JSON", async () => {
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async () =>
    jsonResponse(200, {
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: { content: "Resumo curto." },
              insights: [{ type: "question", content: "Qual e o prazo?", confidence: 0.8 }],
              suggestions: [{ category: "response", content: "Eu sugiro confirmar o prazo.", urgency: "medium" }]
            })
          }
        }
      ]
    })
  );

  const output = await adapter.generate({
    apiKey: "sk-provider-secret",
    analysisModel: "gpt-4o-mini",
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    transcriptText: "Falamos sobre prazo."
  });

  assert.equal(output.summary.content, "Resumo curto.");
  assert.equal(output.insights[0]?.content, "Qual e o prazo?");
  assert.equal(output.suggestions[0]?.content, "Eu sugiro confirmar o prazo.");
});

test("OpenAiCompatibleProviderAdapter uses GPT-5 completion controls without legacy temperature", async () => {
  let requestBody;
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return jsonResponse(200, {
      choices: [{
        message: {
          content: JSON.stringify({
            summary: { content: "Resumo curto." },
            insights: [],
            suggestions: []
          })
        }
      }]
    });
  });

  await adapter.generate({
    apiKey: "sk-provider-secret",
    analysisModel: "gpt-5.6-sol",
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    transcriptText: "Falamos sobre prazo."
  });

  assert.equal(requestBody.max_completion_tokens, 1800);
  assert.equal("max_tokens" in requestBody, false);
  assert.equal("temperature" in requestBody, false);
});

test("OpenAiCompatibleProviderAdapter maps provider failure status codes to safe errors", async () => {
  const cases = [
    [401, "PROVIDER_KEY_INVALID", false],
    [403, "PROVIDER_KEY_INVALID", false],
    [402, "PROVIDER_QUOTA_EXCEEDED", false],
    [408, "PROVIDER_TIMEOUT", true],
    [415, "AUDIO_FORMAT_UNSUPPORTED", false],
    [429, "PROVIDER_RATE_LIMITED", true],
    [500, "PROVIDER_UNAVAILABLE", true]
  ];

  for (const [status, code, retryable] of cases) {
    const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async () => jsonResponse(status, {}));

    await assert.rejects(
      () => adapter.transcribe(transcriptionInput),
      (error) =>
        error instanceof ProviderAdapterError &&
        error.code === code &&
        error.retryable === retryable &&
        !error.message.includes("sk-provider-secret")
    );
  }
});

test("OpenAiCompatibleProviderAdapter maps missing key, network failure, and unknown errors safely", async () => {
  const networkAdapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async () => {
    throw new Error("network failed with sk-provider-secret");
  });

  await assert.rejects(
    () => networkAdapter.generate({ analysisModel: "gpt-4o-mini", responseLanguage: "pt-BR", sessionId: "session-1", transcriptText: "ola" }),
    (error) => error instanceof ProviderAdapterError && error.code === "PROVIDER_KEY_INVALID"
  );
  await assert.rejects(
    () => networkAdapter.transcribe(transcriptionInput),
    (error) =>
      error instanceof ProviderAdapterError &&
      error.code === "PROVIDER_UNAVAILABLE" &&
      error.retryable === true &&
      !error.message.includes("sk-provider-secret")
  );

  const safe = toSafeProviderError(new Error("unknown failure with sk-provider-secret"));
  assert.equal(safe.code, "PROVIDER_UNAVAILABLE");
  assert.equal(safe.retryable, true);
  assert.equal(JSON.stringify(safe).includes("sk-provider-secret"), false);
});

test("OpenAiCompatibleProviderAdapter retries one transient generation network failure", async () => {
  let requestCount = 0;
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async () => {
    requestCount += 1;
    if (requestCount === 1) {
      const error = new TypeError("fetch failed");
      error.cause = { code: "UND_ERR_SOCKET" };
      throw error;
    }
    return jsonResponse(200, {
      choices: [{
        message: {
          content: JSON.stringify({
            summary: { content: "Recovered response." },
            insights: [],
            suggestions: []
          })
        }
      }]
    });
  });

  const output = await adapter.generate({
    apiKey: "sk-provider-secret",
    analysisModel: "gpt-4o-mini",
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    transcriptText: "retry this generation"
  });

  assert.equal(requestCount, 2);
  assert.equal(output.summary.content, "Recovered response.");
});
test("OpenAiCompatibleProviderAdapter requests substantial Code Practice output", async () => {
  const requests = [];
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async (url, init) => {
    requests.push({ url, init });
    return jsonResponse(200, {
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: { content: "Resumo." },
              insights: [],
              suggestions: [
                {
                  category: "response",
                  content: [
                    "## Problema em palavras simples",
                    "Este texto e longo o suficiente para passar pela validacao de qualidade. ".repeat(40),
                    "## Técnica escolhida",
                    "Usar algoritmo recursivo passo a passo.",
                    "## Solução atualizada",
                    "```javascript\nfunction getHeight(root) { return root === null ? -1 : 1 + Math.max(getHeight(root.left), getHeight(root.right)); }\n```",
                    "## Complexidade Big-O",
                    "Tempo O(n) e espaco O(h)."
                  ].join("\n"),
                  urgency: "high"
                }
              ],
              practiceSteps: practiceStepsFixture
            })
          }
        }
      ]
    });
  });

  await adapter.generate({
    apiKey: "sk-provider-secret",
    analysisModel: "gpt-4o-mini",
    imageReferences: Array.from({ length: 30 }, (_, index) => `data:image/png;base64,image-${index + 1}`),
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    task: "code_practice",
    transcriptText: "HackerRank tree height getHeight",
    previousCodePracticeGuidance: ["A orientação anterior usou o campo value e precisa ser revisada."],
    programmingLanguage: "javascript"
  });

  assert.equal(requests.length, 2);
  const analysisBody = JSON.parse(requests[0].init.body);
  const answerBody = JSON.parse(requests[1].init.body);

  assert.equal(analysisBody.max_tokens, 6400);
  assert.equal(analysisBody.temperature, 0);
  assert.match(analysisBody.messages[0].content, /visual evidence analyst/i);
  assert.match(analysisBody.messages[0].content, /functionSignature/);
  assert.match(analysisBody.messages[0].content, /observedTestResults/);
  assert.match(analysisBody.messages[1].content[0].text, /Selected programming language: javascript/);
  const imageParts = analysisBody.messages[1].content.filter((part) => part.type === "image_url");
  assert.equal(imageParts.length, 30);
  assert.equal(imageParts[0].image_url.url, "data:image/png;base64,image-1");
  assert.equal(imageParts.at(-1).image_url.url, "data:image/png;base64,image-30");

  assert.equal(answerBody.max_tokens, 8000);
  assert.equal(answerBody.temperature, 0.15);
  assert.match(answerBody.messages[0].content, /exact contract/i);
  assert.match(answerBody.messages[0].content, /previous guidance as fallible history/i);
  assert.equal(typeof answerBody.messages[1].content, "string");
  assert.match(answerBody.messages[1].content, /Structured visual analysis of all current screenshots/);
  assert.match(answerBody.messages[1].content, /Previous Code Practice guidance/);
  assert.match(answerBody.messages[1].content, /Selected programming language: javascript/);
  assert.match(answerBody.messages[1].content, /do not output language-neutral pseudocode/);
  assert.match(answerBody.messages[1].content, /campo value e precisa ser revisada/);
  assert.match(answerBody.messages[1].content, /Como eu chegaria nessa solução/);
  assert.match(answerBody.messages[1].content, /Ajustes que eu corrigiria no caminho/);
  assert.match(answerBody.messages[1].content, /Never recreate Node, Tree, main, stdin parsing/);
  assert.match(answerBody.messages[1].content, /O que eu entendi do problema/);
  assert.match(answerBody.messages[1].content, /Solução ótima de referência/);
  assert.match(answerBody.messages[1].content, /Perguntas de clarificação/);
  assert.match(answerBody.messages[1].content, /practiceSteps/);
  assert.match(answerBody.messages[1].content, /Termos para pesquisar no Google/);
  assert.match(answerBody.messages[1].content, /Dúvida atual/);
  assert.match(answerBody.messages[1].content, /Fala para entrevista/);
  assert.match(answerBody.messages[1].content, /blockquoted/);
  assert.match(answerBody.messages[1].content, /conversational simulated-interview script/);
});

test("OpenAiCompatibleProviderAdapter retries invalid visual JSON once and accepts fenced JSON", async () => {
  const requests = [];
  const responses = [
    "not-json",
    "```json\n{\"problemTitle\":\"Tree: Level Order Traversal\",\"language\":\"javascript\"}\n```",
    JSON.stringify({
      summary: { content: "Use BFS em JavaScript." },
      insights: [],
      suggestions: [{ category: "response", content: "## Solução ótima de referência\n```javascript\nfunction levelOrder(root) { const queue = [root]; }\n```\nPasso a passo.", urgency: "high" }],
      practiceSteps: practiceStepsFixture
    })
  ];
  let requestCount = 0;
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return jsonResponse(200, {
      choices: [{ finish_reason: "stop", message: { content: responses[requestCount++] } }]
    });
  });

  const output = await adapter.generate({
    apiKey: "sk-provider-secret",
    analysisModel: "gpt-4o-mini",
    imageReferences: ["data:image/png;base64,level-order"],
    programmingLanguage: "javascript",
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    task: "code_practice",
    transcriptText: "Tree: Level Order Traversal"
  });

  assert.equal(requestCount, 3);
  assert.equal(requests[0].max_tokens, 6400);
  assert.equal(requests[1].max_tokens, 8000);
  assert.equal(requests[2].max_tokens, 8000);
  assert.match(output.suggestions[0].content, /```javascript/);
});
test("OpenAiCompatibleProviderAdapter retries a Code Practice answer that omits the selected-language solution", async () => {
  const requests = [];
  const responses = [
    JSON.stringify({ problemTitle: "Swap Nodes [Algo]", language: "unknown", functionSignature: null }),
    JSON.stringify({
      summary: { content: "Explique com travessia." },
      insights: [],
      suggestions: [{ category: "response", content: "Use uma fila, mas preciso ver o editor.", urgency: "high" }]
    }),
    JSON.stringify({
      summary: { content: "Solução corrigida." },
      insights: [],
      suggestions: [{
        category: "response",
        content: "## Solução ótima de referência\n```javascript\nfunction swapNodes(indexes, queries) { return []; }\n```\n## Passo a passo\nA função segue o contrato selecionado.",
        urgency: "high"
      }],
      practiceSteps: practiceStepsFixture
    })
  ];
  let requestCount = 0;
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return jsonResponse(200, {
      choices: [{ finish_reason: "stop", message: { content: responses[requestCount++] } }]
    });
  });

  const output = await adapter.generate({
    apiKey: "sk-provider-secret",
    analysisModel: "gpt-4o-mini",
    imageReferences: ["data:image/jpeg;base64,swap-nodes"],
    programmingLanguage: "javascript",
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    task: "code_practice",
    transcriptText: "Public HackerRank practice page"
  });

  assert.equal(requestCount, 3);
  assert.match(requests[1].messages[1].content, /"language":"javascript"/);
  assert.match(requests[1].messages[1].content, /"selectedProgrammingLanguageIsAuthoritative":true/);
  assert.match(requests[2].messages[1].content, /REPAIR REQUIRED/);
  assert.match(requests[2].messages[1].content, /Solução ótima de referência/);
  assert.match(requests[2].messages[1].content, /practiceSteps/);
  assert.match(requests[2].messages[1].content, /Termos para pesquisar no Google/);
  assert.match(output.suggestions[0].content, /```javascript/);
});
test("OpenAiCompatibleProviderAdapter preserves genuine short Code Practice output without hardcoded replacement", async () => {
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async () =>
    jsonResponse(200, {
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: { content: "Level Order Traversal usa uma fila." },
              insights: [],
              suggestions: [{
                category: "response",
                content: "Use BFS com uma fila para visitar a árvore nível por nível.",
                urgency: "medium"
              }]
            })
          }
        }
      ]
    })
  );

  const output = await adapter.generate({
    apiKey: "sk-provider-secret",
    analysisModel: "gpt-4o-mini",
    imageReferences: ["data:image/png;base64,level-order"],
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    task: "code_practice",
    transcriptText: "Tree: Level Order Traversal"
  });

  assert.equal(output.suggestions[0].content, "Use BFS com uma fila para visitar a árvore nível por nível.");
  assert.doesNotMatch(output.suggestions[0].content, /altura|getHeight/i);
});

test("OpenAiCompatibleProviderAdapter reports invalid final Code Practice JSON instead of inventing guidance", async () => {
  let requestCount = 0;
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async () => {
    requestCount += 1;
    return jsonResponse(200, {
      choices: [{ message: { content: requestCount === 1 ? JSON.stringify({ problemTitle: "Tree: Level Order Traversal" }) : "not-json" } }]
    });
  });

  await assert.rejects(
    () => adapter.generate({
      apiKey: "sk-provider-secret",
      analysisModel: "gpt-4o-mini",
      imageReferences: ["data:image/png;base64,level-order"],
      responseLanguage: "pt-BR",
      sessionId: "session-1",
      task: "code_practice",
      transcriptText: "Tree: Level Order Traversal"
    }),
    (error) =>
      error instanceof ProviderAdapterError &&
      error.code === "PROVIDER_RESPONSE_INVALID" &&
      /invalid JSON/i.test(error.message)
  );
});
test("OpenAiCompatibleProviderAdapter maps malformed JSON response shapes to a safe provider error", async () => {
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async () => jsonResponse(200, null));

  await assert.rejects(
    () => adapter.generate({
      apiKey: "sk-provider-secret",
      analysisModel: "gpt-4o-mini",
      imageReferences: ["data:image/png;base64,level-order"],
      programmingLanguage: "javascript",
      responseLanguage: "pt-BR",
      sessionId: "session-1",
      task: "code_practice",
      transcriptText: "Tree: Level Order Traversal"
    }),
    (error) =>
      error instanceof ProviderAdapterError &&
      error.code === "PROVIDER_RESPONSE_INVALID" &&
      /invalid response shape/i.test(error.message)
  );
});
test("OpenAiCompatibleProviderAdapter maps rejected generation requests separately from audio format errors", async () => {
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async () => jsonResponse(400, {}));

  await assert.rejects(
    () => adapter.generate({
      apiKey: "sk-provider-secret",
      analysisModel: "gpt-4o-mini",
      imageReferences: ["data:image/png;base64,level-order"],
      responseLanguage: "pt-BR",
      sessionId: "session-1",
      task: "code_practice",
      transcriptText: "Tree: Level Order Traversal"
    }),
    (error) =>
      error instanceof ProviderAdapterError &&
      error.code === "PROVIDER_RESPONSE_INVALID" &&
      /generation request/i.test(error.message)
  );
});

test("OpenAiCompatibleProviderAdapter selects repository workflow prompts and incremental history", async () => {
  const requests = [];
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return jsonResponse(200, {
      choices: [{
        message: {
          content: requests.length === 1
            ? JSON.stringify({ activeProblemTitle: "Repository kata", filesAndSymbols: ["src/app.ts handleRequest"] })
            : JSON.stringify({
                summary: { content: "Continue the repository fix." },
                insights: [],
                suggestions: [{
                  category: "response",
                  content: "## Diagnóstico objetivo\nO teste falha em `handleRequest`.\n\n## Mudanças propostas\n```typescript\nexport function handleRequest() { return true; }\n```",
                  urgency: "high"
                }]
              })
        }
      }]
    });
  });

  await adapter.generate({
    apiKey: "sk-provider-secret",
    analysisModel: "gpt-4o-mini",
    codePracticeIncrementalHistory: ["Latest test result: expected true, received false."],
    codePracticeWorkflow: "repository",
    imageReferences: ["data:image/png;base64,repo-screen"],
    previousCodePracticeGuidance: ["Earlier suggestion changed the wrong symbol."],
    programmingLanguage: "typescript",
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    task: "code_practice",
    transcriptText: "Repository editor and terminal are visible."
  });

  assert.equal(requests.length, 2);
  assert.match(requests[0].messages[0].content, /simulated repository debugging session/i);
  assert.match(requests[0].messages[1].content[0].text, /Code Practice workflow: repository/);
  assert.match(requests[1].messages[0].content, /Repository Practice/);
  assert.match(requests[1].messages[0].content, /Do not claim deep repository search/i);
  assert.match(requests[1].messages[1].content, /Bounded incremental repository history/);
  assert.match(requests[1].messages[1].content, /Latest test result/);
  assert.match(requests[1].messages[1].content, /Mudanças propostas/);
});

test("OpenAiCompatibleProviderAdapter selects design-system workflow prompts", async () => {
  const requests = [];
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return jsonResponse(200, {
      choices: [{
        message: {
          content: requests.length === 1
            ? JSON.stringify({ activeProblemTitle: "Button variants", components: ["Button"], tokens: ["spacing.2"] })
            : JSON.stringify({
                summary: { content: "Refine the Button component." },
                insights: [],
                suggestions: [{
                  category: "response",
                  content: "## Roteiro de entrevista\nExplique a API do componente.\n\n## Código final\n```tsx\nexport function Button() { return <button />; }\n```",
                  urgency: "high"
                }]
              })
        }
      }]
    });
  });

  await adapter.generate({
    apiKey: "sk-provider-secret",
    analysisModel: "gpt-4o-mini",
    codePracticeIncrementalHistory: ["Latest visual diff shows cramped spacing."],
    codePracticeWorkflow: "design_system",
    imageReferences: ["data:image/png;base64,design-system-screen"],
    previousCodePracticeGuidance: ["Earlier suggestion skipped accessibility states."],
    programmingLanguage: "tsx",
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    task: "code_practice",
    transcriptText: "Button component and Storybook are visible."
  });

  assert.equal(requests.length, 2);
  assert.match(requests[0].messages[0].content, /design-system\/component-library exercise/i);
  assert.match(requests[0].messages[1].content[0].text, /Code Practice workflow: design_system/);
  assert.match(requests[1].messages[0].content, /Design System Practice/);
  assert.match(requests[1].messages[0].content, /simulated technical-assessment preparation exercise for study/i);
  assert.match(requests[1].messages[1].content, /Bounded incremental design-system history/);
  assert.match(requests[1].messages[1].content, /Roteiro de entrevista/);
  assert.match(requests[1].messages[1].content, /Construção passo a passo/);
  assert.match(requests[1].messages[1].content, /Código final/);
  assert.match(requests[1].messages[1].content, /false starts only as corrected teaching notes/);
});

test("OpenAiCompatibleProviderAdapter generates independent System Design guidance with Mermaid and interview speech", async () => {
  const requests = [];
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return jsonResponse(200, {
      choices: [{
        message: {
          content: requests.length === 1
            ? JSON.stringify({
                activeProblemTitle: "Design a URL shortener",
                problemFingerprint: "url-shortener",
                prompt: "Design a URL shortener",
                functionalRequirements: ["create short URL", "redirect"],
                currentArchitecture: null
              })
            : JSON.stringify({
                summary: { content: "Design a URL shortener." },
                insights: [],
                suggestions: [{
                  category: "response",
                  content: validSystemDesignGuidance(),
                  urgency: "high"
                }],
                practiceSteps: []
              })
        }
      }]
    });
  });

  const output = await adapter.generate({
    apiKey: "sk-provider-secret",
    analysisModel: "gpt-4o-mini",
    imageReferences: Array.from({ length: 10 }, (_, index) => `data:image/png;base64,url-shortener-${index + 1}`),
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    task: "system_design",
    transcriptText: "A realistic company-branded system design simulation."
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].max_tokens, 3200);
  assert.equal(requests[1].max_tokens, 12000);
  const systemDesignImageParts = requests[0].messages[1].content.filter((part) => part.type === "image_url");
  assert.equal(systemDesignImageParts.length, 6);
  assert.equal(systemDesignImageParts[0].image_url.url, "data:image/png;base64,url-shortener-5");
  assert.equal(systemDesignImageParts.at(-1).image_url.url, "data:image/png;base64,url-shortener-10");
  assert.match(requests[0].messages[0].content, /System Design interview tutor/);
  assert.match(requests[0].messages[0].content, /logos/i);
  assert.match(requests[1].messages[0].content, /simulation-only practice session/i);
  assert.match(requests[1].messages[0].content, /valid fenced mermaid flowcharts/i);
  assert.match(requests[1].messages[0].content, /Legenda do diagrama/);
  assert.match(requests[1].messages[0].content, /every important diagram component and connection/i);
  assert.match(requests[1].messages[0].content, /Microsoft, Amazon/i);
  assert.match(requests[1].messages[0].content, /functional and non-functional requirements; 2 access patterns; 3 horizontal and vertical scale/i);
  assert.match(requests[1].messages[1].content, /Perguntas de clarificação/);
  assert.match(requests[1].messages[1].content, /Fala para entrevista/);
  assert.match(requests[1].messages[1].content, /Passo 1 — Requisitos funcionais e não funcionais/);
  assert.match(requests[1].messages[1].content, /Passo 9 — Trade-offs/);
  assert.match(requests[1].messages[1].content, /Problem -> Solution -> Trade-off/);
  assert.equal(output.suggestions[0].content.match(/```mermaid/g)?.length, 2);
  assert.match(output.suggestions[0].content, /## Diagrama inicial/);
  assert.match(output.suggestions[0].content, /## Diagrama final/);
  assert.match(output.suggestions[0].content, /## Legenda do diagrama/);
});

test("OpenAiCompatibleProviderAdapter retries a truncated System Design answer with an expanded budget", async () => {
  const requests = [];
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async (_url, init) => {
    requests.push(JSON.parse(init.body));
    if (requests.length === 1) {
      return jsonResponse(200, {
        choices: [{
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              activeProblemTitle: "Design a URL shortener",
              problemFingerprint: "url-shortener",
              prompt: "Design a URL shortener"
            })
          }
        }]
      });
    }
    if (requests.length === 2) {
      return jsonResponse(200, {
        choices: [{ finish_reason: "length", message: { content: "" } }]
      });
    }
    return jsonResponse(200, {
      choices: [{
        finish_reason: "stop",
        message: {
          content: JSON.stringify({
            summary: { content: "Design a URL shortener." },
            insights: [],
            suggestions: [{
              category: "response",
              content: validSystemDesignGuidance(),
              urgency: "high"
            }],
            practiceSteps: []
          })
        }
      }]
    });
  });

  const output = await adapter.generate({
    apiKey: "sk-provider-secret",
    analysisModel: "gpt-4o-mini",
    imageReferences: ["data:image/png;base64,url-shortener"],
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    task: "system_design",
    transcriptText: "Design a URL shortener"
  });

  assert.equal(requests.length, 3);
  assert.equal(requests[0].max_tokens, 3200);
  assert.equal(requests[1].max_tokens, 12000);
  assert.equal(requests[2].max_tokens, 16000);
  assert.match(requests[2].messages[1].content, /REPAIR REQUIRED/);
  assert.match(requests[2].messages[1].content, /previous provider answer could not be parsed/i);
  assert.match(output.suggestions[0].content, /## Diagrama final/);
});

test("OpenAiCompatibleProviderAdapter repairs System Design guidance with a displaced diagram legend", async () => {
  const requests = [];
  const responses = [
    JSON.stringify({
      activeProblemTitle: "Design a notification service",
      problemFingerprint: "notification-service",
      functionalRequirements: ["send notifications"]
    }),
    JSON.stringify({
      summary: { content: "Notification service." },
      insights: [],
      suggestions: [{
        category: "response",
        content: validSystemDesignGuidance().replace(
          "```\n\n## Legenda do diagrama",
          "```\n\n## Decisões prematuras\nA legenda ficou separada.\n\n## Legenda do diagrama"
        ),
        urgency: "high"
      }],
      practiceSteps: []
    }),
    JSON.stringify({
      summary: { content: "Notification service with legend." },
      insights: [],
      suggestions: [{
        category: "response",
        content: validSystemDesignGuidance(),
        urgency: "high"
      }],
      practiceSteps: []
    })
  ];
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return jsonResponse(200, {
      choices: [{ finish_reason: "stop", message: { content: responses[requests.length - 1] } }]
    });
  });

  const output = await adapter.generate({
    apiKey: "sk-provider-secret",
    analysisModel: "gpt-4o-mini",
    imageReferences: ["data:image/png;base64,notification-service"],
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    task: "system_design",
    transcriptText: "Design a notification service"
  });

  assert.equal(requests.length, 3);
  assert.match(requests[2].messages[1].content, /REPAIR REQUIRED/);
  assert.match(requests[2].messages[1].content, /immediately followed/i);
  assert.match(requests[2].messages[1].content, /exactly nine numbered level-two stages/i);
  assert.match(requests[2].messages[1].content, /Problem, Solution, Trade-off headings/i);
  assert.match(output.suggestions[0].content, /## Legenda do diagrama/);
});

test("OpenAiCompatibleProviderAdapter repairs a System Design stage with an incomplete decision cycle", async () => {
  const requests = [];
  const invalidGuidance = validSystemDesignGuidance().replace(
    "### Trade-off\nBenefício e custo 5.\n\n> **Fala para entrevista:** Vou explicar a decisão 5 e seu custo.",
    "> **Fala para entrevista:** Vou explicar a decisão 5 sem declarar o trade-off."
  );
  const responses = [
    JSON.stringify({
      activeProblemTitle: "Design a URL shortener",
      problemFingerprint: "url-shortener"
    }),
    JSON.stringify({
      summary: { content: "Incomplete decision cycle." },
      insights: [],
      suggestions: [{ category: "response", content: invalidGuidance, urgency: "high" }],
      practiceSteps: []
    }),
    JSON.stringify({
      summary: { content: "Complete decision cycle." },
      insights: [],
      suggestions: [{ category: "response", content: validSystemDesignGuidance(), urgency: "high" }],
      practiceSteps: []
    })
  ];
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return jsonResponse(200, {
      choices: [{ finish_reason: "stop", message: { content: responses[requests.length - 1] } }]
    });
  });

  const output = await adapter.generate({
    apiKey: "sk-provider-secret",
    analysisModel: "gpt-4o-mini",
    imageReferences: ["data:image/png;base64,url-shortener-cycle"],
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    task: "system_design",
    transcriptText: "Design a URL shortener"
  });

  assert.equal(requests.length, 3);
  assert.match(requests[2].messages[1].content, /Problem, Solution, Trade-off headings/i);
  assert.match(output.suggestions[0].content, /### Trade-off\nBenefício e custo 5/);
});

test("OpenAiCompatibleProviderAdapter suppresses a repeated answer when extracted visual facts did not change", async () => {
  const currentAnalysis = {
    activeProblemTitle: "Two Sum",
    problemFingerprint: "two-sum",
    functionSignature: "twoSum(nums, target)",
    currentAttempt: "nested loops",
    observedTestResults: ["sample passes"],
    currentStage: "simple_correct",
    chronologicalProgress: ["cursor moved"]
  };
  let requestCount = 0;
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async () => {
    requestCount += 1;
    return jsonResponse(200, {
      choices: [{ message: { content: JSON.stringify(currentAnalysis) } }]
    });
  });

  const output = await adapter.generate({
    apiKey: "sk-provider-secret",
    analysisModel: "gpt-4o-mini",
    imageReferences: ["data:image/png;base64,two-sum"],
    previousVisualAnalysis: JSON.stringify({ ...currentAnalysis, chronologicalProgress: ["earlier capture"] }),
    programmingLanguage: "javascript",
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    task: "code_practice",
    transcriptText: "Two Sum"
  });

  assert.equal(requestCount, 1);
  assert.equal(output.skippedReason, "unchanged_visual_context");
  assert.equal(output.suggestions.length, 0);
});

test("OpenAiCompatibleProviderAdapter gives only the next complete tested step for an incremental attempt", async () => {
  const requests = [];
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return jsonResponse(200, {
      choices: [{ message: { content: requests.length === 1
        ? JSON.stringify({
            activeProblemTitle: "Two Sum",
            problemFingerprint: "two-sum",
            currentStage: "simple_correct",
            currentAttempt: "nested loops pass samples"
          })
        : JSON.stringify({
            summary: { content: "Agora troque a busca interna por um mapa." },
            insights: [],
            suggestions: [{
              category: "response",
              content: "## Dúvida atual\nComo evitar o segundo loop?\n\n## O que eu faria\nUsaria um mapa.\n\n> **Fala para entrevista:** Vou guardar cada valor já visto.",
              urgency: "high"
            }],
            practiceSteps: [{
              title: "Trocar busca por mapa",
              objective: "Reduzir o tempo para O(n)",
              completeCode: "function twoSum(nums, target) { const seen = new Map(); for (let i = 0; i < nums.length; i++) { const need = target - nums[i]; if (seen.has(need)) return [seen.get(need), i]; seen.set(nums[i], i); } return []; }",
              testCode: "console.log(twoSum([2, 7, 11, 15], 9));",
              expectedResult: "[0, 1]",
              explanation: "Cada elemento é visitado uma vez.",
              interviewerSpeech: "Vou trocar a busca linear interna por acesso médio O(1) em um mapa."
            }]
          }) } }]
    });
  });

  const output = await adapter.generate({
    apiKey: "sk-provider-secret",
    analysisModel: "gpt-4o-mini",
    imageReferences: ["data:image/png;base64,two-sum-progress"],
    previousCodePracticeGuidance: ["A solução simples com dois loops já passou os exemplos."],
    programmingLanguage: "javascript",
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    task: "code_practice",
    transcriptText: "Two Sum progress"
  });

  assert.equal(requests.length, 2);
  assert.match(requests[1].messages[1].content, /Do not repeat the child-simple introduction/);
  assert.doesNotMatch(output.suggestions[0].content, /Solução ótima de referência/);
  assert.equal(output.practiceSteps.length, 1);
});

test("OpenAiCompatibleProviderAdapter closes an already optimal exercise without another code step", async () => {
  let requestCount = 0;
  const adapter = new OpenAiCompatibleProviderAdapter("https://provider.example/v1", async () => {
    requestCount += 1;
    return jsonResponse(200, {
      choices: [{ message: { content: requestCount === 1
        ? JSON.stringify({
            activeProblemTitle: "Two Sum",
            problemFingerprint: "two-sum",
            currentStage: "optimal_correct",
            observedTestResults: ["all tests passed"]
          })
        : JSON.stringify({
            summary: { content: "Exercício concluído." },
            insights: [],
            suggestions: [{
              category: "response",
              content: "Todos os testes visíveis passaram com a solução O(n).\n\n> **Fala para entrevista:** A solução está completa e mantém tempo linear com espaço linear.",
              urgency: "high"
            }],
            practiceSteps: []
          }) } }]
    });
  });

  const output = await adapter.generate({
    apiKey: "sk-provider-secret",
    analysisModel: "gpt-4o-mini",
    imageReferences: ["data:image/png;base64,two-sum-complete"],
    programmingLanguage: "javascript",
    responseLanguage: "pt-BR",
    sessionId: "session-1",
    task: "code_practice",
    transcriptText: "Two Sum complete"
  });

  assert.equal(requestCount, 2);
  assert.match(output.suggestions[0].content, /Exercício|solução está completa/i);
  assert.deepEqual(output.practiceSteps, []);
});

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}

