import { getLogicServices, resolveAssessmentGroupId, startAssessmentWizard } from "./assessment/core.js?v=1.4";

const ASSET_VERSION = encodeURIComponent(window.APP_ASSET_VERSION || "dev");
const {
  loadProject,
  resetProject,
  saveProject,
} = await import(`./storage.js?v=${ASSET_VERSION}`);

const OFFENSIVE_GROUP_ID = "offensive-services";
const ADVISORY_GROUP_ID = "security-advisory-services";
const GROUP_ORDER = [OFFENSIVE_GROUP_ID, ADVISORY_GROUP_ID];
const GROUP_META = {
  [OFFENSIVE_GROUP_ID]: {
    title: "Offensive Services",
    rowClass: "assessment-group-row--offensive",
    totalLabel: "Sub Total",
  },
  [ADVISORY_GROUP_ID]: {
    title: "Security Advisory Services",
    rowClass: "assessment-group-row--advisory",
    totalLabel: "Sub Total",
  },
};

const EDIT_ICON = `
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M11.9 1.6a1.5 1.5 0 0 1 2.1 2.1l-8 8L3 12.9l1.2-2.9 7.7-8.4Zm-7 8.7-.5 1.3 1.3-.5 7.5-7.5-.8-.8-7.5 7.5Z"></path>
  </svg>
`;

const DELETE_ICON = `
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M6.5 1h3l.5 1H13v1H3V2h3l.5-1Zm-2 3h7l-.5 9h-6L4.5 4Zm2 1v6h1V5h-1Zm3 0v6h1V5h-1Z"></path>
  </svg>
`;

let state = loadProject();
let addModal;
let supportModal;
let logicModal;
let currentWizardCleanup = null;
let copyStatusTimer = null;

const el = {
  btnSupport: document.getElementById("btnSupport"),
  supportModal: document.getElementById("supportModal"),
  btnSupportMailClient: document.getElementById("btnSupportMailClient"),
  btnSupportWeb: document.getElementById("btnSupportWeb"),
  btnAddAssessment: document.getElementById("btnAddAssessment"),
  btnShowLogic: document.getElementById("btnShowLogic"),
  btnCopyTable: document.getElementById("btnCopyTable"),
  copyTableStatus: document.getElementById("copyTableStatus"),
  btnResetProject: document.getElementById("btnResetProject"),
  table: document.getElementById("assessmentTable"),
  tableBody: document.getElementById("assessmentTableBody"),
  assessmentTotalFooter: document.getElementById("assessmentTotalFooter"),
  modal: document.getElementById("addAssessmentModal"),
  modalBody: document.getElementById("addAssessmentModalBody"),
  modalTitle: document.getElementById("addAssessmentModalTitle"),
  logicModal: document.getElementById("logicModal"),
  logicTypeOptions: document.getElementById("logicTypeOptions"),
  logicContent: document.getElementById("logicContent"),
};

initApp();

export function initApp() {
  addModal = new bootstrap.Modal(el.modal);
  supportModal = new bootstrap.Modal(el.supportModal);
  logicModal = new bootstrap.Modal(el.logicModal);
  renderLogicTypeOptions();

  el.modal.addEventListener("hidden.bs.modal", () => {
    if (typeof currentWizardCleanup === "function") {
      currentWizardCleanup();
      currentWizardCleanup = null;
    }
    el.modalBody.innerHTML = "";
  });

  el.btnAddAssessment.addEventListener("click", openAddModal);
  el.btnSupport.addEventListener("click", openSupportChooser);
  el.btnSupportMailClient.addEventListener("click", openSupportMailClient);
  el.btnSupportWeb.addEventListener("click", openSupportWeb);
  el.btnShowLogic.addEventListener("click", openLogicModal);
  el.btnCopyTable.addEventListener("click", () => copyTableToClipboard(el.table));
  el.btnResetProject.addEventListener("click", confirmAndResetProject);
  el.logicTypeOptions.addEventListener("change", renderLogicContent);
  el.tableBody.addEventListener("click", handleTableActionClick);

  renderTable(state);
  renderTotals(state);
  renderLogicContent();
}

function handleTableActionClick(event) {
  const editButton = event.target.closest("button[data-edit-id]");
  if (editButton) {
    openEditModal(editButton.dataset.editId);
    return;
  }

  const button = event.target.closest("button[data-delete-id]");
  if (!button) return;

  deleteAssessment(button.dataset.deleteId);
}

export function renderTable(nextState) {
  if (!nextState.assessments.length) {
    el.tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-body-secondary py-5 empty-table-state">No assessments added yet.</td>
      </tr>
    `;
    return;
  }

  const totals = buildGroupTotals(nextState.assessments);
  const hasBothGroups = totals.groups.length > 1;
  const markup = [];
  const visibleGroupIds = GROUP_ORDER.filter((groupId) =>
    nextState.assessments.some((item) => resolveAssessmentGroupId(item) === groupId),
  );

  visibleGroupIds.forEach((groupId, groupIndex) => {
    const items = nextState.assessments.filter((item) => resolveAssessmentGroupId(item) === groupId);
    if (!items.length) return;

    const groupMeta = GROUP_META[groupId];
    const groupTotal = totals.groups.find((group) => group.id === groupId)?.total || 0;

    const groupRowClasses = ["assessment-group-row", groupMeta.rowClass].join(" ");

    markup.push(`
      <tr class="${groupRowClasses}">
        <td colspan="7">
          <div class="assessment-group-row__inner">
            <div class="assessment-group-row__title">${escapeHtml(groupMeta.title)}</div>
          </div>
        </td>
      </tr>
    `);

    items.forEach((item, index) => {
      if (isInlineComplianceAssessment(item)) {
        markup.push(renderInlineComplianceRows(item, index));
        return;
      }

      markup.push(`
        <tr>
          <td><span class="row-index-badge">${index + 1}</span></td>
          <td>${buildAssessmentDetailDisplay(item)}</td>
          <td><span class="md-pill">${item.md.initial}</span></td>
          <td><span class="md-pill md-pill--muted">${item.md.reporting}</span></td>
          <td><span class="md-pill md-pill--muted">${item.md.retest}</span></td>
          <td><span class="md-pill md-pill--total">${item.md.total}</span></td>
          <td>${buildAssessmentActionButtons(item)}</td>
        </tr>
      `);
    });

    if (hasBothGroups) {
      markup.push(`
        <tr class="assessment-subtotal-row ${groupMeta.rowClass}">
          <td colspan="5" class="assessment-subtotal-row__label">${escapeHtml(groupMeta.totalLabel)}</td>
          <td class="assessment-subtotal-row__value">${groupTotal}</td>
          <td></td>
        </tr>
      `);

      if (groupIndex < visibleGroupIds.length - 1) {
        markup.push(`
          <tr class="assessment-group-gap" aria-hidden="true">
            <td colspan="7"></td>
          </tr>
        `);
      }
    }
  });

  el.tableBody.innerHTML = markup.join("");
}

function renderInlineComplianceRows(item, index) {
  const scopedRows = Array.isArray(item?.inputs?.scopedRows) ? item.inputs.scopedRows : [];
  const scopingRows = Array.isArray(item?.inputs?.scopingRows) ? item.inputs.scopingRows : [];
  const summaryLines = getComplianceSummaryLines(item);
  const totalRowspan = Math.max(1 + scopedRows.length + scopingRows.length, 1);

  const markup = [];

  markup.push(`
    <tr class="assessment-inline-group assessment-inline-group--header">
      <td rowspan="${totalRowspan}" class="assessment-inline-group__index">
        <span class="row-index-badge">${index + 1}</span>
      </td>
      <td class="assessment-inline-group__detail">
        <div class="assessment-detail-title">${escapeHtml(getTypeDisplay(item))}</div>
        ${summaryLines.length ? `
          <ul class="assessment-detail-list mb-0">
            ${summaryLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
          </ul>
        ` : ""}
      </td>
      <td><span class="md-pill">${item.md.initial}</span></td>
      <td><span class="md-pill md-pill--muted">${item.md.reporting}</span></td>
      <td><span class="md-pill md-pill--muted">${item.md.retest}</span></td>
      <td><span class="md-pill md-pill--total">${item.md.total}</span></td>
      <td>${buildAssessmentActionButtons(item)}</td>
    </tr>
  `);

  scopedRows.forEach((row) => {
    markup.push(`
      <tr class="assessment-inline-group assessment-inline-group--item">
        <td class="assessment-inline-breakdown-cell">
          <div class="assessment-inline-breakdown-title">${escapeHtml(row.title || "-")}</div>
          ${row.notes ? `<div class="assessment-inline-breakdown-note">${escapeHtml(row.notes)}</div>` : ""}
        </td>
        <td><span class="assessment-inline-md">${normalizeInlineMd(row.initial)}</span></td>
        <td><span class="assessment-inline-md">${normalizeInlineMd(row.reporting)}</span></td>
        <td><span class="assessment-inline-md">${normalizeInlineMd(row.retest)}</span></td>
        <td><span class="assessment-inline-md assessment-inline-md--total">${normalizeInlineMd(row.total)}</span></td>
        <td></td>
      </tr>
    `);
  });

  scopingRows.forEach((row) => {
    markup.push(`
      <tr class="assessment-inline-group assessment-inline-group--pending">
        <td class="assessment-inline-breakdown-cell">
          <div class="assessment-inline-breakdown-title">${escapeHtml(row.title || "-")}</div>
          <div class="assessment-inline-breakdown-note">${escapeHtml(row.notes || "Additional scoping / call discussion required.")}</div>
        </td>
        <td colspan="4" class="assessment-inline-pending-cell">Additional scoping required</td>
        <td></td>
      </tr>
    `);
  });

  return markup.join("");
}

function buildAssessmentActionButtons(item) {
  return `
    <div class="table-action-stack">
      <button type="button" class="btn btn-sm btn-outline-primary table-action-btn table-action-btn--icon" data-edit-id="${escapeHtml(item.id)}" aria-label="Edit assessment" title="Edit assessment">${EDIT_ICON}</button>
      <button type="button" class="btn btn-sm btn-outline-danger table-action-btn table-action-btn--icon" data-delete-id="${escapeHtml(item.id)}" aria-label="Delete assessment" title="Delete assessment">${DELETE_ICON}</button>
    </div>
  `;
}

export function renderTotals(nextState) {
  const totals = buildGroupTotals(nextState.assessments);
  renderAssessmentTotalFooter(totals);
}

export function openAddModal() {
  el.modalTitle.textContent = "Add Assessment";
  if (typeof currentWizardCleanup === "function") {
    currentWizardCleanup();
    currentWizardCleanup = null;
  }

  currentWizardCleanup = startAssessmentWizard({
    mountEl: el.modalBody,
    onSubmit: addAssessmentToProject,
  });
  addModal.show();
}

export function openEditModal(id) {
  const existing = state.assessments.find((item) => item.id === id);
  if (!existing) return;

  el.modalTitle.textContent = "Edit Assessment";
  if (typeof currentWizardCleanup === "function") {
    currentWizardCleanup();
    currentWizardCleanup = null;
  }

  currentWizardCleanup = startAssessmentWizard({
    mountEl: el.modalBody,
    initialAssessment: existing,
    submitLabel: "Save Changes",
    onSubmit: (updatedAssessment) => updateAssessment(id, updatedAssessment),
  });
  addModal.show();
}

export function closeAddModal() {
  addModal.hide();
}

export function openLogicModal() {
  renderLogicTypeOptions();
  renderLogicContent();
  logicModal.show();
}

function openSupportChooser() {
  supportModal.show();
}

function openSupportMailClient() {
  supportModal.hide();
  const to = "cyberops-offsec-scopi-aaaap2qp5dqwjqgktzj6rgej2i@bitdefender.slack.com";
  const subject = "Cyber Security Services Scoping Query";
  const body = [
    "Customer name -",
    "Type of assessment -",
    "Region of the customer -",
    "Timeline -",
  ].join("\n");

  const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailtoUrl;
}

function openSupportWeb() {
  supportModal.hide();
  const to = "cyberops-offsec-scopi-aaaap2qp5dqwjqgktzj6rgej2i@bitdefender.slack.com";
  const subject = "Cyber Security Services Scoping Query";
  const body = [
    "Customer name -",
    "Type of assessment -",
    "Region of the customer -",
    "Timeline -",
  ].join("\n");

  const webUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(webUrl, "_blank", "noopener,noreferrer");
}

export function addAssessmentToProject(assessmentObj) {
  state = {
    ...state,
    assessments: [...state.assessments, assessmentObj],
  };

  saveProject(state);
  renderTable(state);
  renderTotals(state);
  closeAddModal();
}

export function deleteAssessment(id) {
  state = {
    ...state,
    assessments: state.assessments.filter((item) => item.id !== id),
  };

  saveProject(state);
  renderTable(state);
  renderTotals(state);
}

export function updateAssessment(id, updatedAssessment) {
  state = {
    ...state,
    assessments: state.assessments.map((item) =>
      item.id === id
        ? {
            ...updatedAssessment,
            id: item.id,
            createdAt: item.createdAt,
          }
        : item,
    ),
  };

  saveProject(state);
  renderTable(state);
  renderTotals(state);
  closeAddModal();
}

export function confirmAndResetProject() {
  const confirmed = window.confirm("Reset project and clear all assessments?");
  if (!confirmed) return;

  resetProject();
  state = loadProject();
  renderTable(state);
  renderTotals(state);
}

async function copyTableToClipboard(tableEl) {
  const copyableTable = buildCopyableTable(tableEl);
  const html = copyableTable.outerHTML;
  const plain = copyableTable.innerText;

  try {
    if (navigator.clipboard && typeof window.ClipboardItem === "function") {
      await navigator.clipboard.write([
        new window.ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ]);
      setCopyStatus("Copied table.");
      return;
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(plain);
      setCopyStatus("Copied table.");
      return;
    }

    fallbackCopyPlainText(plain);
    setCopyStatus("Copied table.");
  } catch (_error) {
    setCopyStatus("Unable to copy table.");
  }
}

function buildCopyableTable(sourceTable) {
  const clonedTable = sourceTable.cloneNode(true);
  const pendingScopingItems = normalizeCopiedInlineComplianceRows(clonedTable);
  const actionColumnIndex = getActionColumnIndex(clonedTable);

  if (actionColumnIndex >= 0) {
    removeLogicalColumn(clonedTable, actionColumnIndex);
  }

  normalizeCopiedGroupRows(clonedTable);
  appendCopiedTotalRow(clonedTable, pendingScopingItems);
  demoteCopiedTableHeader(clonedTable);

  clonedTable.style.borderCollapse = "collapse";
  clonedTable.style.border = "1px solid #2f2f2f";
  clonedTable.style.width = "100%";
  clonedTable.style.fontFamily = "\"IBM Plex Sans\", Arial, sans-serif";
  clonedTable.style.fontSize = "10pt";
  clonedTable.querySelectorAll("th, td").forEach((cell) => {
    cell.style.border = "1px solid #2f2f2f";
    cell.style.padding = "6px 8px";
    cell.style.verticalAlign = "middle";
    cell.style.fontFamily = "\"IBM Plex Sans\", Arial, sans-serif";
    cell.style.fontSize = "10pt";
    cell.style.lineHeight = "1.3";
  });
  clonedTable.querySelectorAll("thead th").forEach((cell) => {
    cell.style.textAlign = "center";
  });
  clonedTable.querySelectorAll("ul").forEach((list) => {
    list.style.marginTop = "0";
    list.style.marginBottom = "0";
  });
  clonedTable.querySelectorAll("li").forEach((item) => {
    item.style.marginTop = "0";
    item.style.marginBottom = "0";
  });
  centerCopiedTableColumns(clonedTable);

  return clonedTable;
}

function demoteCopiedTableHeader(tableEl) {
  const thead = tableEl.querySelector("thead");
  if (!thead) return;

  const tbody = tableEl.querySelector("tbody") || tableEl.createTBody();
  const headerRows = Array.from(thead.querySelectorAll("tr"));
  const firstBodyRow = tbody.firstChild;

  headerRows.forEach((row) => {
    if (firstBodyRow) {
      tbody.insertBefore(row, firstBodyRow);
    } else {
      tbody.appendChild(row);
    }
  });

  thead.remove();
}

function normalizeCopiedInlineComplianceRows(tableEl) {
  const tbody = tableEl.querySelector("tbody");
  if (!tbody) return [];
  const pendingScopingItems = [];

  const rows = Array.from(tbody.querySelectorAll("tr"));
  const inlineHeaders = rows.filter((row) => row.classList.contains("assessment-inline-group--header"));

  inlineHeaders.forEach((headerRow) => {
    const indexCell = headerRow.children[0];
    const detailCell = headerRow.children[1];
    if (!indexCell || !detailCell) return;

    const rowspan = Math.max(1, Number.parseInt(indexCell.getAttribute("rowspan") || "1", 10));
    const groupedRows = [headerRow];
    let sibling = headerRow.nextElementSibling;

    while (sibling && groupedRows.length < rowspan) {
      groupedRows.push(sibling);
      sibling = sibling.nextElementSibling;
    }

    const summaryServiceTitle = String(detailCell.querySelector(".assessment-detail-title")?.textContent || "Compliance Support").trim();
    const parsed = buildCopiedComplianceBulletLines(groupedRows, summaryServiceTitle);
    const bulletLines = parsed.lines;
    if (parsed.pending.length) pendingScopingItems.push(...parsed.pending);
    if (bulletLines.length) {
      detailCell.querySelectorAll("ul").forEach((list) => list.remove());
      detailCell.appendChild(buildCopiedComplianceBulletList(bulletLines));
    }

    indexCell.removeAttribute("rowspan");

    const headerMdCells = Array.from(headerRow.children).slice(2);
    headerMdCells.forEach((cell) => {
      cell.style.textAlign = "center";
      cell.style.verticalAlign = "middle";
    });

    groupedRows.slice(1).forEach((row) => row.remove());
  });

  return pendingScopingItems;
}

function buildCopiedComplianceBulletLines(groupedRows, serviceTitle = "Compliance Support") {
  const lines = [];
  const pending = [];
  const headerRow = groupedRows[0];
  const detailCell = headerRow.children[1];
  const summaryItems = Array.from(detailCell.querySelectorAll("ul li"))
    .map((item) => String(item.textContent || "").trim())
    .filter(Boolean);
  const seenSummary = new Set();
  summaryItems.forEach((line) => {
    if (seenSummary.has(line)) return;
    seenSummary.add(line);
    lines.push({ text: line, children: [] });
  });
  const organizationSizeRaw = summaryItems.find((line) => /^Organization size:/i.test(line)) || "";
  const organizationSize = organizationSizeRaw.replace(/^Organization size:\s*/i, "").trim();

  const childRows = groupedRows.filter((row) => row.classList.contains("assessment-inline-group--item"));
  if (!childRows.length) return { lines, pending };

  const selectedAssessments = [];
  childRows.forEach((row) => {
    const detailText = String(row.children[0]?.textContent || "")
      .split("\n")
      .map((part) => part.trim())
      .filter(Boolean);
    const title = detailText[0] || "Assessment";
    const initial = normalizeInt(row.children[1]?.textContent || "0");
    const reporting = normalizeInt(row.children[2]?.textContent || "0");
    const parts = [String(initial)];
    if (reporting > 0) parts.push(String(reporting));
    selectedAssessments.push(`${title} (${parts.join("+")})`);
  });

  const pendingRows = groupedRows.filter((row) => row.classList.contains("assessment-inline-group--pending"));
  pendingRows.forEach((row) => {
    const title = String(row.children[0]?.querySelector(".assessment-inline-breakdown-title")?.textContent || row.children[0]?.textContent || "")
      .trim();
    const note = String(row.children[0]?.querySelector(".assessment-inline-breakdown-note")?.textContent || "Additional scoping required.")
      .trim();
    if (title) {
      pending.push({
        serviceTitle,
        organizationSize,
        assessmentType: title,
        note,
      });
    }
  });

  if (selectedAssessments.length) {
    lines.push({
      text: "Selected assessment(s):",
      children: selectedAssessments,
    });
  }

  return { lines, pending };
}

function buildCopiedComplianceBulletList(lines) {
  const list = document.createElement("ul");
  list.style.fontSize = "10pt";
  list.style.lineHeight = "1.3";

  lines.forEach((line) => {
    const item = document.createElement("li");
    item.style.margin = "1px 0";
    item.textContent = line.text;

    if (Array.isArray(line.children) && line.children.length) {
      const childList = document.createElement("ul");
      childList.style.fontSize = "10pt";
      childList.style.lineHeight = "1.3";

      line.children.forEach((child) => {
        const childItem = document.createElement("li");
        childItem.style.margin = "1px 0";
        childItem.style.fontFamily = "\"IBM Plex Sans\", Arial, sans-serif";
        childItem.textContent = child;
        childList.appendChild(childItem);
      });

      item.appendChild(childList);
    }

    list.appendChild(item);
  });

  return list;
}

function getActionColumnIndex(tableEl) {
  const headerRow = tableEl.querySelector("thead tr");
  if (!headerRow) return -1;

  let columnCursor = 0;
  for (const cell of Array.from(headerRow.children)) {
    const span = Math.max(1, Number.parseInt(cell.getAttribute("colspan") || "1", 10));
    const label = String(cell.textContent || "").trim().toLowerCase();
    if (label === "action") return columnCursor;
    columnCursor += span;
  }

  return -1;
}

function removeLogicalColumn(tableEl, targetColumnIndex) {
  const rows = [
    ...Array.from(tableEl.querySelectorAll("thead tr")),
    ...Array.from(tableEl.querySelectorAll("tbody tr")),
    ...Array.from(tableEl.querySelectorAll("tfoot tr")),
  ];

  rows.forEach((row) => {
    let columnCursor = 0;
    for (const cell of Array.from(row.children)) {
      const span = Math.max(1, Number.parseInt(cell.getAttribute("colspan") || "1", 10));
      const coversTarget = targetColumnIndex >= columnCursor && targetColumnIndex < columnCursor + span;

      if (coversTarget) {
        if (span > 1) {
          cell.setAttribute("colspan", String(span - 1));
        } else {
          cell.remove();
        }
        break;
      }

      columnCursor += span;
    }
  });
}

function centerCopiedTableColumns(tableEl) {
  const columnsToCenter = new Set([1, 3, 4, 5, 6]);
  const rows = Array.from(tableEl.querySelectorAll("thead tr, tbody tr, tfoot tr"));

  rows.forEach((row) => {
    if (row.classList.contains("assessment-group-row") || row.classList.contains("assessment-subtotal-row")) return;

    let logicalColumn = 1;
    for (const cell of Array.from(row.children)) {
      if (row.parentElement?.tagName === "TFOOT" && logicalColumn === 1) {
        logicalColumn += Math.max(1, Number.parseInt(cell.getAttribute("colspan") || "1", 10));
        continue;
      }

      const span = Math.max(1, Number.parseInt(cell.getAttribute("colspan") || "1", 10));
      for (let offset = 0; offset < span; offset += 1) {
        if (columnsToCenter.has(logicalColumn + offset)) {
          cell.style.textAlign = "center";
          break;
        }
      }
      logicalColumn += span;
    }
  });
}

function normalizeCopiedGroupRows(tableEl) {
  tableEl.querySelectorAll("tbody tr.assessment-group-row td").forEach((cell) => {
    cell.style.background = "#f2f2f2";
    cell.style.textAlign = "left";
    cell.style.fontWeight = "700";
    cell.style.padding = "10px 12px";
  });

  tableEl.querySelectorAll("tbody tr.assessment-subtotal-row td").forEach((cell) => {
    cell.style.background = "#fafafa";
    cell.style.fontWeight = "700";
    cell.style.padding = "8px 12px";
    cell.style.borderTop = "1px solid #cfcfcf";
    cell.style.textAlign = "center";
  });

  tableEl.querySelectorAll("tbody tr.assessment-subtotal-row td.assessment-subtotal-row__label").forEach((cell) => {
    cell.style.textAlign = "center";
  });

  tableEl.querySelectorAll("tbody tr.assessment-subtotal-row td.assessment-subtotal-row__value").forEach((cell) => {
    cell.style.textAlign = "center";
  });
}

function appendCopiedTotalRow(tableEl, pendingScopingItems = []) {
  const tfoot = tableEl.querySelector("tfoot") || tableEl.createTFoot();
  tfoot.innerHTML = "";
  const totals = getCopiedTableTotals(tableEl);
  const hasBothGroups = totals.groups.length > 1;

  if (hasBothGroups) {
    appendCopiedFooterRow(tfoot, "Grand Total", totals.grandTotal);
  } else {
    appendCopiedFooterRow(tfoot, "Total Mandays", totals.grandTotal);
  }

  appendCopiedPendingScopingSection(tfoot, pendingScopingItems);
}

function setCopyStatus(message) {
  if (!el.copyTableStatus) return;
  el.copyTableStatus.textContent = message;

  if (copyStatusTimer) clearTimeout(copyStatusTimer);
  copyStatusTimer = window.setTimeout(() => {
    el.copyTableStatus.textContent = "";
    copyStatusTimer = null;
  }, 2500);
}

function buildGroupTotals(assessments) {
  const groups = GROUP_ORDER
    .map((groupId) => ({
      id: groupId,
      title: GROUP_META[groupId].title,
      total: assessments
        .filter((item) => resolveAssessmentGroupId(item) === groupId)
        .reduce((acc, item) => acc + normalizeInt(item?.md?.total), 0),
    }))
    .filter((group) => group.total > 0);

  return {
    groups,
    grandTotal: groups.reduce((acc, group) => acc + group.total, 0),
  };
}

function renderAssessmentTotalFooter(totals) {
  if (!el.assessmentTotalFooter) return;

  const label = totals.groups.length > 1 ? "Grand Total" : "Total Mandays";
  const subtitle = totals.groups.length > 1
    ? "Combined effort across offensive and security advisory services"
    : "Combined effort across all scoped assessments";

  if (!totals.groups.length) {
    el.assessmentTotalFooter.innerHTML = `
      <div class="assessment-total-footer__content">
        <div class="assessment-total-footer__label">Total Mandays</div>
        <div class="assessment-total-footer__subtitle">Combined effort across all scoped assessments</div>
      </div>
      <div class="assessment-total-footer__value">0 MD</div>
      <div class="assessment-total-footer__spacer" aria-hidden="true"></div>
    `;
    return;
  }

  el.assessmentTotalFooter.innerHTML = `
    <div class="assessment-total-footer__content">
      <div class="assessment-total-footer__label">${label}</div>
      <div class="assessment-total-footer__subtitle">${subtitle}</div>
    </div>
    <div class="assessment-total-footer__value">${totals.grandTotal} MD</div>
    <div class="assessment-total-footer__spacer" aria-hidden="true"></div>
  `;
}

function getCopiedTableTotals(tableEl) {
  const rows = Array.from(tableEl.querySelectorAll("tbody tr"));
  const groups = [];
  let currentGroup = null;

  rows.forEach((row) => {
    if (row.classList.contains("assessment-group-row")) {
      const title = String(row.textContent || "").trim();
      const id = GROUP_ORDER.find((groupId) => GROUP_META[groupId].title === title) || "";
      currentGroup = { id, title, total: 0 };
      groups.push(currentGroup);
      return;
    }

    if (row.classList.contains("assessment-subtotal-row")) return;

    const totalCell = row.children[5];
    const total = Number.parseInt(totalCell?.textContent || "0", 10);
    if (currentGroup && Number.isInteger(total)) {
      currentGroup.total += total;
    }
  });

  return {
    groups: groups.filter((group) => group.total > 0),
    grandTotal: groups.reduce((acc, group) => acc + group.total, 0),
  };
}

function appendCopiedFooterRow(tfoot, label, total) {
  const row = tfoot.insertRow();
  const labelCell = document.createElement("th");
  labelCell.colSpan = 5;
  labelCell.textContent = label;
  labelCell.style.textAlign = "center";
  labelCell.style.background = "#e8e8e8";
  labelCell.style.fontWeight = "700";

  const totalCell = document.createElement("th");
  totalCell.textContent = String(total);
  totalCell.style.textAlign = "center";
  totalCell.style.background = "#e8e8e8";
  totalCell.style.fontWeight = "700";

  row.append(labelCell, totalCell);
}

function appendCopiedPendingScopingSection(tfoot, pendingScopingItems) {
  if (!Array.isArray(pendingScopingItems) || !pendingScopingItems.length) return;

  const spacer = tfoot.insertRow();
  const spacerCell = spacer.insertCell();
  spacerCell.colSpan = 6;
  spacerCell.style.border = "0";
  spacerCell.style.padding = "4px 0";
  spacerCell.style.background = "#fff";

  const titleRow = tfoot.insertRow();
  const titleCell = document.createElement("th");
  titleCell.colSpan = 6;
  titleCell.textContent = "Additional Scoping Required (Mandays To Be Confirmed)";
  titleCell.style.textAlign = "left";
  titleCell.style.background = "#fff4e8";
  titleCell.style.color = "#7d4f11";
  titleCell.style.fontWeight = "700";
  titleRow.append(titleCell);

  const grouped = [];
  const groupedMap = new Map();
  pendingScopingItems.forEach((item) => {
    const key = `${item.serviceTitle || "Compliance Support"}|${item.organizationSize || "-"}`;
    if (!groupedMap.has(key)) {
      const entry = {
        serviceTitle: item.serviceTitle || "Compliance Support",
        organizationSize: item.organizationSize || "-",
        assessmentTypes: [],
      };
      groupedMap.set(key, entry);
      grouped.push(entry);
    }

    const target = groupedMap.get(key);
    if (item.assessmentType && !target.assessmentTypes.includes(item.assessmentType)) {
      target.assessmentTypes.push(item.assessmentType);
    }
  });

  grouped.forEach((item) => {
    const row = tfoot.insertRow();
    const detailCell = row.insertCell();
    detailCell.colSpan = 6;
    detailCell.style.textAlign = "left";
    detailCell.style.background = "#fffdfa";
    detailCell.style.padding = "8px 10px";

    const wrapper = document.createElement("div");
    wrapper.style.fontSize = "10pt";
    wrapper.style.lineHeight = "1.3";

    const serviceTitle = document.createElement("div");
    serviceTitle.textContent = item.serviceTitle || "Compliance Support";
    serviceTitle.style.fontWeight = "700";
    wrapper.appendChild(serviceTitle);

    const list = document.createElement("ul");
    list.style.margin = "4px 0 0 16px";
    list.style.padding = "0";

    const orgItem = document.createElement("li");
    orgItem.textContent = `Organization size: ${item.organizationSize || "-"}`;
    list.appendChild(orgItem);

    const assessmentsItem = document.createElement("li");
    assessmentsItem.textContent = "Assessment(s):";
    const subList = document.createElement("ul");
    subList.style.margin = "2px 0 0 16px";
    subList.style.padding = "0";

    item.assessmentTypes.forEach((assessment) => {
      const subItem = document.createElement("li");
      subItem.textContent = assessment;
      subList.appendChild(subItem);
    });

    assessmentsItem.appendChild(subList);
    list.appendChild(assessmentsItem);
    wrapper.appendChild(list);
    detailCell.appendChild(wrapper);
  });
}

function normalizeInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getAppDisplay(item) {
  const urlList = item?.inputs?.urlList;
  if (Array.isArray(urlList) && urlList.length > 0) {
    const normalized = urlList
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);
    if (normalized.length > 0) return normalized.join(", ");
  }

  const appName = item?.inputs?.appName;
  if (typeof appName === "string" && appName.trim()) return appName.trim();

  const urlName = item?.inputs?.urlName;
  if (typeof urlName === "string" && urlName.trim()) return urlName.trim();

  return "";
}

function getTypeDisplay(item) {
  const methodologyLabel = getMethodologyDisplay(item);
  if (resolveAssessmentGroupId(item) === OFFENSIVE_GROUP_ID) {
    const testingMode = isTimeBoxedAssessment(item) ? "Time-Boxed" : "Time-Limited";
    return `${testingMode} "${methodologyLabel}" ${item.typeLabel}`;
  }

  if (
    item?.serviceId === "crew_review"
    || item?.type === "crew_review"
    || item?.serviceId === "compliance_support"
    || item?.type === "compliance_support"
  ) {
    return item.typeLabel;
  }

  return methodologyLabel ? `${item.typeLabel} "${methodologyLabel}"` : item.typeLabel;
}

function getMethodologyDisplay(item) {
  const methodology = item?.methodology;
  if (methodology === "blackbox") return "Black-Box";
  if (methodology === "greybox") return "Grey-Box";
  if (methodology === "whitebox") return "White-Box";
  if (methodology === "credentialed") return "Authenticated";
  if (methodology === "non_credentialed") return "Unauthenticated";
  return String(item?.methodologyLabel || "").trim() || "";
}

function getDetailDisplay(item) {
  if (item?.type === "network" || item?.type === "network_va") {
    const ipCount = normalizeInt(item?.inputs?.ipCount);
    if (ipCount > 0) return `${ipCount} IP addresses in-scope`;
  }

  return item?.detailSummary || "-";
}

function isInlineComplianceAssessment(item) {
  return (
    (item?.serviceId === "compliance_support" || item?.type === "compliance_support")
    && Array.isArray(item?.inputs?.scopedRows)
  );
}

function getComplianceSummaryLines(item) {
  return String(item?.detailSummary || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/scoped service row/i.test(line) && !/additional scoping discussion/i.test(line));
}

function normalizeInlineMd(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function buildAssessmentDetailDisplay(item) {
  const typeLabel = getTypeDisplay(item);
  const appDisplay = getAppDisplay(item);
  const detailDisplay = getDetailDisplay(item);
  const detailSummaryHtml = typeof item?.detailSummaryHtml === "string" ? item.detailSummaryHtml : "";
  const detailLines = String(detailDisplay || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletItems = [appDisplay, ...detailLines].filter(Boolean);

  return `
    <div class="assessment-detail-title">${escapeHtml(typeLabel)}</div>
    ${bulletItems.length ? `
      <ul class="assessment-detail-list mb-0">
        ${bulletItems.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
      </ul>
    ` : ""}
    ${detailSummaryHtml}
  `;
}

function isTimeBoxedAssessment(item) {
  if (item?.inputs?.complexity === "large") return true;

  if (item?.type === "network") {
    const ipCount = normalizeInt(item?.inputs?.ipCount);
    return ipCount > 90;
  }

  if (item?.type === "network_va") {
    const ipCount = normalizeInt(item?.inputs?.ipCount);
    const methodology = item?.methodology;
    if (methodology === "credentialed") return ipCount >= 80;
    if (methodology === "non_credentialed") return ipCount > 90;
  }

  return false;
}

function fallbackCopyPlainText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function renderLogicTypeOptions() {
  const logicServices = getLogicServices();
  const selected = document.querySelector("input[name='logicType']:checked")?.value || logicServices[0]?.id || "";

  el.logicTypeOptions.innerHTML = logicServices
    .map((service) => `
      <label class="assessment-type-card option-card ${service.id === selected ? "is-selected" : ""}" for="logicType-${escapeHtml(service.id)}">
        <input class="visually-hidden" type="radio" name="logicType" id="logicType-${escapeHtml(service.id)}" value="${escapeHtml(service.id)}" ${service.id === selected ? "checked" : ""}>
        <span class="assessment-type-title">${escapeHtml(service.logicTitle || service.selectionTitle)}</span>
      </label>
    `)
    .join("");
}

function renderLogicContent() {
  const selected = document.querySelector("input[name='logicType']:checked")?.value || getLogicServices()[0]?.id || "";
  const cardLabels = el.logicTypeOptions.querySelectorAll("label.assessment-type-card");
  cardLabels.forEach((label) => {
    const input = label.querySelector("input[name='logicType']");
    label.classList.toggle("is-selected", Boolean(input?.checked));
  });
  el.logicContent.innerHTML = getLogicFlowHtml(selected);
}

function getLogicFlowHtml(type) {
  const service = getLogicServices().find((entry) => entry.id === type);
  return service?.getLogicHtml?.() || `<div class="text-body-secondary">Logic is not available.</div>`;
}
