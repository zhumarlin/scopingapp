import { calculateNetworkPtMDFromIp } from "./network-pt.js";
import { generateId } from "./shared.js";

export function renderNetworkVaForm(draft, errors, renderError, escapeHtml) {
  const ipCount = Number.parseInt(draft.ipCount, 10);
  const isCredentialed = draft.networkAuthMode === "credentialed";
  const isNonCredentialed = draft.networkAuthMode === "non_credentialed";
  const isTimeBoxed = Number.isInteger(ipCount) && ((isCredentialed && ipCount >= 80) || (isNonCredentialed && ipCount > 90));
  const isInternalScope = draft.networkScope === "internal";
  const ipLabel = isInternalScope
    ? "Total Number of Active and Static IPs (Excluding End-User Devices)"
    : "Total IP Address In-scope";

  return `
    <div class="mb-3">
      <label class="form-label">Assessment Methodology</label>
      <div class="option-card-grid option-card-grid--2">
        <label class="assessment-type-card option-card ${draft.networkAuthMode === "credentialed" ? "is-selected" : ""}" for="authCredentialed">
          <input class="visually-hidden" type="radio" name="networkAuthMode" id="authCredentialed" value="credentialed" ${draft.networkAuthMode === "credentialed" ? "checked" : ""}>
          <span class="assessment-type-title">Authenticated</span>
        </label>
        <label class="assessment-type-card option-card ${draft.networkAuthMode === "non_credentialed" ? "is-selected" : ""}" for="authNonCredentialed">
          <input class="visually-hidden" type="radio" name="networkAuthMode" id="authNonCredentialed" value="non_credentialed" ${draft.networkAuthMode === "non_credentialed" ? "checked" : ""}>
          <span class="assessment-type-title">Unauthenticated</span>
        </label>
      </div>
      ${renderError(errors.networkAuthMode)}
    </div>

    <div class="mb-3">
      <label for="ipCount" class="form-label">${ipLabel}</label>
      <input id="ipCount" type="number" min="1" class="form-control" name="ipCount" value="${escapeHtml(draft.ipCount)}" />
      ${isInternalScope ? `<div class="wizard-helper mt-2">Only permanently assigned infrastructure devices should be included in this count.</div>` : ""}
      ${isTimeBoxed ? `
        <div class="complexity-note mt-2">
          For large-sized networks, the assessment will be conducted on a time-boxed basis, whereby testing will be prioritised on services that are more likely to contain vulnerabilities, based on experience gained from testing similar infrastructure.
        </div>
      ` : ""}
      ${renderError(errors.ipCount)}
    </div>
  `;
}

export function validateNetworkVaInputs(draft) {
  const errors = {};

  if (!["external", "internal"].includes(draft.networkScope)) {
    errors.networkScope = "Select network scope.";
  }

  if (!["credentialed", "non_credentialed"].includes(draft.networkAuthMode)) {
    errors.networkAuthMode = "Select credentialed or non-credentialed mode.";
  }

  const ipCount = Number.parseInt(draft.ipCount, 10);
  if (!Number.isInteger(ipCount) || ipCount < 1) {
    errors.ipCount = "Total IP Address In-scope must be a number >= 1.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function buildNetworkVaAssessment(draft) {
  const md = calculateNetworkVaMD(draft);
  const scopeLabel = draft.networkScope === "external" ? "External" : "Internal";
  const authLabel = draft.networkAuthMode === "credentialed" ? "Authenticated" : "Unauthenticated";
  const ipCount = Number.parseInt(draft.ipCount, 10);

  return {
    id: generateId(),
    type: "network_va",
    typeLabel: `${scopeLabel} Network Vulnerability Assessment`,
    methodology: draft.networkAuthMode,
    methodologyLabel: authLabel,
    inputs: {
      networkScope: draft.networkScope,
      networkAuthMode: draft.networkAuthMode,
      ipCount,
    },
    detailSummary: `${ipCount} IP addresses in-scope`,
    md,
    createdAt: new Date().toISOString(),
  };
}

export function calculateNetworkVaMD(draft) {
  const ipCount = Number.parseInt(draft.ipCount, 10);
  if (!Number.isInteger(ipCount) || ipCount < 1) throw new Error("Invalid IP count.");

  if (draft.networkAuthMode === "non_credentialed") {
    return calculateNetworkPtMDFromIp(ipCount);
  }

  const initial = calculateNetworkVaCredentialedInitial(ipCount);
  const reporting = Math.ceil(initial * 0.25);
  const retest = Math.min(4, Math.ceil(initial / 2));

  return { initial, reporting, retest, total: initial + reporting + retest };
}

function calculateNetworkVaCredentialedInitial(ipCount) {
  return Math.min(9, Math.ceil(ipCount / 8.8));
}
