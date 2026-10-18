"use client";
import { useId } from "react";
import type { Question } from "@/lib/types";
import { Button, Select, TextInput } from "./ui";

const KIND_LABEL: Record<Question["kind"], string> = { text: "Texte court", textarea: "Texte long", select: "Liste de choix", checkbox: "Case à cocher" };

export function QuestionsEditor({ value, onChange, error }: { value: Question[]; onChange: (q: Question[]) => void; error?: string }) {
  const uid = useId();
  const set = (i: number, patch: Partial<Question>) => onChange(value.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">Questions pour l'invité</legend>
      {value.length === 0 && <p className="text-sm text-muted">Aucune question en plus du nom et de l'adresse e-mail.</p>}
      <ol className="space-y-3">
        {value.map((q, i) => (
          <li key={q.id} className="space-y-3 rounded-lg border border-border p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
              <div>
                <label htmlFor={`${uid}-l-${i}`} className="mb-1 block text-sm font-semibold">Intitulé {i + 1}</label>
                <TextInput id={`${uid}-l-${i}`} value={q.label} maxLength={200} onChange={(e) => set(i, { label: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`${uid}-k-${i}`} className="mb-1 block text-sm font-semibold">Type</label>
                <Select id={`${uid}-k-${i}`} value={q.kind} onChange={(e) => set(i, { kind: e.target.value as Question["kind"], options: e.target.value === "select" && q.options.length < 2 ? ["", ""] : q.options })}>
                  {(Object.keys(KIND_LABEL) as Question["kind"][]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </Select>
              </div>
            </div>
            {q.kind === "select" && (
              <div>
                <label htmlFor={`${uid}-o-${i}`} className="mb-1 block text-sm font-semibold">Choix (un par ligne)</label>
                <textarea id={`${uid}-o-${i}`} rows={3} value={q.options.join("\n")} onChange={(e) => set(i, { options: e.target.value.split("\n") })}
                  className="w-full rounded-md border border-border-input bg-bg px-3 py-2" />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="mr-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={q.required} onChange={(e) => set(i, { required: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
                Réponse obligatoire
              </label>
              <Button type="button" variant="ghost" size="sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Monter la question ${i + 1}`}>↑</Button>
              <Button type="button" variant="ghost" size="sm" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={`Descendre la question ${i + 1}`}>↓</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(value.filter((_, j) => j !== i))}>Supprimer la question {i + 1}</Button>
            </div>
          </li>
        ))}
      </ol>
      {error && <p className="text-sm text-danger">{error}</p>}
      {value.length < 10 && (
        <Button type="button" variant="secondary" size="sm"
          onClick={() => onChange([...value, { id: `new-${Date.now()}-${value.length}`, label: "", kind: "text", options: [], required: false }])}>
          Ajouter une question
        </Button>
      )}
    </fieldset>
  );
}
