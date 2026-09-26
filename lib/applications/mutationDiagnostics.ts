import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Temporary server-side diagnostics for application mutations.
 *
 * Logs only identifiers plus the Supabase/PostgREST error envelope so the
 * server log identifies the real failure while the browser keeps a generic
 * message. Never pass emails, tokens, request bodies, or row contents here.
 */
export type ApplicationMutationContext = {
  applicationId: string;
  userId: string;
};

type MutationErrorLike = Pick<
  PostgrestError,
  "code" | "message" | "details" | "hint"
>;

const FAILING_ROW_DETAIL = /failing row contains \([\s\S]*?\)\.?/gi;

/**
 * Postgres constraint violations echo the whole row in `details`
 * ("Failing row contains (...)"), which would leak personal data into logs.
 */
export function redactMutationErrorDetails(
  details: string | null | undefined
): string | null {
  if (!details) return null;
  return details.replace(FAILING_ROW_DETAIL, "Failing row contains ([redacted]).");
}

export function describeApplicationMutationFailure(
  context: ApplicationMutationContext,
  error: MutationErrorLike
) {
  return {
    applicationId: context.applicationId,
    userId: context.userId,
    code: error.code ?? null,
    message: error.message ?? null,
    details: redactMutationErrorDetails(error.details),
    hint: error.hint ?? null,
  };
}

export function logApplicationMutationFailure(
  scope: string,
  context: ApplicationMutationContext,
  error: MutationErrorLike
): void {
  console.error(
    `[applications] ${scope} failed`,
    describeApplicationMutationFailure(context, error)
  );
}
