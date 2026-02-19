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
      requiresRerender = draft.stepIndex === 2;

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
    }

    if (target.matches("input[name='networkAuthMode']")) {
      draft.networkAuthMode = target.value;
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
    }

    if (target.matches("select[name='complexity']")) {
      draft.complexity = target.value;
    }

    if (target.matches("input[name='urlName']")) {
      draft.urlName = target.value;
    }

    if (target.matches("input[name='urlCount']")) {
      draft.urlCount = target.value;
    }

    if (target.matches("input[name='ipCount']")) {
      draft.ipCount = target.value;
    }

    if (target.matches("input[name='mobileAppName']")) {
      draft.mobileAppName = target.value;
    }

    if (target.matches("input[name='mobileOs']")) {
      draft.mobileOs = target.value;
    }

    if (target.matches("textarea[name='urlListText']")) {
      draft.urlListText = target.value;
    }

    if (requiresRerender) {
      renderStep();
    } else {
      syncNavigationButtons();
    }
  }

  function renderStep(errors = {}) {
    mountEl.innerHTML = renderStepMarkup(draft.stepIndex, draft, errors);
    syncNavigationButtons();
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
  return `${progress}
    <h3 class="h6">Review</h3>
    ${review.error ? `<div class="alert alert-danger">${escapeHtml(review.error)}</div>` : ""}
    ${review.error ? "" : `
      <ul class="list-group mb-3">
        <li class="list-group-item d-flex justify-content-between"><span>Type</span><strong>${escapeHtml(review.typeLabel)}</strong></li>
        <li class="list-group-item d-flex justify-content-between"><span>Methodology</span><strong>${escapeHtml(review.methodologyLabel)}</strong></li>
        <li class="list-group-item d-flex justify-content-between"><span>Detail</span><strong>${escapeHtml(review.detailSummary)}</strong></li>
        <li class="list-group-item d-flex justify-content-between"><span>Initial</span><strong>${review.md.initial}</strong></li>
        <li class="list-group-item d-flex justify-content-between"><span>Reporting</span><strong>${review.md.reporting}</strong></li>
        <li class="list-group-item d-flex justify-content-between"><span>Retest</span><strong>${review.md.retest}</strong></li>
        <li class="list-group-item d-flex justify-content-between"><span>Total</span><strong>${review.md.total}</strong></li>
      </ul>
    `}
    ${renderError(errors._form)}
    <div class="d-flex justify-content-between gap-2">
      <button type="button" class="btn btn-outline-secondary" data-action="back">Back</button>
      <button type="button" class="btn btn-success" data-action="submit" ${review.error ? "disabled" : ""}>${escapeHtml(draft.submitLabel)}</button>
    </div>
  `;
}

function renderDetailStepByType(draft, errors) {
  if (draft.type === "webapp") return renderWebConditionalForm(draft, errors);
  if (draft.type === "network") return renderNetworkPtForm(draft, errors);
  if (draft.type === "network_va") return renderNetworkVaForm(draft, errors);
  if (draft.type === "mobile_pt") return renderMobilePtForm(draft, errors);
  return `<div class="alert alert-warning">Select assessment type first.</div>`;
}

function renderWebMethodologyStep(draft, errors) {
  return `
    <div class="mb-3">
      <label class="form-label">Methodology</label>
      <div class="form-check">
        <input class="form-check-input" type="radio" name="methodology" id="methodBlackbox" value="blackbox" ${draft.methodology === "blackbox" ? "checked" : ""}>
        <label class="form-check-label" for="methodBlackbox">Black-box</label>
        <div class="wizard-helper ms-4">Unauthenticated test from external perspective.</div>
      </div>
      <div class="form-check mt-2">
        <input class="form-check-input" type="radio" name="methodology" id="methodGreybox" value="greybox" ${draft.methodology === "greybox" ? "checked" : ""}>
        <label class="form-check-label" for="methodGreybox">Grey-box</label>
        <div class="wizard-helper ms-4">Authenticated test from internal/user perspective.</div>
      </div>
      <div class="form-check mt-2">
        <input class="form-check-input" type="radio" name="methodology" id="methodWhitebox" value="whitebox" ${draft.methodology === "whitebox" ? "checked" : ""}>
        <label class="form-check-label" for="methodWhitebox">White-box</label>
        <div class="wizard-helper ms-4">Authenticated test includes reviewing the source code.</div>
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
      <div class="form-check">
        <input class="form-check-input" type="radio" name="networkScope" id="scopeExternal" value="external" ${draft.networkScope === "external" ? "checked" : ""}>
        <label class="form-check-label" for="scopeExternal">External</label>
      </div>
      <div class="form-check mt-2">
        <input class="form-check-input" type="radio" name="networkScope" id="scopeInternal" value="internal" ${draft.networkScope === "internal" ? "checked" : ""}>
        <label class="form-check-label" for="scopeInternal">Internal</label>
      </div>
      <div class="wizard-helper mt-2">${helper}</div>
      ${renderError(errors.networkScope)}
    </div>
  `;
}

function renderWebConditionalForm(draft, errors) {
  if (draft.methodology === "blackbox") {
    return `
      <div class="mb-3">
        <label class="form-label">Target Mode</label>
        <div class="form-check">
          <input class="form-check-input" type="radio" name="targetMode" id="targetSingle" value="single" ${draft.targetMode === "single" ? "checked" : ""}>
          <label class="form-check-label" for="targetSingle">Single target</label>
        </div>
        <div class="form-check mt-2">
          <input class="form-check-input" type="radio" name="targetMode" id="targetMultiple" value="multiple" ${draft.targetMode === "multiple" ? "checked" : ""}>
          <label class="form-check-label" for="targetMultiple">Multiple target</label>
        </div>
        ${renderError(errors.targetMode)}
      </div>

      ${draft.targetMode === "single" ? renderSingleTargetFields(draft, errors) : ""}
      ${draft.targetMode === "multiple" ? renderMultipleTargetFields(draft, errors) : ""}
    `;
  }

  if (draft.methodology === "greybox" || draft.methodology === "whitebox") {
    return `
      <div class="mb-3">
        <label for="urlName" class="form-label">URL / Name</label>
        <input id="urlName" class="form-control" name="urlName" value="${escapeHtml(draft.urlName)}" placeholder="https://example.com" />
        ${renderError(errors.urlName)}
      </div>

      <div class="mb-3">
        <label for="complexity" class="form-label">Complexity</label>
        <select id="complexity" class="form-select" name="complexity">
          <option value="">Select complexity</option>
          <option value="small" ${draft.complexity === "small" ? "selected" : ""}>Small</option>
          <option value="medium" ${draft.complexity === "medium" ? "selected" : ""}>Medium</option>
          <option value="large" ${draft.complexity === "large" ? "selected" : ""}>Large</option>
        </select>
        ${renderError(errors.complexity)}
      </div>
    `;
  }

  return `<div class="alert alert-warning">Select methodology first.</div>`;
}

function renderNetworkPtForm(draft, errors) {
  return `
    <div class="mb-3">
      <label for="ipCount" class="form-label">Total IP Address In-scope</label>
      <input id="ipCount" type="number" min="1" class="form-control" name="ipCount" value="${escapeHtml(draft.ipCount)}" />
      ${renderError(errors.ipCount)}
    </div>
  `;
}

function renderNetworkVaForm(draft, errors) {
  return `
    <div class="mb-3">
      <label class="form-label">Assessment Methodology</label>
      <div class="form-check">
        <input class="form-check-input" type="radio" name="networkAuthMode" id="authCredentialed" value="credentialed" ${draft.networkAuthMode === "credentialed" ? "checked" : ""}>
        <label class="form-check-label" for="authCredentialed">Credentialed (authenticated)</label>
      </div>
      <div class="form-check mt-2">
        <input class="form-check-input" type="radio" name="networkAuthMode" id="authNonCredentialed" value="non_credentialed" ${draft.networkAuthMode === "non_credentialed" ? "checked" : ""}>
        <label class="form-check-label" for="authNonCredentialed">Non-credentialed (unauthenticated)</label>
      </div>
      ${renderError(errors.networkAuthMode)}
    </div>

    <div class="mb-3">
      <label for="ipCount" class="form-label">Total IP Address In-scope</label>
      <input id="ipCount" type="number" min="1" class="form-control" name="ipCount" value="${escapeHtml(draft.ipCount)}" />
      ${renderError(errors.ipCount)}
    </div>
  `;
}

function renderMobilePtForm(draft, errors) {
  return `
    <div class="mb-3">
      <label for="mobileAppName" class="form-label">App Name</label>
      <input id="mobileAppName" class="form-control" name="mobileAppName" value="${escapeHtml(draft.mobileAppName)}" />
      ${renderError(errors.mobileAppName)}
    </div>

    <div class="mb-3">
      <label class="form-label">OS</label>
      <div class="form-check">
        <input class="form-check-input" type="radio" name="mobileOs" id="mobileOsAndroid" value="android" ${draft.mobileOs === "android" ? "checked" : ""}>
        <label class="form-check-label" for="mobileOsAndroid">Android</label>
      </div>
      <div class="form-check mt-2">
        <input class="form-check-input" type="radio" name="mobileOs" id="mobileOsIos" value="ios" ${draft.mobileOs === "ios" ? "checked" : ""}>
        <label class="form-check-label" for="mobileOsIos">iOS</label>
      </div>
      <div class="form-check mt-2">
        <input class="form-check-input" type="radio" name="mobileOs" id="mobileOsBoth" value="both" ${draft.mobileOs === "both" ? "checked" : ""}>
        <label class="form-check-label" for="mobileOsBoth">Both</label>
      </div>
      ${renderError(errors.mobileOs)}
    </div>

    ${draft.methodology === "greybox" || draft.methodology === "whitebox" ? `
      <div class="mb-3">
        <label for="complexity" class="form-label">Complexity</label>
        <select id="complexity" class="form-select" name="complexity">
          <option value="">Select complexity</option>
          <option value="small" ${draft.complexity === "small" ? "selected" : ""}>Small</option>
          <option value="medium" ${draft.complexity === "medium" ? "selected" : ""}>Medium</option>
          <option value="large" ${draft.complexity === "large" ? "selected" : ""}>Large</option>
        </select>
        ${renderError(errors.complexity)}
      </div>
    ` : ""}
  `;
}

function renderSingleTargetFields(draft, errors) {
  return `
    <div class="mb-3">
      <label for="urlName" class="form-label">URL / Name</label>
      <input id="urlName" class="form-control" name="urlName" value="${escapeHtml(draft.urlName)}" placeholder="https://example.com" />
      ${renderError(errors.urlName)}
    </div>

    <div class="mb-3">
      <label class="form-label">Does a login page exist for this app?</label>
      <div class="form-check">
        <input class="form-check-input" type="radio" name="hasLogin" id="loginYes" value="yes" ${draft.hasLogin === "yes" ? "checked" : ""}>
        <label class="form-check-label" for="loginYes">Yes</label>
      </div>
      <div class="form-check">
        <input class="form-check-input" type="radio" name="hasLogin" id="loginNo" value="no" ${draft.hasLogin === "no" ? "checked" : ""}>
        <label class="form-check-label" for="loginNo">No</label>
      </div>
      ${renderError(errors.hasLogin)}
    </div>

    ${draft.hasLogin === "yes" ? `
      <div class="mb-3">
        <label class="form-label">Can User Self-register?</label>
        <div class="form-check">
          <input class="form-check-input" type="radio" name="canSelfRegister" id="selfRegYes" value="yes" ${draft.canSelfRegister === "yes" ? "checked" : ""}>
          <label class="form-check-label" for="selfRegYes">Yes</label>
        </div>
        <div class="form-check">
          <input class="form-check-input" type="radio" name="canSelfRegister" id="selfRegNo" value="no" ${draft.canSelfRegister === "no" ? "checked" : ""}>
          <label class="form-check-label" for="selfRegNo">No</label>
        </div>
        ${renderError(errors.canSelfRegister)}
      </div>
    ` : ""}
  `;
}

function renderMultipleTargetFields(draft, errors) {
  return `
    <div class="mb-3">
      <label for="urlCount" class="form-label">URL Count</label>
      <input id="urlCount" type="number" min="1" class="form-control" name="urlCount" value="${escapeHtml(draft.urlCount)}" />
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

function renderError(message) {
  if (!message) return "";
  return `<div class="invalid-feedback d-block">${escapeHtml(message)}</div>`;
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
    } else {
      if (!["external", "internal"].includes(draft.networkScope)) {
        errors.networkScope = "Select network scope.";
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  if (stepIndex >= 2) {
    return validateDetailInputs(draft);
  }

  return { valid: true, errors };
}

function validateDetailInputs(draft) {
  const errors = {};

  if (draft.type === "mobile_pt") {
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

  if (draft.type === "network") {
    if (!["external", "internal"].includes(draft.networkScope)) {
      errors.networkScope = "Select network scope.";
    }

    const ipCount = Number.parseInt(draft.ipCount, 10);
    if (!Number.isInteger(ipCount) || ipCount < 1) {
      errors.ipCount = "Total IP Address In-scope must be a number >= 1.";
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  if (draft.type === "network_va") {
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

function buildAssessmentObject(draft) {
  const validation = validateDetailInputs(draft);
  if (!validation.valid) {
    throw new Error("Please fix validation errors before submitting.");
  }

  if (draft.type === "network") {
    const md = calculateNetworkPtMD(draft);
    const scopeLabel = draft.networkScope === "external" ? "External" : "Internal";

    return {
      id: generateId(),
      type: "network",
      typeLabel: `${scopeLabel} Network Penetration Test`,
      methodology: "blackbox",
      methodologyLabel: "Black-box",
      inputs: {
        networkScope: draft.networkScope,
        ipCount: Number.parseInt(draft.ipCount, 10),
      },
      detailSummary: `${scopeLabel} scope: ${Number.parseInt(draft.ipCount, 10)} IP in-scope`,
      md,
      createdAt: new Date().toISOString(),
    };
  }

  if (draft.type === "network_va") {
    const md = calculateNetworkVaMD(draft);
    const scopeLabel = draft.networkScope === "external" ? "External" : "Internal";
    const authLabel = draft.networkAuthMode === "credentialed" ? "Credentialed" : "Non-Credentialed";

    return {
      id: generateId(),
      type: "network_va",
      typeLabel: `${scopeLabel} Network Vulnerability Assessment`,
      methodology: draft.networkAuthMode,
      methodologyLabel: authLabel,
      inputs: {
        networkScope: draft.networkScope,
        networkAuthMode: draft.networkAuthMode,
        ipCount: Number.parseInt(draft.ipCount, 10),
      },
      detailSummary: `${authLabel}: ${Number.parseInt(draft.ipCount, 10)} IP in-scope`,
      md,
      createdAt: new Date().toISOString(),
    };
  }

  if (draft.type === "mobile_pt") {
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

  const md = calculateWebMD(draft);
  const methodologyLabel = getMethodologyLabel(draft.methodology);

  return {
    id: generateId(),
    type: "webapp",
    typeLabel: "Web Application Penetration Test",
    methodology: draft.methodology,
    methodologyLabel,
    inputs: buildWebInputs(draft),
    detailSummary: buildWebDetailSummary(draft),
    md,
    createdAt: new Date().toISOString(),
  };
}

function calculateNetworkPtMD(draft) {
  const ipCount = Number.parseInt(draft.ipCount, 10);
  if (!Number.isInteger(ipCount) || ipCount < 1) throw new Error("Invalid IP count.");

  return calculateNetworkPtMDFromIp(ipCount);
}

function calculateNetworkVaMD(draft) {
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

function calculateNetworkPtMDFromIp(ipCount) {
  const initial = Math.min(9, Math.ceil(ipCount / 10));
  const reporting = 1;
  const retest = initial < 8 ? 1 : 2;
  return { initial, reporting, retest, total: initial + reporting + retest };
}

function calculateNetworkVaCredentialedInitial(ipCount) {
  return Math.min(9, Math.ceil(ipCount / 8.8));
}

function calculateWebMD(draft) {
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

function calculateMobilePtMD(draft) {
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
  if (draft.methodology === "whitebox") {
    return `Complexity: ${complexityLabel} (Initial x1.2)`;
  }

  return `Complexity: ${complexityLabel}`;
}

function buildMobileDetailSummary(draft) {
  const osLabel = getMobileOsLabel(draft.mobileOs);
  if (draft.methodology === "blackbox") return `OS: ${osLabel}`;

  const complexityLabel = capitalize(draft.complexity);
  if (draft.methodology === "whitebox") {
    return `OS: ${osLabel}, Complexity: ${complexityLabel} (Initial x1.2)`;
  }

  return `OS: ${osLabel}, Complexity: ${complexityLabel}`;
}

function getMethodologyLabel(methodology) {
  const labels = {
    blackbox: "Black-box",
    greybox: "Grey-box",
    whitebox: "White-box",
    credentialed: "Credentialed",
    non_credentialed: "Non-Credentialed",
  };

  return labels[methodology] || methodology;
}

function parseUrlLines(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
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

function getMobileOsLabel(value) {
  if (value === "android") return "Android";
  if (value === "ios") return "iOS";
  if (value === "both") return "Both";
  return "Unknown";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function capitalize(value) {
  if (!value) return "";
  return value[0].toUpperCase() + value.slice(1);
}
