import { loadProject, resetProject, saveProject } from "./storage.js";
import { startWebAppWizard } from "./webapp.js";

let state = loadProject();
let addModal;
let logicModal;
let currentWizardCleanup = null;

const el = {
  btnAddAssessment: document.getElementById("btnAddAssessment"),
  btnShowLogic: document.getElementById("btnShowLogic"),
  btnDownloadCsv: document.getElementById("btnDownloadCsv"),
  btnDownloadImage: document.getElementById("btnDownloadImage"),
  btnResetProject: document.getElementById("btnResetProject"),
  table: document.getElementById("assessmentTable"),
  tableBody: document.getElementById("assessmentTableBody"),
  tableTotalMandays: document.getElementById("tableTotalMandays"),
  modal: document.getElementById("addAssessmentModal"),
  modalBody: document.getElementById("addAssessmentModalBody"),
  modalTitle: document.getElementById("addAssessmentModalTitle"),
  logicModal: document.getElementById("logicModal"),
  logicTypeSelect: document.getElementById("logicTypeSelect"),
  logicContent: document.getElementById("logicContent"),
};

initApp();

export function initApp() {
  addModal = new bootstrap.Modal(el.modal);
  logicModal = new bootstrap.Modal(el.logicModal);
  el.modal.addEventListener("hidden.bs.modal", () => {
    if (typeof currentWizardCleanup === "function") {
      currentWizardCleanup();
      currentWizardCleanup = null;
    }
    el.modalBody.innerHTML = "";
  });

  el.btnAddAssessment.addEventListener("click", openAddModal);
  el.btnShowLogic.addEventListener("click", openLogicModal);
  el.btnDownloadCsv.addEventListener("click", downloadTableAsCsv);
  el.btnDownloadImage.addEventListener("click", downloadTableAsImage);
  el.btnResetProject.addEventListener("click", confirmAndResetProject);
  el.logicTypeSelect.addEventListener("change", renderLogicContent);

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
        <td colspan="10" class="text-center text-body-secondary py-4">No assessments added yet.</td>
      </tr>
    `;
    return;
  }

  el.tableBody.innerHTML = nextState.assessments
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.typeLabel)}</td>
          <td>${escapeHtml(item.methodologyLabel)}</td>
          <td>${escapeHtml(getAppDisplay(item))}</td>
          <td>${escapeHtml(item.detailSummary)}</td>
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

function downloadTableAsCsv() {
  const csv = buildExportCsv(state);
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `scoping-table-${getDateStamp()}.csv`);
  URL.revokeObjectURL(url);
}

async function downloadTableAsImage() {
  try {
    if (typeof window.html2canvas !== "function") {
      window.alert("Image download is not available in this browser.");
      return;
    }

    const canvas = await window.html2canvas(el.table, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });

    const url = canvas.toDataURL("image/png");
    triggerDownload(url, `scoping-table-${getDateStamp()}.png`);
  } catch (_error) {
    window.alert("Unable to download image.");
  }
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
  const appName = item?.inputs?.appName;
  if (typeof appName === "string" && appName.trim()) return appName.trim();

  const urlName = item?.inputs?.urlName;
  if (typeof urlName === "string" && urlName.trim()) return urlName.trim();

  const firstListItem = item?.inputs?.urlList?.[0];
  if (typeof firstListItem === "string" && firstListItem.trim()) return firstListItem.trim();

  return "-";
}

function buildExportCsv(nextState) {
  const headers = [
    "No",
    "Type",
    "Methodology",
    "App Name/URL",
    "Detail",
    "Initial (MD)",
    "Reporting (MD)",
    "Retest (MD)",
    "Total (MD)",
  ];

  const lines = [headers.map(escapeCsv).join(",")];
  nextState.assessments.forEach((item, index) => {
    lines.push(
      [
        index + 1,
        item.typeLabel,
        item.methodologyLabel,
        getAppDisplay(item),
        item.detailSummary,
        normalizeInt(item.md?.initial),
        normalizeInt(item.md?.reporting),
        normalizeInt(item.md?.retest),
        normalizeInt(item.md?.total),
      ]
        .map(escapeCsv)
        .join(","),
    );
  });

  const grandTotal = nextState.assessments.reduce((acc, item) => acc + normalizeInt(item?.md?.total), 0);
  lines.push(["", "", "", "", "", "", "", "Total Mandays", grandTotal].map(escapeCsv).join(","));
  return lines.join("\n");
}

function escapeCsv(value) {
  const text = String(value ?? "");
  const escaped = text.replaceAll('"', '""');
  return `"${escaped}"`;
}

function triggerDownload(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

function getDateStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function renderLogicContent() {
  const selected = el.logicTypeSelect.value;
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
