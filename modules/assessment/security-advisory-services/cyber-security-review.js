import {
  createWizardDraft,
  escapeHtml,
  generateId,
  getInitialIncludeRetest,
  renderChoiceStep,
  renderError,
} from "../core.js?v=1.4";

const CSR_LITE_TYPE = "csr_lite";
const CSR_TYPE = "csr";
const CSR_PLUS_TYPE = "csr_plus";
const CUSTOM_FRAMEWORK_VALUE = "__custom__";

const PRIMARY_FRAMEWORK_OPTIONS = [
  "NIST CSF 2.0",
  "CIS v8.0",
  "ISO/IEC 27001:2022",
  "SOC 2",
  "Cyber Trust Mark (SG)",
  "CMMC 2.0 (US)",
  "NIS2 Directive (EU)",
  "MAS TRM 2021 (SG)",
  "Cyber Essentials (UK)",
  "DORA (EU)",
  "Essential Eight (AU)",
  "GDPR (EU)",
  "HIPAA (US)",
  "PCI DSS",
  "NFA ISSP (US)",
  "RMiT (MY)",
  "OJK (ID)",
  "SFC Guideline (HK)",
];

const SECONDARY_FRAMEWORK_OPTIONS = [
  "NIST CSF 2.0",
  "CIS v8.0",
  "ISO/IEC 27001:2022",
  "SOC 2",
  "Cyber Trust Mark (SG)",
  "CMMC 2.0 (US)",
  "NIS2 Directive (EU)",
  "MAS TRM 2021 (SG)",
  "Cyber Essentials (UK)",
  "DORA (EU)",
  "Essential Eight (AU)",
  "GDPR (EU)",
  "PDPA (SG)",
  "HIPAA (US)",
  "PCI DSS",
  "NFA ISSP (US)",
  "RMiT (MY)",
  "OJK (ID)",
  "SFC Guideline (HK)",
];

const CSR_TYPE_OPTIONS = [
  {
    value: CSR_LITE_TYPE,
    title: "CSR Lite",
    subtitle: "A fundamentals assessment covering controls at the domain or category level of a given cybersecurity framework, without a maturity rating and prioritised roadmap.",
    points: ["7 days total", "Initial 6 MD", "Reporting 1 MD"],
  },
  {
    value: CSR_TYPE,
    title: "CSR",
    subtitle: "An assessment covering all controls within a given cybersecurity framework, including a maturity assessment and prioritised roadmap to support remediation activities.",
    points: ["14 days total", "Initial 12 MD", "Reporting 2 MD"],
  },
  {
    value: CSR_PLUS_TYPE,
    title: "CSR Plus",
    subtitle: "A detailed assessment covering all controls, including documentation reviews and walkthroughs aligned to a given cybersecurity framework, with a prioritised roadmap plus a high-level threat assessment and business impact assessment (BIA).",
    points: ["20 days total", "Initial 17 MD", "Reporting 3 MD"],
  },
];
const CSR_TYPE_VALUES = new Set(CSR_TYPE_OPTIONS.map((option) => option.value));

const CSR_TYPE_CONFIG = {
  [CSR_LITE_TYPE]: {
    label: "CSR Lite",
    initial: 6,
    reporting: 1,
    retest: 6,
    mapping: 4,
    description: "Fundamentals assessment at the domain or category level without maturity rating or prioritised roadmap",
  },
  [CSR_TYPE]: {
    label: "CSR",
    initial: 12,
    reporting: 2,
    retest: 6,
    mapping: 4,
    description: "Full control assessment with maturity assessment and prioritised roadmap",
  },
  [CSR_PLUS_TYPE]: {
    label: "CSR Plus",
    initial: 17,
    reporting: 3,
    retest: 6,
    mapping: 4,
    description: "Detailed control assessment with documentation review, walkthroughs, threat assessment, and BIA",
  },
};

const PRIMARY_FRAMEWORK_SELECT_OPTIONS = buildFrameworkSelectOptions(PRIMARY_FRAMEWORK_OPTIONS);
const SECONDARY_FRAMEWORK_SELECT_OPTIONS = buildFrameworkSelectOptions(SECONDARY_FRAMEWORK_OPTIONS);

function buildFrameworkSelectOptions(options) {
  return [
    { value: "", label: "Not selected" },
    ...options.map((option) => ({ value: option, label: option })),
    { value: CUSTOM_FRAMEWORK_VALUE, label: "Custom" },
  ];
}

function normalizeFrameworkValue(selectedValue, customValue) {
  if (selectedValue === CUSTOM_FRAMEWORK_VALUE) {
    return String(customValue || "").trim();
  }

  return String(selectedValue || "").trim();
}

function renderFrameworkSelect({
  label,
  name,
  selectedValue,
  customName,
  customValue,
  options,
  errors,
  helper = "",
}) {
  return `
    <div class="mb-3">
      <label class="form-label" for="${escapeHtml(name)}">${escapeHtml(label)}</label>
      <select class="form-select" id="${escapeHtml(name)}" name="${escapeHtml(name)}">
        ${options.map((option) => `
          <option value="${escapeHtml(option.value)}" ${selectedValue === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>
        `).join("")}
      </select>
      ${helper ? `<div class="wizard-helper mt-2">${escapeHtml(helper)}</div>` : ""}
      ${renderError(errors[name])}
    </div>
    ${selectedValue === CUSTOM_FRAMEWORK_VALUE ? `
      <div class="mb-3">
        <label class="form-label" for="${escapeHtml(customName)}">Custom Framework</label>
        <input
          type="text"
          class="form-control"
          id="${escapeHtml(customName)}"
          name="${escapeHtml(customName)}"
          value="${escapeHtml(customValue)}"
          placeholder="Enter framework name"
        >
        ${renderError(errors[customName])}
      </div>
    ` : ""}
  `;
}

function buildSecurityAdvisoryReview({
  serviceId,
  type,
  typeLabel,
  methodology,
  includeRetest,
  primaryFramework,
  secondaryFramework,
}) {
  const config = CSR_TYPE_CONFIG[methodology];
  if (!config) throw new Error("Invalid Cyber Security Review type.");

  const md = calculateCyberSecurityReviewMd({
    methodology,
    includeRetest,
    secondaryFramework,
  });

  return {
    id: generateId(),
    serviceId,
    groupId: "security-advisory-services",
    type,
    typeLabel,
    methodology,
    methodologyLabel: config.label,
    inputs: {
      csrAssessmentType: methodology,
      primaryFramework,
      secondaryFramework,
      hasFrameworkMapping: Boolean(secondaryFramework),
      futureReview: Boolean(includeRetest),
      includeRetest: Boolean(includeRetest),
    },
    detailSummary: buildCyberSecurityReviewSummary({
      methodology,
      includeRetest,
      primaryFramework,
      secondaryFramework,
    }),
    reviewDetailSummary: buildCyberSecurityReviewSummary({
      methodology,
      includeRetest,
      primaryFramework,
      secondaryFramework,
    }),
    md,
    createdAt: new Date().toISOString(),
  };
}

export const cyberSecurityReviewService = {
  id: "cyber_security_review",
  assessmentType: "cyber_security_review",
  groupId: "security-advisory-services",
  selectionTitle: "Cyber Security Review (CSR)",
  selectionSubtitle: "A structured gap assessment aligned to a recognised control framework",
  logicTitle: "Cyber Security Review",
  reviewConfig: {
    editableRetest: true,
    methodologyFieldLabel: "Assessment Type",
    detailFieldLabel: "Summary",
    retestLabel: "Future Review",
    retestYesLabel: "Include Follow-up",
    retestNoLabel: "No Follow-up",
    retestHelper: "Retest is a follow-up verification after remediation to confirm that identified findings have been properly addressed. This applies to both offensive and security advisory services.",
    retestImpactTitle: "Follow-up impact",
    retestStatLabel: "Follow-up",
  },
  steps: [
    {
      id: "assessment_type",
      render(draft, errors) {
        return renderChoiceStep({
          label: "Assessment Type",
          name: "csrAssessmentType",
          selectedValue: draft.csrAssessmentType,
          errors,
          columns: 1,
          gridClass: "methodology-grid",
          cardClass: "methodology-card",
          options: CSR_TYPE_OPTIONS,
        });
      },
      validate(draft) {
        const errors = {};
        if (!CSR_TYPE_VALUES.has(draft.csrAssessmentType)) {
          errors.csrAssessmentType = "Select one Cyber Security Review type.";
        }

        return { valid: Object.keys(errors).length === 0, errors };
      },
    },
    {
      id: "frameworks",
      render(draft, errors) {
        const hasPrimaryFrameworkSelected = Boolean(draft.primaryFramework);

        return `
          <div class="mb-4">
            <label class="form-label">Choose Framework</label>
            <div class="wizard-helper mt-2">Optional. Select one primary framework and add a second framework only if mapping is needed.</div>
          </div>
          ${renderFrameworkSelect({
            label: "Primary Framework",
            name: "primaryFramework",
            selectedValue: draft.primaryFramework,
            customName: "primaryFrameworkCustom",
            customValue: draft.primaryFrameworkCustom,
            options: PRIMARY_FRAMEWORK_SELECT_OPTIONS,
            errors,
            helper: "Choose one framework or leave it unselected.",
          })}
          ${hasPrimaryFrameworkSelected ? renderChoiceStep({
            label: "Would you need mapping to another framework?",
            name: "hasFrameworkMapping",
            selectedValue: draft.hasFrameworkMapping,
            errors,
            columns: 2,
            compact: true,
            options: [
              { value: "no", title: "No" },
              { value: "yes", title: "Yes" },
            ],
          }) : ""}
          ${hasPrimaryFrameworkSelected && draft.hasFrameworkMapping === "yes" ? renderFrameworkSelect({
            label: "Secondary Framework",
            name: "secondaryFramework",
            selectedValue: draft.secondaryFramework,
            customName: "secondaryFrameworkCustom",
            customValue: draft.secondaryFrameworkCustom,
            options: SECONDARY_FRAMEWORK_SELECT_OPTIONS,
            errors,
            helper: "Adds 4 MD to the assessment effort.",
          }) : ""}
        `;
      },
      validate(draft) {
        const errors = {};
        if (draft.primaryFramework && !["yes", "no", ""].includes(draft.hasFrameworkMapping)) {
          errors.hasFrameworkMapping = "Select whether framework mapping is needed.";
        }

        if (draft.primaryFramework === CUSTOM_FRAMEWORK_VALUE && !draft.primaryFrameworkCustom.trim()) {
          errors.primaryFrameworkCustom = "Enter the primary framework name.";
        }

        if (draft.primaryFramework && draft.hasFrameworkMapping === "yes") {
          if (!draft.secondaryFramework) {
            errors.secondaryFramework = "Select the secondary framework.";
          }

          if (draft.secondaryFramework === CUSTOM_FRAMEWORK_VALUE && !draft.secondaryFrameworkCustom.trim()) {
            errors.secondaryFrameworkCustom = "Enter the secondary framework name.";
          }
        }

        return { valid: Object.keys(errors).length === 0, errors };
      },
    },
  ],
  createDraft(initialAssessment = null, submitLabel = "Add to Project") {
    if (!initialAssessment) {
      return createWizardDraft("cyber_security_review", submitLabel, {
        csrAssessmentType: "",
        primaryFramework: "",
        primaryFrameworkCustom: "",
        hasFrameworkMapping: "no",
        secondaryFramework: "",
        secondaryFrameworkCustom: "",
        includeRetest: null,
      });
    }

    const inputs = initialAssessment.inputs || {};
    const primaryFramework = typeof inputs.primaryFramework === "string" ? inputs.primaryFramework : "";
    const secondaryFramework = typeof inputs.secondaryFramework === "string" ? inputs.secondaryFramework : "";

    return createWizardDraft("cyber_security_review", submitLabel, {
      stepIndex: 2,
      csrAssessmentType: typeof inputs.csrAssessmentType === "string" ? inputs.csrAssessmentType : "",
      primaryFramework: PRIMARY_FRAMEWORK_OPTIONS.includes(primaryFramework) ? primaryFramework : primaryFramework ? CUSTOM_FRAMEWORK_VALUE : "",
      primaryFrameworkCustom: PRIMARY_FRAMEWORK_OPTIONS.includes(primaryFramework) ? "" : primaryFramework,
      hasFrameworkMapping: secondaryFramework ? "yes" : "no",
      secondaryFramework: SECONDARY_FRAMEWORK_OPTIONS.includes(secondaryFramework) ? secondaryFramework : secondaryFramework ? CUSTOM_FRAMEWORK_VALUE : "",
      secondaryFrameworkCustom: SECONDARY_FRAMEWORK_OPTIONS.includes(secondaryFramework) ? "" : secondaryFramework,
      includeRetest: getInitialIncludeRetest(initialAssessment),
    });
  },
  handleInputChange(draft, target) {
    if (!(target instanceof HTMLElement)) return false;

    if (target.matches("input[name='csrAssessmentType']")) {
      draft.csrAssessmentType = target.value;
      return true;
    }

    if (target.matches("select[name='primaryFramework']")) {
      draft.primaryFramework = target.value;
      if (draft.primaryFramework !== CUSTOM_FRAMEWORK_VALUE) {
        draft.primaryFrameworkCustom = "";
      }
      if (!draft.primaryFramework) {
        draft.hasFrameworkMapping = "no";
        draft.secondaryFramework = "";
        draft.secondaryFrameworkCustom = "";
      }
      return true;
    }

    if (target.matches("input[name='primaryFrameworkCustom']")) {
      draft.primaryFrameworkCustom = target.value;
      return false;
    }

    if (target.matches("input[name='hasFrameworkMapping']")) {
      draft.hasFrameworkMapping = target.value;
      if (draft.hasFrameworkMapping !== "yes") {
        draft.secondaryFramework = "";
        draft.secondaryFrameworkCustom = "";
      }
      return true;
    }

    if (target.matches("select[name='secondaryFramework']")) {
      draft.secondaryFramework = target.value;
      if (draft.secondaryFramework !== CUSTOM_FRAMEWORK_VALUE) {
        draft.secondaryFrameworkCustom = "";
      }
      return true;
    }

    if (target.matches("input[name='secondaryFrameworkCustom']")) {
      draft.secondaryFrameworkCustom = target.value;
      return false;
    }

    return false;
  },
  buildAssessment(draft) {
    if (!CSR_TYPE_VALUES.has(draft.csrAssessmentType)) {
      throw new Error("Invalid Cyber Security Review type.");
    }

    const primaryFramework = normalizeFrameworkValue(draft.primaryFramework, draft.primaryFrameworkCustom);
    const secondaryFramework = draft.hasFrameworkMapping === "yes"
      ? normalizeFrameworkValue(draft.secondaryFramework, draft.secondaryFrameworkCustom)
      : "";

    return buildSecurityAdvisoryReview({
      serviceId: "cyber_security_review",
      type: "cyber_security_review",
      typeLabel: "Cyber Security Review",
      methodology: draft.csrAssessmentType,
      includeRetest: draft.includeRetest,
      primaryFramework,
      secondaryFramework,
    });
  },
  getLogicHtml() {
    return `
      <div class="logic-flow">
        <div class="logic-node">Select CSR type: CSR Lite=(6,1,0), CSR=(12,2,0), CSR Plus=(17,3,0)</div>
        <div class="logic-node decision">Need mapping to another framework?</div>
        <div class="logic-arrow">↓ yes</div>
        <div class="logic-node">Add framework mapping = 4 MD</div>
        <div class="logic-arrow">↓ no</div>
        <div class="logic-node">framework mapping = 0</div>
        <div class="logic-node decision">Future review in 6-12 months?</div>
        <div class="logic-arrow">↓ yes</div>
        <div class="logic-node">Add follow-up = 6 MD</div>
        <div class="logic-arrow">↓ no</div>
        <div class="logic-node">follow-up = 0</div>
        <div class="logic-node outcome">total = initial + reporting + framework mapping + follow-up</div>
      </div>
    `;
  },
};

function calculateCyberSecurityReviewMd(draft) {
  const methodology = draft.csrAssessmentType || draft.methodology;
  const config = CSR_TYPE_CONFIG[methodology];
  if (!config) throw new Error("Invalid Cyber Security Review type.");

  const initial = config.initial + (draft.secondaryFramework ? config.mapping : 0);
  const reporting = config.reporting;
  const retest = draft.includeRetest ? config.retest : 0;
  return { initial, reporting, retest, total: initial + reporting + retest };
}

function buildCyberSecurityReviewSummary(draft) {
  const methodology = draft.csrAssessmentType || draft.methodology;
  if (!CSR_TYPE_CONFIG[methodology]) return "Invalid review type";

  const primaryFramework = normalizeFrameworkValue(draft.primaryFramework, draft.primaryFrameworkCustom);
  const secondaryFramework = normalizeFrameworkValue(draft.secondaryFramework, draft.secondaryFrameworkCustom);
  const frameworkSummary = primaryFramework ? `Primary Framework: ${primaryFramework}` : "No framework selected";
  const futureReview = draft.includeRetest ? "Future review included" : "No future review";
  return [
    frameworkSummary,
    ...(secondaryFramework ? [`Mapped to: ${secondaryFramework}`] : []),
    futureReview,
  ].join("\n");
}
