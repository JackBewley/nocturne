/** A quiet artwork tint for Now Playing, with no transparent corner pools. */
export function createPlaybackGradient(colors: string[]): string {
  const candidates = colors
    .filter((color) => /^#[0-9a-f]{6}$/i.test(color))
    .map((color) => {
      const [r, g, b] = [1, 3, 5].map(
        (offset) => parseInt(color.slice(offset, offset + 2), 16) / 255,
      );
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      const lightness = (max + min) / 2;
      const saturation =
        delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
      let hue = 0;
      if (delta > 0) {
        if (max === r) hue = ((g - b) / delta + 6) % 6;
        else if (max === g) hue = (b - r) / delta + 2;
        else hue = (r - g) / delta + 4;
        hue *= 60;
      }
      // Prefer a colored mid/dark tone over white highlights or near-black pixels.
      const score = lightness < 0.06 ? 0 : saturation * (1 - lightness);
      return { hue, saturation, score };
    });
  const accent = candidates.sort((a, b) => b.score - a.score)[0];
  const hue = accent?.hue ?? 220;
  const saturation = Math.min(28, (accent?.saturation ?? 0) * 55);
  return `linear-gradient(180deg in oklab, hsl(${hue} ${saturation}% 18%) 0%, hsl(${hue} ${saturation * 0.8}% 14%) 100%)`;
}
