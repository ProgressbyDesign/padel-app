import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authMedia, HOME_MEDIA, VENUE_JOIN_MEDIA } from "./media";
import { HERO_POSTER_SRC } from "./home/heroMedia";

const publicFile = (src: string) => path.join(process.cwd(), "public", src);
afterEach(() => { vi.doUnmock("node:fs"); vi.resetModules(); });

describe("video and poster pairs", () => {
  it("uses the existing homepage webp at its actual location", () => {
    expect(HOME_MEDIA).toEqual({ video: "/videos/hero-padel.mp4", poster: "/videos/hero-padel-overlay.webp" });
    expect(HERO_POSTER_SRC).toBe(HOME_MEDIA.poster);
  });
  it.each([
    [false, "player", "login-video"],
    [false, "coach", "login-video"],
    [false, "venue", "login-video"],
    [true, "player", "new-player-video"],
    [true, "coach", "coach-register-video"],
  ] as const)("selects matching auth media for joining=%s audience=%s", (joining, audience, name) => {
    const media = authMedia(joining, audience);
    expect(media).toEqual({ video: `/videos/${name}.mp4`, poster: `/videos/${name}-overlay.webp` });
    expect(existsSync(publicFile(media.video!))).toBe(true);
    expect(existsSync(publicFile(media.poster))).toBe(true);
    expect(media.poster).not.toBe(HERO_POSTER_SRC);
  });
  it("uses a real venue image until a dedicated pair is available", () => {
    const hasPoster = existsSync(publicFile("/videos/venue-register-video-overlay.webp"));
    const hasVideo = existsSync(publicFile("/videos/venue-register-video.mp4"));
    expect(authMedia(true, "venue")).toEqual({
      video: hasPoster && hasVideo ? "/videos/venue-register-video.mp4" : null,
      poster: hasPoster ? "/videos/venue-register-video-overlay.webp" : "/images/discovery/coastal-venue.webp",
    });
    expect(existsSync(publicFile(VENUE_JOIN_MEDIA.poster))).toBe(true);
  });
  it("automatically uses the dedicated venue pair when supplied", async () => {
    vi.resetModules();
    vi.doMock("node:fs", () => ({ existsSync: () => true }));
    const { VENUE_JOIN_MEDIA: media } = await import("./media");
    expect(media).toEqual({ video: "/videos/venue-register-video.mp4", poster: "/videos/venue-register-video-overlay.webp" });
  });
  it.each(["login-video.mp4", "login-video-overlay.webp"])("keeps a visible fallback if %s is missing", async (missing) => {
    vi.resetModules();
    vi.doMock("node:fs", () => ({ existsSync: (file: string) => !file.endsWith(missing) }));
    const { LOGIN_MEDIA: media } = await import("./media");
    expect(media.video).toBeNull();
    expect(existsSync(publicFile(media.poster))).toBe(true);
  });
  it("keeps the matching image beneath the video and the existing playback guards", () => {
    const auth = readFileSync("components/auth/AuthExperience.tsx", "utf8");
    expect(auth).toContain("<Image src={poster}");
    expect(auth).toContain("<HomeHeroVideo src={video} poster={poster}");
    expect(auth).not.toContain("HERO_POSTER_SRC");
    const video = readFileSync("components/home/HomeHeroVideo.tsx", "utf8");
    for (const guard of ["prefers-reduced-motion: reduce", "desktop.matches && !reduceMotion.matches", "autoPlay", "muted", "loop", "playsInline", "poster={poster}"]) expect(video).toContain(guard);
  });
});
