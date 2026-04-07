import {
  createWizardDraft,
  generateId,
  getInitialIncludeRetest,
} from "../core.js?v=1.4";

const CREW_TYPE = "crew";
const CREW_LONG_SUMMARY = "A Cybersecurity Review Essentials Workshop is a focused, efficient assessment of an organization's cybersecurity foundations, aligned with a Bitdefender framework and mapped to common industry-recognized standards. The engagement provides practical, prioritized recommendations, builds security awareness, and helps optimize limited resources by addressing cybersecurity holistically across people, process, and technology, not just technical controls.";

function calculateCrewReviewMd(draft) {
  const initial = 1;
  const reporting = 1;
  const retest = draft.includeRetest ? 2 : 0;
  return { initial, reporting, retest, total: initial + reporting + retest };
}

function buildCrewDetailSummary(draft) {
  return draft.includeRetest ? "Future review included" : "No future review";
}

export const crewReviewService = {
  id: "crew_review",
  assessmentType: "crew_review",
  groupId: "security-advisory-services",
  selectionTitle: "C.R.E.W. (Cybersecurity Review Essentials Workshop)",
  selectionSubtitle: "Holistic cybersecurity review for SMEs and larger organization with lean IT teams.",
  logicTitle: "C.R.E.W.",
  reviewConfig: {
    editableRetest: true,
    methodologyFieldLabel: "Service",
    detailFieldLabel: "Summary",
    retestLabel: "Future Review",
    retestYesLabel: "Include Follow-up",
    retestNoLabel: "No Follow-up",
    retestHelper: "Retest is a follow-up verification after remediation to confirm that identified findings have been properly addressed. This applies to both offensive and security advisory services.",
    retestImpactTitle: "Follow-up impact",
    retestStatLabel: "Follow-up",
    reviewIntroText: CREW_LONG_SUMMARY,
  },
  steps: [],
  createDraft(initialAssessment = null, submitLabel = "Add to Project") {
    if (!initialAssessment) {
      return createWizardDraft("crew_review", submitLabel, {
        includeRetest: null,
      });
    }

    return createWizardDraft("crew_review", submitLabel, {
      stepIndex: 1,
      includeRetest: getInitialIncludeRetest(initialAssessment),
    });
  },
  handleInputChange() {
    return false;
  },
  buildAssessment(draft) {
    return {
      id: generateId(),
      serviceId: "crew_review",
      groupId: "security-advisory-services",
      type: "crew_review",
      typeLabel: "C.R.E.W. (Cybersecurity Review Essentials Workshop)",
      methodology: CREW_TYPE,
      methodologyLabel: "C.R.E.W.",
      inputs: {
        csrAssessmentType: CREW_TYPE,
        futureReview: Boolean(draft.includeRetest),
        includeRetest: Boolean(draft.includeRetest),
      },
      detailSummary: buildCrewDetailSummary(draft),
      reviewDetailSummary: buildCrewDetailSummary(draft),
      md: calculateCrewReviewMd(draft),
      createdAt: new Date().toISOString(),
    };
  },
  getLogicHtml() {
    return `
      <div class="logic-flow">
        <div class="logic-node">C.R.E.W. = initial 1 MD + reporting 1 MD</div>
        <div class="logic-node decision">Future review in 6-12 months?</div>
        <div class="logic-arrow">↓ yes</div>
        <div class="logic-node">Add follow-up = 2 MD</div>
        <div class="logic-arrow">↓ no</div>
        <div class="logic-node">follow-up = 0</div>
        <div class="logic-node outcome">total = initial + reporting + follow-up</div>
      </div>
    `;
  },
};
