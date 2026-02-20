import { capitalize, generateId, getMethodologyLabel, parseUrlLines, renderComplexityCards } from "./shared.js";

export function renderWebConditionalForm(draft, errors, renderError, escapeHtml) {
  if (draft.methodology === "blackbox") {
    return `
      <div class="mb-3">
        <label class="form-label">Target Mode</label>
        <div class="option-card-grid option-card-grid--2">
          <label class="assessment-type-card option-card ${draft.targetMode === "single" ? "is-selected" : ""}" for="targetSingle">
            <input class="visually-hidden" type="radio" name="targetMode" id="targetSingle" value="single" ${draft.targetMode === "single" ? "checked" : ""}>
            <span class="assessment-type-title">Single target</span>
          </label>
          <label class="assessment-type-card option-card ${draft.targetMode === "multiple" ? "is-selected" : ""}" for="targetMultiple">
            <input class="visually-hidden" type="radio" name="targetMode" id="targetMultiple" value="multiple" ${draft.targetMode === "multiple" ? "checked" : ""}>
            <span class="assessment-type-title">Multiple target</span>
          </label>
        </div>
        ${renderError(errors.targetMode)}
      </div>

      ${draft.targetMode === "single" ? renderSingleTargetFields(draft, errors, renderError, escapeHtml) : ""}
      ${draft.targetMode === "multiple" ? renderMultipleTargetFields(draft, errors, renderError, escapeHtml) : ""}
    `;
  }

  if (draft.methodology === "greybox" || draft.methodology === "whitebox") {
    const hasUrlOrName = Boolean(draft.urlName && draft.urlName.trim());

    return `
      <div class="mb-3">
        <label for="urlName" class="form-label">URL / Name *</label>
        <input id="urlName" class="form-control" name="urlName" value="${escapeHtml(draft.urlName)}" placeholder="https://example.com or My App Name" aria-required="true" />
        ${renderError(errors.urlName)}
      </div>

      ${renderComplexityCards(draft, errors, { locked: !hasUrlOrName })}
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

export function buildWebPtAssessment(draft) {
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
  return `
    <div class="mb-3">
      <label for="urlName" class="form-label">URL / Name</label>
      <input id="urlName" class="form-control" name="urlName" value="${escapeHtml(draft.urlName)}" placeholder="https://example.com or My App Name" />
      ${renderError(errors.urlName)}
    </div>

    <div class="mb-3">
      <label class="form-label">Does a login page exist for this app?</label>
      <div class="option-card-grid option-card-grid--2">
        <label class="assessment-type-card option-card ${draft.hasLogin === "yes" ? "is-selected" : ""}" for="loginYes">
          <input class="visually-hidden" type="radio" name="hasLogin" id="loginYes" value="yes" ${draft.hasLogin === "yes" ? "checked" : ""}>
          <span class="assessment-type-title">Yes</span>
        </label>
        <label class="assessment-type-card option-card ${draft.hasLogin === "no" ? "is-selected" : ""}" for="loginNo">
          <input class="visually-hidden" type="radio" name="hasLogin" id="loginNo" value="no" ${draft.hasLogin === "no" ? "checked" : ""}>
          <span class="assessment-type-title">No</span>
        </label>
      </div>
      ${renderError(errors.hasLogin)}
    </div>

    ${draft.hasLogin === "yes" ? `
      <div class="mb-3">
        <label class="form-label">Can User Self-register?</label>
        <div class="option-card-grid option-card-grid--2">
          <label class="assessment-type-card option-card ${draft.canSelfRegister === "yes" ? "is-selected" : ""}" for="selfRegYes">
            <input class="visually-hidden" type="radio" name="canSelfRegister" id="selfRegYes" value="yes" ${draft.canSelfRegister === "yes" ? "checked" : ""}>
            <span class="assessment-type-title">Yes</span>
          </label>
          <label class="assessment-type-card option-card ${draft.canSelfRegister === "no" ? "is-selected" : ""}" for="selfRegNo">
            <input class="visually-hidden" type="radio" name="canSelfRegister" id="selfRegNo" value="no" ${draft.canSelfRegister === "no" ? "checked" : ""}>
            <span class="assessment-type-title">No</span>
          </label>
        </div>
        ${renderError(errors.canSelfRegister)}
      </div>
    ` : ""}
  `;
}

function renderMultipleTargetFields(draft, errors, renderError, escapeHtml) {
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
