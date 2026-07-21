export type VenueFormValues = {
  name: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  website: string;
  venue_type: string;
  courts: string;
  court_type: string;
  coaching_available: boolean;
  coaching_description: string;
  price: string;
  opening_hours_structured: string;
};

export type VenueFormField = keyof VenueFormValues;

export type VenueUpdateState = {
  status: "idle" | "error" | "success";
  message: string | null;
  fieldErrors: Partial<Record<VenueFormField, string>>;
  values: VenueFormValues;
  revision: number;
};
