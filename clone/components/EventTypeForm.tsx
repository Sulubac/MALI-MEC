"use client";
import { useState } from "react";
import { saveEventTypeAction } from "@/app/actions";
import type { EventType, Question } from "@/lib/types";
import { LOCATION_LABEL } from "@/lib/format";
import { Button, ButtonLink, Card, Field, Notice, Select, TextArea, TextInput } from "./ui";
import { QuestionsEditor } from "./QuestionsEditor";
import { useKeptForm } from "./useKeptForm";

const DURATIONS = [15, 30, 45, 60, 90];
const NOTICES: [number, string][] = [[0, "Aucun"], [60, "1 heure"], [240, "4 heures"], [1440, "1 jour"], [2880, "2 jours"], [10080, "1 semaine"]];

export function EventTypeForm({ initial }: { initial?: EventType }) {
  const [state, action, pending] = useKeptForm(saveEventTypeAction);
  const e = state.fieldErrors ?? {};
  const [name, setName] = useState(initial?.name ?? "");
  const [duration, setDuration] = useState(String(initial?.durationMinutes ?? 30));
  const [location, setLocation] = useState<string>(initial?.locationKind ?? "video");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [questions, setQuestions] = useState<Question[]>(initial?.questions ?? []);
  const notice = initial?.minNoticeMinutes ?? 240;
  const durationOptions = DURATIONS.includes(Number(duration)) ? DURATIONS : [...DURATIONS, Number(duration)].sort((a, b) => a - b);
  const noticeOptions = NOTICES.some(([v]) => v === notice) ? NOTICES : ([...NOTICES, [notice, `${notice} minutes`]] as [number, string][]).sort((a, b) => a[0] - b[0]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form onSubmit={action} className="max-w-xl space-y-6" noValidate>
        {initial && <input type="hidden" name="id" value={initial.id} />}
        <input type="hidden" name="questions" value={JSON.stringify(questions)} />
        {state.error && <Notice>{state.error}</Notice>}

        <section className="space-y-5">
          <h2>Détails</h2>
          <Field id="name" label="Nom" error={e.name}>
            <TextInput id="name" name="name" required maxLength={80} value={name} onChange={(ev) => setName(ev.target.value)} error={e.name} placeholder="Par exemple : Échange de 30 minutes" />
          </Field>
          <Field id="duration" label="Durée" error={e.duration}>
            <Select id="duration" name="duration" value={duration} onChange={(ev) => setDuration(ev.target.value)} error={e.duration}>
              {durationOptions.map((d) => <option key={d} value={d}>{d} minutes</option>)}
            </Select>
          </Field>
          <Field id="locationKind" label="Lieu" error={e.locationKind}>
            <Select id="locationKind" name="locationKind" value={location} onChange={(ev) => setLocation(ev.target.value)} error={e.locationKind}>
              {Object.entries(LOCATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field id="locationDetail" label="Précision sur le lieu" hint="Lien de la réunion, adresse ou numéro. Facultatif.">
            <TextInput id="locationDetail" name="locationDetail" maxLength={200} defaultValue={initial?.locationDetail} />
          </Field>
          <Field id="description" label="Description">
            <TextArea id="description" name="description" maxLength={1000} value={description} onChange={(ev) => setDescription(ev.target.value)} />
          </Field>
        </section>

        <section className="space-y-5">
          <h2>Règles de réservation</h2>
          <Field id="minNotice" label="Préavis minimum" hint="Délai avant lequel on ne peut plus réserver." error={e.minNotice}>
            <Select id="minNotice" name="minNotice" defaultValue={String(notice)} error={e.minNotice}>
              {noticeOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field id="maxDays" label="Réservable jusqu'à (jours à l'avance)" error={e.maxDays}>
            <TextInput id="maxDays" name="maxDays" type="number" min={1} max={365} defaultValue={initial?.maxDaysAhead ?? 60} error={e.maxDays} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="bufferBefore" label="Marge avant (minutes)" error={e.bufferBefore}>
              <TextInput id="bufferBefore" name="bufferBefore" type="number" min={0} max={240} defaultValue={initial?.bufferBeforeMinutes ?? 0} error={e.bufferBefore} />
            </Field>
            <Field id="bufferAfter" label="Marge après (minutes)" error={e.bufferAfter}>
              <TextInput id="bufferAfter" name="bufferAfter" type="number" min={0} max={240} defaultValue={initial?.bufferAfterMinutes ?? 0} error={e.bufferAfter} />
            </Field>
            <Field id="limitPerDay" label="Maximum par jour" hint="Laissez vide pour ne pas limiter." error={e.limitPerDay}>
              <TextInput id="limitPerDay" name="limitPerDay" type="number" min={1} max={50} defaultValue={initial?.limitPerDay ?? ""} error={e.limitPerDay} />
            </Field>
            <Field id="limitPerWeek" label="Maximum par semaine" hint="Laissez vide pour ne pas limiter." error={e.limitPerWeek}>
              <TextInput id="limitPerWeek" name="limitPerWeek" type="number" min={1} max={250} defaultValue={initial?.limitPerWeek ?? ""} error={e.limitPerWeek} />
            </Field>
          </div>
        </section>

        <section className="space-y-5">
          <h2>Formulaire de l'invité</h2>
          <QuestionsEditor value={questions} onChange={setQuestions} error={e.questions} />
        </section>

        <section className="space-y-5">
          <h2>Après la réservation</h2>
          <Field id="redirectUrl" label="Rediriger vers une autre adresse" hint="Facultatif. Sinon l'invité voit la page de confirmation." error={e.redirectUrl}>
            <TextInput id="redirectUrl" name="redirectUrl" type="url" placeholder="https://" defaultValue={initial?.confirmationRedirectUrl} error={e.redirectUrl} />
          </Field>
        </section>

        <div className="flex gap-3">
          <Button type="submit" loading={pending}>Enregistrer</Button>
          <ButtonLink href="/event-types" variant="ghost">Annuler</ButtonLink>
        </div>
      </form>

      <aside aria-label="Aperçu de la page de réservation" className="lg:sticky lg:top-8 lg:self-start">
        <p className="mb-2 text-sm font-semibold">Aperçu pour l'invité</p>
        <Card className="space-y-2 p-4">
          <p className="text-sm text-muted">Alex Martin</p>
          <p className="break-words text-lg font-semibold">{name || "Nom du rendez-vous"}</p>
          <p className="text-sm text-muted">{duration} min · {LOCATION_LABEL[location]}</p>
          {description && <p className="whitespace-pre-line break-words text-sm">{description}</p>}
          {questions.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-border pt-2 text-sm text-muted">
              {questions.map((q) => <li key={q.id}>{q.label || "Question sans intitulé"}{q.required ? " *" : ""}</li>)}
            </ul>
          )}
        </Card>
      </aside>
    </div>
  );
}
