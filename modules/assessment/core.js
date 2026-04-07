import { mobilePtService } from "./offensive-services/mobile-pt.js?v=1.4";
import { networkPtService } from "./offensive-services/network-pt.js?v=1.4";
import { networkVaService } from "./offensive-services/network-va.js?v=1.4";
import { webPtService } from "./offensive-services/web-pt.js?v=1.4";
import { complianceSupportService } from "./security-advisory-services/compliance-support.js?v=1.4";
import { crewReviewService } from "./security-advisory-services/crew-review.js?v=1.4";
import { cyberSecurityReviewService } from "./security-advisory-services/cyber-security-review.js?v=1.4";
import { trainingAwarenessService } from "./security-advisory-services/training-awareness.js?v=1.4";

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

export function formatMultilineText(value) {
  return escapeHtml(value).replaceAll("\n", "<br>");
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

const DEFAULT_COMPLEXITY_OPTIONS = [
  {
    value: "small",
    title: "Small",
    points: [
      "1 user role, with a total of 10 functions",
      "Simple business logic",
      "Small internal or basic public applications",
      "Common examples: company profile website with login, simple booking system, event registration platform, basic internal data entry application",
    ],
  },
  {
    value: "medium",
    title: "Medium",
    points: [
      "2 user roles, with a total of 25 functions",
      "Role-based access (e.g., Admin & User)",
      "Mid-sized business applications",
      "Common examples: small-to-mid e-commerce platform, Learning Management System (LMS), HR management system, membership or loyalty application",
    ],
  },
  {
    value: "large",
    title: "Large",
    points: [
      "More than 2 user roles, or more than 50 functions",
      "Multiple access levels with granular permissions",
      "Complex business workflows",
      "Financial or transactional processing",
      "Common examples: internet banking system, enterprise ERP platform, marketplace platform, insurance or fintech application",
    ],
  },
];

export function renderComplexityCards(draft, errors, options = {}) {
  const locked = Boolean(options.locked);
  const complexityOptions = Array.isArray(options.cards) && options.cards.length
    ? options.cards
    : DEFAULT_COMPLEXITY_OPTIONS;
  const sectionLabel = options.sectionLabel ? `<div class="wizard-section-kicker">${escapeHtml(options.sectionLabel)}</div>` : "";
  const helper = options.helper ? `<div class="wizard-helper mt-2">${escapeHtml(options.helper)}</div>` : "";
  const focusTarget = typeof options.focusTarget === "string" ? options.focusTarget : "";
  const lockTitle = options.lockTitle || "Complete the target details first";
  const lockMessage = options.lockMessage || "Enter the application URL or name to unlock complexity selection.";

  return `
    <div class="mb-3">
      ${sectionLabel}
      <label class="form-label">Complexity</label>
      ${helper}
      <div class="complexity-grid-shell ${locked ? "is-locked" : ""}">
        ${locked ? `
          <button type="button" class="complexity-lock-overlay" ${focusTarget ? `data-focus-target="${escapeHtml(focusTarget)}"` : ""}>
            <span class="complexity-lock-overlay__title">${escapeHtml(lockTitle)}</span>
            <span class="complexity-lock-overlay__message">${escapeHtml(lockMessage)}</span>
          </button>
        ` : ""}
        <div class="complexity-grid ${locked ? "is-locked" : ""}">
          ${complexityOptions.map((item) => `
            <label class="assessment-type-card complexity-card ${draft.complexity === item.value ? "is-selected" : ""}" for="complexity-${escapeHtml(item.value)}">
              <input class="visually-hidden" type="radio" name="complexity" id="complexity-${escapeHtml(item.value)}" value="${escapeHtml(item.value)}" ${draft.complexity === item.value ? "checked" : ""} ${locked ? "disabled" : ""}>
              <span class="assessment-type-card__selection" aria-hidden="true"></span>
              <div class="assessment-type-card__header">
                <span class="complexity-title">${escapeHtml(item.title)}</span>
              </div>
              <div class="assessment-type-card__details">
                <ul class="complexity-points">
                  ${(Array.isArray(item.points) ? item.points : []).map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
                </ul>
              </div>
            </label>
          `).join("")}
        </div>
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

export function createWizardDraft(serviceId, submitLabel, overrides = {}) {
  return {
    serviceId,
    stepIndex: 0,
    includeRetest: null,
    reviewSelectionMade: false,
    submitLabel,
    ...overrides,
  };
}

export function getInitialIncludeRetest(initialAssessment) {
  if (typeof initialAssessment?.inputs?.includeRetest === "boolean") {
    return initialAssessment.inputs.includeRetest;
  }

  if (typeof initialAssessment?.md?.retest === "number") {
    return initialAssessment.md.retest > 0;
  }

  return true;
}

export function renderChoiceStep({
  label,
  name,
  options,
  selectedValue,
  errors = {},
  columns = 1,
  helper = "",
  gridClass = "",
  cardClass = "",
  compact = false,
}) {
  const gridClasses = ["option-card-grid", `option-card-grid--${columns}`];
  if (compact) gridClasses.push("option-card-grid--compact");
  if (gridClass) gridClasses.push(gridClass);

  return `
    <div class="mb-3">
      <label class="form-label">${escapeHtml(label)}</label>
      <div class="${gridClasses.join(" ")}">
        ${options.map((option) => renderChoiceCard({
          name,
          option,
          selectedValue,
          cardClass,
          compact,
        })).join("")}
      </div>
      ${helper ? `<div class="wizard-helper mt-2">${escapeHtml(helper)}</div>` : ""}
      ${renderError(errors[name])}
    </div>
  `;
}

export function renderServiceSelectionStep({ groups, services, selectedServiceId }) {
  return `
    <div class="service-group-stack">
      ${groups.map((group) => {
        const groupServices = services.filter((service) => service.groupId === group.id);
        return `
          <section class="service-group">
            <div class="service-group-header">
              <h3 class="service-group-title">${escapeHtml(group.title)}</h3>
              ${group.description ? `<p class="service-group-description">${escapeHtml(group.description)}</p>` : ""}
            </div>
            ${groupServices.length ? `
              <div class="assessment-type-grid">
                ${groupServices.map((service) => renderServiceCard(service, selectedServiceId)).join("")}
              </div>
            ` : `
              <div class="wizard-helper">No services configured for this group yet.</div>
            `}
          </section>
        `;
      }).join("")}
    </div>
  `;
}

export function renderReviewStep({ draft, review, fullRetestMd, reviewConfig = {} }) {
  const includeRetestMode = draft.includeRetest === true ? "yes" : draft.includeRetest === false ? "no" : "";
  const showRetestEditor = reviewConfig.editableRetest !== false;
  const summaryVisible = !showRetestEditor || Boolean(draft.reviewSelectionMade);
  const reviewIntroText = reviewConfig.reviewIntroText || "";
  const methodologyFieldLabel = reviewConfig.methodologyFieldLabel || "Methodology";
  const detailFieldLabel = reviewConfig.detailFieldLabel || "Detail";
  const retestLabel = reviewConfig.retestLabel || "Retest Option";
  const retestYesLabel = reviewConfig.retestYesLabel || "Include Retest";
  const retestNoLabel = reviewConfig.retestNoLabel || "No Retest";
  const retestStatLabel = reviewConfig.retestStatLabel || "Retest";
  const retestHelper = reviewConfig.retestHelper || "Retest is a follow-up verification after remediation to confirm that identified findings have been properly addressed. This applies to both offensive and security advisory services.";
  const mdBreakdownItems = [
    { label: "Initial", value: review.md.initial },
    { label: "Reporting", value: review.md.reporting },
    { label: retestStatLabel, value: review.md.retest },
  ];
  const reviewDetailMarkup = review.reviewDetailHtml
    ? `<div class="review-meta-item__value review-detail-html">${review.reviewDetailHtml}</div>`
    : `<strong class="review-meta-item__value">${formatMultilineText(review.detailSummary || "-")}</strong>`;

  return `
    ${reviewIntroText ? `<section class="review-intro mb-3">${escapeHtml(reviewIntroText)}</section>` : ""}
    <h3 class="review-heading">Review Scope</h3>
    ${review.error ? `<div class="alert alert-danger">${escapeHtml(review.error)}</div>` : `
      ${showRetestEditor ? `
        <section class="review-editable mb-3">
          ${renderChoiceStep({
            label: retestLabel,
            name: "includeRetestMode",
            selectedValue: includeRetestMode,
            columns: 2,
            compact: true,
            helper: retestHelper,
            options: [
              { value: "yes", title: retestYesLabel },
              { value: "no", title: retestNoLabel },
            ],
          })}
        </section>
      ` : ""}
      ${summaryVisible ? `
        <section class="review-card mb-3">
          <div class="review-card__hero">
            <div>
              <div class="review-card__eyebrow">Assessment Summary</div>
              <div class="review-card__title">${escapeHtml(review.typeLabel)}</div>
            </div>
          </div>

          <div class="review-meta-grid">
            <div class="review-meta-item">
              <span class="review-meta-item__label">${escapeHtml(methodologyFieldLabel)}</span>
              <strong class="review-meta-item__value">${escapeHtml(review.methodologyLabel || "-")}</strong>
            </div>
            <div class="review-meta-item">
              <span class="review-meta-item__label">${escapeHtml(detailFieldLabel)}</span>
              ${reviewDetailMarkup}
            </div>
          </div>

          <div class="review-md-grid">
            ${mdBreakdownItems.map((item) => `
              <div class="review-md-item">
                <span class="review-md-item__label">${escapeHtml(item.label)}</span>
                <strong class="review-md-item__value">${item.value} MD</strong>
              </div>
            `).join("")}
            <div class="review-md-item review-md-item--total">
              <span class="review-md-item__label">Total</span>
              <strong class="review-md-item__value">${review.md.total} MD</strong>
            </div>
          </div>
        </section>
      ` : `
        <div class="review-gate-note">Select ${escapeHtml(retestLabel.toLowerCase())} above to preview the assessment summary.</div>
      `}
    `}
  `;
}

export const SERVICE_GROUPS = [
  {
    id: "offensive-services",
    title: "Offensive Security Services",
    description: "Improve and strengthen your security by identifying key weaknesses",
  },
  {
    id: "security-advisory-services",
    title: "Cybersecurity Advisory Services",
    description: "A trusted advisor supporting to achieve compliance and improve overall security posture.",
  },
];

export const SERVICE_DEFINITIONS = [
  webPtService,
  mobilePtService,
  networkPtService,
  networkVaService,
  crewReviewService,
  cyberSecurityReviewService,
  complianceSupportService,
  trainingAwarenessService,
];

const SERVICES_BY_ID = new Map(SERVICE_DEFINITIONS.map((service) => [service.id, service]));
const SERVICES_BY_ASSESSMENT_TYPE = new Map(
  SERVICE_DEFINITIONS
    .filter((service) => typeof service.assessmentType === "string")
    .map((service) => [service.assessmentType, service]),
);

export function getServiceDefinition(serviceId) {
  return SERVICES_BY_ID.get(serviceId) || null;
}

export function getEnabledServices() {
  return SERVICE_DEFINITIONS.filter((service) => !service.disabled);
}

export function getDefaultServiceDefinition() {
  return getEnabledServices()[0] || null;
}

export function getDefaultServiceDefinitionForGroup(groupId) {
  return getEnabledServices().find((service) => service.groupId === groupId) || null;
}

export function getLogicServices() {
  return SERVICE_DEFINITIONS.filter((service) => typeof service.getLogicHtml === "function");
}

export function resolveAssessmentServiceId(assessment) {
  if (
    assessment?.inputs?.csrAssessmentType === "crew"
    || assessment?.methodology === "crew"
  ) {
    return "crew_review";
  }

  if (typeof assessment?.serviceId === "string" && SERVICES_BY_ID.has(assessment.serviceId)) {
    return assessment.serviceId;
  }

  const matched = SERVICES_BY_ASSESSMENT_TYPE.get(assessment?.type);
  return matched?.id || getDefaultServiceDefinition()?.id || "";
}

export function resolveAssessmentGroupId(assessment) {
  if (typeof assessment?.groupId === "string") return assessment.groupId;
  const serviceId = resolveAssessmentServiceId(assessment);
  return getServiceDefinition(serviceId)?.groupId || "offensive-services";
}

export function startAssessmentWizard({ mountEl, onSubmit, initialAssessment = null, submitLabel = "Add to Project", defaultGroupId = "", defaultServiceId = "" }) {
  let draft = createInitialDraft(initialAssessment, submitLabel, defaultGroupId, defaultServiceId);

  mountEl.addEventListener("click", handleClick);
  mountEl.addEventListener("input", handleInputChange);
  mountEl.addEventListener("change", handleInputChange);

  renderStep();

  return cleanup;

  function handleClick(event) {
    const focusTargetTrigger = event.target.closest("[data-focus-target]");
    if (focusTargetTrigger instanceof HTMLElement) {
      const targetId = focusTargetTrigger.dataset.focusTarget;
      if (targetId) {
        const focusEl = document.getElementById(targetId);
        if (focusEl instanceof HTMLElement) {
          focusEl.focus();
          if (typeof focusEl.scrollIntoView === "function") {
            focusEl.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        }
      }
      return;
    }

    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;

    if (action === "back") {
      draft.stepIndex = Math.max(0, draft.stepIndex - 1);
      renderStep();
      return;
    }

    if (action === "next") {
      const validation = validateCurrentStep(draft);
      if (!validation.valid) {
        renderStep(validation.errors);
        return;
      }

      draft.stepIndex = Math.min(getTotalSteps(draft) - 1, draft.stepIndex + 1);
      renderStep();
      return;
    }

    if (action === "submit") {
      const validation = validateCurrentStep(draft);
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

    if (target.matches("input[name='serviceId']")) {
      const service = getServiceDefinition(target.value);
      if (!service || service.disabled) return;

      draft = service.createDraft(null, draft.submitLabel);
      renderStep();
      return;
    }

    if (target.matches("input[name='includeRetestMode']")) {
      draft.includeRetest = target.value === "yes";
      draft.reviewSelectionMade = true;
      renderStep();
      return;
    }

    const service = getCurrentService(draft);
    if (!service || typeof service.handleInputChange !== "function") return;

    const requiresRerender = Boolean(service.handleInputChange(draft, target, event));
    if (requiresRerender) {
      renderStep();
    } else {
      syncNavigationButtons();
      runAfterRender();
    }
  }

  function renderStep(errors = {}) {
    mountEl.innerHTML = renderStepMarkup(draft, errors);
    syncNavigationButtons();
    runAfterRender();
  }

  function syncNavigationButtons() {
    const nextBtn = mountEl.querySelector("button[data-action='next']");
    if (nextBtn) {
      nextBtn.disabled = !validateCurrentStep(draft).valid;
    }
  }

  function runAfterRender() {
    const step = getActiveServiceStep(draft);
    const service = getCurrentService(draft);
    if (service && step && typeof step.afterRender === "function") {
      step.afterRender(draft, mountEl);
    }
  }

  function cleanup() {
    mountEl.removeEventListener("click", handleClick);
    mountEl.removeEventListener("input", handleInputChange);
    mountEl.removeEventListener("change", handleInputChange);
  }
}

function renderChoiceCard({ name, option, selectedValue, cardClass = "", compact = false }) {
  const selected = option.value === selectedValue;
  const inputId = option.id || `${name}-${option.value}`;
  const pointsClass = cardClass === "complexity-card" ? "complexity-points" : "methodology-points";
  const classes = ["assessment-type-card", "option-card"];
  if (compact) classes.push("option-card--compact");
  if (cardClass) classes.push(cardClass);
  if (selected) classes.push("is-selected");
  if (option.disabled) classes.push("is-disabled");

  return `
    <label class="${classes.join(" ")}" for="${escapeHtml(inputId)}">
      <input
        class="visually-hidden"
        type="radio"
        name="${escapeHtml(name)}"
        id="${escapeHtml(inputId)}"
        value="${escapeHtml(option.value)}"
        ${selected ? "checked" : ""}
        ${option.disabled ? "disabled" : ""}
      >
      <span class="assessment-type-card__selection" aria-hidden="true"></span>
      <div class="assessment-type-card__header">
        <span class="assessment-type-title">${escapeHtml(option.title)}</span>
        ${option.badge ? `<span class="service-card-badge">${escapeHtml(option.badge)}</span>` : ""}
      </div>
      ${option.subtitle ? `<span class="assessment-type-subtitle">${escapeHtml(option.subtitle)}</span>` : ""}
      ${Array.isArray(option.points) && option.points.length ? `
        <div class="assessment-type-card__details">
          <ul class="${pointsClass}">
            ${option.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
          </ul>
        </div>
      ` : ""}
    </label>
  `;
}

function renderServiceCard(service, selectedServiceId) {
  return renderChoiceCard({
    name: "serviceId",
    selectedValue: selectedServiceId,
    cardClass: "service-card",
    option: {
      value: service.id,
      title: service.selectionTitle,
      subtitle: service.selectionSubtitle,
      disabled: Boolean(service.disabled),
      badge: service.disabled ? service.disabledLabel || "Coming soon" : "",
      id: `service-${service.id}`,
    },
  });
}

function renderStepMarkup(draft, errors) {
  const totalSteps = getTotalSteps(draft);
  const progress = `<div class="wizard-step-indicator mb-3">Step ${draft.stepIndex + 1} of ${totalSteps}</div>`;

  if (draft.stepIndex === 0) {
    return `${progress}
      ${renderServiceSelectionStep({
        groups: SERVICE_GROUPS,
        services: SERVICE_DEFINITIONS,
        selectedServiceId: draft.serviceId,
      })}
      ${renderWizardActions({ showBack: false, action: "next", label: "Continue" })}
    `;
  }

  if (draft.stepIndex === totalSteps - 1) {
    const review = buildReview(draft);
    const fullRetestMd = getFullRetestMd(draft);
    const service = getCurrentService(draft);
    const reviewConfig = service?.reviewConfig || {};
    const requiresReviewSelection = reviewConfig.editableRetest !== false && !draft.reviewSelectionMade;
    return `${progress}
      ${renderReviewStep({ draft, review, fullRetestMd, reviewConfig })}
      ${renderError(errors._form)}
      ${renderWizardActions({
        showBack: true,
        action: "submit",
        label: draft.submitLabel,
        variant: "success",
        disabled: Boolean(review.error || requiresReviewSelection),
      })}
    `;
  }

  const step = getActiveServiceStep(draft);
  if (!step) {
    return `${progress}<div class="alert alert-warning">Service step is not configured.</div>`;
  }

  return `${progress}
    ${step.render(draft, errors, { renderError, escapeHtml })}
    ${renderError(errors._form)}
    ${renderWizardActions({
      showBack: true,
      action: "next",
      label: step.nextLabel || "Next",
      footerClass: "mt-4",
    })}
  `;
}

function renderWizardActions({ showBack, action, label, variant = "primary", disabled = false, footerClass = "" }) {
  return `
    <div class="d-flex justify-content-${showBack ? "between" : "end"} gap-2 ${footerClass}">
      ${showBack ? `<button type="button" class="btn btn-outline-secondary" data-action="back">Back</button>` : ""}
      <button type="button" class="btn btn-${variant}" data-action="${action}" ${disabled ? "disabled" : ""}>${escapeHtml(label)}</button>
    </div>
  `;
}

function validateCurrentStep(draft) {
  if (draft.stepIndex === 0) {
    const service = getCurrentService(draft);
    if (!service || service.disabled) {
      return { valid: false, errors: { serviceId: "Select an available service." } };
    }

    return { valid: true, errors: {} };
  }

  if (draft.stepIndex === getTotalSteps(draft) - 1) {
    return validateAllServiceSteps(draft);
  }

  const step = getActiveServiceStep(draft);
  if (!step || typeof step.validate !== "function") {
    return { valid: true, errors: {} };
  }

  return step.validate(draft);
}

function validateAllServiceSteps(draft) {
  const service = getCurrentService(draft);
  if (!service) return { valid: false, errors: { _form: "Service not found." } };

  for (const step of service.steps) {
    const validation = typeof step.validate === "function" ? step.validate(draft) : { valid: true, errors: {} };
    if (!validation.valid) return validation;
  }

  return { valid: true, errors: {} };
}

function buildReview(draft) {
  try {
    const assessment = buildAssessmentObject(draft);
    return {
      typeLabel: assessment.typeLabel,
      methodologyLabel: assessment.methodologyLabel,
      detailSummary: assessment.reviewDetailSummary || assessment.detailSummary,
      reviewDetailHtml: assessment.reviewDetailHtml || "",
      md: assessment.md,
    };
  } catch (error) {
    return { error: error.message || "Invalid data" };
  }
}

function buildAssessmentObject(draft, includeRetest = draft.includeRetest) {
  const validation = validateAllServiceSteps(draft);
  if (!validation.valid) {
    throw new Error("Please fix validation errors before submitting.");
  }

  const service = getCurrentService(draft);
  if (!service || typeof service.buildAssessment !== "function") {
    throw new Error("Unsupported assessment type.");
  }

  return applyRetestPreference(service.buildAssessment(draft), includeRetest);
}

function createInitialDraft(initialAssessment, submitLabel, defaultGroupId, defaultServiceId) {
  const defaultService = getServiceDefinition(defaultServiceId)
    || (defaultGroupId ? getDefaultServiceDefinitionForGroup(defaultGroupId) : null)
    || getDefaultServiceDefinition();
  if (!defaultService) {
    throw new Error("No enabled services are configured.");
  }

  if (!initialAssessment) {
    return defaultService.createDraft(null, submitLabel);
  }

  const serviceId = resolveAssessmentServiceId(initialAssessment);
  const service = getServiceDefinition(serviceId) || defaultService;
  return {
    ...service.createDraft(initialAssessment, submitLabel),
    reviewSelectionMade: true,
  };
}

function getCurrentService(draft) {
  return getServiceDefinition(draft.serviceId) || null;
}

function getActiveServiceStep(draft) {
  const service = getCurrentService(draft);
  if (!service) return null;
  return service.steps[draft.stepIndex - 1] || null;
}

function getTotalSteps(draft) {
  const service = getCurrentService(draft);
  return (service?.steps?.length || 0) + 2;
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

function getFullRetestMd(draft) {
  try {
    const withRetest = buildAssessmentObject(draft, true);
    return Number(withRetest.md?.retest) || 0;
  } catch (_error) {
    return 0;
  }
}
