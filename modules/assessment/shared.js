export function renderError(message) {
  if (!message) return "";
  return `<div class="invalid-feedback d-block">${escapeHtml(message)}</div>`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function capitalize(value) {
  if (!value) return "";
  return value[0].toUpperCase() + value.slice(1);
}

export function getMethodologyLabel(methodology) {
  const labels = {
    blackbox: "Black-box",
    greybox: "Grey-box",
    whitebox: "White-box",
    credentialed: "Credentialed",
    non_credentialed: "Non-Credentialed",
  };

  return labels[methodology] || methodology;
}

export function parseUrlLines(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function renderComplexityCards(draft, errors, options = {}) {
  const locked = Boolean(options.locked);

  return `
    <div class="mb-3">
      <label class="form-label">Complexity</label>
      <div class="complexity-grid ${locked ? "is-locked" : ""}">
        <label class="assessment-type-card complexity-card ${draft.complexity === "small" ? "is-selected" : ""}" for="complexitySmall">
          <input class="visually-hidden" type="radio" name="complexity" id="complexitySmall" value="small" ${draft.complexity === "small" ? "checked" : ""} ${locked ? "disabled" : ""}>
          <span class="complexity-title">Small</span>
          <ul class="complexity-points">
            <li>1 user role, with a total of 10 functions</li>
            <li>Simple business logic</li>
            <li>Small internal or basic public applications</li>
            <li>Common examples: company profile website with login, simple booking system, event registration platform, basic internal data entry application</li>
          </ul>
        </label>
        <label class="assessment-type-card complexity-card ${draft.complexity === "medium" ? "is-selected" : ""}" for="complexityMedium">
          <input class="visually-hidden" type="radio" name="complexity" id="complexityMedium" value="medium" ${draft.complexity === "medium" ? "checked" : ""} ${locked ? "disabled" : ""}>
          <span class="complexity-title">Medium</span>
          <ul class="complexity-points">
            <li>2 user roles, with a total of 25 functions</li>
            <li>Role-based access (e.g., Admin &amp; User)</li>
            <li>Mid-sized business applications</li>
            <li>Common examples: small-to-mid e-commerce platform, Learning Management System (LMS), HR management system, membership or loyalty application</li>
          </ul>
        </label>
        <label class="assessment-type-card complexity-card ${draft.complexity === "large" ? "is-selected" : ""}" for="complexityLarge">
          <input class="visually-hidden" type="radio" name="complexity" id="complexityLarge" value="large" ${draft.complexity === "large" ? "checked" : ""} ${locked ? "disabled" : ""}>
          <span class="complexity-title">Large</span>
          <ul class="complexity-points">
            <li>More than 2 user roles, or more than 50 functions</li>
            <li>Multiple access levels with granular permissions</li>
            <li>Complex business workflows</li>
            <li>Financial or transactional processing</li>
            <li>Common examples: internet banking system, enterprise ERP platform, marketplace platform, insurance or fintech application</li>
          </ul>
        </label>
      </div>
      ${!locked && draft.complexity === "large" ? `
        <div class="complexity-note mt-3">
          The testing effort would be performed on a time-boxed basis, where testing is prioritised on functions within the application that are more likely to contain vulnerabilities, based on experience gained from testing similar applications. As a point of reference, a form with up to eight input fields typically requires two to three working hours to test. Time-boxed testing is useful as an initial baseline assessment and is not intended to be exhaustive.
        </div>
      ` : ""}
      ${renderError(errors.complexity)}
    </div>
  `;
}

export function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}
