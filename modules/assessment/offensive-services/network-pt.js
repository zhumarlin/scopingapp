import { createWizardDraft, generateId, getInitialIncludeRetest, renderChoiceStep } from "../core.js?v=0.4.1";

export const networkPtService = {
  id: "network_pt",
  assessmentType: "network",
  groupId: "offensive-services",
  selectionTitle: "Network Penetration Test",
  selectionSubtitle: "Penetration testing against internal or external IP address/hosts",
  logicTitle: "Network PT",
  steps: [
    {
      id: "details",
      render(draft, errors, helpers) {
        return renderNetworkPtForm(draft, errors, helpers.renderError, helpers.escapeHtml);
      },
      validate: validateNetworkPtInputs,
    },
  ],
  createDraft(initialAssessment = null, submitLabel = "Add to Project") {
    if (!initialAssessment) {
      return createWizardDraft("network_pt", submitLabel, {
        networkScope: "",
        ipCount: "",
      });
    }

    const inputs = initialAssessment.inputs || {};

    return createWizardDraft("network_pt", submitLabel, {
      stepIndex: 0,
      networkScope: inputs.networkScope || "",
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

    if (target.matches("input[name='ipCount']")) {
      draft.ipCount = target.value;
      return event.type === "change";
    }

    return false;
  },
  buildAssessment(draft) {
    const md = calculateNetworkPtMD(draft);
    const scopeLabel = draft.networkScope === "external" ? "External" : "Internal";
    const ipCount = Number.parseInt(draft.ipCount, 10);

    return {
      id: generateId(),
      serviceId: "network_pt",
      groupId: "offensive-services",
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
  },
  getLogicHtml() {
    return `
      <div class="logic-flow">
        <div class="logic-node">assessment = min(9, ceil(ipCount / 10))</div>
        <div class="logic-node">reporting = 1</div>
        <div class="logic-node">retest = assessment &lt; 8 ? 1 : 2</div>
        <div class="logic-node outcome">total = assessment + reporting + retest</div>
      </div>
    `;
  },
};

export function renderNetworkPtForm(draft, errors, renderError, escapeHtml) {
  const ipCount = Number.parseInt(draft.ipCount, 10);
  const isTimeBoxed = Number.isInteger(ipCount) && ipCount > 90;
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
      helper: "Methodology will be set to Black-box by default.",
      options: [
        { value: "external", title: "External" },
        { value: "internal", title: "Internal" },
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
