"use client";
import { useActionState } from "react";
import { createEventTypeAction, type FormState } from "@/app/actions";
import { Button, Field, Select, TextArea, TextInput } from "./ui";

const DURATIONS = [15, 30, 45, 60, 90];

export function EventTypeForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createEventTypeAction, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="max-w-xl space-y-5" noValidate>
      <Field id="name" label="Nom" error={e.name}>
        <TextInput id="name" name="name" required maxLength={80} error={e.name} placeholder="Par exemple : Échange de 30 minutes" />
      </Field>
      <Field id="duration" label="Durée" error={e.duration}>
        <Select id="duration" name="duration" defaultValue="30" error={e.duration}>
          {DURATIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}
        </Select>
      </Field>
      <Field id="locationKind" label="Lieu" error={e.locationKind}>
        <Select id="locationKind" name="locationKind" defaultValue="video" error={e.locationKind}>
          <option value="video">Visioconférence</option>
          <option value="phone">Téléphone</option>
          <option value="in_person">En personne</option>
          <option value="custom">Autre</option>
        </Select>
      </Field>
      <Field id="locationDetail" label="Précision sur le lieu" hint="Lien de la réunion, adresse ou numéro. Facultatif.">
        <TextInput id="locationDetail" name="locationDetail" maxLength={200} />
      </Field>
      <Field id="description" label="Description">
        <TextArea id="description" name="description" maxLength={1000} />
      </Field>
      <div className="flex gap-3">
        <Button type="submit" loading={pending}>Enregistrer</Button>
      </div>
    </form>
  );
}
