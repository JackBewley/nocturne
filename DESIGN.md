# Nocturne playback background experiment

Target: the existing 800 x 480 Car Thing Now Playing screen. Preserve typography, controls, artwork, spacing, other screens, and Minimal Clock behavior. Separate from Minimal Clock PR #60.

Select one coherent hue across 64 x 64 artwork pixels. Small logos count: do not require their weighted score to cover a fixed percentage of the entire image. Sample the center as well as the perimeter. Prefer a meaningful colored accent to brown photographic skin/shadows; retain brown/orange when there is no alternative. Ignore near-black, white, neutral pixels and isolated noise. Within the chosen hue, use lighter samples to keep shadow pixels from muddying its tint.

References: Elle King blue-gray, K.Flay red, Marian Hill gold/olive, BØRNS muted gold/olive. This is an approximation of the supplied Spotify references, not Spotify's proprietary algorithm. No track-specific colors or artwork changes.

`packages/ui/src/utils/playbackGradient.ts` owns selection and gradient values: saturation capped at 85%, top HSL lightness 16-32%, bottom 82% of top. The background is an opaque vertical gradient, with no bright radial pools. `GradientBackground` starts playback with a neutral vertical fill and App explicitly sets playback presentation from the active screen, independent of asynchronous artwork section callbacks. Existing three-second transitions remain.

`SpotifyImage` samples loaded artwork for Now Playing; URL extraction shares the same helper and a separate playback cache key. Other screens retain original extraction and mesh gradients.
