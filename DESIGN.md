# Nocturne playback background experiment

Target: the existing 800 x 480 Car Thing Now Playing screen. Preserve all typography, controls, artwork, spacing, other screens, and Minimal Clock behavior.

The supplied Spotify reference has a quiet artwork-colored surface with a small vertical brightness change. Replace Now Playing corner pools with an opaque gradient from HSL lightness 18% to 14%, with saturation capped at 28%. Select a colored mid/dark artwork hue instead of white highlights. `src/utils/playbackGradient.ts` owns this treatment; `GradientBackground` applies it only to `nowPlaying`. Preserve existing palette loading and crossfade timing. This is a separate experiment, not part of Minimal Clock PR #60.
