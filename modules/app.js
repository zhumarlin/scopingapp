import { loadProject, resetProject, saveProject } from "./storage.js";
import { startWebAppWizard } from "./assessment-wizard.js";

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
  tableTotalMandays: document.getElementById("tableTotalMandays"),
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
  el.btnCopyTable.addEventListener("click", copyTableToClipboard);
  el.btnResetProject.addEventListener("click", confirmAndResetProject);
  el.logicTypeOptions.addEventListener("change", renderLogicContent);

  el.tableBody.addEventListener("click", (event) => {
    const editButton = event.target.closest("button[data-edit-id]");
    if (editButton) {
      openEditModal(editButton.dataset.editId);
      return;
    }

    const button = event.target.closest("button[data-delete-id]");
    if (!button) return;

    deleteAssessment(button.dataset.deleteId);
  });

  renderTable(state);
  renderTotals(state);
  renderLogicContent();
}

export function renderTable(nextState) {
  if (!nextState.assessments.length) {
    el.tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-body-secondary py-4">No assessments added yet.</td>
      </tr>
    `;
    return;
  }

  el.tableBody.innerHTML = nextState.assessments
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${buildAssessmentDetailDisplay(item)}</td>
          <td>${item.md.initial}</td>
          <td>${item.md.reporting}</td>
          <td>${item.md.retest}</td>
          <td>${item.md.total}</td>
          <td>
            <button type="button" class="btn btn-sm btn-outline-primary me-1" data-edit-id="${escapeHtml(item.id)}">Edit</button>
            <button type="button" class="btn btn-sm btn-outline-danger" data-delete-id="${escapeHtml(item.id)}">Delete</button>
          </td>
        </tr>
      `,
    )
    .join("");
}

export function renderTotals(nextState) {
  const grandTotal = nextState.assessments.reduce((acc, item) => acc + normalizeInt(item?.md?.total), 0);
  el.tableTotalMandays.textContent = String(grandTotal);
}

export function openAddModal() {
  el.modalTitle.textContent = "Add Assessment";
  if (typeof currentWizardCleanup === "function") {
    currentWizardCleanup();
    currentWizardCleanup = null;
  }

  currentWizardCleanup = startWebAppWizard({
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

  currentWizardCleanup = startWebAppWizard({
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
  renderLogicContent();
  logicModal.show();
}

function openSupportChooser() {
  supportModal.show();
}

function openSupportMailClient() {
  supportModal.hide();
  const to = "cyberops-offsec-scopi-aaaap2qp5dqwjqgktzj6rgej2i@bitdefender.slack.com";
  const subject = "OffSec Services Scoping Calculator Query";
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
  const subject = "OffSec Services Scoping Calculator Query";
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

async function copyTableToClipboard() {
  const copyableTable = buildCopyableTable(el.table);
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
  const actionColumnIndex = getActionColumnIndex(clonedTable);

  if (actionColumnIndex >= 0) {
    removeLogicalColumn(clonedTable, actionColumnIndex);
  }

  // Inline styles preserve visible borders when pasted into Word.
  clonedTable.style.borderCollapse = "collapse";
  clonedTable.style.border = "1px solid #2f2f2f";
  clonedTable.style.width = "100%";
  clonedTable.querySelectorAll("th, td").forEach((cell) => {
    cell.style.border = "1px solid #2f2f2f";
    cell.style.padding = "6px 8px";
    cell.style.verticalAlign = "middle";
  });
  centerCopiedTableColumns(clonedTable);

  return clonedTable;
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
  // Copied columns (after removing Action): 1=No, 2=Assessment Detail, 3..6=MD fields.
  const columnsToCenter = new Set([1, 3, 4, 5, 6]);
  const rows = Array.from(tableEl.querySelectorAll("thead tr, tbody tr, tfoot tr"));

  rows.forEach((row) => {
    let logicalColumn = 1;
    for (const cell of Array.from(row.children)) {
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

function setCopyStatus(message) {
  if (!el.copyTableStatus) return;
  el.copyTableStatus.textContent = message;

  if (copyStatusTimer) {
    clearTimeout(copyStatusTimer);
  }
  copyStatusTimer = window.setTimeout(() => {
    el.copyTableStatus.textContent = "";
    copyStatusTimer = null;
  }, 2500);
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
  const testingMode = isTimeBoxedAssessment(item) ? "Time-Boxed" : "Time-Limited";
  const methodologyLabel = getMethodologyDisplay(item);
  return `${testingMode} "${methodologyLabel}" ${item.typeLabel}`;
}

function getMethodologyDisplay(item) {
  const methodology = item?.methodology;
  if (methodology === "blackbox") return "Black-Box";
  if (methodology === "greybox") return "Grey-Box";
  if (methodology === "whitebox") return "White-Box";
  if (methodology === "credentialed") return "Authenticated";
  if (methodology === "non_credentialed") return "Unauthenticated";
  return String(item?.methodologyLabel || "").trim() || "Unknown";
}

function getDetailDisplay(item) {
  if (item?.type === "network" || item?.type === "network_va") {
    const ipCount = normalizeInt(item?.inputs?.ipCount);
    if (ipCount > 0) return `${ipCount} IP addresses in-scope`;
  }

  return item?.detailSummary || "-";
}

function buildAssessmentDetailDisplay(item) {
  const typeLabel = getTypeDisplay(item);
  const appDisplay = getAppDisplay(item);
  const detailDisplay = getDetailDisplay(item);

  const bulletItems = [
    appDisplay ? appDisplay : "",
    detailDisplay,
  ].filter(Boolean);

  return `
    <div class="assessment-detail-title">${escapeHtml(typeLabel)}</div>
    <ul class="assessment-detail-list mb-0">
      ${bulletItems.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
    </ul>
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

function renderLogicContent() {
  const selected = document.querySelector("input[name='logicType']:checked")?.value || "webapp";
  const cardLabels = el.logicTypeOptions.querySelectorAll("label.assessment-type-card");
  cardLabels.forEach((label) => {
    const input = label.querySelector("input[name='logicType']");
    label.classList.toggle("is-selected", Boolean(input?.checked));
  });
  el.logicContent.innerHTML = getLogicFlowHtml(selected);
}

function getLogicFlowHtml(type) {
  if (type === "webapp") {
    return `
      <div class="logic-flow">
        <div class="logic-node decision">Start -> IF methodology = blackbox?</div>
        <div class="logic-arrow">↓ yes</div>
        <div class="logic-branch">
          <div class="logic-node decision">IF targetMode = multiple?</div>
          <div class="logic-arrow">↓ yes</div>
          <div class="logic-node">initial = urlCount; reporting = ceil(initial * 0.3); retest = ceil((initial + reporting) * 0.25)</div>
          <div class="logic-arrow">↓ no</div>
          <div class="logic-node decision">IF login=yes AND selfRegister=yes?</div>
          <div class="logic-arrow">↓ yes</div>
          <div class="logic-node">initial = 3; reporting = 1; retest = 1</div>
          <div class="logic-arrow">↓ no</div>
          <div class="logic-node">initial = 1; reporting = 1; retest = 1</div>
        </div>
        <div class="logic-arrow">↓ no (greybox/whitebox)</div>
        <div class="logic-node">Greybox: small=(2,1,1), medium=(5,1,1), large=(9,1,2)</div>
        <div class="logic-node">Whitebox: initial = ceil(greybox.initial * 1.2), reporting/retest same as greybox</div>
        <div class="logic-node outcome">total = initial + reporting + retest</div>
      </div>
    `;
  }

  if (type === "mobile_pt") {
    return `
      <div class="logic-flow">
        <div class="logic-node decision">IF methodology = blackbox?</div>
        <div class="logic-arrow">↓ yes</div>
        <div class="logic-node">initial = 3; reporting = 1; retest = 1</div>
        <div class="logic-arrow">↓ no (greybox/whitebox)</div>
        <div class="logic-node decision">IF OS = both?</div>
        <div class="logic-arrow">↓ yes</div>
        <div class="logic-node">Greybox map: small=(5,1,1), medium=(7,1,1), large=(9,1,2)</div>
        <div class="logic-arrow">↓ no (one OS)</div>
        <div class="logic-node">Greybox map: small=(4,1,1), medium=(6,1,1), large=(8,1,2)</div>
        <div class="logic-node decision">IF methodology = whitebox?</div>
        <div class="logic-arrow">↓ yes</div>
        <div class="logic-node">initial = ceil(greybox.initial * 1.2); reporting/retest same as greybox</div>
        <div class="logic-node outcome">total = initial + reporting + retest</div>
      </div>
    `;
  }

  if (type === "network_pt") {
    return `
      <div class="logic-flow">
        <div class="logic-node">methodology = Black-box (fixed)</div>
        <div class="logic-node">initial = min(9, ceil(ipCount / 10)); reporting = 1</div>
        <div class="logic-node decision">IF initial &lt; 8?</div>
        <div class="logic-arrow">↓ yes</div>
        <div class="logic-node">retest = 1</div>
        <div class="logic-arrow">↓ no</div>
        <div class="logic-node">retest = 2</div>
        <div class="logic-node outcome">total = initial + reporting + retest</div>
      </div>
    `;
  }

  if (type === "network_va_credentialed") {
    return `
      <div class="logic-flow">
        <div class="logic-node">methodology = Credentialed</div>
        <div class="logic-node">initial = min(9, ceil(ipCount / 8.8))</div>
        <div class="logic-node">reporting = ceil(initial * 0.25)</div>
        <div class="logic-node">retest = min(4, ceil(initial / 2))</div>
        <div class="logic-node outcome">total = initial + reporting + retest</div>
      </div>
    `;
  }

  return `
    <div class="logic-flow">
      <div class="logic-node">methodology = Non-Credentialed</div>
      <div class="logic-node">Use same formula as Network Penetration Test</div>
      <div class="logic-node">initial = min(9, ceil(ipCount / 10)); reporting = 1</div>
      <div class="logic-node decision">IF initial &lt; 8?</div>
      <div class="logic-arrow">↓ yes</div>
      <div class="logic-node">retest = 1</div>
      <div class="logic-arrow">↓ no</div>
      <div class="logic-node">retest = 2</div>
      <div class="logic-node outcome">total = initial + reporting + retest</div>
    </div>
  `;
}
