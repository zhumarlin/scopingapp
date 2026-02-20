import { renderWebConditionalForm, validateWebPtInputs, buildWebPtAssessment } from "./assessment/web.js";
import { renderNetworkPtForm, validateNetworkPtInputs, buildNetworkPtAssessment } from "./assessment/network-pt.js";
import { renderNetworkVaForm, validateNetworkVaInputs, buildNetworkVaAssessment } from "./assessment/network-va.js";
import { renderMobilePtForm, validateMobilePtInputs, buildMobilePtAssessment } from "./assessment/mobile-pt.js";
import { escapeHtml, renderError } from "./assessment/shared.js";

const TOTAL_STEPS = 4;

export function startWebAppWizard({ mountEl, onSubmit, initialAssessment = null, submitLabel = "Add to Project" }) {
  const draft = createInitialDraft(initialAssessment, submitLabel);

  mountEl.addEventListener("click", handleClick);
  mountEl.addEventListener("input", handleInputChange);
  mountEl.addEventListener("change", handleInputChange);

  renderStep();

  return cleanup;

  function handleClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;

    if (action === "back") {
      draft.stepIndex = Math.max(0, draft.stepIndex - 1);
      renderStep();
      return;
    }

    if (action === "next") {
      const validation = validateStep(draft.stepIndex, draft);
      if (!validation.valid) {
        renderStep(validation.errors);
        return;
      }

      draft.stepIndex = Math.min(TOTAL_STEPS - 1, draft.stepIndex + 1);
      renderStep();
      return;
    }

    if (action === "submit") {
      const validation = validateStep(draft.stepIndex, draft);
      if (!validation.valid) {
        renderStep(validation.errors);
        return;
      }

      try {
        const assessmentObj = buildAssessmentObject(draft);
        cleanup();
        onSubmit(assessmentObj);
      } catch (error) {
        renderStep({ _form: error.message || "Invalid input." });
      }
    }
  }

  function handleInputChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    let requiresRerender = false;

    if (target.matches("input[name='assessmentType']")) {
      draft.type = target.value;
      resetTypeSpecificFields(draft);

      if (draft.type === "webapp") {
        draft.typeLabel = "Web Application Penetration Test";
        draft.methodology = "";
        draft.methodologyLabel = "";
      }

      if (draft.type === "network") {
        draft.typeLabel = "Network Penetration Test";
        draft.methodology = "blackbox";
        draft.methodologyLabel = "Black-box";
      }

      if (draft.type === "network_va") {
        draft.typeLabel = "Network Vulnerability Assessment";
        draft.methodology = "";
        draft.methodologyLabel = "";
      }

      if (draft.type === "mobile_pt") {
        draft.typeLabel = "Mobile Application Penetration Test";
        draft.methodology = "";
        draft.methodologyLabel = "";
      }

      requiresRerender = true;
    }

    if (target.matches("input[name='methodology']")) {
      draft.methodology = target.value;
      requiresRerender = true;

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
    }

    if (target.matches("input[name='networkScope']")) {
      draft.networkScope = target.value;
      requiresRerender = true;
    }

    if (target.matches("input[name='networkAuthMode']")) {
      draft.networkAuthMode = target.value;
      requiresRerender = true;
    }

    if (target.matches("input[name='targetMode']")) {
      draft.targetMode = target.value;
      requiresRerender = true;
      if (draft.targetMode === "single") {
        draft.urlCount = "";
        draft.urlListText = "";
      } else {
        draft.hasLogin = "";
        draft.canSelfRegister = "";
      }
    }

    if (target.matches("input[name='hasLogin']")) {
      draft.hasLogin = target.value;
      requiresRerender = true;
      if (draft.hasLogin !== "yes") draft.canSelfRegister = "";
    }

    if (target.matches("input[name='canSelfRegister']")) {
      draft.canSelfRegister = target.value;
      requiresRerender = true;
    }

    if (target.matches("input[name='complexity'], select[name='complexity']")) {
      draft.complexity = target.value;
      requiresRerender = true;
    }

    if (target.matches("input[name='urlName']")) {
      draft.urlName = target.value;
    }

    if (target.matches("input[name='urlCount']")) {
      draft.urlCount = target.value;
    }

    if (target.matches("input[name='ipCount']")) {
      draft.ipCount = target.value;
      requiresRerender = event.type === "change";
    }

    if (target.matches("input[name='mobileAppName']")) {
      draft.mobileAppName = target.value;
    }

    if (target.matches("input[name='mobileOs']")) {
      draft.mobileOs = target.value;
      requiresRerender = true;
    }

    if (target.matches("textarea[name='urlListText']")) {
      draft.urlListText = target.value;
    }

    if (target.matches("input[name='includeRetestMode']")) {
      draft.includeRetest = target.value === "yes";
      requiresRerender = true;
    }

    if (requiresRerender) {
      renderStep();
    } else {
      syncNavigationButtons();
      syncComplexityInteractivity();
    }
  }

  function renderStep(errors = {}) {
    mountEl.innerHTML = renderStepMarkup(draft.stepIndex, draft, errors);
    syncNavigationButtons();
    syncComplexityInteractivity();
  }

  function syncNavigationButtons() {
    const nextBtn = mountEl.querySelector("button[data-action='next']");
    if (nextBtn) {
      nextBtn.disabled = !validateStep(draft.stepIndex, draft).valid;
    }
  }

  function cleanup() {
    mountEl.removeEventListener("click", handleClick);
    mountEl.removeEventListener("input", handleInputChange);
    mountEl.removeEventListener("change", handleInputChange);
  }

  function syncComplexityInteractivity() {
    const complexityGrid = mountEl.querySelector(".complexity-grid");
    if (!complexityGrid) return;

    const lockForWeb = draft.type === "webapp"
      && (draft.methodology === "greybox" || draft.methodology === "whitebox")
      && !draft.urlName.trim();
    const lockForMobile = draft.type === "mobile_pt"
      && (draft.methodology === "greybox" || draft.methodology === "whitebox")
      && !draft.mobileAppName.trim();
    const locked = lockForWeb || lockForMobile;

    complexityGrid.classList.toggle("is-locked", locked);
    const complexityInputs = complexityGrid.querySelectorAll("input[name='complexity']");
    complexityInputs.forEach((input) => {
      input.disabled = locked;
    });
  }
}

function renderStepMarkup(stepIndex, draft, errors) {
  const progress = `<div class="wizard-step-indicator mb-3">Step ${stepIndex + 1} of ${TOTAL_STEPS}</div>`;

  if (stepIndex === 0) {
    return `${progress}
      <div class="mb-3">
        <label class="form-label">Assessment Type</label>
        <div class="assessment-type-grid">
          <label class="assessment-type-card ${draft.type === "webapp" ? "is-selected" : ""}" for="typeWebApp">
            <input class="visually-hidden" type="radio" name="assessmentType" id="typeWebApp" value="webapp" ${draft.type === "webapp" ? "checked" : ""}>
            <span class="assessment-type-title">Web Application Penetration Test</span>
            <span class="assessment-type-subtitle">Web application focused security assessment</span>
          </label>
          <label class="assessment-type-card ${draft.type === "mobile_pt" ? "is-selected" : ""}" for="typeMobilePt">
            <input class="visually-hidden" type="radio" name="assessmentType" id="typeMobilePt" value="mobile_pt" ${draft.type === "mobile_pt" ? "checked" : ""}>
            <span class="assessment-type-title">Mobile Application Penetration Test</span>
            <span class="assessment-type-subtitle">Mobile application focused security assessment</span>
          </label>
          <label class="assessment-type-card ${draft.type === "network" ? "is-selected" : ""}" for="typeNetwork">
            <input class="visually-hidden" type="radio" name="assessmentType" id="typeNetwork" value="network" ${draft.type === "network" ? "checked" : ""}>
            <span class="assessment-type-title">Network Penetration Test</span>
            <span class="assessment-type-subtitle">Penetration testing against internal or external IP address/hosts</span>
          </label>
          <label class="assessment-type-card ${draft.type === "network_va" ? "is-selected" : ""}" for="typeNetworkVa">
            <input class="visually-hidden" type="radio" name="assessmentType" id="typeNetworkVa" value="network_va" ${draft.type === "network_va" ? "checked" : ""}>
            <span class="assessment-type-title">Network Vulnerability Assessment</span>
            <span class="assessment-type-subtitle">Assess the vulnerability within your hosts</span>
          </label>
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2">
        <button type="button" class="btn btn-primary" data-action="next">Continue</button>
      </div>
    `;
  }

  if (stepIndex === 1) {
    return `${progress}
      ${draft.type === "webapp" || draft.type === "mobile_pt" ? renderWebMethodologyStep(draft, errors) : renderNetworkScopeStep(draft, errors)}
      <div class="d-flex justify-content-between gap-2">
        <button type="button" class="btn btn-outline-secondary" data-action="back">Back</button>
        <button type="button" class="btn btn-primary" data-action="next">Next</button>
      </div>
    `;
  }

  if (stepIndex === 2) {
    return `${progress}
      ${renderDetailStepByType(draft, errors)}
      ${renderError(errors._form)}
      <div class="d-flex justify-content-between gap-2 mt-4">
        <button type="button" class="btn btn-outline-secondary" data-action="back">Back</button>
        <button type="button" class="btn btn-primary" data-action="next">Next</button>
      </div>
    `;
  }

  const review = buildReview(draft);
  const fullRetestMd = getFullRetestMd(draft);
  const retestImpactLabel = draft.includeRetest ? `+${fullRetestMd} MD` : "0 MD";
  return `${progress}
    <h3 class="h6">Review</h3>
    ${review.error ? `<div class="alert alert-danger">${escapeHtml(review.error)}</div>` : ""}
    ${review.error ? "" : `
      <section class="review-readonly mb-3">
        <ul class="list-group mb-0">
          <li class="list-group-item d-flex justify-content-between"><span>Type</span><strong>${escapeHtml(review.typeLabel)}</strong></li>
          <li class="list-group-item d-flex justify-content-between"><span>Methodology</span><strong>${escapeHtml(review.methodologyLabel)}</strong></li>
          <li class="list-group-item d-flex justify-content-between"><span>Detail</span><strong>${escapeHtml(review.detailSummary)}</strong></li>
        </ul>
      </section>
      <section class="review-editable mb-3">
        <div class="mb-3">
          <label class="form-label">Retest Option</label>
          <div class="option-card-grid option-card-grid--2">
            <label class="assessment-type-card option-card ${draft.includeRetest ? "is-selected" : ""}" for="includeRetestYes">
              <input class="visually-hidden" type="radio" name="includeRetestMode" id="includeRetestYes" value="yes" ${draft.includeRetest ? "checked" : ""}>
              <span class="assessment-type-title">Include Retest</span>
            </label>
            <label class="assessment-type-card option-card ${!draft.includeRetest ? "is-selected" : ""}" for="includeRetestNo">
              <input class="visually-hidden" type="radio" name="includeRetestMode" id="includeRetestNo" value="no" ${!draft.includeRetest ? "checked" : ""}>
              <span class="assessment-type-title">No Retest</span>
            </label>
          </div>
        </div>
        <div class="retest-impact-row mb-0">
          <span>Retest impact</span>
          <strong>${retestImpactLabel}</strong>
          <span class="ms-3">Estimated total</span>
          <strong>${review.md.total} MD</strong>
        </div>
      </section>
    `}
    ${renderError(errors._form)}
    <div class="d-flex justify-content-between gap-2">
      <button type="button" class="btn btn-outline-secondary" data-action="back">Back</button>
      <button type="button" class="btn btn-success" data-action="submit" ${review.error ? "disabled" : ""}>${escapeHtml(draft.submitLabel)}</button>
    </div>
  `;
}

function renderDetailStepByType(draft, errors) {
  if (draft.type === "webapp") return renderWebConditionalForm(draft, errors, renderError, escapeHtml);
  if (draft.type === "network") return renderNetworkPtForm(draft, errors, renderError, escapeHtml);
  if (draft.type === "network_va") return renderNetworkVaForm(draft, errors, renderError, escapeHtml);
  if (draft.type === "mobile_pt") return renderMobilePtForm(draft, errors, renderError, escapeHtml);
  return `<div class="alert alert-warning">Select assessment type first.</div>`;
}

function renderWebMethodologyStep(draft, errors) {
  return `
    <div class="mb-3">
      <label class="form-label">Methodology</label>
      <div class="methodology-grid">
        <label class="assessment-type-card methodology-card ${draft.methodology === "blackbox" ? "is-selected" : ""}" for="methodBlackbox">
          <input class="visually-hidden" type="radio" name="methodology" id="methodBlackbox" value="blackbox" ${draft.methodology === "blackbox" ? "checked" : ""}>
          <span class="assessment-type-title">Black-Box Testing</span>
          <span class="assessment-type-subtitle">Simulates an external attacker with no access or prior knowledge.</span>
          <ul class="methodology-points">
            <li>No credentials, documentation, or internal information are provided.</li>
            <li>Tests what can be discovered and exploited from the outside (pre-authentication).</li>
            <li>Typically, narrower in scope and less costly.</li>
          </ul>
        </label>
        <label class="assessment-type-card methodology-card ${draft.methodology === "greybox" ? "is-selected" : ""}" for="methodGreybox">
          <input class="visually-hidden" type="radio" name="methodology" id="methodGreybox" value="greybox" ${draft.methodology === "greybox" ? "checked" : ""}>
          <span class="assessment-type-title">Grey-Box Testing</span>
          <span class="assessment-type-subtitle">Simulates an attacker with limited access (e.g., a standard user account).</span>
          <ul class="methodology-points">
            <li>Valid credentials or partial system knowledge are provided.</li>
            <li>Assesses what a compromised account, malicious insider, or stolen credentials could exploit.</li>
            <li>Broader scope and effort required when compared with black-box testing.</li>
          </ul>
        </label>
        <label class="assessment-type-card methodology-card ${draft.methodology === "whitebox" ? "is-selected" : ""}" for="methodWhitebox">
          <input class="visually-hidden" type="radio" name="methodology" id="methodWhitebox" value="whitebox" ${draft.methodology === "whitebox" ? "checked" : ""}>
          <span class="assessment-type-title">White-Box Testing</span>
          <span class="assessment-type-subtitle">Provides full transparency, including architecture details, configuration information, and potentially source code.</span>
          <ul class="methodology-points">
            <li>Enables deep, methodical security analysis beyond surface testing.</li>
            <li>Best for high-risk systems, new launches or when maximum assurance is required.</li>
            <li>Highest level of access, depth, and testing effort.</li>
          </ul>
        </label>
      </div>
      ${renderError(errors.methodology)}
    </div>
  `;
}

function renderNetworkScopeStep(draft, errors) {
  const helper = draft.type === "network"
    ? "Methodology will be set to Black-box by default."
    : "Select if this Vulnerability Assessment is external or internal scope.";

  return `
    <div class="mb-3">
      <label class="form-label">Network Scope</label>
      <div class="option-card-grid option-card-grid--2">
        <label class="assessment-type-card option-card ${draft.networkScope === "external" ? "is-selected" : ""}" for="scopeExternal">
          <input class="visually-hidden" type="radio" name="networkScope" id="scopeExternal" value="external" ${draft.networkScope === "external" ? "checked" : ""}>
          <span class="assessment-type-title">External</span>
        </label>
        <label class="assessment-type-card option-card ${draft.networkScope === "internal" ? "is-selected" : ""}" for="scopeInternal">
          <input class="visually-hidden" type="radio" name="networkScope" id="scopeInternal" value="internal" ${draft.networkScope === "internal" ? "checked" : ""}>
          <span class="assessment-type-title">Internal</span>
        </label>
      </div>
      <div class="wizard-helper mt-2">${helper}</div>
      ${renderError(errors.networkScope)}
    </div>
  `;
}

function buildReview(draft) {
  try {
    const assessment = buildAssessmentObject(draft);
    return {
      typeLabel: assessment.typeLabel,
      methodologyLabel: assessment.methodologyLabel,
      detailSummary: assessment.detailSummary,
      md: assessment.md,
    };
  } catch (error) {
    return { error: error.message || "Invalid data" };
  }
}

function validateStep(stepIndex, draft) {
  const errors = {};

  if (stepIndex === 0) {
    if (!["webapp", "network", "network_va", "mobile_pt"].includes(draft.type)) {
      errors.type = "Select assessment type.";
      return { valid: false, errors };
    }

    return { valid: true, errors };
  }

  if (stepIndex === 1) {
    if (draft.type === "webapp" || draft.type === "mobile_pt") {
      if (!["blackbox", "greybox", "whitebox"].includes(draft.methodology)) {
        errors.methodology = "Select one methodology.";
      }
    } else if (!["external", "internal"].includes(draft.networkScope)) {
      errors.networkScope = "Select network scope.";
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  if (stepIndex >= 2) {
    return validateDetailInputs(draft);
  }

  return { valid: true, errors };
}

function validateDetailInputs(draft) {
  if (draft.type === "webapp") return validateWebPtInputs(draft);
  if (draft.type === "network") return validateNetworkPtInputs(draft);
  if (draft.type === "network_va") return validateNetworkVaInputs(draft);
  if (draft.type === "mobile_pt") return validateMobilePtInputs(draft);
  return { valid: false, errors: { type: "Unsupported assessment type." } };
}

function buildAssessmentObject(draft, includeRetest = draft.includeRetest) {
  const validation = validateDetailInputs(draft);
  if (!validation.valid) {
    throw new Error("Please fix validation errors before submitting.");
  }

  if (draft.type === "webapp") return applyRetestPreference(buildWebPtAssessment(draft), includeRetest);
  if (draft.type === "network") return applyRetestPreference(buildNetworkPtAssessment(draft), includeRetest);
  if (draft.type === "network_va") return applyRetestPreference(buildNetworkVaAssessment(draft), includeRetest);
  if (draft.type === "mobile_pt") return applyRetestPreference(buildMobilePtAssessment(draft), includeRetest);

  throw new Error("Unsupported assessment type.");
}
function createInitialDraft(initialAssessment, submitLabel) {
  if (!initialAssessment) {
    return {
      type: "webapp",
      typeLabel: "Web Application Penetration Test",
      methodology: "",
      methodologyLabel: "",
      stepIndex: 0,
      targetMode: "",
      urlName: "",
      hasLogin: "",
      canSelfRegister: "",
      urlCount: "",
      urlListText: "",
      complexity: "",
      networkScope: "",
      networkAuthMode: "",
      ipCount: "",
      mobileAppName: "",
      mobileOs: "",
      includeRetest: true,
      submitLabel,
    };
  }

  const inputs = initialAssessment.inputs || {};

  if (initialAssessment.type === "network") {
    return {
      type: "network",
      typeLabel: "Network Penetration Test",
      methodology: "blackbox",
      methodologyLabel: "Black-box",
      stepIndex: 1,
      targetMode: "",
      urlName: "",
      hasLogin: "",
      canSelfRegister: "",
      urlCount: "",
      urlListText: "",
      complexity: "",
      networkScope: inputs.networkScope || "",
      networkAuthMode: "",
      ipCount: String(inputs.ipCount ?? ""),
      includeRetest: getInitialIncludeRetest(initialAssessment),
      submitLabel,
    };
  }

  if (initialAssessment.type === "network_va") {
    return {
      type: "network_va",
      typeLabel: "Network Vulnerability Assessment",
      methodology: inputs.networkAuthMode || initialAssessment.methodology || "",
      methodologyLabel: initialAssessment.methodologyLabel || "",
      stepIndex: 1,
      targetMode: "",
      urlName: "",
      hasLogin: "",
      canSelfRegister: "",
      urlCount: "",
      urlListText: "",
      complexity: "",
      networkScope: inputs.networkScope || "",
      networkAuthMode: inputs.networkAuthMode || "",
      ipCount: String(inputs.ipCount ?? ""),
      mobileAppName: "",
      mobileOs: "",
      includeRetest: getInitialIncludeRetest(initialAssessment),
      submitLabel,
    };
  }

  if (initialAssessment.type === "mobile_pt") {
    return {
      type: "mobile_pt",
      typeLabel: "Mobile Application Penetration Test",
      methodology: initialAssessment.methodology || "",
      methodologyLabel: initialAssessment.methodologyLabel || "",
      stepIndex: 1,
      targetMode: "",
      urlName: "",
      hasLogin: "",
      canSelfRegister: "",
      urlCount: "",
      urlListText: "",
      complexity: inputs.complexity || "",
      networkScope: "",
      networkAuthMode: "",
      ipCount: "",
      mobileAppName: typeof inputs.appName === "string" ? inputs.appName : "",
      mobileOs: typeof inputs.os === "string" ? inputs.os : "",
      includeRetest: getInitialIncludeRetest(initialAssessment),
      submitLabel,
    };
  }

  const isBlackbox = initialAssessment.methodology === "blackbox";
  const targetMode = isBlackbox ? inputs.targetMode || "single" : "";
  const urlList = Array.isArray(inputs.urlList) ? inputs.urlList : [];

  return {
    type: "webapp",
    typeLabel: "Web Application Penetration Test",
    methodology: initialAssessment.methodology || "",
    methodologyLabel: initialAssessment.methodologyLabel || "",
    stepIndex: 1,
    targetMode,
    urlName: typeof inputs.urlName === "string" ? inputs.urlName : "",
    hasLogin: targetMode === "single" ? (inputs.hasLogin ? "yes" : "no") : "",
    canSelfRegister: targetMode === "single" && inputs.hasLogin ? (inputs.canSelfRegister ? "yes" : "no") : "",
    urlCount: targetMode === "multiple" ? String(inputs.urlCount ?? "") : "",
    urlListText: targetMode === "multiple" ? urlList.join("\n") : "",
    complexity: typeof inputs.complexity === "string" ? inputs.complexity : "",
    networkScope: "",
    networkAuthMode: "",
    ipCount: "",
    mobileAppName: "",
    mobileOs: "",
    includeRetest: getInitialIncludeRetest(initialAssessment),
    submitLabel,
  };
}

function resetTypeSpecificFields(draft) {
  draft.targetMode = "";
  draft.urlName = "";
  draft.hasLogin = "";
  draft.canSelfRegister = "";
  draft.urlCount = "";
  draft.urlListText = "";
  draft.complexity = "";
  draft.networkScope = "";
  draft.networkAuthMode = "";
  draft.ipCount = "";
  draft.mobileAppName = "";
  draft.mobileOs = "";
}

function applyRetestPreference(assessment, includeRetest) {
  assessment.inputs = {
    ...(assessment.inputs || {}),
    includeRetest: Boolean(includeRetest),
  };

  if (includeRetest) return assessment;

  const initial = Number(assessment.md?.initial) || 0;
  const reporting = Number(assessment.md?.reporting) || 0;
  assessment.md = {
    ...assessment.md,
    retest: 0,
    total: initial + reporting,
  };

  return assessment;
}

function getInitialIncludeRetest(initialAssessment) {
  if (typeof initialAssessment?.inputs?.includeRetest === "boolean") {
    return initialAssessment.inputs.includeRetest;
  }

  if (typeof initialAssessment?.md?.retest === "number") {
    return initialAssessment.md.retest > 0;
  }

  return true;
}

function getFullRetestMd(draft) {
  try {
    const withRetest = buildAssessmentObject(draft, true);
    return Number(withRetest.md?.retest) || 0;
  } catch (_error) {
    return 0;
  }
}
