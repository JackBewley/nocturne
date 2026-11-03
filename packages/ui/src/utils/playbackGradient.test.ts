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
