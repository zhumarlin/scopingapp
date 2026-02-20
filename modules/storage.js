const STORAGE_KEY = "scopingProject";
const STORAGE_VERSION = "1.1";
const DEFAULT_STATE = Object.freeze({
  version: STORAGE_VERSION,
  assessments: [],
});

export function loadProject() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneDefault();

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("Invalid state");
    if (parsed.version !== STORAGE_VERSION) throw new Error("Version mismatch");

    if (!Array.isArray(parsed.assessments)) throw new Error("Invalid assessments shape");
    const assessments = parsed.assessments;
    return {
      version: STORAGE_VERSION,
      assessments,
    };
  } catch (_error) {
    resetProject();
    return cloneDefault();
  }
}

export function saveProject(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: STORAGE_VERSION,
    assessments: Array.isArray(state?.assessments) ? state.assessments : [],
  }));
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
