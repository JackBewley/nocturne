import { describe, expect, test } from "bun:test";
import {
  selectPlaybackColor,
  createPlaybackGradient,
} from "./playbackGradient";
function pixels(groups: Array<[number, number, number, number]>) {
  return new Uint8ClampedArray(
    groups.flatMap(([r, g, b, count]) =>
      Array.from({ length: count }, () => [r, g, b, 255]).flat(),
    ),
  );
}
describe("playback color selection", () => {
  test("red artwork outweighs a small dark purple shadow", () => {
    const hex = selectPlaybackColor(
      pixels([
        [220, 15, 8, 80],
        [35, 8, 60, 10],
        [240, 240, 240, 10],
      ]),
    );
    expect(parseInt(hex.slice(1, 3), 16)).toBeGreaterThan(150);
    expect(parseInt(hex.slice(5, 7), 16)).toBeLessThan(40);
  });
  test("neutral artwork stays neutral", () => {
    const hex = selectPlaybackColor(
      pixels([
        [210, 210, 210, 60],
        [20, 20, 20, 40],
      ]),
    );
    expect(hex.slice(1, 3)).toBe(hex.slice(3, 5));
    expect(hex.slice(3, 5)).toBe(hex.slice(5, 7));
  });
  test("empty palette produces an opaque bounded gradient", () => {
    const css = createPlaybackGradient([]);
    expect(css).toContain("linear-gradient");
    expect(css).not.toContain("NaN");
    expect(css).not.toContain("transparent");
  });
});

describe("small artwork accents", () => {
  test("a small gold logo on black stays gold instead of falling back to gray", () => {
    const data = pixels([[8, 9, 8, 4096]]);
    for (let y = 28; y < 36; y++) {
      for (let x = 28; x < 36; x++)
        data.set([129, 113, 51, 255], (y * 64 + x) * 4);
    }
    expect(selectPlaybackColor(data, 64)).toBe("#817133");
  });
  test("a coherent olive accent survives a larger brown photographic area", () => {
    expect(
      selectPlaybackColor(
        pixels([
          [65, 40, 25, 3900],
          [150, 142, 95, 196],
        ]),
        64,
      ),
    ).toBe("#968e5f");
  });
  test("warm artwork without an alternative retains its own color", () => {
    expect(selectPlaybackColor(pixels([[140, 90, 50, 4096]]), 64)).toBe(
      "#8c5a32",
    );
  });
  test("isolated colored noise on neutral art does not become the theme", () => {
    expect(
      selectPlaybackColor(
        pixels([
          [120, 120, 120, 4095],
          [0, 255, 0, 1],
        ]),
        64,
      ),
    ).toBe("#787878");
  });
});
