(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const initializedRegions = new WeakSet();

  const motionPreviewAllowed = () => finePointer.matches && !reducedMotion.matches;

  const loadPreviewSource = (video) => {
    if (video.dataset.previewLoaded === "true") {
      return true;
    }

    const nestedSource = video.querySelector("source[data-src]");
    const directSource = video.dataset.src;

    if (nestedSource?.dataset.src) {
      nestedSource.src = nestedSource.dataset.src;
      if (nestedSource.dataset.type) {
        nestedSource.type = nestedSource.dataset.type;
      }
    } else if (directSource) {
      video.src = directSource;
    } else {
      return false;
    }

    video.preload = "metadata";
    video.dataset.previewLoaded = "true";
    video.load();
    return true;
  };

  const deactivatePreview = (region) => {
    const video = region?.querySelector("video[data-preview-video]");
    if (!video) {
      return false;
    }

    region.classList.remove("is-playing");
    video.pause();

    try {
      video.currentTime = 0;
    } catch {
      // Some browsers reject seeking until metadata exists; the poster remains reliable.
    }

    video.hidden = true;
    return true;
  };

  const activatePreview = async (region) => {
    const video = region?.querySelector("video[data-preview-video]");
    if (!video || !motionPreviewAllowed() || !loadPreviewSource(video)) {
      return false;
    }

    video.hidden = false;

    try {
      const playRequest = video.play();
      if (playRequest instanceof Promise) {
        await playRequest;
      }
      region.classList.add("is-playing");
      return true;
    } catch {
      deactivatePreview(region);
      return false;
    }
  };

  const setupRegion = (region) => {
    if (initializedRegions.has(region)) {
      return;
    }

    const video = region.querySelector("video[data-preview-video]");
    if (!video) {
      return;
    }

    initializedRegions.add(region);
    region.classList.add("has-video");
    video.hidden = true;
    video.setAttribute("aria-hidden", "true");

    region.addEventListener("pointerenter", () => {
      void activatePreview(region);
    });

    region.addEventListener("pointerleave", () => {
      deactivatePreview(region);
    });

    region.addEventListener("focusin", () => {
      void activatePreview(region);
    });

    region.addEventListener("focusout", (event) => {
      if (!event.relatedTarget || !region.contains(event.relatedTarget)) {
        deactivatePreview(region);
      }
    });
  };

  const refreshPreviewRegions = (root = document) => {
    root.querySelectorAll("[data-publication-media]").forEach(setupRegion);
  };

  const stopAllPreviews = () => {
    document.querySelectorAll("[data-publication-media]").forEach(deactivatePreview);
  };

  const onMediaQueryChange = (query, handler) => {
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", handler);
    } else if (typeof query.addListener === "function") {
      query.addListener(handler);
    }
  };

  onMediaQueryChange(reducedMotion, (event) => {
    if (event.matches) {
      stopAllPreviews();
    }
  });

  onMediaQueryChange(finePointer, (event) => {
    if (!event.matches) {
      stopAllPreviews();
    }
  });

  window.AcademicHomepageMediaPreview = Object.freeze({
    activate: activatePreview,
    deactivate: deactivatePreview,
    refresh: refreshPreviewRegions
  });

  const initialize = () => {
    refreshPreviewRegions();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
