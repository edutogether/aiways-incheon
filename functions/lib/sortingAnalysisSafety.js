"use strict";

function evaluateAnalysisSafety(o = {}) {
  const poor = o.targetVisibility === "poor" || o.imageQuality === "poor" || o.occlusion === "severe" ||
    (o.multiObject && o.targetDominance === "low") ||
    (o.backgroundClutter === "high" && o.targetVisibility !== "clear");
  const caution = !poor && (
    o.targetVisibility === "partial" || o.backgroundClutter === "medium" ||
    o.deformation || o.contamination || o.multiObject || o.occlusion === "mild"
  );
  const safetyLevel = poor ? "RETAKE" : caution ? "CAUTION" : "SAFE";
  return {
    safetyLevel,
    retakeRecommended: poor,
    directSelectionRecommended: true,
    reasons: poor ? ["image_ambiguity"] : caution ? ["check_visible_condition"] : [],
    uxState: safetyLevel.toLowerCase()
  };
}

module.exports = { evaluateAnalysisSafety };
