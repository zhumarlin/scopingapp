import { calculateNetworkPtMDFromIp } from "./network-pt.js";
import { createWizardDraft, generateId, getInitialIncludeRetest, renderChoiceStep } from "../core.js";

export const networkVaService = {
  id: "network_va",
  assessmentType: "network_va",
  groupId: "offensive-services",
  selectionTitle: "Network Vulnerability Assessment",
  selectionSubtitle: "Assess the vulnerability within your hosts",
  logicTitle: "Network VA",
  steps: [
    {
      id: "details",
      render(draft, errors, helpers) {
        return renderNetworkVaForm(draft, errors, helpers.renderError, helpers.escapeHtml);
      },
      validate: validateNetworkVaInputs,
    },
  ],
  createDraft(initialAssessment = null, submitLabel = "Add to Project") {
    if (!initialAssessment) {
      return createWizardDraft("network_va", submitLabel, {
        networkScope: "",
        networkAuthMode: "",
        ipCount: "",
      });
    }

    const inputs = initialAssessment.inputs || {};

    return createWizardDraft("network_va", submitLabel, {
      stepIndex: 0,
      networkScope: inputs.networkScope || "",
      networkAuthMode: inputs.networkAuthMode || initialAssessment.methodology || "",
      ipCount: String(inputs.ipCount ?? ""),
      includeRetest: getInitialIncludeRetest(initialAssessment),
    });
  },
  handleInputChange(draft, target, event) {
    if (!(target instanceof HTMLElement)) return false;

    if (target.matches("input[name='networkScope']")) {
      draft.networkScope = target.value;
      return true;
    }

    if (target.matches("input[name='networkAuthMode']")) {
      draft.networkAuthMode = target.value;
      return true;
    }

    if (target.matches("input[name='ipCount']")) {
      draft.ipCount = target.value;
      return event.type === "change";
    }

    return false;
  },
  buildAssessment(draft) {
    const md = calculateNetworkVaMD(draft);
    const scopeLabel = draft.networkScope === "external" ? "External" : "Internal";
    const authLabel = draft.networkAuthMode === "credentialed" ? "Authenticated" : "Unauthenticated";
    const ipCount = Number.parseInt(draft.ipCount, 10);

    return {
      id: generateId(),
      serviceId: "network_va",
      groupId: "offensive-services",
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
  },
  getLogicHtml() {
    return `
      <div class="logic-flow">
        <div class="logic-node decision">IF methodology = non_credentialed?</div>
        <div class="logic-arrow">↓ yes</div>
        <div class="logic-node">Reuse Network PT formula</div>
        <div class="logic-arrow">↓ no (credentialed)</div>
        <div class="logic-node">initial = min(9, ceil(ipCount / 8.8))</div>
        <div class="logic-node">reporting = ceil(initial * 0.25)</div>
        <div class="logic-node">retest = min(4, ceil(initial / 2))</div>
        <div class="logic-node outcome">total = initial + reporting + retest</div>
      </div>
    `;
  },
};

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
    ${renderChoiceStep({
      label: "Network Scope",
      name: "networkScope",
      selectedValue: draft.networkScope,
      errors,
      columns: 2,
      compact: true,
      helper: "Select if this Vulnerability Assessment is external or internal scope.",
      options: [
        { value: "external", title: "External" },
        { value: "internal", title: "Internal" },
      ],
    })}

    ${renderChoiceStep({
      label: "Assessment Methodology",
      name: "networkAuthMode",
      selectedValue: draft.networkAuthMode,
      errors,
      columns: 2,
      compact: true,
      options: [
        { value: "credentialed", title: "Authenticated" },
        { value: "non_credentialed", title: "Unauthenticated" },
      ],
    })}

    <div class="mb-3">
      <label for="ipCount" class="form-label">${ipLabel}</label>
      <input id="ipCount" type="number" min="1" class="form-control wizard-field wizard-field--short" name="ipCount" value="${escapeHtml(draft.ipCount)}" />
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
