import {
  createWizardDraft,
  escapeHtml,
  generateId,
  renderChoiceStep,
  renderError,
} from "../core.js?v=0.4.1";

const DELIVERY_TYPE_HUMAN = "human_led";
const DELIVERY_TYPE_PLATFORM = "platform_delivered";

const HUMAN_MODE_ONSITE = "onsite";
const HUMAN_MODE_REMOTE = "remote";

const REPORTING_QUARTERLY = "quarterly";
const REPORTING_MONTHLY = "monthly";
const TRAVEL_NOTE_TEXT = "Additional travel cost would be added for locations outside of Singapore, Indonesia, and Romania";

const DELIVERY_TYPE_OPTIONS = [
  {
    value: DELIVERY_TYPE_HUMAN,
    title: "Human-led training",
    subtitle: "Training delivered by an experienced cybersecurity consultant.",
  },
  {
    value: DELIVERY_TYPE_PLATFORM,
    title: "Platform-delivered training",
    subtitle: "Training via a Human Risk Management (HRM) platform often referred to as a Learning Management System (LMS).",
  },
];

const HUMAN_MODE_OPTIONS = [
  {
    value: HUMAN_MODE_ONSITE,
    title: "Onsite delivery",
    subtitle: "In-person session at your location.",
  },
  {
    value: HUMAN_MODE_REMOTE,
    title: "Remote delivery",
    subtitle: "Live virtual session.",
  },
];

const REPORTING_OPTIONS = [
  {
    value: REPORTING_QUARTERLY,
    title: "Quarterly reports",
    subtitle: "Periodic progress summary every quarter.",
  },
  {
    value: REPORTING_MONTHLY,
    title: "Monthly reports",
    subtitle: "Regular monthly progress summary.",
  },
];

const DELIVERY_TYPE_VALUES = new Set(DELIVERY_TYPE_OPTIONS.map((option) => option.value));
const HUMAN_MODE_VALUES = new Set(HUMAN_MODE_OPTIONS.map((option) => option.value));
const REPORTING_VALUES = new Set(REPORTING_OPTIONS.map((option) => option.value));

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function parseNonNegativeInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function getHumanModeLabel(mode) {
  return HUMAN_MODE_OPTIONS.find((option) => option.value === mode)?.title || "";
}

function getDeliveryTypeLabel(type) {
  return DELIVERY_TYPE_OPTIONS.find((option) => option.value === type)?.title || "";
}

function getReportingLabel(reportingFrequency) {
  return REPORTING_OPTIONS.find((option) => option.value === reportingFrequency)?.title || "";
}

function buildTrainingAwarenessSummaryLines(draft) {
  if (draft.deliveryType === DELIVERY_TYPE_HUMAN) {
    const sessions = parsePositiveInteger(draft.sessionCount);
    return [
      `Mode: ${getHumanModeLabel(draft.humanDeliveryMode)}`,
      `Sessions: ${sessions}`,
    ];
  }

  const userCount = parsePositiveInteger(draft.userCount);
  const phishingSimulations = parseNonNegativeInteger(draft.phishingSimulationCount);
  const fullyManaged = draft.fullyManagedOnboarding === "yes" ? "Yes" : "No";
  const bespokeContent = draft.bespokeContent === "yes" ? "Yes" : "No";
  const reportingLabel = getReportingLabel(draft.reportingFrequency);

  return [
    `Users: ${userCount}`,
    `Fully managed onboarding: ${fullyManaged}`,
    `Bespoke training content: ${bespokeContent}`,
    `Phishing simulations per year: ${phishingSimulations}`,
    `Reporting: ${reportingLabel}`,
  ];
}

function calculateTrainingAwarenessMd(draft) {
  if (draft.deliveryType === DELIVERY_TYPE_HUMAN) {
    const sessions = parsePositiveInteger(draft.sessionCount);
    const additionalTesting = Math.max(0, sessions - 1);

    if (draft.humanDeliveryMode === HUMAN_MODE_ONSITE) {
      const initial = 5 + additionalTesting;
      const reporting = 1;
      const retest = 0;
      return { initial, reporting, retest, total: initial + reporting + retest };
    }

    const initial = 4 + additionalTesting;
    const reporting = 1;
    const retest = 0;
    return { initial, reporting, retest, total: initial + reporting + retest };
  }

  const userCount = parsePositiveInteger(draft.userCount);
  const phishingSimulations = parseNonNegativeInteger(draft.phishingSimulationCount);
  const fullyManaged = draft.fullyManagedOnboarding === "yes";
  const bespokeContent = draft.bespokeContent === "yes";

  const userTestingDays = Math.ceil(userCount / 25);
  const onboardingTestingDays = fullyManaged ? 1 : 0;
  const bespokeInitialDays = bespokeContent ? 2 : 0;
  const phishingTestingDays = phishingSimulations;

  const initial = userTestingDays + onboardingTestingDays + bespokeInitialDays + phishingTestingDays;
  const reporting = (bespokeContent ? 1 : 0)
    + (draft.reportingFrequency === REPORTING_MONTHLY ? 6 : 2);
  const retest = 0;

  return { initial, reporting, retest, total: initial + reporting + retest };
}

function buildTrainingAwarenessSummary(draft) {
  const lines = buildTrainingAwarenessSummaryLines(draft);
  if (draft.deliveryType === DELIVERY_TYPE_HUMAN && draft.humanDeliveryMode === HUMAN_MODE_ONSITE) {
    lines.push(TRAVEL_NOTE_TEXT);
  }
  return lines.join("\n");
}

function buildTrainingAwarenessReviewHtml(draft) {
  const lines = buildTrainingAwarenessSummaryLines(draft);
  const content = lines.map((line) => `<div>${escapeHtml(line)}</div>`).join("");
  const travelNoteMarkup = draft.deliveryType === DELIVERY_TYPE_HUMAN && draft.humanDeliveryMode === HUMAN_MODE_ONSITE
    ? `<div class="travel-cost-note mt-2">${escapeHtml(TRAVEL_NOTE_TEXT)}</div>`
    : "";

  return `
    <div class="ttx-summary-lines">
      ${content}
      ${travelNoteMarkup}
    </div>
  `;
}

function renderServiceConfigurationStep(draft, errors) {
  if (draft.deliveryType === DELIVERY_TYPE_HUMAN) {
    return `
      ${renderChoiceStep({
    label: "Delivery Mode",
    name: "humanDeliveryMode",
    selectedValue: draft.humanDeliveryMode,
    errors,
    columns: 1,
    gridClass: "methodology-grid",
    cardClass: "methodology-card",
    options: HUMAN_MODE_OPTIONS,
  })}
      <div class="mb-3">
        <label class="form-label" for="session-count">How many sessions are required?</label>
        <input
          type="number"
          min="1"
          step="1"
          class="form-control wizard-field wizard-field--short"
          id="session-count"
          name="sessionCount"
          value="${escapeHtml(draft.sessionCount || "")}"
          placeholder="Enter number of sessions"
        >
        ${draft.humanDeliveryMode === HUMAN_MODE_ONSITE ? `
          <div class="travel-cost-note mt-2">${escapeHtml(TRAVEL_NOTE_TEXT)}</div>
        ` : ""}
        ${renderError(errors.sessionCount)}
      </div>
    `;
  }

  return `
    <div class="mb-3">
      <label class="form-label" for="user-count">How many users?</label>
      <input
        type="number"
        min="1"
        step="1"
        class="form-control wizard-field wizard-field--short"
        id="user-count"
        name="userCount"
        value="${escapeHtml(draft.userCount || "")}"
        placeholder="Enter number of users"
      >
      ${renderError(errors.userCount)}
    </div>

    ${renderChoiceStep({
    label: "Fully managed onboarding for new employees?",
    name: "fullyManagedOnboarding",
    selectedValue: draft.fullyManagedOnboarding,
    errors,
    columns: 2,
    compact: true,
    options: [
      { value: "yes", title: "Yes" },
      { value: "no", title: "No" },
    ],
  })}

    ${renderChoiceStep({
    label: "Need bespoke training content?",
    name: "bespokeContent",
    selectedValue: draft.bespokeContent,
    errors,
    columns: 2,
    compact: true,
    options: [
      { value: "yes", title: "Yes" },
      { value: "no", title: "No" },
    ],
  })}

    <div class="mb-3">
      <label class="form-label" for="phishing-simulations">How many phishing simulations annually?</label>
      <input
        type="number"
        min="0"
        step="1"
        class="form-control wizard-field wizard-field--short"
        id="phishing-simulations"
        name="phishingSimulationCount"
        value="${escapeHtml(draft.phishingSimulationCount || "")}"
        placeholder="Enter number of simulations"
      >
      ${renderError(errors.phishingSimulationCount)}
    </div>

    ${renderChoiceStep({
    label: "Reporting frequency",
    name: "reportingFrequency",
    selectedValue: draft.reportingFrequency,
    errors,
    columns: 2,
    compact: true,
    options: REPORTING_OPTIONS,
  })}
  `;
}

export const trainingAwarenessService = {
  id: "training_awareness",
  assessmentType: "training_awareness",
  groupId: "security-advisory-services",
  selectionTitle: "Training and Awareness",
  selectionSubtitle: "Improve employees awareness of security.",
  logicTitle: "Training and Awareness",
  reviewConfig: {
    editableRetest: false,
    methodologyFieldLabel: "Delivery Type",
    detailFieldLabel: "Summary",
    reviewIntroText: "",
  },
  steps: [
    {
      id: "delivery_type",
      render(draft, errors) {
        return renderChoiceStep({
          label: "Delivery Type",
          name: "deliveryType",
          selectedValue: draft.deliveryType,
          errors,
          columns: 1,
          gridClass: "methodology-grid",
          cardClass: "methodology-card",
          options: DELIVERY_TYPE_OPTIONS,
        });
      },
      validate(draft) {
        const errors = {};
        if (!DELIVERY_TYPE_VALUES.has(draft.deliveryType)) {
          errors.deliveryType = "Select one delivery type.";
        }
        return { valid: Object.keys(errors).length === 0, errors };
      },
    },
    {
      id: "configuration",
      render: renderServiceConfigurationStep,
      validate(draft) {
        const errors = {};

        if (draft.deliveryType === DELIVERY_TYPE_HUMAN) {
          if (!HUMAN_MODE_VALUES.has(draft.humanDeliveryMode)) {
            errors.humanDeliveryMode = "Select delivery mode.";
          }

          const sessions = parsePositiveInteger(draft.sessionCount);
          if (!sessions) {
            errors.sessionCount = "Enter a valid session count (minimum 1).";
          }

          return { valid: Object.keys(errors).length === 0, errors };
        }

        const userCount = parsePositiveInteger(draft.userCount);
        if (!userCount) {
          errors.userCount = "Enter a valid user count (minimum 1).";
        }

        if (!["yes", "no"].includes(draft.fullyManagedOnboarding)) {
          errors.fullyManagedOnboarding = "Select onboarding management option.";
        }

        if (!["yes", "no"].includes(draft.bespokeContent)) {
          errors.bespokeContent = "Select bespoke content option.";
        }

        if (!Number.isInteger(Number.parseInt(draft.phishingSimulationCount, 10)) || Number.parseInt(draft.phishingSimulationCount, 10) < 0) {
          errors.phishingSimulationCount = "Enter a valid number of phishing simulations (minimum 0).";
        }

        if (!REPORTING_VALUES.has(draft.reportingFrequency)) {
          errors.reportingFrequency = "Select reporting frequency.";
        }

        return { valid: Object.keys(errors).length === 0, errors };
      },
    },
  ],
  createDraft(initialAssessment = null, submitLabel = "Add to Project") {
    if (!initialAssessment) {
      return createWizardDraft("training_awareness", submitLabel, {
        deliveryType: "",
        humanDeliveryMode: "",
        sessionCount: "1",
        userCount: "",
        fullyManagedOnboarding: "no",
        bespokeContent: "no",
        phishingSimulationCount: "0",
        reportingFrequency: REPORTING_QUARTERLY,
        includeRetest: false,
      });
    }

    const inputs = initialAssessment.inputs || {};
    const deliveryType = DELIVERY_TYPE_VALUES.has(inputs.deliveryType)
      ? inputs.deliveryType
      : DELIVERY_TYPE_HUMAN;

    return createWizardDraft("training_awareness", submitLabel, {
      stepIndex: 1,
      deliveryType,
      humanDeliveryMode: HUMAN_MODE_VALUES.has(inputs.humanDeliveryMode) ? inputs.humanDeliveryMode : "",
      sessionCount: String(inputs.sessionCount || "1"),
      userCount: String(inputs.userCount || ""),
      fullyManagedOnboarding: ["yes", "no"].includes(inputs.fullyManagedOnboarding) ? inputs.fullyManagedOnboarding : "no",
      bespokeContent: ["yes", "no"].includes(inputs.bespokeContent) ? inputs.bespokeContent : "no",
      phishingSimulationCount: String(inputs.phishingSimulationCount || "0"),
      reportingFrequency: REPORTING_VALUES.has(inputs.reportingFrequency) ? inputs.reportingFrequency : REPORTING_QUARTERLY,
      includeRetest: false,
    });
  },
  handleInputChange(draft, target) {
    if (!(target instanceof HTMLInputElement)) return false;

    if (target.name === "deliveryType" && target.type === "radio") {
      draft.deliveryType = target.value;
      return true;
    }

    if (target.name === "humanDeliveryMode" && target.type === "radio") {
      draft.humanDeliveryMode = target.value;
      return true;
    }

    if (target.name === "sessionCount") {
      draft.sessionCount = target.value;
      return false;
    }

    if (target.name === "userCount") {
      draft.userCount = target.value;
      return false;
    }

    if (target.name === "fullyManagedOnboarding" && target.type === "radio") {
      draft.fullyManagedOnboarding = target.value;
      return true;
    }

    if (target.name === "bespokeContent" && target.type === "radio") {
      draft.bespokeContent = target.value;
      return true;
    }

    if (target.name === "phishingSimulationCount") {
      draft.phishingSimulationCount = target.value;
      return false;
    }

    if (target.name === "reportingFrequency" && target.type === "radio") {
      draft.reportingFrequency = target.value;
      return true;
    }

    return false;
  },
  buildAssessment(draft) {
    const md = calculateTrainingAwarenessMd(draft);
    const detailSummary = buildTrainingAwarenessSummary(draft);
    const reviewDetailHtml = buildTrainingAwarenessReviewHtml(draft);
    const deliveryTypeLabel = getDeliveryTypeLabel(draft.deliveryType);

    return {
      id: generateId(),
      serviceId: "training_awareness",
      groupId: "security-advisory-services",
      type: "training_awareness",
      typeLabel: "Training and Awareness",
      methodology: draft.deliveryType,
      methodologyLabel: deliveryTypeLabel,
      inputs: {
        deliveryType: draft.deliveryType,
        humanDeliveryMode: draft.humanDeliveryMode,
        sessionCount: parsePositiveInteger(draft.sessionCount),
        userCount: parsePositiveInteger(draft.userCount),
        fullyManagedOnboarding: draft.fullyManagedOnboarding,
        bespokeContent: draft.bespokeContent,
        phishingSimulationCount: parseNonNegativeInteger(draft.phishingSimulationCount),
        reportingFrequency: draft.reportingFrequency,
        includeRetest: false,
      },
      detailSummary,
      reviewDetailSummary: detailSummary,
      reviewDetailHtml,
      md,
      createdAt: new Date().toISOString(),
    };
  },
  getLogicHtml() {
    return `
      <div class="logic-flow">
        <div class="logic-node">Select delivery type: Human-led or Platform-delivered</div>
        <div class="logic-node decision">Human-led?</div>
        <div class="logic-arrow">↓ yes</div>
        <div class="logic-node">Onsite = (5 assessment + 1 reporting), Remote = (4 assessment + 1 reporting)</div>
        <div class="logic-node">Additional testing days = max(0, sessions - 1)</div>
        <div class="logic-arrow">↓ no</div>
        <div class="logic-node">Users add testing days = ceil(users / 25)</div>
        <div class="logic-node">Fully managed onboarding? yes = +1 assessment</div>
        <div class="logic-node">Bespoke content? yes = +2 assessment and +1 reporting</div>
        <div class="logic-node">Phishing simulations add testing days = simulation count</div>
        <div class="logic-node">Reporting frequency: Quarterly = +2 reporting, Monthly = +6 reporting</div>
        <div class="logic-node outcome">Total MD = assessment + reporting (retest fixed to 0)</div>
      </div>
    `;
  },
};
