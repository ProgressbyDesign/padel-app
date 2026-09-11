import { describe, expect, it } from "vitest";
import { signupIntent } from "./signupIntent";
describe("signup intent presentation hint", () => {
  it("remembers coach and venue application entry points", () => {
    expect(signupIntent("/account/applications/coach")).toBe("coach");
    expect(signupIntent("/account/applications/venue?step=1")).toBe("venue");
  });
  it("does not mistake booking or unrelated paths for partner signup", () => {
    expect(signupIntent("/book/coach/123")).toBe("player");
    expect(signupIntent("/account")).toBe("player");
    expect(signupIntent("/other?next=/account/applications/coach")).toBe("player");
  });
});
