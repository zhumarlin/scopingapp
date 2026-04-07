import {
  createWizardDraft,
  escapeHtml,
  generateId,
  renderError,
} from "../core.js?v=1.4";

const ORG_SIZE_SMALL = "small";
const ORG_SIZE_MEDIUM = "medium";
const ORG_SIZE_ENTERPRISE = "enterprise";

const ORG_SIZE_OPTIONS = [
  {
    value: ORG_SIZE_SMALL,
    title: "Less than 250 employees or 1 system/business unit",
  },
  {
    value: ORG_SIZE_MEDIUM,
    title: "250-1000 employees or 2-3 systems/business units",
  },
  {
    value: ORG_SIZE_ENTERPRISE,
    title: "Entire enterprise with more than 1000 employees",
  },
];

const ASSESSMENT_POLICY_TEMPLATES = "policies_templates";
const ASSESSMENT_READINESS = "readiness_assessment";
const ASSESSMENT_INTERNAL_AUDIT = "internal_audit";
const ASSESSMENT_REMEDIATION = "remediation_support";
const ASSESSMENT_CERTIFICATION = "certification_support";
const CUSTOM_DAY_OPTION = "__custom__";

const REMEDIATION_OPTIONS = [
  { value: "10", title: "10 days" },
  { value: "20", title: "20 days" },
  { value: "30", title: "30 days" },
  { value: CUSTOM_DAY_OPTION, title: "Custom" },
];

const ASSESSMENT_OPTIONS = [
  {
    value: ASSESSMENT_POLICY_TEMPLATES,
    title: "Policies Templates",
    description: "Templates of 12 essential cybersecurity policies plus a one-hour workshop.",
    points: ["1 day for assessment"],
  },
  {
    value: ASSESSMENT_READINESS,
    title: "Readiness Assessment",
    description: "Gap review and risk assessment aligned to a single framework such as ISO 27001, NIS 2, or SOC 2.",
    points: ["Assessment and reporting effort depends on organization size"],
  },
  {
    value: ASSESSMENT_INTERNAL_AUDIT,
    title: "Internal Audit",
    description: "Internal audit covering all controls within a selected cybersecurity framework.",
    points: ["Assessment and reporting effort depends on organization size"],
  },
  {
    value: ASSESSMENT_REMEDIATION,
    title: "Remediation Support",
    description: "Retainer days used to remediate identified gaps after readiness, internal audit, or certification activities.",
    points: ["Choose 10, 20, 30, or custom days for assessment"],
  },
  {
    value: ASSESSMENT_CERTIFICATION,
    title: "Certification Support",
    description: "Support with selecting a certification body and guidance throughout the certification assessment.",
    points: ["6 days for assessment"],
  },
];

const ASSESSMENT_DEFINITIONS = {
  [ASSESSMENT_POLICY_TEMPLATES]: {
    title: "Policies Templates",
    getResult() {
      return {
        initial: 1,
        reporting: 0,
        retest: 0,
        notes: "Templates of 12 essential cybersecurity policies and one hour workshop to explain the policies and answer questions",
      };
    },
  },
  [ASSESSMENT_READINESS]: {
    title: "Readiness Assessment",
    getResult(draft) {
      if (draft.organizationSize === ORG_SIZE_SMALL) {
        return {
          initial: 13,
          reporting: 3,
          retest: 0,
          notes: "A gap review and risk assessment to a single cybersecurity framework such as ISO27001, NIS 2 or SOC 2",
        };
      }

      if (draft.organizationSize === ORG_SIZE_MEDIUM) {
        return {
          initial: 17,
          reporting: 3,
          retest: 0,
          notes: "A gap review and risk assessment to a single cybersecurity framework such as ISO27001, NIS 2 or SOC 2",
        };
      }

      return {
        scopingRequired: true,
        notes: "Enterprise-wide readiness assessments require additional scoping/call discussion.",
      };
    },
  },
  [ASSESSMENT_INTERNAL_AUDIT]: {
    title: "Internal Audit",
    getResult(draft) {
      if (draft.organizationSize === ORG_SIZE_SMALL) {
        return {
          initial: 10,
          reporting: 2,
          retest: 0,
          notes: "An internal audit assessment covering all controls within a given cybersecurity framework (such as ISO 27001, NIS 2 or SOC 2).",
        };
      }

      if (draft.organizationSize === ORG_SIZE_MEDIUM) {
        return {
          initial: 13,
          reporting: 3,
          retest: 0,
          notes: "An internal audit assessment covering all controls within a given cybersecurity framework (such as ISO 27001, NIS 2 or SOC 2).",
        };
      }

      return {
        scopingRequired: true,
        notes: "Enterprise-wide internal audits require additional scoping/call discussion.",
      };
    },
  },
  [ASSESSMENT_REMEDIATION]: {
    title: "Remediation Support",
    getResult(draft) {
      const initial = getRemediationDays(draft);
      return {
        initial,
        reporting: 0,
        retest: 0,
        notes: "A retainer of days used to remediate identified gaps either following on from Bitdefender readiness assessment, or an internal or certification audit",
      };
    },
  },
  [ASSESSMENT_CERTIFICATION]: {
    title: "Certification Support",
    getResult() {
      return {
        initial: 6,
        reporting: 0,
        retest: 0,
        notes: "Bitdefender can support selecting a third party Certification Body for any relevant certifications that require, and support throughout the assessment.",
      };
    },
  },
};

const ASSESSMENT_OPTION_VALUES = new Set(ASSESSMENT_OPTIONS.map((option) => option.value));

function getOrgSizeLabel(value) {
  return ORG_SIZE_OPTIONS.find((option) => option.value === value)?.title || "";
}

function normalizeSelectedAssessmentTypes(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry, index) => ASSESSMENT_OPTION_VALUES.has(entry) && value.indexOf(entry) === index);
}

function getRemediationDays(draft) {
  if (draft.remediationDays === CUSTOM_DAY_OPTION) {
    return Number.parseInt(draft.customRemediationDays, 10) || 0;
  }

  return Number.parseInt(draft.remediationDays, 10) || 0;
}

function buildScopedRows(draft) {
  return draft.selectedAssessmentTypes.map((assessmentType) => {
    const definition = ASSESSMENT_DEFINITIONS[assessmentType];
    if (!definition) return null;

    const result = definition.getResult(draft);
    if (result.scopingRequired) {
      return {
        key: assessmentType,
        title: definition.title,
        scopingRequired: true,
        notes: result.notes,
      };
    }

    const initial = result.initial || 0;
    const reporting = result.reporting || 0;
    const retest = result.retest || 0;

    return {
      key: assessmentType,
      title: definition.title,
      initial,
      reporting,
      retest,
      total: initial + reporting + retest,
      notes: result.notes || "",
    };
  }).filter(Boolean);
}

function calculateComplianceSupportMd(draft) {
  return buildScopedRows(draft)
    .filter((row) => !row.scopingRequired)
    .reduce((totals, row) => ({
      initial: totals.initial + row.initial,
      reporting: totals.reporting + row.reporting,
      retest: totals.retest + row.retest,
      total: totals.total + row.total,
    }), {
      initial: 0,
      reporting: 0,
      retest: 0,
      total: 0,
    });
}

function buildComplianceSummaryText(draft, scopedRows, scopingRows) {
  const summaryParts = [`Organization size: ${getOrgSizeLabel(draft.organizationSize)}`];
  if (scopedRows.length) {
    summaryParts.push(`${scopedRows.length} scoped service row${scopedRows.length === 1 ? "" : "s"}`);
  }
  if (scopingRows.length) {
    summaryParts.push(`${scopingRows.length} item${scopingRows.length === 1 ? "" : "s"} need additional scoping discussion`);
  }

  return summaryParts.join("\n");
}

function buildScopeTableHtml(rows) {
  return `
    <div class="scope-breakdown-card">
      <div class="scope-breakdown-card__title">Scoped Items</div>
      <div class="scope-breakdown-table-wrap">
        <table class="scope-breakdown-table">
          <thead>
            <tr>
              <th>Assessment Type</th>
              <th>Assessment</th>
              <th>Reporting</th>
              <th>Retest</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>
                  <strong>${escapeHtml(row.title)}</strong>
                  ${row.notes ? `<div class="scope-breakdown-table__note">${escapeHtml(row.notes)}</div>` : ""}
                </td>
                <td>${row.initial}</td>
                <td>${row.reporting}</td>
                <td>${row.retest}</td>
                <td>${row.total}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function buildScopingTableHtml(rows) {
  return `
    <div class="scope-breakdown-card scope-breakdown-card--pending">
      <div class="scope-breakdown-card__title">Additional Scoping / Call Discussion Needed</div>
      <div class="scope-breakdown-table-wrap">
        <table class="scope-breakdown-table scope-breakdown-table--pending">
          <thead>
            <tr>
              <th>Assessment Type</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td><strong>${escapeHtml(row.title)}</strong></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function buildComplianceDetailHtml(draft) {
  const rows = buildScopedRows(draft);
  const scopedRows = rows.filter((row) => !row.scopingRequired);
  const scopingRows = rows.filter((row) => row.scopingRequired);
  const htmlParts = [];

  if (scopedRows.length) {
    htmlParts.push(buildScopeTableHtml(scopedRows));
  }

  if (scopingRows.length) {
    htmlParts.push(buildScopingTableHtml(scopingRows));
  }

  return htmlParts.join("");
}

function serializeScopedRows(rows) {
  return rows.map((row) => ({
    key: row.key,
    title: row.title,
    initial: row.initial,
    reporting: row.reporting,
    retest: row.retest,
    total: row.total,
    notes: row.notes,
  }));
}

function serializeScopingRows(rows) {
  return rows.map((row) => ({
    key: row.key,
    title: row.title,
    notes: row.notes,
  }));
}

function renderOrgSizeStep(draft, errors) {
  return `
    <div class="mb-3">
      <label class="form-label">Organization Size</label>
      <div class="option-card-grid option-card-grid--1 methodology-grid compliance-org-size-grid">
        ${ORG_SIZE_OPTIONS.map((option) => `
          <label class="assessment-type-card option-card methodology-card compliance-org-size-card ${draft.organizationSize === option.value ? "is-selected" : ""}" for="org-size-${escapeHtml(option.value)}">
            <input
              class="visually-hidden"
              type="radio"
              name="organizationSize"
              id="org-size-${escapeHtml(option.value)}"
              value="${escapeHtml(option.value)}"
              ${draft.organizationSize === option.value ? "checked" : ""}
            >
            <span class="assessment-type-card__selection" aria-hidden="true"></span>
            <div class="assessment-type-card__header">
              <span class="assessment-type-title">${escapeHtml(option.title)}</span>
            </div>
            ${option.subtitle ? `<span class="assessment-type-subtitle">${escapeHtml(option.subtitle)}</span>` : ""}
          </label>
        `).join("")}
      </div>
      ${renderError(errors.organizationSize)}
    </div>
  `;
}

function getOrganizationSizeSpecificPoint(assessmentType, organizationSize) {
  if (assessmentType === ASSESSMENT_READINESS) {
    if (organizationSize === ORG_SIZE_SMALL) return "13 days for assessment and 3 days for reporting";
    if (organizationSize === ORG_SIZE_MEDIUM) return "17 days for assessment and 3 days for reporting";
    if (organizationSize === ORG_SIZE_ENTERPRISE) return "Additional scoping discussion required for enterprise-wide scope";
  }

  if (assessmentType === ASSESSMENT_INTERNAL_AUDIT) {
    if (organizationSize === ORG_SIZE_SMALL) return "10 days for assessment and 2 days for reporting";
    if (organizationSize === ORG_SIZE_MEDIUM) return "13 days for assessment and 3 days for reporting";
    if (organizationSize === ORG_SIZE_ENTERPRISE) return "Additional scoping discussion required for enterprise-wide scope";
  }

  return "";
}

function renderAssessmentTypeStep(draft, errors) {
  return `
    <div class="mb-3">
      <label class="form-label">Assessment Type</label>
      <div class="wizard-helper mt-2">Select one or more assessment types based on your scope requirements.</div>
      <div class="compliance-service-grid">
        ${ASSESSMENT_OPTIONS.map((option) => {
          const checked = draft.selectedAssessmentTypes.includes(option.value);
          const isRemediation = option.value === ASSESSMENT_REMEDIATION;
          const dynamicPoint = getOrganizationSizeSpecificPoint(option.value, draft.organizationSize);
          const displayPoints = dynamicPoint
            ? [dynamicPoint]
            : option.points;
          const pointEntries = displayPoints.map((point) => ({
            text: point,
            isWarning: /additional scoping discussion required/i.test(point),
          }));

          return `
            <div class="compliance-service-option ${checked ? "is-selected" : ""}">
              <label class="compliance-service-option__label" for="compliance-type-${escapeHtml(option.value)}">
                <input
                  type="checkbox"
                  id="compliance-type-${escapeHtml(option.value)}"
                  name="selectedAssessmentTypes"
                  value="${escapeHtml(option.value)}"
                  ${checked ? "checked" : ""}
                >
                <div class="compliance-service-option__content">
                  <div class="compliance-service-option__title">${escapeHtml(option.title)}</div>
                  <div class="compliance-service-option__description">${escapeHtml(option.description)}</div>
                  <ul class="compliance-service-option__points">
                    ${pointEntries.map((entry) => `
                      <li class="${entry.isWarning ? "compliance-service-option__point--warning" : ""}">
                        ${escapeHtml(entry.text)}
                      </li>
                    `).join("")}
                  </ul>
                </div>
              </label>
              ${checked && isRemediation ? renderRemediationOptions(draft, errors) : ""}
            </div>
          `;
        }).join("")}
      </div>
      ${renderError(errors.selectedAssessmentTypes)}
    </div>
  `;
}

function renderRemediationOptions(draft, errors) {
  return `
    <div class="compliance-inline-config">
      <div class="wizard-section-kicker">Remediation Support Days</div>
      <div class="compliance-inline-options">
        ${REMEDIATION_OPTIONS.map((option) => `
          <label class="compliance-inline-option ${draft.remediationDays === option.value ? "is-selected" : ""}" for="remediation-days-${escapeHtml(option.value)}">
            <input
              class="visually-hidden"
              type="radio"
              name="remediationDays"
              id="remediation-days-${escapeHtml(option.value)}"
              value="${escapeHtml(option.value)}"
              ${draft.remediationDays === option.value ? "checked" : ""}
            >
            <span>${escapeHtml(option.title)}</span>
          </label>
        `).join("")}
      </div>
      ${draft.remediationDays === CUSTOM_DAY_OPTION ? `
        <div class="mt-3">
          <label class="form-label" for="custom-remediation-days">Custom remediation days</label>
          <input
            type="number"
            min="1"
            step="1"
            class="form-control wizard-field wizard-field--short"
            id="custom-remediation-days"
            name="customRemediationDays"
            value="${escapeHtml(draft.customRemediationDays || "")}"
            placeholder="Enter days"
          >
        </div>
      ` : ""}
      ${renderError(errors.remediationDays)}
      ${renderError(errors.customRemediationDays)}
    </div>
  `;
}

export const complianceSupportService = {
  id: "compliance_support",
  assessmentType: "compliance_support",
  groupId: "security-advisory-services",
  selectionTitle: "Compliance Support",
  selectionSubtitle: "A structured readiness assessment and remediation support service to help organizations achieve and maintain compliance with a selected regulatory or industry framework.",
  logicTitle: "Compliance Support",
  reviewConfig: {
    editableRetest: false,
    methodologyFieldLabel: "Organization Size",
    detailFieldLabel: "Summary",
    reviewIntroText: "A structured readiness assessment and remediation support service to help organizations achieve and maintain compliance with a selected regulatory or industry framework.",
  },
  steps: [
    {
      id: "organization_size",
      render: renderOrgSizeStep,
      validate(draft) {
        const errors = {};
        if (!ORG_SIZE_OPTIONS.some((option) => option.value === draft.organizationSize)) {
          errors.organizationSize = "Select an organization size.";
        }
        return { valid: Object.keys(errors).length === 0, errors };
      },
    },
    {
      id: "assessment_types",
      render: renderAssessmentTypeStep,
      validate(draft) {
        const errors = {};

        if (!draft.selectedAssessmentTypes.length) {
          errors.selectedAssessmentTypes = "Select at least one assessment type.";
        }

        if (draft.selectedAssessmentTypes.includes(ASSESSMENT_REMEDIATION)) {
          if (!REMEDIATION_OPTIONS.some((option) => option.value === draft.remediationDays)) {
            errors.remediationDays = "Select a remediation support day option.";
          }

          if (draft.remediationDays === CUSTOM_DAY_OPTION) {
            const customDays = Number.parseInt(draft.customRemediationDays, 10);
            if (!Number.isInteger(customDays) || customDays <= 0) {
              errors.customRemediationDays = "Enter a valid number of custom remediation days.";
            }
          }
        }

        return { valid: Object.keys(errors).length === 0, errors };
      },
    },
  ],
  createDraft(initialAssessment = null, submitLabel = "Add to Project") {
    if (!initialAssessment) {
      return createWizardDraft("compliance_support", submitLabel, {
        organizationSize: "",
        selectedAssessmentTypes: [],
        remediationDays: "10",
        customRemediationDays: "",
        includeRetest: false,
      });
    }

    const inputs = initialAssessment.inputs || {};
    return createWizardDraft("compliance_support", submitLabel, {
      stepIndex: 1,
      organizationSize: String(inputs.organizationSize || ""),
      selectedAssessmentTypes: normalizeSelectedAssessmentTypes(inputs.selectedAssessmentTypes),
      remediationDays: String(inputs.remediationDays || "10"),
      customRemediationDays: String(inputs.customRemediationDays || ""),
      includeRetest: false,
    });
  },
  handleInputChange(draft, target) {
    if (!(target instanceof HTMLInputElement)) return false;

    if (target.name === "organizationSize" && target.type === "radio") {
      draft.organizationSize = target.value;
      return true;
    }

    if (target.name === "selectedAssessmentTypes" && target.type === "checkbox") {
      const nextValues = new Set(draft.selectedAssessmentTypes);
      if (target.checked) {
        nextValues.add(target.value);
      } else {
        nextValues.delete(target.value);
      }

      draft.selectedAssessmentTypes = ASSESSMENT_OPTIONS
        .map((option) => option.value)
        .filter((value) => nextValues.has(value));
      return true;
    }

    if (target.name === "remediationDays" && target.type === "radio") {
      draft.remediationDays = target.value;
      return true;
    }

    if (target.name === "customRemediationDays") {
      draft.customRemediationDays = target.value;
      return false;
    }

    return false;
  },
  buildAssessment(draft) {
    const rows = buildScopedRows(draft);
    const scopedRows = rows.filter((row) => !row.scopingRequired);
    const scopingRows = rows.filter((row) => row.scopingRequired);
    const md = calculateComplianceSupportMd(draft);

    return {
      id: generateId(),
      serviceId: "compliance_support",
      groupId: "security-advisory-services",
      type: "compliance_support",
      typeLabel: "Compliance Support",
      methodology: draft.organizationSize,
      methodologyLabel: getOrgSizeLabel(draft.organizationSize),
      inputs: {
        organizationSize: draft.organizationSize,
        selectedAssessmentTypes: [...draft.selectedAssessmentTypes],
        remediationDays: draft.remediationDays,
        customRemediationDays: draft.customRemediationDays,
        scopedRows: serializeScopedRows(scopedRows),
        scopingRows: serializeScopingRows(scopingRows),
        includeRetest: false,
      },
      detailSummary: buildComplianceSummaryText(draft, scopedRows, scopingRows),
      reviewDetailSummary: buildComplianceSummaryText(draft, scopedRows, scopingRows),
      detailSummaryHtml: buildComplianceDetailHtml(draft),
      reviewDetailHtml: buildComplianceDetailHtml(draft),
      md,
      createdAt: new Date().toISOString(),
    };
  },
  getLogicHtml() {
    return `
      <div class="logic-flow">
        <div class="logic-node">Select organization size</div>
        <div class="logic-node">Choose one or more compliance support assessment types</div>
        <div class="logic-node">Policies Templates = 1 assessment / 0 reporting / 0 retest</div>
        <div class="logic-node">Readiness = 13/3 for size A, 17/3 for size B, discussion for size C</div>
        <div class="logic-node">Internal Audit = 10/2 for size A, 13/3 for size B, discussion for size C</div>
        <div class="logic-node">Remediation Support = 10, 20, 30, or custom assessment days</div>
        <div class="logic-node">Certification Support = 6 assessment / 0 reporting / 0 retest</div>
        <div class="logic-node outcome">Total MD = sum of scoped selected rows only</div>
      </div>
    `;
  },
};
