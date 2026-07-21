"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateManagedVenueAction } from "@/app/account/venues/[venueId]/actions";
import CountryCombobox from "@/components/account/CountryCombobox";
import OpeningHoursEditor from "@/components/account/OpeningHoursEditor";
import { VENUE_TYPE_OPTIONS } from "@/lib/venueEditorOptions";
import type {
  VenueFormField,
  VenueUpdateState,
} from "@/lib/venueManagement";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-3 text-base text-primary outline-none transition placeholder:text-primary/35 focus:border-primary/35 focus:ring-2 focus:ring-primary/10 disabled:bg-primary/5";

const textareaClass = `${inputClass} resize-y`;

function FieldError({
  field,
  state,
}: {
  field: VenueFormField;
  state: VenueUpdateState;
}) {
  const message = state.fieldErrors[field];
  if (!message) return null;
  return (
    <span id={`${field}-error`} className="mt-1.5 block text-sm text-red-700">
      {message}
    </span>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-65"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

function CourtTypeControls({
  initialValue,
  invalid,
  describedBy,
}: {
  initialValue: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [indoor, setIndoor] = useState(
    initialValue === "indoor" || initialValue === "mixed"
  );
  const [outdoor, setOutdoor] = useState(
    initialValue === "outdoor" || initialValue === "mixed"
  );
  const value = indoor && outdoor ? "mixed" : indoor ? "indoor" : outdoor ? "outdoor" : "";

  return (
    <fieldset
      className="sm:col-span-2"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
    >
      <legend className="text-sm font-medium text-primary">Court type</legend>
      <input type="hidden" name="court_type" value={value} />
      <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
        {[
          {
            label: "Indoor",
            checked: indoor,
            setChecked: setIndoor,
          },
          {
            label: "Outdoor",
            checked: outdoor,
            setChecked: setOutdoor,
          },
        ].map((option) => (
          <label
            key={option.label}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
              option.checked
                ? "border-primary bg-primary text-white"
                : "border-primary/15 bg-white text-primary hover:bg-surface"
            }`}
          >
            <input
              type="checkbox"
              checked={option.checked}
              onChange={(event) => option.setChecked(event.target.checked)}
              className="h-5 w-5 rounded border-primary/25 accent-accent"
            />
            <span className="font-semibold">{option.label}</span>
          </label>
        ))}
      </div>
      {initialValue === "unknown" ? (
        <p className="mt-2 text-sm text-amber-700">
          The existing court type is unknown. Choose at least one option.
        </p>
      ) : null}
    </fieldset>
  );
}

export default function VenueBasicInformationForm({
  venueId,
  initialState,
  legacyOpeningHours,
  legacyImageUrl,
}: {
  venueId: string;
  initialState: VenueUpdateState;
  legacyOpeningHours: string | null;
  legacyImageUrl: string | null;
}) {
  const updateVenue = updateManagedVenueAction.bind(null, venueId);
  const [state, formAction] = useActionState(updateVenue, initialState);
  const [resetVersion, setResetVersion] = useState(0);

  function fieldAccessibility(field: VenueFormField) {
    const invalid = Boolean(state.fieldErrors[field]);
    return {
      "aria-invalid": invalid || undefined,
      "aria-describedby": invalid ? `${field}-error` : undefined,
    };
  }

  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-7">
      <div>
        <h2 className="text-2xl font-bold text-primary">Basic information</h2>
        <p className="mt-1 text-sm leading-6 text-primary/60">
          Keep the public venue details accurate and useful for players.
        </p>
      </div>

      <form
        key={`${state.revision}-${resetVersion}`}
        action={formAction}
        className="mt-7 space-y-7"
        onReset={(event) => {
          event.preventDefault();
          setResetVersion((current) => current + 1);
        }}
      >
        {state.message ? (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={`rounded-xl border px-4 py-3 text-sm ${
              state.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {state.message}
          </p>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-primary sm:col-span-2">
            Venue name
            <input
              className={inputClass}
              type="text"
              name="name"
              defaultValue={state.values.name}
              maxLength={120}
              autoComplete="organization"
              required
              {...fieldAccessibility("name")}
            />
            <FieldError field="name" state={state} />
          </label>

          <label className="block text-sm font-medium text-primary sm:col-span-2">
            Address
            <input
              className={inputClass}
              type="text"
              name="address"
              defaultValue={state.values.address}
              maxLength={300}
              autoComplete="street-address"
              {...fieldAccessibility("address")}
            />
            <FieldError field="address" state={state} />
          </label>

          <label className="block text-sm font-medium text-primary">
            City
            <input
              className={inputClass}
              type="text"
              name="city"
              defaultValue={state.values.city}
              maxLength={100}
              autoComplete="address-level2"
              required
              {...fieldAccessibility("city")}
            />
            <FieldError field="city" state={state} />
          </label>

          <div className="block text-sm font-medium text-primary">
            <label htmlFor="venue-country-search">Country</label>
            <CountryCombobox
              initialValue={state.values.country}
              invalid={Boolean(state.fieldErrors.country)}
              describedBy={
                state.fieldErrors.country ? "country-error" : undefined
              }
            />
            <FieldError field="country" state={state} />
          </div>

          <label className="block text-sm font-medium text-primary">
            Phone
            <input
              className={inputClass}
              type="tel"
              name="phone"
              defaultValue={state.values.phone}
              maxLength={40}
              autoComplete="tel"
              {...fieldAccessibility("phone")}
            />
            <FieldError field="phone" state={state} />
          </label>

          <label className="block text-sm font-medium text-primary">
            Website
            <input
              className={inputClass}
              type="url"
              name="website"
              defaultValue={state.values.website}
              placeholder="https://example.com"
              autoComplete="url"
              {...fieldAccessibility("website")}
            />
            <FieldError field="website" state={state} />
          </label>

          <fieldset
            className="sm:col-span-2"
            aria-invalid={Boolean(state.fieldErrors.venue_type) || undefined}
            aria-describedby={
              state.fieldErrors.venue_type ? "venue_type-error" : undefined
            }
          >
            <legend className="text-sm font-medium text-primary">
              Venue type
            </legend>
            <div className="mt-1.5 grid gap-3 md:grid-cols-2">
              {VENUE_TYPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer gap-3 rounded-xl border border-primary/15 bg-white p-4 transition has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-white"
                >
                  <input
                    type="radio"
                    name="venue_type"
                    value={option.value}
                    defaultChecked={state.values.venue_type === option.value}
                    required
                    className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
                  />
                  <span>
                    <span className="block font-semibold">{option.label}</span>
                    <span className="mt-1 block text-sm leading-5 opacity-70">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {state.values.venue_type === "unknown" ? (
              <p className="mt-2 text-sm text-amber-700">
                The existing venue type is unknown. Choose one of the supported
                options.
              </p>
            ) : null}
            <FieldError field="venue_type" state={state} />
          </fieldset>

          <label className="block text-sm font-medium text-primary">
            Number of courts
            <input
              className={inputClass}
              type="number"
              name="courts"
              defaultValue={state.values.courts}
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              {...fieldAccessibility("courts")}
            />
            <FieldError field="courts" state={state} />
          </label>

          <CourtTypeControls
            initialValue={state.values.court_type}
            invalid={Boolean(state.fieldErrors.court_type)}
            describedBy={
              state.fieldErrors.court_type ? "court_type-error" : undefined
            }
          />
          <div className="-mt-3 sm:col-span-2">
            <FieldError field="court_type" state={state} />
          </div>

          <label className="block text-sm font-medium text-primary">
            Price information
            <input
              className={inputClass}
              type="text"
              name="price"
              defaultValue={state.values.price}
              maxLength={120}
              placeholder="From €20 per hour"
              {...fieldAccessibility("price")}
            />
            <FieldError field="price" state={state} />
          </label>

          <div className="rounded-xl border border-primary/10 bg-surface/70 p-4 sm:col-span-2">
            <p className="text-sm font-semibold text-primary">
              Legacy image fallback
            </p>
            <p className="mt-1 text-sm leading-5 text-primary/55">
              Images are managed in the Venue images section. This existing
              fallback URL is preserved but cannot be edited here.
            </p>
            <p className="mt-2 break-all text-xs text-primary/60">
              {legacyImageUrl?.trim() || "No legacy image URL"}
            </p>
          </div>
        </div>

        <fieldset className="rounded-2xl border border-primary/10 bg-surface/70 p-4 sm:p-5">
          <legend className="px-1 text-sm font-semibold text-primary">Coaching</legend>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="coaching_available"
              value="true"
              defaultChecked={state.values.coaching_available}
              className="mt-0.5 h-5 w-5 rounded border-primary/25 accent-primary"
            />
            <span>
              <span className="block text-sm font-semibold text-primary">
                Coaching is available at this venue
              </span>
              <span className="mt-0.5 block text-sm text-primary/55">
                This is displayed on the public venue page.
              </span>
            </span>
          </label>

          <label className="mt-5 block text-sm font-medium text-primary">
            Coaching description
            <textarea
              className={textareaClass}
              name="coaching_description"
              defaultValue={state.values.coaching_description}
              maxLength={1200}
              rows={4}
              {...fieldAccessibility("coaching_description")}
            />
            <FieldError field="coaching_description" state={state} />
          </label>
        </fieldset>

        <div>
          <OpeningHoursEditor
            initialJson={state.values.opening_hours_structured}
            legacyText={legacyOpeningHours}
            invalid={Boolean(state.fieldErrors.opening_hours_structured)}
            describedBy={
              state.fieldErrors.opening_hours_structured
                ? "opening_hours_structured-error"
                : undefined
            }
          />
          <FieldError field="opening_hours_structured" state={state} />
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-primary/10 pt-5 sm:flex-row sm:justify-end">
          <button
            type="reset"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface"
          >
            Reset changes
          </button>
          <SaveButton />
        </div>
      </form>
    </section>
  );
}
