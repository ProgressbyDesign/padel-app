import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

export const HERO_POSTER_SRC = "/images/hero-padel-overlay.jpg";

const LOCAL_HERO_VIDEO = "/videos/hero-padel.mp4";

function localHeroVideoExists() {
  return existsSync(path.join(process.cwd(), "public/videos/hero-padel.mp4"));
}

/** Swap this path when the final homepage reel is added to `public/videos`. */
export const HERO_VIDEO_SRC = localHeroVideoExists() ? LOCAL_HERO_VIDEO : null;
