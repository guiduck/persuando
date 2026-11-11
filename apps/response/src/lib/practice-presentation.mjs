const languageAliases = { js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript", py: "python", cs: "csharp", sh: "bash", shell: "bash", html: "xml", vue: "xml", yml: "yaml", md: "markdown", txt: "text" };
const languages = new Set(["javascript", "typescript", "python", "java", "csharp", "go", "cpp", "c", "css", "json", "bash", "xml", "yaml", "sql", "ruby", "kotlin", "swift", "php", "rust", "markdown", "text", "powershell", "plaintext"]);

export function codeLanguage(code, hint = "") {
  const supplied = hint.trim().toLowerCase();
  if (languages.has(supplied) || languageAliases[supplied]) return languageAliases[supplied] ?? supplied;
  const extension = /\.([a-z]+)\b/i.exec(hint)?.[1]?.toLowerCase();
  if (extension && (languages.has(extension) || languageAliases[extension])) return languageAliases[extension] ?? extension;
  if (/^\s*(?:from \S+ import |def |import (?:unittest|pytest))/m.test(code)) return "python";
  if (/\b(?:public|private)\s+(?:static\s+)?(?:class|void|int)\b/.test(code)) return /using System/.test(code) ? "csharp" : "java";
  if (/^\s*(?:npm |npx |cd |node --|\$ )/m.test(code)) return "bash";
  return "javascript";
}

export function fencedCode(code, language) {
  const longest = Math.max(0, ...[...code.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${code}\n${fence}`;
}

export function isManualCheck(step) {
  if (step.testKind) return step.testKind === "manual";
  return /^\s*(?:manual\b|ui checks?\b|checks? manuais\b|verifica(?:ção|ções) manua(?:l|is)\b|teste manual\b)/i.test(step.testCode);
}

// Older answers may embed speech after a paragraph/list item. Keep code fences untouched.
export function emphasizeInterviewSpeech(markdown) {
  let fence;
  return markdown.split(/\r?\n/).map((line) => {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      return line;
    }
    if (fence || /^\s*>/.test(line)) return line;
    const match = /(?:\*\*)?((?:(?:Opening|Closing) )?interview speech|What I would say to the interviewer|Fala para entrevista)(?:\*\*)?\s*(?::|→|->|—)\s*(?:\*\*)?(.+)$/i.exec(line);
    if (!match) return line;
    const before = line.slice(0, match.index).trimEnd();
    const list = /^(\s*)(?:\d+[.)]|[-+*])\s+/.exec(line);
    const indent = list ? " ".repeat(list[0].length) : /^\s*/.exec(line)[0];
    const quote = `> **${match[1]}:** ${match[2]}`;
    if (list && !before.slice(list[0].trimEnd().length).trim()) return `${list[0]}${quote}`;
    return before.trim() ? `${before}\n\n${indent}${quote}` : `${indent}${quote}`;
  }).join("\n");
}
