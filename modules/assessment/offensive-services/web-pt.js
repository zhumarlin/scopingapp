import {
  capitalize,
  createWizardDraft,
  generateId,
  getInitialIncludeRetest,
  getMethodologyLabel,
  parseUrlLines,
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

export const webPtService = {
  id: "webapp",
  assessmentType: "webapp",
  groupId: "offensive-services",
  selectionTitle: "Web Application Penetration Test",
  selectionSubtitle: "Web application focused security assessment",
  logicTitle: "Web App PT",
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
        return renderWebConditionalForm(draft, errors, helpers.renderError, helpers.escapeHtml);
      },
      validate: validateWebPtInputs,
      afterRender(draft, mountEl) {
        syncComplexityInteractivity(draft, mountEl);
      },
    },
  ],
  createDraft(initialAssessment = null, submitLabel = "Add to Project") {
    if (!initialAssessment) {
      return createWizardDraft("webapp", submitLabel, {
        methodology: "",
        targetMode: "",
        urlName: "",
        hasLogin: "",
        canSelfRegister: "",
        urlCount: "",
        urlListText: "",
        complexity: "",
        showComplexity: false,
        showSingleTargetQuestions: false,
      });
    }

    const inputs = initialAssessment.inputs || {};
    const isBlackbox = initialAssessment.methodology === "blackbox";
    const targetMode = isBlackbox ? inputs.targetMode || "single" : "";
    const urlList = Array.isArray(inputs.urlList) ? inputs.urlList : [];

    return createWizardDraft("webapp", submitLabel, {
      stepIndex: 1,
      methodology: initialAssessment.methodology || "",
      targetMode,
      urlName: typeof inputs.urlName === "string" ? inputs.urlName : "",
      hasLogin: targetMode === "single" ? (inputs.hasLogin ? "yes" : "no") : "",
      canSelfRegister: targetMode === "single" && inputs.hasLogin ? (inputs.canSelfRegister ? "yes" : "no") : "",
      urlCount: targetMode === "multiple" ? String(inputs.urlCount ?? "") : "",
      urlListText: targetMode === "multiple" ? urlList.join("\n") : "",
      complexity: typeof inputs.complexity === "string" ? inputs.complexity : "",
      showComplexity: typeof inputs.urlName === "string" && inputs.urlName.trim().length > 0,
      showSingleTargetQuestions: targetMode === "single" && typeof inputs.urlName === "string" && inputs.urlName.trim().length > 0,
      includeRetest: getInitialIncludeRetest(initialAssessment),
    });
  },
  handleInputChange(draft, target) {
    if (!(target instanceof HTMLElement)) return false;

    if (target.matches("input[name='methodology']")) {
      draft.methodology = target.value;
      if (draft.methodology !== "blackbox") {
        draft.targetMode = "";
        draft.hasLogin = "";
        draft.canSelfRegister = "";
        draft.urlCount = "";
        draft.urlListText = "";
      }
      if (draft.methodology === "blackbox") {
        draft.complexity = "";
      }
      return true;
    }

    if (target.matches("input[name='targetMode']")) {
      draft.targetMode = target.value;
      if (draft.targetMode === "single") {
        draft.urlCount = "";
        draft.urlListText = "";
        if (draft.urlName.trim()) {
          draft.showSingleTargetQuestions = true;
        }
      } else {
        draft.hasLogin = "";
        draft.canSelfRegister = "";
      }
      return true;
    }

    if (target.matches("input[name='hasLogin']")) {
      draft.hasLogin = target.value;
      if (draft.hasLogin !== "yes") draft.canSelfRegister = "";
      return true;
    }

    if (target.matches("input[name='canSelfRegister']")) {
      draft.canSelfRegister = target.value;
      return true;
    }

    if (target.matches("input[name='complexity'], select[name='complexity']")) {
      draft.complexity = target.value;
      return true;
    }

    if (target.matches("input[name='urlName']")) {
      draft.urlName = target.value;
      if (!draft.showComplexity && draft.urlName.trim()) {
        draft.showComplexity = true;
      }
      if (draft.targetMode === "single" && !draft.showSingleTargetQuestions && draft.urlName.trim()) {
        draft.showSingleTargetQuestions = true;
      }
      return false;
    }

    if (target.matches("input[name='urlCount']")) {
      draft.urlCount = target.value;
      return false;
    }

    if (target.matches("textarea[name='urlListText']")) {
      draft.urlListText = target.value;
      return false;
    }

    return false;
  },
  buildAssessment(draft) {
    const md = calculateWebMD(draft);
    const methodologyLabel = getMethodologyLabel(draft.methodology);

    return {
      id: generateId(),
      serviceId: "webapp",
      groupId: "offensive-services",
      type: "webapp",
      typeLabel: "Web Application Penetration Test",
      methodology: draft.methodology,
      methodologyLabel,
      inputs: buildWebInputs(draft),
      detailSummary: buildWebDetailSummary(draft),
      md,
      createdAt: new Date().toISOString(),
    };
  },
  getLogicHtml() {
    return `
      <div class="logic-flow">
        <div class="logic-node decision">Start -> IF methodology = blackbox?</div>
        <div class="logic-arrow">↓ yes</div>
        <div class="logic-branch">
          <div class="logic-node decision">IF targetMode = multiple?</div>
          <div class="logic-arrow">↓ yes</div>
          <div class="logic-node">initial = urlCount; reporting = ceil(initial * 0.3); retest = ceil((initial + reporting) * 0.25)</div>
          <div class="logic-arrow">↓ no</div>
          <div class="logic-node decision">IF login=yes AND selfRegister=yes?</div>
          <div class="logic-arrow">↓ yes</div>
          <div class="logic-node">initial = 3; reporting = 1; retest = 1</div>
          <div class="logic-arrow">↓ no</div>
          <div class="logic-node">initial = 1; reporting = 1; retest = 1</div>
        </div>
        <div class="logic-arrow">↓ no (greybox/whitebox)</div>
        <div class="logic-node">Greybox: small=(2,1,1), medium=(5,1,1), large=(9,1,2)</div>
        <div class="logic-node">Whitebox: initial = ceil(greybox.initial * 1.2), reporting/retest same as greybox</div>
        <div class="logic-node outcome">total = initial + reporting + retest</div>
      </div>
    `;
  },
};

export function renderWebConditionalForm(draft, errors, renderError, escapeHtml) {
  if (draft.methodology === "blackbox") {
    return `
      ${renderChoiceStep({
        label: "Target Mode",
        name: "targetMode",
        selectedValue: draft.targetMode,
        errors,
        columns: 2,
        compact: true,
        options: [
          { value: "single", title: "Single target" },
          { value: "multiple", title: "Multiple target" },
        ],
      })}
      ${draft.targetMode === "single" ? renderSingleTargetFields(draft, errors, renderError, escapeHtml) : ""}
      ${draft.targetMode === "multiple" ? renderMultipleTargetFields(draft, errors, renderError, escapeHtml) : ""}
    `;
  }

  if (draft.methodology === "greybox" || draft.methodology === "whitebox") {
    const showComplexity = Boolean(draft.showComplexity);

    return `
      <div class="mb-4">
        <div class="wizard-section-kicker">Step 1</div>
        <label for="urlName" class="form-label">URL / Name *</label>
        <input id="urlName" class="form-control wizard-field wizard-field--medium" name="urlName" value="${escapeHtml(draft.urlName)}" placeholder="https://example.com or My App Name" aria-required="true" />
        ${renderError(errors.urlName)}
      </div>

      <div class="complexity-section ${showComplexity ? "" : "is-hidden"}">
        ${renderComplexityCards(draft, errors, {
          sectionLabel: "Step 2",
          helper: "Choose the closest complexity level for this application.",
        })}
      </div>
    `;
  }

  return `<div class="alert alert-warning">Select methodology first.</div>`;
}

export function validateWebPtInputs(draft) {
  const errors = {};

  if (!["blackbox", "greybox", "whitebox"].includes(draft.methodology)) {
    errors.methodology = "Methodology is required.";
    return { valid: false, errors };
  }

  if (draft.methodology === "blackbox") {
    if (!["single", "multiple"].includes(draft.targetMode)) {
      errors.targetMode = "Select target mode.";
    }

    if (draft.targetMode === "single") {
      if (!draft.urlName || !draft.urlName.trim()) {
        errors.urlName = "URL / Name is required.";
      }

      if (!["yes", "no"].includes(draft.hasLogin)) {
        errors.hasLogin = "Select whether a login page exists.";
      }

      if (draft.hasLogin === "yes" && !["yes", "no"].includes(draft.canSelfRegister)) {
        errors.canSelfRegister = "Select self-register availability.";
      }
    }

    if (draft.targetMode === "multiple") {
      const count = Number.parseInt(draft.urlCount, 10);
      if (!Number.isInteger(count) || count < 1) {
        errors.urlCount = "URL Count must be a number >= 1.";
      }
    }
  }

  if (draft.methodology === "greybox" || draft.methodology === "whitebox") {
    if (!draft.urlName || !draft.urlName.trim()) {
      errors.urlName = "URL / Name is required.";
    }

    if (!["small", "medium", "large"].includes(draft.complexity)) {
      errors.complexity = "Select complexity.";
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function calculateWebMD(draft) {
  if (draft.methodology === "blackbox") {
    if (draft.targetMode === "multiple") {
      const initial = Number.parseInt(draft.urlCount, 10);
      if (!Number.isInteger(initial) || initial < 1) throw new Error("Invalid URL count.");
      const reporting = Math.ceil(initial * 0.3);
      const retest = Math.ceil((initial + reporting) * 0.25);
      return { initial, reporting, retest, total: initial + reporting + retest };
    }

    if (draft.targetMode === "single") {
      const loginYes = draft.hasLogin === "yes";
      const selfYes = draft.canSelfRegister === "yes";
      const initial = loginYes && selfYes ? 3 : 1;
      const reporting = 1;
      const retest = 1;
      return { initial, reporting, retest, total: initial + reporting + retest };
    }

    throw new Error("Invalid black-box target mode.");
  }

  if (draft.methodology === "greybox" || draft.methodology === "whitebox") {
    const map = {
      small: { initial: 2, reporting: 1, retest: 1 },
      medium: { initial: 5, reporting: 1, retest: 1 },
      large: { initial: 9, reporting: 1, retest: 2 },
    };

    const base = map[draft.complexity];
    if (!base) throw new Error("Invalid complexity.");

    const initial = draft.methodology === "whitebox" ? Math.ceil(base.initial * 1.2) : base.initial;
    const reporting = base.reporting;
    const retest = base.retest;

    return { initial, reporting, retest, total: initial + reporting + retest };
  }

  throw new Error("Unsupported methodology.");
}

function renderSingleTargetFields(draft, errors, renderError, escapeHtml) {
  const showSingleTargetQuestions = Boolean(draft.showSingleTargetQuestions);

  return `
    <div class="mb-3">
      <label for="urlName" class="form-label">URL / Name</label>
      <input id="urlName" class="form-control wizard-field wizard-field--medium" name="urlName" value="${escapeHtml(draft.urlName)}" placeholder="https://example.com or My App Name" />
      ${renderError(errors.urlName)}
    </div>

    <div class="web-single-followup-section ${showSingleTargetQuestions ? "" : "is-hidden"}">
      ${renderChoiceStep({
        label: "Does a login page exist for this app?",
        name: "hasLogin",
        selectedValue: draft.hasLogin,
        errors,
        columns: 2,
        compact: true,
        options: [
          { value: "yes", title: "Yes" },
          { value: "no", title: "No" },
        ],
      })}

      ${draft.hasLogin === "yes" ? renderChoiceStep({
        label: "Can User Self-register?",
        name: "canSelfRegister",
        selectedValue: draft.canSelfRegister,
        errors,
        columns: 2,
        compact: true,
        options: [
          { value: "yes", title: "Yes" },
          { value: "no", title: "No" },
        ],
      }) : ""}
    </div>
  `;
}

function renderMultipleTargetFields(draft, errors, renderError, escapeHtml) {
  return `
    <div class="mb-3">
      <label for="urlCount" class="form-label">URL Count</label>
      <input id="urlCount" type="number" min="1" class="form-control wizard-field wizard-field--short" name="urlCount" value="${escapeHtml(draft.urlCount)}" />
      ${renderError(errors.urlCount)}
    </div>

    <div class="mb-3">
      <label for="urlListText" class="form-label">URL List (optional, one per line)</label>
      <textarea id="urlListText" class="form-control" rows="5" name="urlListText" placeholder="https://a.com\nhttps://b.com">${escapeHtml(draft.urlListText)}</textarea>
      <div class="wizard-helper mt-2">Optional helper field for notes/recommendation list; no strict validation applied.</div>
      ${renderError(errors.urlListText)}
    </div>
  `;
}

function buildWebInputs(draft) {
  if (draft.methodology === "blackbox" && draft.targetMode === "multiple") {
    return {
      targetMode: "multiple",
      urlCount: Number.parseInt(draft.urlCount, 10),
      urlList: parseUrlLines(draft.urlListText),
    };
  }

  if (draft.methodology === "blackbox" && draft.targetMode === "single") {
    return {
      targetMode: "single",
      urlName: draft.urlName.trim(),
      hasLogin: draft.hasLogin === "yes",
      canSelfRegister: draft.hasLogin === "yes" ? draft.canSelfRegister === "yes" : false,
    };
  }

  return {
    urlName: draft.urlName.trim(),
    complexity: draft.complexity,
  };
}

function buildWebDetailSummary(draft) {
  if (draft.methodology === "blackbox" && draft.targetMode === "multiple") {
    return `Multiple target: ${Number.parseInt(draft.urlCount, 10)} URL`;
  }

  if (draft.methodology === "blackbox" && draft.targetMode === "single") {
    if (draft.hasLogin === "yes") {
      return `Single target: login=yes, self-register=${draft.canSelfRegister}`;
    }

    return "Single target: login=no";
  }

  const complexityLabel = capitalize(draft.complexity);
  return `Complexity: ${complexityLabel}`;
}

function syncComplexityInteractivity(draft, mountEl) {
  const complexitySection = mountEl.querySelector(".complexity-section");
  if (complexitySection) {
    complexitySection.classList.toggle("is-hidden", !draft.showComplexity);
  }

  const singleTargetSection = mountEl.querySelector(".web-single-followup-section");
  if (singleTargetSection) {
    singleTargetSection.classList.toggle("is-hidden", !draft.showSingleTargetQuestions);
  }

  const complexityGrid = mountEl.querySelector(".complexity-grid");
  if (!complexityGrid) return;
}
