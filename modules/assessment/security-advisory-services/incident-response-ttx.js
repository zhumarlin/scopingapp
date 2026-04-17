import {
  createWizardDraft,
  escapeHtml,
  generateId,
  renderChoiceStep,
  renderError,
} from "../core.js?v=0.4.1";

const DELIVERY_REMOTE = "remote";
const DELIVERY_ONSITE = "onsite";

const SCENARIO_DEFAULT = "default_ransomware";
const SCENARIO_CUSTOMIZED = "customized_one";
const SCENARIO_TWO = "two_scenarios";
const SCENARIO_CUSTOM = "custom_scenarios";
const SCENARIO_DYNAMIC_PREFIX = "scenarios_";

const YES = "yes";
const NO = "no";
const TRAVEL_NOTE_TEXT = "Additional travel cost would be added for locations outside of Singapore, Indonesia, and Romania";

const DELIVERY_OPTIONS = [
  {
    value: DELIVERY_REMOTE,
    title: "Remote",
    subtitle: "Delivery of an IR TTX remotely on Microsoft Teams.",
  },
  {
    value: DELIVERY_ONSITE,
    title: "Onsite",
    subtitle: "Delivery of an IR TTX onsite on customer physical premises.",
  },
];

const SCENARIO_OPTIONS = [
  { value: SCENARIO_DEFAULT, title: "1 default scenario - ransomware" },
  { value: SCENARIO_CUSTOMIZED, title: "1 customized scenario", subtitle: "2 hours per scenario/simulation" },
  { value: SCENARIO_TWO, title: "2 scenarios" },
  { value: SCENARIO_CUSTOM, title: "Custom", subtitle: "Customized scenarios up to 10." },
];

const YES_NO_OPTIONS = [
  { value: YES, title: "Yes" },
  { value: NO, title: "No" },
];

const DELIVERY_VALUES = new Set(DELIVERY_OPTIONS.map((option) => option.value));
const SCENARIO_VALUES = new Set(SCENARIO_OPTIONS.map((option) => option.value));

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function parseBoundedInteger(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return 0;
  if (parsed < min || parsed > max) return 0;
  return parsed;
}

function getDeliveryLabel(deliveryType) {
  return DELIVERY_OPTIONS.find((option) => option.value === deliveryType)?.title || "";
}

function getScenarioLabel(scenarioType) {
  if (scenarioType === SCENARIO_CUSTOM) return "Custom";
  return SCENARIO_OPTIONS.find((option) => option.value === scenarioType)?.title || "";
}

function getScenarioCountFromType(scenarioType, fallbackValue = 0) {
  if (scenarioType === SCENARIO_CUSTOM) {
    return parseBoundedInteger(fallbackValue, 3, 10);
  }

  if (!String(scenarioType).startsWith(SCENARIO_DYNAMIC_PREFIX)) return 0;
  const countValue = String(scenarioType).slice(SCENARIO_DYNAMIC_PREFIX.length);
  return parseBoundedInteger(countValue, 3, 10);
}

function buildTtxSummaryLines(draft) {
  const lines = [
    `Delivery type: ${getDeliveryLabel(draft.deliveryType)}`,
    `Scenarios/Simulations: ${getScenarioLabel(draft.scenarioType)}`,
  ];

  if (draft.scenarioType === SCENARIO_CUSTOM || String(draft.scenarioType).startsWith(SCENARIO_DYNAMIC_PREFIX)) {
    lines.push(`Number of scenarios: ${getScenarioCountFromType(draft.scenarioType, draft.scenarioCount)}`);
  }

  lines.push(`Workshop: ${draft.includeWorkshop === YES ? "Included" : "Not included"}`);
  lines.push(`Incident Response Policy review: ${draft.includePolicyReview === YES ? "Included" : "Not included"}`);

  if (draft.includePlaybookReview === YES) {
    lines.push(`Procedures/playbooks to review: ${parsePositiveInteger(draft.playbookCount)}`);
  } else {
    lines.push("Procedures/playbooks review: Not included");
  }

  return lines;
}

function calculateTtxMd(draft) {
  const md = {
    assessment: 0,
    reporting: 0,
    retest: 0,
  };

  if (draft.deliveryType === DELIVERY_ONSITE) {
    md.assessment += 5;
    md.reporting += 2;
  } else {
    md.assessment += 1;
    md.reporting += 1;
  }

  if (draft.scenarioType === SCENARIO_CUSTOMIZED) {
    md.assessment += 2;
    md.reporting += 1;
  } else if (draft.scenarioType === SCENARIO_TWO) {
    md.assessment += 3;
    md.reporting += 1;
  } else if (draft.scenarioType === SCENARIO_CUSTOM || String(draft.scenarioType).startsWith(SCENARIO_DYNAMIC_PREFIX)) {
    const scenarioCount = getScenarioCountFromType(draft.scenarioType, draft.scenarioCount);
    if (scenarioCount >= 3) {
      md.assessment += 3 + (scenarioCount - 2);
      md.reporting += 1;
    }
  }

  if (draft.includeWorkshop === YES) {
    md.assessment += 2;
  }

  if (draft.includePolicyReview === YES) {
    md.assessment += 0.5;
    md.reporting += 0.5;
  }

  if (draft.includePlaybookReview === YES) {
    const playbookCount = parsePositiveInteger(draft.playbookCount);
    md.assessment += playbookCount * 0.5;
    md.reporting += playbookCount * 0.5;
  }

  const total = md.assessment + md.reporting + md.retest;
  return { initial: md.assessment, reporting: md.reporting, retest: md.retest, total };
}

function buildTtxSummary(draft) {
  const lines = buildTtxSummaryLines(draft);

  if (draft.deliveryType === DELIVERY_ONSITE) {
    lines.push(TRAVEL_NOTE_TEXT);
  }

  return lines.join("\n");
}

function buildTtxReviewDetailHtml(draft) {
  const lines = buildTtxSummaryLines(draft);
  const content = lines.map((line) => `<div>${escapeHtml(line)}</div>`).join("");
  const travelNoteMarkup = draft.deliveryType === DELIVERY_ONSITE
    ? `<div class="travel-cost-note mt-2">${escapeHtml(TRAVEL_NOTE_TEXT)}</div>`
    : "";

  return `
    <div class="ttx-summary-lines">
      ${content}
      ${travelNoteMarkup}
    </div>
  `;
}

function renderScenarioStep(draft, errors) {
  return `
    ${renderChoiceStep({
    label: "Scenarios/Simulations - How many scenarios would you like to cover?",
    name: "scenarioType",
    selectedValue: draft.scenarioType,
    errors,
    columns: 1,
    gridClass: "methodology-grid",
    cardClass: "methodology-card",
    options: SCENARIO_OPTIONS,
  })}
    ${draft.scenarioType === SCENARIO_CUSTOM ? `
      <div class="mb-3">
        <label class="form-label" for="scenario-count">How many scenarios would you like to cover?</label>
        <input
          type="number"
          min="3"
          max="10"
          step="1"
          class="form-control wizard-field wizard-field--short"
          id="scenario-count"
          name="scenarioCount"
          value="${escapeHtml(draft.scenarioCount || "")}"
          placeholder="Enter a value from 3 to 10"
        >
        ${renderError(errors.scenarioCount)}
      </div>
    ` : ""}
  `;
}

function renderWorkshopStep(draft, errors) {
  return `
    ${renderChoiceStep({
    label: "Workshop - A 2 hours session conducted a week before the exercise to introduce participants to the exercise flow, overview the threat landscape, and remind the incident response procedures.",
    name: "includeWorkshop",
    selectedValue: draft.includeWorkshop,
    errors,
    columns: 2,
    compact: true,
    options: YES_NO_OPTIONS,
  })}
  `;
}

function renderFurtherReviewStep(draft, errors) {
  return `
    <div class="mb-3">
      <div class="wizard-helper mb-2">Further Review (changes will be recommended).</div>
    </div>
    ${renderChoiceStep({
    label: "Review of an Incident Response Policy",
    name: "includePolicyReview",
    selectedValue: draft.includePolicyReview,
    errors,
    columns: 2,
    compact: true,
    options: YES_NO_OPTIONS,
  })}
    ${renderChoiceStep({
    label: "Review of procedures and playbooks",
    name: "includePlaybookReview",
    selectedValue: draft.includePlaybookReview,
    errors,
    columns: 2,
    compact: true,
    options: YES_NO_OPTIONS,
  })}
    ${draft.includePlaybookReview === YES ? `
      <div class="mb-3">
        <label class="form-label" for="playbook-count">How many procedures/playbooks would you like reviewed?</label>
        <input
          type="number"
          min="1"
          step="1"
          class="form-control wizard-field wizard-field--short"
          id="playbook-count"
          name="playbookCount"
          value="${escapeHtml(draft.playbookCount || "")}"
          placeholder="Enter number of procedures/playbooks"
        >
        ${renderError(errors.playbookCount)}
      </div>
    ` : ""}
  `;
}

export const incidentResponseTtxService = {
  id: "incident_response_ttx",
  assessmentType: "incident_response_ttx",
  groupId: "security-advisory-services",
  selectionTitle: "Incident Response Tabletop Exercises (TTX)",
  selectionSubtitle: "A tabletop simulation of a real cyber security incident.",
  logicTitle: "Incident Response TTX",
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
        return `
          ${renderChoiceStep({
    label: "Delivery Type",
    name: "deliveryType",
    selectedValue: draft.deliveryType,
    errors,
    columns: 1,
    gridClass: "methodology-grid",
    cardClass: "methodology-card",
    options: DELIVERY_OPTIONS,
  })}
          ${draft.deliveryType === DELIVERY_ONSITE ? `<div class="travel-cost-note mt-2">${escapeHtml(TRAVEL_NOTE_TEXT)}</div>` : ""}
        `;
      },
      validate(draft) {
        const errors = {};
        if (!DELIVERY_VALUES.has(draft.deliveryType)) {
          errors.deliveryType = "Select one delivery type.";
        }
        return { valid: Object.keys(errors).length === 0, errors };
      },
    },
    {
      id: "scenarios",
      render: renderScenarioStep,
      validate(draft) {
        const errors = {};
        if (!SCENARIO_VALUES.has(draft.scenarioType)) {
          errors.scenarioType = "Select one scenario option.";
        }

        if (draft.scenarioType === SCENARIO_CUSTOM) {
          const scenarioCount = parseBoundedInteger(draft.scenarioCount, 3, 10);
          if (!scenarioCount) {
            errors.scenarioCount = "Enter a valid number of scenarios (3 to 10).";
          }
        }

        return { valid: Object.keys(errors).length === 0, errors };
      },
    },
    {
      id: "workshop",
      render: renderWorkshopStep,
      validate(draft) {
        const errors = {};
        if (![YES, NO].includes(draft.includeWorkshop)) {
          errors.includeWorkshop = "Select Yes or No.";
        }
        return { valid: Object.keys(errors).length === 0, errors };
      },
    },
    {
      id: "further_review",
      render: renderFurtherReviewStep,
      validate(draft) {
        const errors = {};
        if (![YES, NO].includes(draft.includePolicyReview)) {
          errors.includePolicyReview = "Select Yes or No.";
        }
        if (![YES, NO].includes(draft.includePlaybookReview)) {
          errors.includePlaybookReview = "Select Yes or No.";
        }
        if (draft.includePlaybookReview === YES) {
          const playbookCount = parsePositiveInteger(draft.playbookCount);
          if (!playbookCount) {
            errors.playbookCount = "Enter a valid number of procedures/playbooks.";
          }
        }
        return { valid: Object.keys(errors).length === 0, errors };
      },
    },
  ],
  createDraft(initialAssessment = null, submitLabel = "Add to Project") {
    if (!initialAssessment) {
      return createWizardDraft("incident_response_ttx", submitLabel, {
        deliveryType: "",
        scenarioType: "",
        scenarioCount: "3",
        includeWorkshop: NO,
        includePolicyReview: NO,
        includePlaybookReview: NO,
        playbookCount: "1",
        includeRetest: false,
      });
    }

    const inputs = initialAssessment.inputs || {};
    let scenarioType = SCENARIO_VALUES.has(inputs.scenarioType) ? inputs.scenarioType : "";
    if (String(inputs.scenarioType || "").startsWith(SCENARIO_DYNAMIC_PREFIX)) {
      scenarioType = SCENARIO_CUSTOM;
    }
    if (inputs.scenarioType === "three_to_ten") {
      const legacyScenarioCount = parseBoundedInteger(inputs.scenarioCount, 3, 10);
      scenarioType = legacyScenarioCount ? SCENARIO_CUSTOM : "";
    }

    return createWizardDraft("incident_response_ttx", submitLabel, {
      stepIndex: 1,
      deliveryType: DELIVERY_VALUES.has(inputs.deliveryType) ? inputs.deliveryType : "",
      scenarioType,
      scenarioCount: String(inputs.scenarioCount || "3"),
      includeWorkshop: [YES, NO].includes(inputs.includeWorkshop) ? inputs.includeWorkshop : NO,
      includePolicyReview: [YES, NO].includes(inputs.includePolicyReview) ? inputs.includePolicyReview : NO,
      includePlaybookReview: [YES, NO].includes(inputs.includePlaybookReview) ? inputs.includePlaybookReview : NO,
      playbookCount: String(inputs.playbookCount || "1"),
      includeRetest: false,
    });
  },
  handleInputChange(draft, target) {
    if (!(target instanceof HTMLInputElement)) return false;

    if (target.name === "deliveryType" && target.type === "radio") {
      draft.deliveryType = target.value;
      return true;
    }

    if (target.name === "scenarioType" && target.type === "radio") {
      draft.scenarioType = target.value;
      return true;
    }

    if (target.name === "scenarioCount") {
      draft.scenarioCount = target.value;
      return false;
    }

    if (target.name === "includeWorkshop" && target.type === "radio") {
      draft.includeWorkshop = target.value;
      return true;
    }

    if (target.name === "includePolicyReview" && target.type === "radio") {
      draft.includePolicyReview = target.value;
      return true;
    }

    if (target.name === "includePlaybookReview" && target.type === "radio") {
      draft.includePlaybookReview = target.value;
      return true;
    }

    if (target.name === "playbookCount") {
      draft.playbookCount = target.value;
      return false;
    }

    return false;
  },
  buildAssessment(draft) {
    const md = calculateTtxMd(draft);
    const detailSummary = buildTtxSummary(draft);
    const reviewDetailHtml = buildTtxReviewDetailHtml(draft);
    const scenarioCount = getScenarioCountFromType(draft.scenarioType, draft.scenarioCount);

    return {
      id: generateId(),
      serviceId: "incident_response_ttx",
      groupId: "security-advisory-services",
      type: "incident_response_ttx",
      typeLabel: "Incident Response Tabletop Exercises (TTX)",
      methodology: draft.deliveryType,
      methodologyLabel: getDeliveryLabel(draft.deliveryType),
      inputs: {
        deliveryType: draft.deliveryType,
        scenarioType: draft.scenarioType,
        scenarioCount,
        includeWorkshop: draft.includeWorkshop,
        includePolicyReview: draft.includePolicyReview,
        includePlaybookReview: draft.includePlaybookReview,
        playbookCount: parsePositiveInteger(draft.playbookCount),
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
        <div class="logic-node">Delivery type: Remote=(1,1,0), Onsite=(5,2,0)</div>
        <div class="logic-node">Scenarios: default=(0,0,0), customized=(2,1,0), 2 scenarios=(3,1,0)</div>
        <div class="logic-node">If scenarios are 3-10: baseline 2 scenarios (3,1,0) + 1 assessment day per scenario above 2</div>
        <div class="logic-node">Workshop included? add (2,0,0)</div>
        <div class="logic-node">Incident Response Policy review? add (0.5,0.5,0)</div>
        <div class="logic-node">Procedures/playbooks review? add (0.5,0.5,0) per document</div>
        <div class="logic-node outcome">Total MD = assessment + reporting (retest fixed to 0)</div>
      </div>
    `;
  },
};
