"use client";
import { startTransition, useActionState, type FormEvent } from "react";
import type { FormState } from "@/app/actions";

/**
 * Comme `useActionState`, mais sans la réinitialisation automatique des champs que React 19
 * applique après chaque envoi : en cas d'erreur de validation, la saisie de l'utilisateur est conservée.
 */
export function useKeptForm(action: (prev: FormState, fd: FormData) => Promise<FormState>) {
  const [state, dispatch, pending] = useActionState<FormState, FormData>(action, {});
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
  return [state, onSubmit, pending] as const;
}
