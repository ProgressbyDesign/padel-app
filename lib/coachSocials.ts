import {
  isVenueSocialPlatform,
  MAX_VENUE_SOCIAL_URL_LENGTH,
  MAX_VENUE_SOCIALS,
  normalizeSafeExternalHttpsUrl,
  normalizeVenueSocialUrl,
  sortVenueSocials,
  validPublicVenueSocials,
  VENUE_SOCIAL_PLATFORMS,
  venueSocialPlatformLabel,
  venueSocialVisibleUrl,
  type VenueSocialInput,
  type VenueSocialPlatform,
  type VenueSocialRow,
  type VenueSocialUrlResult,
} from "@/lib/venueSocials";

export const MAX_COACH_SOCIAL_URL_LENGTH = MAX_VENUE_SOCIAL_URL_LENGTH;
export const MAX_COACH_SOCIALS = MAX_VENUE_SOCIALS;
export const COACH_SOCIAL_PLATFORMS = VENUE_SOCIAL_PLATFORMS;

export type CoachSocialPlatform = VenueSocialPlatform;
export type CoachSocialInput = VenueSocialInput;
export type CoachSocialUrlResult = VenueSocialUrlResult;

export type CoachSocialRow = {
  id: string;
  coach_id: string;
  platform: string;
  url: string;
  is_primary: boolean;
  created_at: string | null;
};

export const isCoachSocialPlatform = isVenueSocialPlatform;
export const coachSocialPlatformLabel = venueSocialPlatformLabel;
export const normalizeCoachSocialUrl = normalizeVenueSocialUrl;
export const normalizeSafeCoachHttpsUrl = normalizeSafeExternalHttpsUrl;
export const coachSocialVisibleUrl = venueSocialVisibleUrl;

export function isValidCoachSocialId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function sortCoachSocials(socials: CoachSocialRow[]): CoachSocialRow[] {
  return sortVenueSocials(
    socials.map((social) => ({
      id: social.id,
      venue_id: social.coach_id,
      platform: social.platform,
      url: social.url,
      is_primary: social.is_primary,
      created_at: social.created_at,
    })) as VenueSocialRow[]
  ).map((social) => ({
    id: String(social.id),
    coach_id: String(social.venue_id),
    platform: social.platform,
    url: social.url,
    is_primary: social.is_primary,
    created_at: social.created_at,
  }));
}

export function validPublicCoachSocials(
  socials: CoachSocialRow[] | null | undefined
): CoachSocialRow[] {
  return validPublicVenueSocials(
    (socials ?? []).map((social) => ({
      id: social.id,
      venue_id: social.coach_id,
      platform: social.platform,
      url: social.url,
      is_primary: social.is_primary,
      created_at: social.created_at,
    }))
  ).map((social) => ({
    id: String(social.id),
    coach_id: String(social.venue_id),
    platform: social.platform,
    url: social.url,
    is_primary: social.is_primary,
    created_at: social.created_at,
  }));
}
