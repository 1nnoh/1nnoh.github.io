(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const initializedRegions = new WeakSet();
  let emailFeedbackTimer;

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

  const copyWithTextarea = (value) => {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.inset = "0 auto auto -9999px";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    textarea.setSelectionRange(0, value.length);

    const copied = document.execCommand("copy");
    textarea.remove();

    if (!copied) {
      throw new Error("Clipboard fallback was rejected.");
    }
  };

  const copyText = async (value) => {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch {
        // Fall through to the selection-based copy path when permission is unavailable.
      }
    }

    copyWithTextarea(value);
  };

  const setupEmailCopy = () => {
    const button = document.querySelector("[data-copy-email]");
    const tooltip = document.querySelector("[data-email-tooltip]");
    const status = document.querySelector("[data-copy-status]");

    if (!button || !tooltip || !status) {
      return;
    }

    const email = button.dataset.email;
    if (!email) {
      return;
    }

    const resetFeedback = () => {
      tooltip.textContent = email;
      button.setAttribute("aria-label", "Copy email address");
      delete button.dataset.copyState;
    };

    button.addEventListener("click", async () => {
      clearTimeout(emailFeedbackTimer);
      status.textContent = "";

      try {
        await copyText(email);
        tooltip.textContent = "Copied!";
        button.dataset.copyState = "copied";
        button.setAttribute("aria-label", "Email address copied");
        status.textContent = `Email address ${email} copied to clipboard.`;
      } catch {
        tooltip.textContent = "Copy failed";
        button.dataset.copyState = "failed";
        button.setAttribute("aria-label", "Copy email address failed");
        status.textContent = `Could not copy the email address. The address is ${email}.`;
      }

      emailFeedbackTimer = window.setTimeout(resetFeedback, 1600);
    });
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
    setupEmailCopy();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
