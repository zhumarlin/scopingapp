import { generateId } from "./shared.js";

export function renderNetworkPtForm(draft, errors, renderError, escapeHtml) {
  const ipCount = Number.parseInt(draft.ipCount, 10);
  const isTimeBoxed = Number.isInteger(ipCount) && ipCount > 90;
  const isInternalScope = draft.networkScope === "internal";
  const ipLabel = isInternalScope
    ? "Total Number of Active and Static IPs (Excluding End-User Devices)"
    : "Total IP Address In-scope";

  return `
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

export function validateNetworkPtInputs(draft) {
  const errors = {};

  if (!["external", "internal"].includes(draft.networkScope)) {
    errors.networkScope = "Select network scope.";
  }

  const ipCount = Number.parseInt(draft.ipCount, 10);
  if (!Number.isInteger(ipCount) || ipCount < 1) {
    errors.ipCount = "Total IP Address In-scope must be a number >= 1.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function buildNetworkPtAssessment(draft) {
  const md = calculateNetworkPtMD(draft);
  const scopeLabel = draft.networkScope === "external" ? "External" : "Internal";
  const ipCount = Number.parseInt(draft.ipCount, 10);

  return {
    id: generateId(),
    type: "network",
    typeLabel: `${scopeLabel} Network Penetration Test`,
    methodology: "blackbox",
    methodologyLabel: "Black-box",
    inputs: {
      networkScope: draft.networkScope,
      ipCount,
    },
    detailSummary: `${ipCount} IP addresses in-scope`,
    md,
    createdAt: new Date().toISOString(),
  };
}

export function calculateNetworkPtMD(draft) {
  const ipCount = Number.parseInt(draft.ipCount, 10);
  if (!Number.isInteger(ipCount) || ipCount < 1) throw new Error("Invalid IP count.");

  return calculateNetworkPtMDFromIp(ipCount);
}

export function calculateNetworkPtMDFromIp(ipCount) {
  const initial = Math.min(9, Math.ceil(ipCount / 10));
  const reporting = 1;
  const retest = initial < 8 ? 1 : 2;
  return { initial, reporting, retest, total: initial + reporting + retest };
}
