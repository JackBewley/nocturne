import { useEffect, useState } from "react";
import {
  loadSpotifyPalette,
  type PaletteFetcher,
  type SpotifyPalette,
} from "../utils/spotifyPalette";

export function useSpotifyPalette(
  uri: string | null,
  artwork: string | null,
  fetcher: PaletteFetcher,
  ready: boolean,
): SpotifyPalette | null {
  const key = uri + ":" + artwork;
  const [result, setResult] = useState<{
    key: string;
    palette: SpotifyPalette | null;
  } | null>(null);
  useEffect(() => {
    if (!uri || !ready) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void loadSpotifyPalette(uri, artwork, fetcher, controller.signal).then(
        (palette) => {
          if (!controller.signal.aborted) setResult({ key, palette });
        },
      );
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [uri, artwork, fetcher, ready, key]);
  return uri && result?.key === key ? result.palette : null;
}
