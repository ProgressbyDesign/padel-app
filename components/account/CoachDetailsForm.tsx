"use client";

import { useActionState, useState } from "react";
import { updateManagedCoachDetailsAction } from "@/app/account/coaches/[coachId]/actions";
import {
  COACH_PROFILE_OUTCOME_OPTIONS,
  type CoachDetailsFormValues,
  type CoachDetailsUpdateState,
} from "@/lib/coachManagement";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-3 text-base text-primary outline-none transition placeholder:text-primary/35 focus:border-primary/35 focus:ring-2 focus:ring-primary/10";

const chipSelected = "border-primary bg-primary text-accent";
const chipIdle =
  "border-primary/15 bg-white text-primary hover:border-primary/30 hover:bg-surface";

function CoachDetailsFields({
  values,
  fieldErrors,
}: {
  values: CoachDetailsFormValues;
  fieldErrors: CoachDetailsUpdateState["fieldErrors"];
}) {
  const [outcomes, setOutcomes] = useState(values.outcomes);
  const [travelAvailable, setTravelAvailable] = useState(
    values.travel_available
  );
  const [audienceAdults, setAudienceAdults] = useState(values.audience_adults);
  const [audienceJuniors, setAudienceJuniors] = useState(
    values.audience_juniors
  );

  function toggleOutcome(value: string) {
    setOutcomes((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  return (
    <>
      <input type="hidden" name="travel_available" value={String(travelAvailable)} />
      <input type="hidden" name="audience_adults" value={String(audienceAdults)} />
      <input type="hidden" name="audience_juniors" value={String(audienceJuniors)} />
      {outcomes.map((outcome) => (
        <input key={outcome} type="hidden" name="outcomes" value={outcome} />
      ))}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-primary sm:col-span-2">
          Name
          <input
            className={inputClass}
            name="name"
            defaultValue={values.name}
            required
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name ? (
            <span className="mt-1.5 block text-sm text-red-700">
              {fieldErrors.name}
            </span>
          ) : null}
        </label>

        <label className="block text-sm font-medium text-primary sm:col-span-2">
          Role
          <input
            className={inputClass}
            name="role"
            defaultValue={values.role}
            aria-invalid={Boolean(fieldErrors.role)}
          />
          {fieldErrors.role ? (
            <span className="mt-1.5 block text-sm text-red-700">
              {fieldErrors.role}
            </span>
          ) : null}
        </label>

        <label className="block text-sm font-medium text-primary">
          Years of experience
          <input
            className={inputClass}
            type="number"
            name="experience_years"
            min={0}
            max={60}
            defaultValue={values.experience_years}
            aria-invalid={Boolean(fieldErrors.experience_years)}
          />
          {fieldErrors.experience_years ? (
            <span className="mt-1.5 block text-sm text-red-700">
              {fieldErrors.experience_years}
            </span>
          ) : null}
        </label>

        <label className="block text-sm font-medium text-primary">
          Phone
          <input
            className={inputClass}
            name="phone"
            defaultValue={values.phone}
            autoComplete="tel"
            aria-invalid={Boolean(fieldErrors.phone)}
          />
          {fieldErrors.phone ? (
            <span className="mt-1.5 block text-sm text-red-700">
              {fieldErrors.phone}
            </span>
          ) : null}
        </label>

        <label className="block text-sm font-medium text-primary">
          Price from (€)
          <input
            className={inputClass}
            type="number"
            name="price_from"
            min={0}
            max={10000}
            defaultValue={values.price_from}
            aria-invalid={Boolean(fieldErrors.price_from)}
          />
          {fieldErrors.price_from ? (
            <span className="mt-1.5 block text-sm text-red-700">
              {fieldErrors.price_from}
            </span>
          ) : null}
        </label>

        <div className="flex items-end">
          <label className="inline-flex items-center gap-2.5 text-sm font-medium text-primary">
            <input
              type="checkbox"
              checked={travelAvailable}
              onChange={(event) => setTravelAvailable(event.target.checked)}
              className="h-5 w-5 rounded border-primary/25 accent-primary"
            />
            Travel available
          </label>
        </div>
      </div>

      <label className="block text-sm font-medium text-primary">
        Description
        <textarea
          className={`${inputClass} min-h-36 resize-y`}
          name="description"
          defaultValue={values.description}
          maxLength={2000}
          aria-invalid={Boolean(fieldErrors.description)}
        />
        {fieldErrors.description ? (
          <span className="mt-1.5 block text-sm text-red-700">
            {fieldErrors.description}
          </span>
        ) : null}
      </label>

      <fieldset>
        <legend className="text-sm font-medium text-primary">Audiences</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={audienceAdults}
            onClick={() => setAudienceAdults((value) => !value)}
            className={`rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${
              audienceAdults ? chipSelected : chipIdle
            }`}
          >
            Adults
          </button>
          <button
            type="button"
            aria-pressed={audienceJuniors}
            onClick={() => setAudienceJuniors((value) => !value)}
            className={`rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${
              audienceJuniors ? chipSelected : chipIdle
            }`}
          >
            Juniors
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-primary">
          Coaching outcomes
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {COACH_PROFILE_OUTCOME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={outcomes.includes(option.value)}
              onClick={() => toggleOutcome(option.value)}
              className={`rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition ${
                outcomes.includes(option.value) ? chipSelected : chipIdle
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {fieldErrors.outcomes ? (
          <p className="mt-2 text-sm text-red-700">{fieldErrors.outcomes}</p>
        ) : null}
      </fieldset>
    </>
  );
}

export default function CoachDetailsForm({
  coachId,
  initialState,
}: {
  coachId: string;
  initialState: CoachDetailsUpdateState;
}) {
  const boundAction = updateManagedCoachDetailsAction.bind(null, coachId);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-6">
      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${
            state.status === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <CoachDetailsFields
        key={state.revision}
        values={state.values}
        fieldErrors={state.fieldErrors}
      />

      <p className="text-xs text-primary/50">
        Your account login email is separate from any public coach email and is
        not edited here.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}
