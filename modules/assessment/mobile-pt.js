import { capitalize, generateId, getMethodologyLabel, renderComplexityCards } from "./shared.js";

export function renderMobilePtForm(draft, errors, renderError, escapeHtml) {
  const hasAppName = Boolean(draft.mobileAppName && draft.mobileAppName.trim());

  return `
    <div class="mb-3">
      <label for="mobileAppName" class="form-label">App Name *</label>
      <input id="mobileAppName" class="form-control" name="mobileAppName" value="${escapeHtml(draft.mobileAppName)}" aria-required="true" />
      ${renderError(errors.mobileAppName)}
    </div>

    <div class="mb-3">
      <label class="form-label">OS</label>
      <div class="option-card-grid option-card-grid--3">
        <label class="assessment-type-card option-card ${draft.mobileOs === "android" ? "is-selected" : ""}" for="mobileOsAndroid">
          <input class="visually-hidden" type="radio" name="mobileOs" id="mobileOsAndroid" value="android" ${draft.mobileOs === "android" ? "checked" : ""}>
          <span class="assessment-type-title">Android</span>
        </label>
        <label class="assessment-type-card option-card ${draft.mobileOs === "ios" ? "is-selected" : ""}" for="mobileOsIos">
          <input class="visually-hidden" type="radio" name="mobileOs" id="mobileOsIos" value="ios" ${draft.mobileOs === "ios" ? "checked" : ""}>
          <span class="assessment-type-title">iOS</span>
        </label>
        <label class="assessment-type-card option-card ${draft.mobileOs === "both" ? "is-selected" : ""}" for="mobileOsBoth">
          <input class="visually-hidden" type="radio" name="mobileOs" id="mobileOsBoth" value="both" ${draft.mobileOs === "both" ? "checked" : ""}>
          <span class="assessment-type-title">Both</span>
        </label>
      </div>
      ${renderError(errors.mobileOs)}
    </div>

    ${draft.methodology === "greybox" || draft.methodology === "whitebox" ? `
      ${renderComplexityCards(draft, errors, { locked: !hasAppName })}
    ` : ""}
  `;
}

export function validateMobilePtInputs(draft) {
  const errors = {};

  if (!["blackbox", "greybox", "whitebox"].includes(draft.methodology)) {
    errors.methodology = "Methodology is required.";
  }
  if (!draft.mobileAppName || !draft.mobileAppName.trim()) {
    errors.mobileAppName = "App Name is required.";
  }
  if (!["android", "ios", "both"].includes(draft.mobileOs)) {
    errors.mobileOs = "Select OS.";
  }
  if ((draft.methodology === "greybox" || draft.methodology === "whitebox") && !["small", "medium", "large"].includes(draft.complexity)) {
    errors.complexity = "Select complexity.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function buildMobilePtAssessment(draft) {
  const md = calculateMobilePtMD(draft);
  const methodologyLabel = getMethodologyLabel(draft.methodology);

  return {
    id: generateId(),
    type: "mobile_pt",
    typeLabel: "Mobile Application Penetration Test",
    methodology: draft.methodology,
    methodologyLabel,
    inputs: {
      appName: draft.mobileAppName.trim(),
      os: draft.mobileOs,
      complexity: draft.methodology === "greybox" || draft.methodology === "whitebox" ? draft.complexity : undefined,
    },
    detailSummary: buildMobileDetailSummary(draft),
    md,
    createdAt: new Date().toISOString(),
  };
}

export function calculateMobilePtMD(draft) {
  const isTwoOs = draft.mobileOs === "both";

  if (draft.methodology === "blackbox") {
    const initial = 3;
    const reporting = 1;
    const retest = 1;
    return { initial, reporting, retest, total: initial + reporting + retest };
  }

  const greyMapOneOs = {
    small: { initial: 4, reporting: 1, retest: 1 },
    medium: { initial: 6, reporting: 1, retest: 1 },
    large: { initial: 8, reporting: 1, retest: 2 },
  };

  const greyMapTwoOs = {
    small: { initial: 5, reporting: 1, retest: 1 },
    medium: { initial: 7, reporting: 1, retest: 1 },
    large: { initial: 9, reporting: 1, retest: 2 },
  };

  const base = (isTwoOs ? greyMapTwoOs : greyMapOneOs)[draft.complexity];
  if (!base) throw new Error("Invalid mobile complexity.");

  if (draft.methodology === "greybox") {
    return { ...base, total: base.initial + base.reporting + base.retest };
  }

  if (draft.methodology === "whitebox") {
    const initial = Math.ceil(base.initial * 1.2);
    const reporting = base.reporting;
    const retest = base.retest;
    return { initial, reporting, retest, total: initial + reporting + retest };
  }

  throw new Error("Unsupported mobile methodology.");
}

function buildMobileDetailSummary(draft) {
  const osLabel = getMobileOsLabel(draft.mobileOs);
  if (draft.methodology === "blackbox") return `OS: ${osLabel}`;

  const complexityLabel = capitalize(draft.complexity);
  return `OS: ${osLabel}, Complexity: ${complexityLabel}`;
}

function getMobileOsLabel(value) {
  if (value === "android") return "Android";
  if (value === "ios") return "iOS";
  if (value === "both") return "Both";
  return "Unknown";
}
