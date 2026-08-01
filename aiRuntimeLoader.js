"use strict";

// Advisory image models are intentionally loaded only after the related UI is used.
// They never participate in App Check, storage, or the final user decision.
(() => {
  const SOURCES = Object.freeze({
    tf: "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js",
    mobilenet: "https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js",
    teachableMachine: "https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8/dist/teachablemachine-image.min.js"
  });
  const pending = new Map();
  const timeoutMs = 12000;

  function loadScript(name) {
    if (pending.has(name)) return pending.get(name);
    const source = SOURCES[name];
    if (!source) return Promise.reject(new Error("Unknown AI runtime"));
    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-ai-runtime="${name}"]`);
      if (existing?.dataset.loaded === "true") return resolve();
      const script = existing || document.createElement("script");
      const timer = window.setTimeout(() => reject(new Error(`${name} runtime timed out`)), timeoutMs);
      const finish = (error) => {
        window.clearTimeout(timer);
        if (error) {
          pending.delete(name);
          reject(error);
        } else {
          script.dataset.loaded = "true";
          resolve();
        }
      };
      script.async = true;
      script.src = source;
      script.dataset.aiRuntime = name;
      script.addEventListener("load", () => finish(), { once: true });
      script.addEventListener("error", () => finish(new Error(`${name} runtime failed to load`)), { once: true });
      if (!existing) document.head.append(script);
    });
    pending.set(name, promise);
    return promise;
  }

  async function loadMobileNet() {
    await loadScript("tf");
    await loadScript("mobilenet");
    if (!window.mobilenet?.load) throw new Error("MobileNet runtime is unavailable");
    return window.mobilenet;
  }

  async function loadTeachableMachine() {
    await loadScript("tf");
    await loadScript("teachableMachine");
    if (!window.tmImage?.load) throw new Error("Teachable Machine runtime is unavailable");
    return window.tmImage;
  }

  window.AIWaysAiRuntime = Object.freeze({ loadMobileNet, loadTeachableMachine });
})();
