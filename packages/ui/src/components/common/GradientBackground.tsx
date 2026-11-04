import { useEffect, useState, useRef } from "react";
import { useGradientTransition } from "../../hooks/useGradientTransition";
import { createPlaybackGradient } from "../../utils/playbackGradient";
import classNames from "classnames";
import type { GradientState } from "../../types";

interface GradientBackgroundProps {
  gradientState?: GradientState;
  className?: string;
  playback?: boolean;
}

const GradientBackground = ({
  gradientState = {
    imageURL: null,
    section: null,
  },
  className = "",
  playback = false,
}: GradientBackgroundProps) => {
  const section = playback ? "nowPlaying" : gradientState.section;
  const {
    gradientHexColors,
    generateMeshGradient,
    updateGradientColors,
    gradientTransitionDurationMs,
    initialMeshGradient,
  } = useGradientTransition(section);

  const [gradientLayers, setGradientLayers] = useState<
    Array<{ id: number; css: string | null; opacity: number }>
  >([
    {
      id: 0,
      css:
        section === "nowPlaying"
          ? createPlaybackGradient([])
          : initialMeshGradient,
      opacity: 1,
    },
    { id: 1, css: null, opacity: 0 },
  ]);
  const [activeLayerId, setActiveLayerId] = useState(0);
  const initialFadeSetupRef = useRef(false);

  useEffect(() => {
    updateGradientColors(gradientState.imageURL, section);
  }, [updateGradientColors, gradientState.imageURL, section]);

  useEffect(() => {
    const newCalculatedGradientCss =
      section === "nowPlaying"
        ? createPlaybackGradient(
            Array.isArray(gradientState.imageURL)
              ? gradientState.imageURL
              : gradientHexColors,
          )
        : generateMeshGradient(gradientHexColors);

    const currentActiveLayer = gradientLayers.find(
      (l) => l.id === activeLayerId,
    );
    const currentDisplayedCss = currentActiveLayer
      ? currentActiveLayer.css
      : null;

    if (
      newCalculatedGradientCss === currentDisplayedCss &&
      initialFadeSetupRef.current
    ) {
      return;
    }

    if (!initialFadeSetupRef.current) {
      setGradientLayers((prevLayers) =>
        prevLayers.map((layer) =>
          layer.id === 1
            ? { ...layer, css: newCalculatedGradientCss, opacity: 0 }
            : layer,
        ),
      );

      const rafId = requestAnimationFrame(() => {
        setGradientLayers((prevLayers) =>
          prevLayers.map((layer) => {
            if (layer.id === 1) return { ...layer, opacity: 1 };
            if (layer.id === 0) return { ...layer, opacity: 0 };
            return layer;
          }),
        );
        setActiveLayerId(1);
        initialFadeSetupRef.current = true;
      });

      return () => cancelAnimationFrame(rafId);
    } else {
      const newActiveLayerId = 1 - activeLayerId;
      setGradientLayers((prevLayers) =>
        prevLayers.map((layer) => {
          if (layer.id === newActiveLayerId) {
            return { ...layer, css: newCalculatedGradientCss, opacity: 1 };
          }
          return { ...layer, opacity: 0 };
        }),
      );
      setActiveLayerId(newActiveLayerId);
    }
  }, [
    gradientHexColors,
    section,
    gradientState.imageURL,
    generateMeshGradient,
    activeLayerId,
    initialMeshGradient,
  ]);

  return (
    <div
      className={classNames(
        "absolute",
        "inset-0",
        "overflow-hidden",
        className,
      )}
    >
      {gradientLayers.map(
        (layer) =>
          layer.css && (
            <div
              key={layer.id}
              style={{
                backgroundImage: layer.css,
                opacity: layer.opacity,
                transition: `opacity ${gradientTransitionDurationMs / 1000}s linear`,
                zIndex: layer.opacity === 1 ? 2 : 1,
              }}
              className="absolute inset-0 w-full h-full"
            />
          ),
      )}
    </div>
  );
};

export default GradientBackground;
