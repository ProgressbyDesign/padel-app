export type SignupPageCopy = {
  title: string;
  description: string;
  metadataTitle: string;
  metadataDescription: string;
};

export function isPartnerSignupPath(nextPath: string): boolean {
  return (
    nextPath.includes("/account/applications/coach") ||
    nextPath.includes("/account/applications/venue")
  );
}

export function signupPageCopy(nextPath: string): SignupPageCopy {
  if (nextPath.includes("/account/applications/coach")) {
    return {
      title: "Create your account",
      description:
        "Create an account to apply as a Padel Pathways coach. This is a partner application, not a player signup.",
      metadataTitle: "Create account",
      metadataDescription: "Create an account to apply as a Padel Pathways coach.",
    };
  }

  if (nextPath.includes("/account/applications/venue")) {
    return {
      title: "Create your account",
      description:
        "Create an account to apply as a Padel Pathways academy or venue.",
      metadataTitle: "Create account",
      metadataDescription:
        "Create an account to apply as a Padel Pathways academy or venue.",
    };
  }

  return {
    title: "Create your player account",
    description: "Create your free Padel Pathways player account.",
    metadataTitle: "Create player account",
    metadataDescription: "Create your free Padel Pathways player account.",
  };
}
