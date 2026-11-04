export type SpotifyPalette = {
  backgroundBase: string;
  backgroundTintedBase: string;
};
export type PaletteFetcher = (
  url: string,
  signal: AbortSignal,
) => Promise<{ data?: unknown }>;
const cache = new Map<
  string,
  { palette: SpotifyPalette | null; expires: number }
>();
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
function color(value: unknown): string | null {
  const c = object(value);
  const channels = [c.red, c.green, c.blue];
  if (c.alpha !== undefined && c.alpha !== 255) return null;
  if (
    !channels.every(
      (v) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 255,
    )
  )
    return null;
  return (
    "#" +
    channels.map((v) => (v as number).toString(16).padStart(2, "0")).join("")
  );
}
function artworkId(url: unknown): string | null {
  if (typeof url !== "string") return null;
  return (
    /\/image\/[a-f0-9]{16}([a-f0-9]{24})(?:[?#]|$)/i
      .exec(url)?.[1]
      ?.toLowerCase() ?? null
  );
}
export function parseSpotifyPalette(
  data: unknown,
  trackUri: string,
  artworkUrl?: string | null,
): SpotifyPalette | null {
  if (typeof data !== "string" || data.length > 2_000_000) return null;
  try {
    const html = data.trimStart().startsWith("<")
      ? data
      : atob(data.replace(/^data:[^,]*;base64,/, ""));
    const script =
      /<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(
        html,
      )?.[1];
    if (!script) return null;
    const root = object(JSON.parse(script));
    const entity = object(
      object(object(object(object(root.props).pageProps).state).data).entity,
    );
    if (entity.uri !== trackUri || entity.type !== "track") return null;
    const visual = object(entity.visualIdentity);
    const expected = artworkId(artworkUrl);
    if (
      expected &&
      (!Array.isArray(visual.image) ||
        !visual.image.some(
          (image) => artworkId(object(image).url) === expected,
        ))
    )
      return null;
    const backgroundBase = color(visual.backgroundBase);
    const backgroundTintedBase = color(visual.backgroundTintedBase);
    return backgroundBase && backgroundTintedBase
      ? { backgroundBase, backgroundTintedBase }
      : null;
  } catch {
    // Invalid or changed embed metadata is an expected fallback condition.
    return null;
  }
}
export function spotifyPaletteGradient(palette: SpotifyPalette): string {
  return `linear-gradient(180deg in oklab, ${palette.backgroundBase} 0%, ${palette.backgroundTintedBase} 100%)`;
}
export async function loadSpotifyPalette(
  trackUri: string,
  artworkUrl: string | null,
  fetcher: PaletteFetcher,
  signal: AbortSignal,
): Promise<SpotifyPalette | null> {
  const id = /^spotify:track:([A-Za-z0-9]{22})$/.exec(trackUri)?.[1];
  if (!id || signal.aborted) return null;
  const key = trackUri + ":" + (artworkId(artworkUrl) ?? artworkUrl ?? "");
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.palette;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let palette: SpotifyPalette | null = null;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(null);
      }, 8000);
    });
    const result = await Promise.race([
      fetcher("https://open.spotify.com/embed/track/" + id, controller.signal),
      timeout,
    ]);
    if (result)
      palette = parseSpotifyPalette(result.data, trackUri, artworkUrl);
  } catch {
    // Companion/network failures leave the existing artwork gradient visible.
    palette = null;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
  if (signal.aborted) return null;
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  cache.set(key, {
    palette,
    expires: Date.now() + (palette ? 86400000 : 300000),
  });
  return palette;
}
