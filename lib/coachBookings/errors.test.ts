import { describe, expect, it } from "vitest";
import { bookingMutationErrorMessage, BOOKING_ERROR_COPY } from "./errors";

describe("booking publication errors", () => {
  it("explains when a coach or venue stops being published", () => {
    expect(bookingMutationErrorMessage({ name: "PostgrestError", code: "23514", message: "Booking requests require a published coach and venue.", details: "", hint: "" })).toBe(BOOKING_ERROR_COPY.RELATIONSHIP_UNAVAILABLE);
  });
});
