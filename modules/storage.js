const STORAGE_KEY = "scopingProject";
const DEFAULT_STATE = Object.freeze({
  version: "1.0",
  assessments: [],
});

export function loadProject() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneDefault();

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("Invalid state");

    const assessments = Array.isArray(parsed.assessments) ? parsed.assessments : [];
    return {
      version: typeof parsed.version === "string" ? parsed.version : DEFAULT_STATE.version,
      assessments,
    };
  } catch (_error) {
    resetProject();
    return cloneDefault();
  }
}

export function saveProject(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetProject() {
  localStorage.removeItem(STORAGE_KEY);
}

function cloneDefault() {
  return {
    version: DEFAULT_STATE.version,
    assessments: [],
  };
}
