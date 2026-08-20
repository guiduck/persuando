import { ProviderAdapterError, type ProviderAdapter, type ProviderGenerationInput, type ProviderGenerationOutput, type ProviderTranscriptionInput, type ProviderTranscriptionOutput } from "./provider-adapter.js";

type FetchLike = typeof fetch;
const CODE_PRACTICE_MIN_CONTENT_LENGTH = 900;
const CODE_PRACTICE_MAX_TOKENS = 3200;
const DEFAULT_GENERATION_MAX_TOKENS = 900;

export class OpenAiCompatibleProviderAdapter implements ProviderAdapter {
  readonly name = "openai-compatible" as const;

  constructor(
    private readonly baseUrl = "https://api.openai.com/v1",
    private readonly fetchFn: FetchLike = fetch
  ) {}

  async transcribe(input: ProviderTranscriptionInput): Promise<ProviderTranscriptionOutput> {
    if (!input.apiKey) throw new ProviderAdapterError("PROVIDER_KEY_INVALID", "Provider API key is missing.", false);

    const form = new FormData();
    form.set("model", input.model);
    form.set("language", normalizeTranscriptionLanguage(input.language));
    form.set("temperature", "0");
    if (input.prompt) form.set("prompt", input.prompt);
    form.set(
      "file",
      new Blob([toArrayBuffer(input.audio)], { type: contentTypeForCodec(input.codec) }),
      fileNameForCodec(input.codec)
    );

    const response = await this.fetchProvider("/audio/transcriptions", input.apiKey, {
      body: form,
      method: "POST"
    });
    const payload = (await response.json()) as { text?: string; language?: string };
    return {
      transcript: {
        text: payload.text ?? "",
        confidence: 1,
        language: payload.language ?? input.language,
        provisional: false
      }
    };
  }

  async generate(input: ProviderGenerationInput): Promise<ProviderGenerationOutput> {
    if (!input.apiKey) throw new ProviderAdapterError("PROVIDER_KEY_INVALID", "Provider API key is missing.", false);

    const response = await this.fetchProvider("/chat/completions", input.apiKey, {
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: generationSystemPrompt(input.task)
          },
          {
            role: "user",
            content: generationUserContent(input)
          }
        ],
        model: input.analysisModel,
        max_tokens: generationMaxTokens(input.task),
        response_format: { type: "json_object" },
        temperature: generationTemperature(input.task)
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return parseGenerationContent(payload.choices?.[0]?.message?.content ?? "", input.transcriptText, input.task);
  }

  private async fetchProvider(path: string, apiKey: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${apiKey}`,
          ...(init.headers ?? {})
        }
      });
    } catch {
      throw new ProviderAdapterError("PROVIDER_UNAVAILABLE", "Provider network request failed.", true);
    }

    if (!response.ok) throw providerErrorForStatus(response.status);
    return response;
  }
}

function contentTypeForCodec(codec: ProviderTranscriptionInput["codec"]): string {
  if (codec === "webm-opus") return "audio/webm";
  if (codec === "pcm16") return "audio/wav";
  throw new ProviderAdapterError("AUDIO_FORMAT_UNSUPPORTED", "Audio codec is unsupported.", false);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function fileNameForCodec(codec: ProviderTranscriptionInput["codec"]): string {
  return codec === "webm-opus" ? "chunk.webm" : "chunk.wav";
}

function normalizeTranscriptionLanguage(language: string): string {
  return language.split("-")[0]?.toLowerCase() || language;
}

function providerErrorForStatus(status: number): ProviderAdapterError {
  if (status === 401 || status === 403) {
    return new ProviderAdapterError("PROVIDER_KEY_INVALID", "Provider credential could not be authorized.", false);
  }
  if (status === 408 || status === 504) {
    return new ProviderAdapterError("PROVIDER_TIMEOUT", "Provider request timed out.", true);
  }
  if (status === 402) {
    return new ProviderAdapterError("PROVIDER_QUOTA_EXCEEDED", "Provider quota is exhausted.", false);
  }
  if (status === 400 || status === 415) {
    return new ProviderAdapterError("AUDIO_FORMAT_UNSUPPORTED", "Provider rejected the audio format.", false);
  }
  if (status === 429) {
    return new ProviderAdapterError("PROVIDER_RATE_LIMITED", "Provider rate limit reached.", true);
  }
  if (status >= 500) {
    return new ProviderAdapterError("PROVIDER_UNAVAILABLE", "Provider is temporarily unavailable.", true);
  }
  return new ProviderAdapterError("PROVIDER_UNAVAILABLE", "Provider request failed.", false);
}

function generationMaxTokens(task: ProviderGenerationInput["task"]): number {
  return task === "code_practice" ? CODE_PRACTICE_MAX_TOKENS : DEFAULT_GENERATION_MAX_TOKENS;
}

function generationTemperature(task: ProviderGenerationInput["task"]): number {
  return task === "code_practice" ? 0.15 : 0.2;
}

function generationSystemPrompt(task: ProviderGenerationInput["task"]): string {
  if (task === "code_practice") {
    return [
      "You are Persuando Code Practice, a patient coding teacher for study, practice, preparation, and review.",
      "Use screenshots as primary context to identify the coding exercise, function signature, visible code, constraints, examples, errors, and the user's current attempt.",
      "Do not narrate the UI as the final answer and do not merely restate the prompt. Produce useful coaching for the programming problem itself.",
      "Responsible-use boundary: if the image or transcript appears to show a proctored exam, hiring assessment, interview assessment, live contest, or platform challenge where direct answers may be disallowed, do not provide copy-paste final code. Give conceptual coaching, hints, pseudocode, complexity analysis, and debugging direction instead.",
      "If the context clearly appears to be self-study, preparation, local practice, review, or a user-owned sandbox, you may include complete final code while teaching the reasoning.",
      "Return STRICT JSON with summary.content, insights[], and suggestions[]. Put the main teaching answer in suggestions[0].content with category='response' and urgency='high'.",
      "The teaching answer must be substantial, concrete, and usually 900 to 1500 words. It must include these labeled sections: Problema em palavras simples, Linguagem detectada, Ideia como para uma criança de 5 anos, Técnica escolhida, Passo a passo com trechos de código, Complexidade Big-O, Casos de borda, Pseudocódigo ou código quando permitido, and Exemplo rápido.",
      "Format suggestions[0].content as Markdown plain text. Use headings for sections, numbered lists for steps, inline code for identifiers, and fenced code blocks with a language tag for pseudocode or code. In the step-by-step section, every major step must include a small code snippet, usually 1 to 5 lines, that shows exactly what is being added or why that line exists.",
      "If the visible exercise is tree height, binary tree height, DFS, recursion, graph/tree traversal, sorting, dynamic programming, or any other recognizable pattern, solve that pattern directly instead of giving generic advice.",
      "Detect the programming language from the screenshot UI, language selector, file extension, function signature, visible syntax, or transcript. Use that detected language for pseudocode, snippets, and final code. If the language is unclear, fall back to JavaScript. When code is allowed and visible, preserve the user's language, class/function signature, parameter names, and data structure shape when possible.",
      "Do not output generic advice like 'understand basic concepts'. Do not stop after one paragraph. Do not give a code-free step list. Be concrete and didactic.",
      "Do not include secrets."
    ].join(" ");
  }

  if (task === "insights") {
    return "Generate focused meeting or study insights. Return JSON with summary.content, insights[], and suggestions[]. Prioritize key concepts, questions being asked, terms to explain, and risks. Do not include secrets.";
  }

  if (task === "followups") {
    return "Generate practical follow-up suggestions and things the user can say next. Return JSON with summary.content, insights[], and suggestions[]. Keep suggestions actionable. Do not include secrets.";
  }

  if (task === "summary") {
    return "Generate an accurate concise summary of the current session. Return JSON with summary.content, insights[], and suggestions[]. Do not include secrets.";
  }

  return "You generate concise meeting assistance. Return JSON with summary.content, insights[], and suggestions[]. Include direct answers, useful explanations, and follow-ups. Do not include secrets.";
}

function generationUserContent(input: ProviderGenerationInput): string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> {
  const text = input.task === "code_practice" ? codePracticeUserText(input) : `Task: ${input.task ?? "session_assistance"}
Language: ${input.responseLanguage}
Transcript and context:
${input.transcriptText}`;
  const imageReferences = input.imageReferences?.filter(Boolean) ?? [];
  if (imageReferences.length === 0) return text;
  return [
    { type: "text", text },
    ...imageReferences.slice(-4).map((url) => ({ type: "image_url" as const, image_url: { url } }))
  ];
}

function codePracticeUserText(input: ProviderGenerationInput): string {
  return `Task: code_practice
Language: ${input.responseLanguage}

Read the attached screenshots as the primary source. Look for a programming exercise, selected programming language, function signature, existing code, examples, constraints, and error messages.

Focus on teaching the programming problem. Do not describe the screenshot unless it is necessary to explain the reasoning. If the screenshot looks like an active assessment, platform challenge, proctored environment, or hiring/interview evaluation, give hints, same-language pseudocode, reasoning, and complexity analysis instead of copy-paste final code.

Required output inside suggestions[0].content:
- Use Markdown headings and lists in plain text.
- Use inline code for identifiers like function names and variables.
- Detect the programming language from the latest screenshot: language selector, editor syntax, file extension, function signature, imports, or transcript. If unclear, use JavaScript.
- Use fenced code blocks with the detected language tag for pseudocode, snippets, and code, for example \`\`\`javascript, \`\`\`typescript, \`\`\`python, \`\`\`java, or \`\`\`cpp. Avoid \`\`\`text for algorithm pseudocode unless no programming language can reasonably fit.
- Start by identifying the actual coding problem from the latest screenshot.
- Include a short "Linguagem detectada" section explaining the language you found or why you are using JavaScript fallback.
- Explain the problem in simple words.
- Explain the intuition as if teaching a 5-year-old.
- Name the chosen technique and why it fits.
- Give a "Passo a passo com trechos de código" section where each important step includes a short code snippet in the detected language. The steps should show the solution being built line by line, not just describe it.
- Include pseudocode in the detected language, or complete final code in a fenced code block only when clearly allowed for study/practice/review.
- Explain Big-O time complexity and why.
- Explain Big-O space complexity and why.
- List edge cases.
- Walk through a tiny example.

Quality bar:
- A one-paragraph response is invalid.
- A response that only repeats the exercise statement is invalid.
- A response without Big-O is invalid.
- A response without concrete steps is invalid.
- A response whose step-by-step section has no code snippets is invalid.
- A response that uses a different language than the visible exercise without explaining why is invalid.

Recent transcript and session context:
${input.transcriptText}`;
}
function parseGenerationContent(content: string, fallbackTranscript: string, task: ProviderGenerationInput["task"]): ProviderGenerationOutput {
  try {
    const parsed = JSON.parse(content) as Partial<ProviderGenerationOutput>;
    return normalizeGenerationOutput(
      {
        summary: parsed.summary?.content ? parsed.summary : { content: fallbackSummary(fallbackTranscript) },
        insights: Array.isArray(parsed.insights) ? parsed.insights : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : []
      },
      fallbackTranscript,
      task
    );
  } catch {
    return normalizeGenerationOutput(
      {
        summary: { content: fallbackSummary(fallbackTranscript) },
        insights: [],
        suggestions: [
          {
            category: "response",
            content,
            urgency: "medium"
          }
        ]
      },
      fallbackTranscript,
      task
    );
  }
}

function normalizeGenerationOutput(output: ProviderGenerationOutput, fallbackTranscript: string, task: ProviderGenerationInput["task"]): ProviderGenerationOutput {
  if (task !== "code_practice") return output;
  const primary = output.suggestions[0]?.content?.trim() ?? "";
  if (isUsefulCodePracticeGuidance(primary)) return output;

  return {
    ...output,
    suggestions: [
      {
        category: "response",
        content: codePracticeQualityFallback(primary || output.summary.content, fallbackTranscript),
        urgency: "high"
      },
      ...output.suggestions.slice(1)
    ]
  };
}

function isUsefulCodePracticeGuidance(content: string): boolean {
  if (content.length < CODE_PRACTICE_MIN_CONTENT_LENGTH) return false;
  if (!/(big-?o|o\()/i.test(content)) return false;
  if (!/(passo|step|algorithm|algoritmo|técnica|technique)/i.test(content)) return false;
  if (!/```(?:javascript|typescript|python|java|cpp|csharp|go|ruby|php|swift|kotlin)/i.test(content)) return false;
  if (!/(linguagem detectada|detected language|language detected)/i.test(content)) return false;
  return true;
}

function codePracticeQualityFallback(shortAnswer: string, fallbackTranscript: string): string {
  const context = `${shortAnswer}\n${fallbackTranscript}`.trim();
  if (/tree|árvore|arvore|height|altura|getheight|binary/i.test(context)) {
    return [
      "## Problema em palavras simples",
      "Pelo contexto visível, o exercício parece ser sobre calcular a altura de uma árvore binária. A altura é o maior caminho que sai da raiz e chega até uma folha. Em plataformas como HackerRank, esse problema costuma medir altura em arestas, então uma árvore com apenas a raiz tem altura 0.",
      "",
      "## Linguagem detectada",
      "Não deu para confirmar a linguagem com total segurança pelo fallback, então vou usar JavaScript. Se o editor mostrar outra linguagem, mantenha a mesma ideia e troque apenas a sintaxe.",
      "",
      "## Ideia como para uma criança de 5 anos",
      "Imagine que cada nó é uma pecinha de brinquedo. Para saber a altura de uma pecinha, você pergunta para os dois lados: quantas pecinhas existem no caminho da esquerda? E quantas existem no caminho da direita? O lado que tiver o maior caminho ganha. A resposta da pecinha atual é esse maior caminho mais um passo para chegar nela.",
      "",
      "## Técnica escolhida",
      "Use DFS com recursão. DFS combina com árvore porque você resolve o mesmo mini-problema em cada nó: calcular a altura do filho esquerdo, calcular a altura do filho direito e escolher o maior resultado.",
      "",
      "## Passo a passo com trechos de código",
      "1. Comece criando a função com o mesmo nome que a plataforma pediu. No HackerRank em JavaScript, normalmente a assinatura é `function getHeight(root) { ... }`.",
      "```javascript\nfunction getHeight(root) {\n  // vamos preencher aqui dentro\n}\n```",
      "2. Trate o caso em que o nó não existe. Como o enunciado conta arestas, retornar `-1` faz uma árvore com só a raiz virar `0`.",
      "```javascript\nif (root === null) {\n  return -1;\n}\n```",
      "3. Pergunte a altura do lado esquerdo chamando a própria função. Isso desce pela árvore até encontrar uma folha.",
      "```javascript\nconst leftHeight = getHeight(root.left);\n```",
      "4. Faça a mesma coisa para o lado direito. A função não precisa saber se o lado é grande ou pequeno; ela só calcula.",
      "```javascript\nconst rightHeight = getHeight(root.right);\n```",
      "5. Escolha o maior lado, porque altura é o caminho mais longo até uma folha.",
      "```javascript\nconst tallestChild = Math.max(leftHeight, rightHeight);\n```",
      "6. Some `1` para contar a aresta que liga o nó atual ao filho mais alto.",
      "```javascript\nreturn 1 + tallestChild;\n```",
      "",
      "## Pseudocódigo ou código quando permitido",
      "Se este for um ambiente de estudo, preparação ou prática, a versão completa em JavaScript fica assim:",
      "```javascript\nfunction getHeight(root) {\n  if (root === null) {\n    return -1;\n  }\n\n  const leftHeight = getHeight(root.left);\n  const rightHeight = getHeight(root.right);\n\n  return 1 + Math.max(leftHeight, rightHeight);\n}\n```",
      "Se a plataforma contar altura em número de nós, troque o caso base para `return 0`. Mas se o enunciado disser que altura é número de arestas, mantenha `return -1` para nó vazio.",
      "",
      "## Complexidade Big-O",
      "Tempo: O(n), porque cada nó da árvore é visitado uma única vez. Se existem 20 nós, a função chama a lógica para cada um dos 20 nós.",
      "",
      "Espaço: O(h), onde `h` é a altura da árvore. Esse espaço vem da pilha de chamadas da recursão. Em uma árvore equilibrada, `h` fica perto de `log n`; em uma árvore muito torta, `h` pode chegar a `n`.",
      "",
      "## Casos de borda",
      "- Árvore vazia: retorna `-1` se contar arestas, ou `0` se contar nós.",
      "- Árvore com só a raiz: retorna `0` quando conta arestas.",
      "- Árvore só para a esquerda: a recursão ainda funciona.",
      "- Árvore só para a direita: a recursão também funciona.",
      "- Árvore equilibrada: o maior entre esquerda e direita decide a altura.",
      "",
      "## Exemplo rápido",
      "Se a raiz tem um caminho maior que passa por três arestas, as folhas retornam `0`, os pais retornam `1`, o próximo nível retorna `2`, e a raiz retorna `3`. É como subir a resposta de baixo para cima."
    ].join("\n");
  }

  return [
    "## Problema em palavras simples",
    "A resposta automática anterior veio curta demais para ser útil. Use o print mais recente para identificar o enunciado, a assinatura da função, exemplos e restrições antes de continuar.",
    "",
    "## Linguagem detectada",
    "Não deu para confirmar a linguagem com segurança, então use JavaScript como fallback. Se o editor mostrar Python, Java, C++ ou outra linguagem, mantenha a ideia e adapte a sintaxe.",
    "",
    "## Ideia como para uma criança de 5 anos",
    "Primeiro descubra qual brinquedo precisa montar. Depois separe as peças: entrada, saída, regra principal e casos estranhos. Só então monte uma solução pequena e teste com um exemplo.",
    "",
    "## Técnica escolhida",
    "Escolha a técnica pelo formato do problema: árvore/grafo sugere DFS ou BFS; lista ordenada sugere dois ponteiros ou busca binária; subproblemas repetidos sugerem programação dinâmica; contagem/frequência sugere mapa/hash.",
    "",
    "## Passo a passo com trechos de código",
    "1. Guarde a entrada em nomes claros.",
    "```javascript\nconst input = readInput();\n```",
    "2. Crie uma função pequena para resolver o núcleo do problema.",
    "```javascript\nfunction solve(input) {\n  // escolha a técnica aqui\n}\n```",
    "3. Percorra apenas o que for necessário e atualize uma resposta.",
    "```javascript\nlet answer = null;\nfor (const item of input) {\n  // atualize answer usando item\n}\n```",
    "4. Retorne exatamente o formato pedido pelo enunciado.",
    "```javascript\nreturn answer;\n```",
    "",
    "## Pseudocódigo ou código quando permitido",
    "```javascript\nfunction solve(input) {\n  const state = new Map();\n\n  for (const item of input) {\n    // aplique a regra principal do problema\n    state.set(item, (state.get(item) ?? 0) + 1);\n  }\n\n  return computeAnswerFrom(state);\n}\n```",
    "",
    "## Complexidade Big-O",
    "Tempo: explique quantas vezes cada item é visitado. Se cada item é lido uma vez, normalmente é O(n). Espaço: explique quais estruturas extras são criadas; por exemplo, um mapa pode custar O(n).",
    "",
    "## Casos de borda",
    "- Entrada vazia.",
    "- Entrada com um elemento.",
    "- Valores repetidos.",
    "- Valores já ordenados ou totalmente desordenados.",
    "- Resultado inexistente.",
    "",
    "## Exemplo rápido",
    "Pegue o menor exemplo do enunciado e simule cada linha do algoritmo. Se uma variável muda, mostre o valor novo dela."
  ].join("\n");
}
function fallbackSummary(transcriptText: string): string {
  return `Current session summary: ${transcriptText.trim().slice(0, 120)}`;
}
