import { describe, expect, test } from "bun:test";
import {
  loadSpotifyPalette,
  parseSpotifyPalette,
  spotifyPaletteGradient,
} from "./spotifyPalette";
const uri = "spotify:track:2yByBvNNCf6FIJdLJA3vum";
const art = "https://i.scdn.co/image/ab67616d00001e02fef2974deb22214a69cb5dbf";
const pair = { backgroundBase: "#00587d", backgroundTintedBase: "#003456" };
function fixture(
  track = uri,
  rgb: unknown = { red: 0, green: 88, blue: 125, alpha: 255 },
) {
  return (
    '<script id="__NEXT_DATA__" type="application/json">' +
    JSON.stringify({
      props: {
        pageProps: {
          state: {
            data: {
              entity: {
                uri: track,
                type: "track",
                visualIdentity: {
                  backgroundBase: rgb,
                  backgroundTintedBase: {
                    red: 0,
                    green: 52,
                    blue: 86,
                    alpha: 255,
                  },
                  image: [{ url: art }],
                },
              },
            },
          },
        },
      },
    }) +
    "</script>"
  );
}
describe("Spotify supplied palette", () => {
  test("uses both supplied endpoints without local recoloring", () => {
    const palette = parseSpotifyPalette(btoa(fixture()), uri, art);
    expect(palette).toEqual(pair);
    expect(spotifyPaletteGradient(pair)).toBe(
      "linear-gradient(180deg in oklab, #00587d 0%, #003456 100%)",
    );
  });
  test("accepts another resolution of the same artwork", () => {
    expect(
      parseSpotifyPalette(fixture(), uri, art.replace("00001e02", "0000b273")),
    ).toEqual(pair);
  });
  test("rejects other track or artwork metadata", () => {
    expect(
      parseSpotifyPalette(fixture("spotify:track:other"), uri, art),
    ).toBeNull();
    expect(
      parseSpotifyPalette(fixture(), uri, art.replace("fef297", "000000")),
    ).toBeNull();
  });
  test("malformed, oversized, missing and unsafe color values fall back", () => {
    for (const value of [
      null,
      {},
      "<html>error</html>",
      "invalid base64",
      "x".repeat(2_000_001),
    ])
      expect(parseSpotifyPalette(value, uri)).toBeNull();
    for (const value of [
      { red: -1, green: 0, blue: 0 },
      { red: 256, green: 0, blue: 0 },
      { red: "0", green: 0, blue: 0 },
      { red: 0, green: 0, blue: 0, alpha: 0 },
    ])
      expect(parseSpotifyPalette(fixture(uri, value), uri)).toBeNull();
  });
  test("successful lookup is cached and failure leaves fallback", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return { data: btoa(fixture()) };
    };
    const signal = new AbortController().signal;
    expect(await loadSpotifyPalette(uri, art, fetcher, signal)).toEqual(pair);
    expect(await loadSpotifyPalette(uri, art, fetcher, signal)).toEqual(pair);
    expect(calls).toBe(1);
    const failedUri = "spotify:track:1111111111111111111111";
    expect(
      await loadSpotifyPalette(
        failedUri,
        null,
        async () => {
          throw Error("offline");
        },
        signal,
      ),
    ).toBeNull();
    expect(
      await loadSpotifyPalette(failedUri, null, fetcher, signal),
    ).toBeNull();
    expect(calls).toBe(1);
  });
  test("cancelled late response never becomes a cached palette", async () => {
    const cancelledUri = "spotify:track:2222222222222222222222";
    const controller = new AbortController();
    const fetcher = async () => {
      controller.abort();
      return { data: fixture(cancelledUri) };
    };
    expect(
      await loadSpotifyPalette(cancelledUri, null, fetcher, controller.signal),
    ).toBeNull();
    expect(
      await loadSpotifyPalette(
        cancelledUri,
        null,
        async () => ({ data: fixture(cancelledUri) }),
        new AbortController().signal,
      ),
    ).toEqual(pair);
  });
  test("local tracks never trigger a metadata request", async () => {
    expect(
      await loadSpotifyPalette(
        "spotify:local:track",
        null,
        async () => {
          throw Error("must not fetch");
        },
        new AbortController().signal,
      ),
    ).toBeNull();
  });
});
