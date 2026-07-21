export type AuthActionState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

export const INITIAL_AUTH_ACTION_STATE: AuthActionState = {
  status: "idle",
  message: null,
};

export type AuthenticatedAccount = {
  id: string;
  email: string;
};

export type MembershipRole = "owner" | "manager";
