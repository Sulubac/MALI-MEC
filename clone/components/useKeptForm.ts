"use client";
import { startTransition, useActionState, type FormEvent } from "react";
import type { FormState } from "@/app/actions";

/**
 * Comme `useActionState`, mais sans la réinitialisation automatique des champs que React 19
 * applique après chaque envoi : en cas d'erreur de validation, la saisie de l'utilisateur est conservée.
 */
export function useKeptForm(action: (prev: FormState, fd: FormData) => Promise<FormState>) {
  const safe = async (prev: FormState, fd: FormData): Promise<FormState> => {
    try {
      return await action(prev, fd);
    } catch (e) {
      // redirections et « introuvable » de Next passent par une exception : on les laisse passer
      const digest = (e as { digest?: unknown } | null)?.digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_")) throw e;
      return { error: "Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez." };
    }
  };
  const [state, dispatch, pending] = useActionState<FormState, FormData>(safe, {});
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
  return [state, onSubmit, pending] as const;
}
