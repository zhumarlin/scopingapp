import {
  capitalize,
  createWizardDraft,
  generateId,
  getInitialIncludeRetest,
  getMethodologyLabel,
  renderComplexityCards,
  renderChoiceStep,
} from "../core.js?v=1.4";

const METHODOLOGY_OPTIONS = [
  {
    value: "blackbox",
    title: "Black-Box Testing",
    subtitle: "Simulates an external attacker with no access or prior knowledge.",
    points: [
      "No credentials, documentation, or internal information are provided.",
      "Tests what can be discovered and exploited from the outside (pre-authentication).",
      "Typically, narrower in scope and less costly.",
    ],
  },
  {
    value: "greybox",
    title: "Grey-Box Testing",
    subtitle: "Simulates an attacker with limited access (e.g., a standard user account).",
    points: [
      "Valid credentials or partial system knowledge are provided.",
      "Assesses what a compromised account, malicious insider, or stolen credentials could exploit.",
      "Broader scope and effort required when compared with black-box testing.",
    ],
  },
  {
    value: "whitebox",
    title: "White-Box Testing",
    subtitle: "Provides full transparency, including architecture details, configuration information, and potentially source code.",
    points: [
      "Enables deep, methodical security analysis beyond surface testing.",
      "Best for high-risk systems, new launches or when maximum assurance is required.",
      "Highest level of access, depth, and testing effort.",
    ],
  },
];

const MOBILE_COMPLEXITY_OPTIONS = [
  {
    value: "small",
    title: "Small",
    points: [
      "Single mobile app with a focused feature set and one primary user journey.",
      "Limited device integration such as basic storage, camera, or push notifications.",
      "Simple authentication and straightforward API interaction.",
      "Common examples: event companion app, basic employee app, simple customer portal app.",
    ],
  },
  {
    value: "medium",
    title: "Medium",
    points: [
      "Multiple authenticated journeys or role-based flows within the mobile app.",
      "Moderate use of device capabilities such as location, file upload, biometrics, or offline data.",
      "Several backend/API integrations and broader business logic.",
      "Common examples: loyalty app, healthcare member app, mobile commerce app, field service app.",
    ],
  },
  {
    value: "large",
    title: "Large",
    points: [
      "Extensive feature set with multiple roles, sensitive data, or high-risk workflows.",
      "Heavy backend/API dependency with complex session handling, authorisation, or transaction logic.",
      "Broader mobile attack surface including local storage, deep links, certificate pinning bypass checks, and device feature abuse.",
      "Common examples: mobile banking app, fintech wallet, super app, enterprise operations app with privileged functions.",
    ],
  },
];

export const mobilePtService = {
  id: "mobile_pt",
  assessmentType: "mobile_pt",
  groupId: "offensive-services",
  selectionTitle: "Mobile Application Penetration Test",
  selectionSubtitle: "Mobile application focused security assessment",
  logicTitle: "Mobile App PT",
  steps: [
    {
      id: "methodology",
      render(draft, errors) {
        return renderChoiceStep({
          label: "Methodology",
          name: "methodology",
          selectedValue: draft.methodology,
          errors,
          columns: 1,
          gridClass: "methodology-grid",
          cardClass: "methodology-card",
          options: METHODOLOGY_OPTIONS,
        });
      },
      validate(draft) {
        const errors = {};
        if (!["blackbox", "greybox", "whitebox"].includes(draft.methodology)) {
          errors.methodology = "Select one methodology.";
        }

        return { valid: Object.keys(errors).length === 0, errors };
      },
    },
    {
      id: "details",
      render(draft, errors, helpers) {
        return renderMobilePtForm(draft, errors, helpers.renderError, helpers.escapeHtml);
      },
      validate: validateMobilePtInputs,
      afterRender(draft, mountEl) {
        syncMobileDetailVisibility(draft, mountEl);
      },
    },
  ],
  createDraft(initialAssessment = null, submitLabel = "Add to Project") {
    if (!initialAssessment) {
      return createWizardDraft("mobile_pt", submitLabel, {
        methodology: "",
        mobileAppName: "",
        mobileOs: "",
        complexity: "",
        showFollowupFields: false,
      });
    }

    const inputs = initialAssessment.inputs || {};

    return createWizardDraft("mobile_pt", submitLabel, {
      stepIndex: 1,
      methodology: initialAssessment.methodology || "",
      mobileAppName: typeof inputs.appName === "string" ? inputs.appName : "",
      mobileOs: typeof inputs.os === "string" ? inputs.os : "",
      complexity: inputs.complexity || "",
      showFollowupFields: typeof inputs.appName === "string" && inputs.appName.trim().length > 0,
      includeRetest: getInitialIncludeRetest(initialAssessment),
    });
  },
  handleInputChange(draft, target) {
    if (!(target instanceof HTMLElement)) return false;

    if (target.matches("input[name='methodology']")) {
      draft.methodology = target.value;
      if (draft.methodology === "blackbox") draft.complexity = "";
      return true;
    }

    if (target.matches("input[name='mobileAppName']")) {
      draft.mobileAppName = target.value;
      if (!draft.showFollowupFields && draft.mobileAppName.trim()) {
        draft.showFollowupFields = true;
      }
      return false;
    }

    if (target.matches("input[name='mobileOs']")) {
      draft.mobileOs = target.value;
      return true;
    }

    if (target.matches("input[name='complexity'], select[name='complexity']")) {
      draft.complexity = target.value;
      return true;
    }

    return false;
  },
  buildAssessment(draft) {
    const md = calculateMobilePtMD(draft);
    const methodologyLabel = getMethodologyLabel(draft.methodology);

    return {
      id: generateId(),
      serviceId: "mobile_pt",
      groupId: "offensive-services",
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
  },
  getLogicHtml() {
    return `
      <div class="logic-flow">
        <div class="logic-node decision">IF methodology = blackbox?</div>
        <div class="logic-arrow">↓ yes</div>
        <div class="logic-node">assessment = 3; reporting = 1; retest = 1</div>
        <div class="logic-arrow">↓ no (greybox/whitebox)</div>
        <div class="logic-node decision">IF OS = both?</div>
        <div class="logic-arrow">↓ yes</div>
        <div class="logic-node">Greybox map: small=(5,1,1), medium=(7,1,1), large=(9,1,2)</div>
        <div class="logic-arrow">↓ no (one OS)</div>
        <div class="logic-node">Greybox map: small=(4,1,1), medium=(6,1,1), large=(8,1,2)</div>
        <div class="logic-node decision">IF methodology = whitebox?</div>
        <div class="logic-arrow">↓ yes</div>
        <div class="logic-node">assessment = ceil(greybox.assessment * 1.2); reporting/retest same as greybox</div>
        <div class="logic-node outcome">total = assessment + reporting + retest</div>
      </div>
    `;
  },
};

export function renderMobilePtForm(draft, errors, renderError, escapeHtml) {
  const showFollowupFields = Boolean(draft.showFollowupFields);

  return `
    <div class="mb-3">
      <label for="mobileAppName" class="form-label">App Name *</label>
      <input id="mobileAppName" class="form-control wizard-field wizard-field--medium" name="mobileAppName" value="${escapeHtml(draft.mobileAppName)}" aria-required="true" />
      ${renderError(errors.mobileAppName)}
    </div>

    <div class="mobile-followup-section ${showFollowupFields ? "" : "is-hidden"}">
      ${renderChoiceStep({
        label: "OS",
        name: "mobileOs",
        selectedValue: draft.mobileOs,
        errors,
        columns: 3,
        compact: true,
        options: [
          { value: "android", title: "Android" },
          { value: "ios", title: "iOS" },
          { value: "both", title: "Both" },
        ],
      })}

      ${draft.methodology === "greybox" || draft.methodology === "whitebox" ? `
        ${renderComplexityCards(draft, errors, {
          cards: MOBILE_COMPLEXITY_OPTIONS,
        })}
      ` : ""}
    </div>
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

function syncMobileDetailVisibility(draft, mountEl) {
  const followupSection = mountEl.querySelector(".mobile-followup-section");
  if (!followupSection) return;

  followupSection.classList.toggle("is-hidden", !draft.showFollowupFields);
}
