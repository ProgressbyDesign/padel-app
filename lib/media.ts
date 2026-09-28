import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

type Media = { video: string | null; poster: string };

function localMedia(name: string, fallback = "/images/discovery/coastal-venue.webp"): Media {
  const video = `/videos/${name}.mp4`;
  const poster = `/videos/${name}-overlay.webp`;
  const hasPoster = existsSync(path.join(process.cwd(), "public", poster));
  return {
    // Only play a video when its matching poster is also available.
    video: hasPoster && existsSync(path.join(process.cwd(), "public", video)) ? video : null,
    poster: hasPoster ? poster : fallback,
  };
}

export const HOME_MEDIA = localMedia("hero-padel", "/images/hero-padel-overlay2.jpg");
export const LOGIN_MEDIA = localMedia("login-video");
export const PLAYER_JOIN_MEDIA = localMedia("new-player-video");
export const COACH_JOIN_MEDIA = localMedia("coach-register-video");
// Temporary image-only venue experience until both dedicated video assets are supplied.
export const VENUE_JOIN_MEDIA = localMedia("venue-register-video");

export function authMedia(joining: boolean, audience: "player" | "coach" | "venue"): Media {
  if (!joining) return LOGIN_MEDIA;
  if (audience === "coach") return COACH_JOIN_MEDIA;
  if (audience === "venue") return VENUE_JOIN_MEDIA;
  return PLAYER_JOIN_MEDIA;
}
