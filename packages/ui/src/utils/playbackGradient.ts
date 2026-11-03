type Tone = { hue: number; saturation: number; lightness: number };
function tone(r: number, g: number, b: number): Tone {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
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
  return { hue, saturation, lightness };
}

/** Population-weighted hue selection across the image, ignoring text highlights and black shadows. */
export function selectPlaybackColor(
  pixels: Uint8ClampedArray,
  width = 0,
): string {
  const buckets = Array.from({ length: 24 }, () => ({
    weight: 0,
    r: 0,
    g: 0,
    b: 0,
  }));
  let graySum = 0,
    count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const r = pixels[i] / 255,
      g = pixels[i + 1] / 255,
      b = pixels[i + 2] / 255;
    const t = tone(r, g, b);
    graySum += t.lightness;
    count++;
    if (t.lightness < 0.07 || t.lightness > 0.9 || t.saturation < 0.12)
      continue;
    const x = width ? (i / 4) % width : 0;
    const y = width ? Math.floor(i / 4 / width) : 0;
    const height = width ? pixels.length / 4 / width : 0;
    const edge = width
      ? Math.max(
          Math.abs(((x + 0.5) / width) * 2 - 1),
          Math.abs(((y + 0.5) / height) * 2 - 1),
        )
      : 0;
    // Background colors near the artwork perimeter should outweigh central faces and lettering.
    const weight =
      t.saturation *
      t.saturation *
      (1 - t.lightness) ** 3 *
      (0.15 + edge ** 4 * 4);
    const bucket = buckets[Math.round(t.hue / 15) % 24];
    bucket.weight += weight;
    bucket.r += r * weight;
    bucket.g += g * weight;
    bucket.b += b * weight;
  }
  const ranked = buckets
    .map((bucket, index) => ({
      index,
      weight:
        bucket.weight +
        buckets[(index + 23) % 24].weight +
        buckets[(index + 1) % 24].weight,
    }))
    .sort((a, b) => b.weight - a.weight);
  const best = ranked[0];
  let rgb: number[];
  if (!best || best.weight < Math.max(1, count * 0.015)) {
    const gray = count ? graySum / count : 0.14;
    rgb = [gray, gray, gray];
  } else {
    const group = [
      buckets[(best.index + 23) % 24],
      buckets[best.index],
      buckets[(best.index + 1) % 24],
    ];
    rgb = ["r", "g", "b"].map(
      (channel) =>
        group.reduce(
          (sum, bucket) => sum + bucket[channel as "r" | "g" | "b"],
          0,
        ) / best.weight,
    );
  }
  return (
    "#" +
    rgb
      .map((c) =>
        Math.round(c * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function extractPlaybackColor(image: CanvasImageSource): string {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "#242424";
  ctx.drawImage(image, 0, 0, 64, 64);
  return selectPlaybackColor(ctx.getImageData(0, 0, 64, 64).data, 64);
}

export function createPlaybackGradient(colors: string[]): string {
  const color = colors.find((c) => /^#[0-9a-f]{6}$/i.test(c)) ?? "#242424";
  const [r, g, b] = [1, 3, 5].map(
    (offset) => parseInt(color.slice(offset, offset + 2), 16) / 255,
  );
  const { hue, saturation, lightness } = tone(r, g, b);
  const s = Math.min(85, saturation * 100);
  const top = Math.max(16, Math.min(32, lightness * 75 + saturation * 12));
  const bottom = top * 0.82;
  return `linear-gradient(180deg in oklab, hsl(${hue} ${s}% ${top}%) 0%, hsl(${hue} ${s}% ${bottom}%) 100%)`;
}
