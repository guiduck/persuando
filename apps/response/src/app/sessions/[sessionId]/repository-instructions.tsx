"use client";

import { MAX_REPOSITORY_INSTRUCTIONS_LENGTH } from "@persuando/contracts";
import { useId } from "react";

export interface RepositoryPracticeSetup {
  instructions: string;
  ready: boolean;
}

const storageKey = (sessionId: string) => `persuando:${sessionId}:repository-instructions:v1`;

export function loadRepositorySetup(sessionId: string): RepositoryPracticeSetup {
  try {
    const stored: unknown = JSON.parse(window.sessionStorage.getItem(storageKey(sessionId)) ?? "null");
    if (stored && typeof stored === "object" && "instructions" in stored && typeof stored.instructions === "string"
      && stored.instructions.length <= MAX_REPOSITORY_INSTRUCTIONS_LENGTH && "ready" in stored && stored.ready === true) {
      return { instructions: stored.instructions, ready: true };
    }
  } catch { /* The optional step also works when browser storage is unavailable. */ }
  return { instructions: "", ready: false };
}

export function saveRepositorySetup(sessionId: string, setup: RepositoryPracticeSetup): void {
  try {
    window.sessionStorage.setItem(storageKey(sessionId), JSON.stringify(setup));
  } catch { /* Keep the current in-memory setup when storage is unavailable. */ }
}

export function clearRepositorySetup(sessionId: string): void {
  try {
    window.sessionStorage.removeItem(storageKey(sessionId));
  } catch { /* Storage may be unavailable. */ }
}

export function RepositoryInstructionsStep({ disabled, onChange, setup }: Readonly<{
  disabled: boolean;
  onChange(setup: RepositoryPracticeSetup): void;
  setup: RepositoryPracticeSetup;
}>) {
  const inputId = useId();
  const helpId = `${inputId}-help`;
  return (
    <div className="repository-instructions">
      <strong>Antes do treino: instruções específicas (opcional)</strong>
      {setup.ready ? (
        <>
          <p role="status">{setup.instructions ? "Instruções incluídas nas próximas respostas de Repository." : "Treino sem instruções extras."}</p>
          <button className="button subtle small" disabled={disabled} onClick={() => onChange({ ...setup, ready: false })} type="button">Editar instruções</button>
        </>
      ) : (
        <>
          <label htmlFor={inputId}>Prompt, enunciado ou e-mail do teste</label>
          <p id={helpId}>Cole o texto completo com requisitos, tempo disponível, plataforma, dataset e regras. Ele complementa o passo a passo, a validação e a fala para entrevista no treino prévio.</p>
          <textarea
            aria-describedby={helpId}
            disabled={disabled}
            id={inputId}
            maxLength={MAX_REPOSITORY_INSTRUCTIONS_LENGTH}
            onChange={(event) => onChange({ instructions: event.target.value, ready: false })}
            placeholder={"Ex.: Live Coding Interview\nTempo: 90 minutos. Projeto mobile com dataset JSON ou CSV.\nAmbiente e emulador já configurados. Implementar requisitos, executar testes e explicar decisões."}
            rows={9}
            value={setup.instructions}
          />
          <small>{setup.instructions.length.toLocaleString("pt-BR")} / 16.000 caracteres. O texto fica nesta aba por sessão e é enviado ao modelo ao gerar.</small>
          <div className="repository-instructions-actions">
            <button className="button subtle" disabled={disabled || !setup.instructions.trim()} onClick={() => onChange({ instructions: setup.instructions.trim(), ready: true })} type="button">Continuar com instruções</button>
            <button className="button subtle" disabled={disabled} onClick={() => onChange({ instructions: "", ready: true })} type="button">Pular / continuar sem instruções</button>
          </div>
        </>
      )}
    </div>
  );
}
