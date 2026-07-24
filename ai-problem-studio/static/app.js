"use strict";

// The UI object centralizes every static HTML element used by event handlers and rendering functions.
const ui = {
  // The topbar indicator reflects only local backend health.
  serviceStatus: document.getElementById("serviceStatus"),
  // The message area displays safe text-only success, information, and error notifications.
  messageRegion: document.getElementById("messageRegion"),
  // The settings form persists non-secret Codex Agent endpoint and model choices.
  settingsForm: document.getElementById("settingsForm"),
  // The Codex Agent base URL input supports OpenAI and other Responses-compatible gateways.
  modelBaseUrlInput: document.getElementById("modelBaseUrlInput"),
  // The Codex model input selects the configured Agent model identifier.
  modelNameInput: document.getElementById("modelNameInput"),
  // The password field submits a replacement Codex API key without rendering any existing key value.
  modelApiKeyInput: document.getElementById("modelApiKeyInput"),
  // The badge exposes only whether the backend currently has an API key, never the key itself.
  apiKeyStatus: document.getElementById("apiKeyStatus"),
  // The checkbox explicitly clears the process-only API key instead of interpreting a blank password field as clear.
  clearApiKeyInput: document.getElementById("clearApiKeyInput"),
  // The select controls Codex model_reasoning_effort for compatible reasoning models.
  reasoningEffortInput: document.getElementById("reasoningEffortInput"),
  // The QOJ API base URL input is reused by CAPTCHA, login, and draft export requests.
  qojBaseUrlInput: document.getElementById("qojBaseUrlInput"),
  // The mandatory brief form creates one LangGraph generation job.
  briefForm: document.getElementById("briefForm"),
  // The algorithm list textarea becomes the algorithmRequirements array in the API payload.
  algorithmRequirementsInput: document.getElementById("algorithmRequirementsInput"),
  // The background textarea defines the requested scenario or contest narrative.
  backgroundInput: document.getElementById("backgroundInput"),
  // The assessment textarea becomes the assessmentPoints array in the API payload.
  assessmentPointsInput: document.getElementById("assessmentPointsInput"),
  // The sample assessment textarea becomes the sampleAssessmentPoints array in the API payload.
  sampleAssessmentPointsInput: document.getElementById("sampleAssessmentPointsInput"),
  // The constraints textarea tells the agent the legal data range and intended complexity.
  constraintsInput: document.getElementById("constraintsInput"),
  // The difficulty selector maps directly to QOJ's one-through-five difficulty field.
  difficultyInput: document.getElementById("difficultyInput"),
  // The generate button is disabled while a long-running model and Docker workflow is active.
  generateButton: document.getElementById("generateButton"),
  // The result section remains hidden until a job response exists.
  resultSection: document.getElementById("resultSection"),
  // The job status badge exposes generation, review, failure, or export lifecycle state.
  jobStatusBadge: document.getElementById("jobStatusBadge"),
  // The retry action appears only for a failed job and always creates a distinct generation attempt.
  retryJobButton: document.getElementById("retryJobButton"),
  // The job metadata field shows a stable job ID and timestamps for audit.
  jobMetadata: document.getElementById("jobMetadata"),
  // The progress panel retains real backend workflow events for the current generation job.
  progressPanel: document.getElementById("progressPanel"),
  // The progress list receives one safe DOM row for each persisted SSE event sequence.
  progressList: document.getElementById("progressList"),
  // The report grid holds static, critic, and reference verification results.
  reportGrid: document.getElementById("reportGrid"),
  // The failure region displays an agent/provider failure when no candidate can be shown.
  failureRegion: document.getElementById("failureRegion"),
  // The candidate region contains statement, formats, solution explanation, and reference code.
  candidateRegion: document.getElementById("candidateRegion"),
  // The candidate title displays the generated problem name.
  candidateTitle: document.getElementById("candidateTitle"),
  // The statement preformatted field displays Markdown and LaTeX source safely as text.
  statementOutput: document.getElementById("statementOutput"),
  // The input-format preformatted field displays Markdown and LaTeX source safely as text.
  inputFormatOutput: document.getElementById("inputFormatOutput"),
  // The output-format preformatted field displays Markdown and LaTeX source safely as text.
  outputFormatOutput: document.getElementById("outputFormatOutput"),
  // The solution explanation field displays the generated teaching explanation as source text.
  solutionExplanationOutput: document.getElementById("solutionExplanationOutput"),
  // The reference solution code element displays C++17 source safely as text.
  referenceSolutionOutput: document.getElementById("referenceSolutionOutput"),
  // The test area contains visible and hidden cases with reference-derived outputs.
  testArea: document.getElementById("testArea"),
  // The test table body is populated from the verified reference report.
  testCasesOutput: document.getElementById("testCasesOutput"),
  // The review form persists an explicit human approval decision.
  reviewForm: document.getElementById("reviewForm"),
  // The reviewer name becomes part of the durable local review record.
  reviewerNameInput: document.getElementById("reviewerNameInput"),
  // The review notes field records corrections, evidence, or rejection rationale.
  reviewNotesInput: document.getElementById("reviewNotesInput"),
  // The approval checkbox is the browser control for the mandatory human gate.
  approvalInput: document.getElementById("approvalInput"),
  // The QOJ session badge shows only browser-memory session state.
  qojSessionStatus: document.getElementById("qojSessionStatus"),
  // The session detail explains whether the badge represents a login, pending token, expiration, or connectivity failure.
  qojSessionDetail: document.getElementById("qojSessionDetail"),
  // The QOJ login form forwards one CAPTCHA-protected teacher login request.
  qojLoginForm: document.getElementById("qojLoginForm"),
  // The QOJ username input is cleared only by the user and never persisted by this app.
  qojUsernameInput: document.getElementById("qojUsernameInput"),
  // The password input is immediately cleared after every login attempt.
  qojPasswordInput: document.getElementById("qojPasswordInput"),
  // The CAPTCHA refresh button obtains a fresh QOJ CAPTCHA image and identifier.
  refreshCaptchaButton: document.getElementById("refreshCaptchaButton"),
  // The CAPTCHA image is supplied by QOJ and never stored by the browser script.
  captchaImage: document.getElementById("captchaImage"),
  // The CAPTCHA value input is forwarded only for the next QOJ teacher login request.
  captchaInput: document.getElementById("captchaInput"),
  // The verify session button confirms that the current transient QOJ token is usable.
  verifySessionButton: document.getElementById("verifySessionButton"),
  // The optional manual token input supports a pre-authenticated dedicated QOJ account session.
  manualAccessTokenInput: document.getElementById("manualAccessTokenInput"),
  // The export form collects QOJ-only metadata after human review instead of before AI generation.
  qojExportForm: document.getElementById("qojExportForm"),
  // The optional export title overrides the reviewed Agent title only for the new QOJ draft.
  qojTitleInput: document.getElementById("qojTitleInput"),
  // The optional QOJ folder input is submitted only when the approved draft is created.
  folderIdInput: document.getElementById("folderIdInput"),
  // The access scope selector controls the QOJ draft audience at export time.
  accessScopeInput: document.getElementById("accessScopeInput"),
  // The major ID remains disabled until the author explicitly selects MAJOR access scope.
  majorIdInput: document.getElementById("majorIdInput"),
  // The export button performs QOJ draft creation only after all automatic and human gates pass.
  exportQojButton: document.getElementById("exportQojButton"),
  // The eligibility text tells the author which generation, review, or login gate still blocks export.
  exportEligibility: document.getElementById("exportEligibility"),
  // The export result field displays a QOJ draft or problem identifier after successful creation.
  exportResult: document.getElementById("exportResult"),
};

// The current job ID is kept in page memory and URL hash, never in a token-bearing storage location.
let currentJobId = "";
// The current job object is the rendered server response used by review and export actions.
let currentJob = null;
// The browser tracks whether the backend currently owns a verified server-side QOJ session for this page.
let hasQojServerSession = false;
// The last verified account label lets cleared manual-token input preserve an accurate connected-state explanation.
let activeQojAccountName = "";
// The CAPTCHA ID pairs the visible image with exactly one pending QOJ teacher-login attempt.
let currentCaptchaId = "";
// The active EventSource receives durable progress for only the job currently rendered in the workspace.
let activeProgressStream = null;
// Rendered sequence numbers prevent automatic SSE reconnection from duplicating already visible events.
let renderedProgressSequences = new Set();

/**
 * Send one same-origin JSON request and turn FastAPI errors into useful browser exceptions.
 * @param {string} requestPath The API path beginning with /api.
 * @param {RequestInit} requestOptions Fetch method, body, and optional headers.
 * @returns {Promise<any>} Parsed JSON response body.
 */
async function requestJson(requestPath, requestOptions = {}) {
  // The caller options are copied so content negotiation is consistent without mutating the original object.
  const normalizedOptions = { ...requestOptions };
  // The base headers select JSON while preserving caller-provided headers for future expansion.
  const requestHeaders = {
    Accept: "application/json",
    ...(normalizedOptions.headers || {}),
  };
  if (normalizedOptions.body) {
    requestHeaders["Content-Type"] = "application/json";
  }
  // The browser sends only to this standalone backend, which then calls Codex or QOJ server-to-server.
  const response = await fetch(requestPath, { ...normalizedOptions, headers: requestHeaders });
  // Empty responses are normalized to an object so callers have one predictable result shape.
  const responsePayload = response.status === 204 ? {} : await response.json();
  if (!response.ok) {
    // FastAPI uses detail for validation and upstream-proxy errors; generic fallback avoids blank alerts.
    const errorMessage = responsePayload.detail || responsePayload.message || "请求未成功完成";
    // The status and safe response body allow QOJ session logic to distinguish expiration from a transport failure.
    const requestError = new Error(errorMessage);
    requestError.statusCode = response.status;
    requestError.responsePayload = responsePayload;
    throw requestError;
  }
  return responsePayload;
}

/**
 * Show a text-only notification so server/model output cannot execute as HTML in the browser.
 * @param {string} messageText Notification content.
 * @param {"success"|"error"|"info"} messageType Visual severity class.
 */
function showMessage(messageText, messageType = "info") {
  // The element is created per message so an old error never overwrites a newer action result.
  const messageElement = document.createElement("div");
  messageElement.className = `message ${messageType}`;
  messageElement.textContent = messageText;
  ui.messageRegion.replaceChildren(messageElement);
}

/**
 * Ask Layui to enhance native selects and checkboxes after this script changes their values or visibility.
 * @returns {void} Completion after an available Layui form module redraws its controls.
 */
function renderLayuiForm() {
  // The optional lookup preserves core form usability if a browser cannot load the external CDN.
  const layuiForm = window.layui?.form;
  if (layuiForm) {
    layuiForm.render();
  }
}

/**
 * Register Layui form callbacks for controls whose visual wrappers do not emit a native browser change event.
 * @returns {void} Completion after the available checkbox event bridge has been registered.
 */
function initializeLayuiFormEvents() {
  // Layui supplies the event only after its deferred library script has initialized the form module.
  const layuiForm = window.layui?.form;
  if (layuiForm) {
    layuiForm.on("checkbox(clearApiKey)", () => {
      // The native checked property is already synchronized by Layui before this callback runs.
      syncApiKeyControls();
    });
  }
}

/**
 * Keep a long-running command button stable and prevent duplicate submissions.
 * @param {HTMLButtonElement} buttonElement Button whose busy state is updated.
 * @param {boolean} isBusy Whether the associated operation is currently running.
 * @param {string} busyLabel Short text shown while the operation runs.
 */
function setButtonBusy(buttonElement, isBusy, busyLabel) {
  // The original label is stored only on the DOM node so each button restores independently.
  const originalLabel = buttonElement.dataset.originalLabel || buttonElement.textContent;
  if (!buttonElement.dataset.originalLabel) {
    buttonElement.dataset.originalLabel = originalLabel;
  }
  buttonElement.disabled = isBusy;
  buttonElement.textContent = isBusy ? busyLabel : buttonElement.dataset.originalLabel;
}

/**
 * Convert comma or line-delimited author concepts into a compact API string array.
 * @param {string} rawText Source textarea value.
 * @returns {string[]} Trimmed non-empty concepts in author order.
 */
function parseTextList(rawText) {
  // The delimiter pattern supports the common Chinese and ASCII list separators used in brief entry.
  const rawItems = rawText.split(/[\n,，;；]+/);
  // Blank values are removed before Pydantic receives the list.
  const cleanItems = rawItems.map((itemValue) => itemValue.trim()).filter(Boolean);
  return cleanItems;
}

/**
 * Return an optional positive integer or null for an intentionally blank metadata field.
 * @param {string} rawValue Input element string value.
 * @returns {number|null} Parsed positive integer or null.
 */
function parseOptionalPositiveInteger(rawValue) {
  // The trimmed source distinguishes a blank field from a numeric zero.
  const normalizedValue = rawValue.trim();
  if (!normalizedValue) {
    return null;
  }
  // Number conversion is explicit because form fields always provide strings.
  const parsedValue = Number(normalizedValue);
  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new Error("ID 必须为正整数");
  }
  return parsedValue;
}

/**
 * Load persisted endpoints, model identity, reasoning effort, and safe API-key status into the settings controls.
 * @returns {Promise<void>} Completion after all fields are populated.
 */
async function loadRuntimeSettings() {
  // The server response excludes the provider API key and provides only its configured boolean state.
  const runtimeSettings = await requestJson("/api/settings");
  applyRuntimeSettings(runtimeSettings);
}

/**
 * Apply browser-safe provider settings without exposing or reconstructing the API key.
 * @param {object} runtimeSettings The API response containing endpoint, model, reasoning, and key-state fields.
 * @returns {void} Completion after the settings controls represent the active backend configuration.
 */
function applyRuntimeSettings(runtimeSettings) {
  // Endpoint and model values are non-secret and may be repopulated after a page refresh or save.
  ui.modelBaseUrlInput.value = runtimeSettings.deepseekBaseUrl;
  ui.modelNameInput.value = runtimeSettings.deepseekModel;
  ui.reasoningEffortInput.value = runtimeSettings.reasoningEffort || "";
  ui.qojBaseUrlInput.value = runtimeSettings.qojBaseUrl;
  // The password input is always cleared rather than replacing it with a masked server value.
  ui.modelApiKeyInput.value = "";
  ui.clearApiKeyInput.checked = false;
  setApiKeyConfigurationStatus(Boolean(runtimeSettings.apiKeyConfigured));
  syncApiKeyControls();
}

/**
 * Render the non-secret API-key status and preserve the blank replacement-key input contract.
 * @param {boolean} isConfigured Whether the local backend currently retains a usable provider key.
 * @returns {void} Completion after the badge and input placeholder are synchronized.
 */
function setApiKeyConfigurationStatus(isConfigured) {
  // The status contains no key characters, length, partial mask, or provider-specific fingerprint.
  ui.apiKeyStatus.textContent = isConfigured ? "已配置" : "未配置";
  ui.apiKeyStatus.className = `layui-badge api-key-status${isConfigured ? " is-configured" : ""}`;
  ui.modelApiKeyInput.placeholder = isConfigured ? "已配置，留空则保持当前密钥" : "请输入 API Key";
}

/**
 * Keep the clear-key checkbox and replacement-key field mutually exclusive.
 * @returns {void} Completion after the browser controls and Layui wrappers reflect the selected intent.
 */
function syncApiKeyControls() {
  // A checked clear action cannot be combined with a replacement key in the same form submission.
  const shouldClearApiKey = ui.clearApiKeyInput.checked;
  ui.modelApiKeyInput.disabled = shouldClearApiKey;
  if (shouldClearApiKey) {
    ui.modelApiKeyInput.value = "";
  }
  // Layui redraws its custom checkbox wrapper after native state changes through JavaScript.
  renderLayuiForm();
}

/**
 * Persist editable endpoint, model, reasoning, and optional API-key settings without returning the key to the page.
 * @param {SubmitEvent} submitEvent Form submission event.
 * @returns {Promise<void>} Completion after server validation and save.
 */
async function handleSettingsSubmit(submitEvent) {
  submitEvent.preventDefault();
  // The password field is sent only for this same-origin request and is cleared immediately after success.
  const settingsPayload = {
    deepseekBaseUrl: ui.modelBaseUrlInput.value.trim(),
    deepseekModel: ui.modelNameInput.value.trim(),
    reasoningEffort: ui.reasoningEffortInput.value || null,
    qojBaseUrl: ui.qojBaseUrlInput.value.trim(),
    apiKey: ui.modelApiKeyInput.value.trim() || null,
    clearApiKey: ui.clearApiKeyInput.checked,
  };
  // The submit button is discovered from the form so the HTML remains resilient to layout changes.
  const submitButton = ui.settingsForm.querySelector('button[type="submit"]');
  try {
    setButtonBusy(submitButton, true, "正在保存");
    // Validated settings become defaults for later generation and QOJ requests without exposing the saved key.
    const savedSettings = await requestJson("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settingsPayload),
    });
    applyRuntimeSettings(savedSettings);
    showMessage("连接设置已保存", "success");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    setButtonBusy(submitButton, false, "");
  }
}

/**
 * Build the mandatory first-step author brief in the exact API contract shape.
 * @returns {object} Validatable ProblemBrief request payload.
 */
function buildBriefPayload() {
  // The structured brief is the agent's immutable source of teaching intent.
  const briefPayload = {
    algorithmRequirements: parseTextList(ui.algorithmRequirementsInput.value),
    background: ui.backgroundInput.value.trim(),
    assessmentPoints: parseTextList(ui.assessmentPointsInput.value),
    sampleAssessmentPoints: parseTextList(ui.sampleAssessmentPointsInput.value),
    constraints: ui.constraintsInput.value.trim(),
    difficulty: Number(ui.difficultyInput.value),
  };
  return briefPayload;
}

/**
 * Build QOJ-only metadata only after an approved candidate is ready to become a draft.
 * @returns {object} Validatable QojExportRequest payload.
 */
function buildQojExportPayload() {
  // The selected scope controls whether a major ID is meaningful to the QOJ draft API.
  const accessScope = ui.accessScopeInput.value;
  // The optional major field remains numeric at the API boundary instead of leaving QOJ to parse browser text.
  const majorId = parseOptionalPositiveInteger(ui.majorIdInput.value);
  if (accessScope === "MAJOR" && !majorId) {
    throw new Error("访问范围为 MAJOR 时必须填写专业 ID");
  }
  // Metadata is separate from the generation brief so it never biases or invalidates AI content generation.
  return {
    title: ui.qojTitleInput.value.trim() || null,
    folderId: parseOptionalPositiveInteger(ui.folderIdInput.value),
    accessScope,
    majorId: accessScope === "MAJOR" ? majorId : null,
  };
}

/**
 * Keep the QOJ major-ID control semantically aligned with the selected access scope.
 * @returns {void} Completion after the export metadata controls have been synchronized and redrawn.
 */
function syncQojExportMetadataControls() {
  // Only a major-scoped QOJ draft needs an organization identifier, so irrelevant input is disabled and cleared.
  const needsMajorId = ui.accessScopeInput.value === "MAJOR";
  ui.majorIdInput.disabled = !needsMajorId;
  if (!needsMajorId) {
    ui.majorIdInput.value = "";
  }
  // Layui needs an explicit redraw after native select state changes through JavaScript.
  renderLayuiForm();
}

/**
 * Start one bounded LangGraph job after the author has entered all required teaching intent.
 * @param {SubmitEvent} submitEvent Form submission event.
 * @returns {Promise<void>} Completion after the job is created and its durable event stream is connected.
 */
async function handleBriefSubmit(submitEvent) {
  submitEvent.preventDefault();
  // A locally retained reference distinguishes a failed creation request from a job whose EventSource later reconnects.
  let createdJob = null;
  try {
    // Browser-side construction catches simple missing list values before a paid provider call.
    const briefPayload = buildBriefPayload();
    if (!briefPayload.algorithmRequirements.length || !briefPayload.assessmentPoints.length || !briefPayload.sampleAssessmentPoints.length) {
      throw new Error("算法、考察点和样例考察点均至少需要一项");
    }
    // A new job owns the progress region, so an older reconnecting EventSource cannot append stale events.
    closeProgressStream();
    setGenerationBusy(true);
    // The backend returns immediately after durable job creation; model and Docker work continues in the background.
    createdJob = await requestJson("/api/jobs", {
      method: "POST",
      body: JSON.stringify(briefPayload),
    });
    renderJob(createdJob);
    startProgressStream(createdJob);
  } catch (error) {
    showMessage(error.message, "error");
    // A failed POST produced no durable job, so the author can correct the brief and submit again immediately.
    if (!createdJob) {
      setGenerationBusy(false);
    }
  }
}

/**
 * Create a new generation job from a failed job's immutable original brief without changing the failed audit record.
 * @returns {Promise<void>} Completion after the replacement job has started or its creation error is displayed.
 */
async function handleRetryJob() {
  // The rendered job is captured before the request so a later UI update cannot substitute live form fields for its brief.
  const failedJob = currentJob;
  if (!failedJob || failedJob.status !== "FAILED") {
    showMessage("只有失败的 AI 任务可以再次执行", "error");
    return;
  }
  // The persisted brief is the authoritative retry input and contains no provider key or QOJ credential.
  const retryBrief = failedJob.brief;
  if (!retryBrief) {
    showMessage("失败任务缺少原始出题需求，无法再次执行", "error");
    return;
  }
  // A replacement job is tracked separately so a failed request can leave the original failed task visible and retryable.
  let replacementJob = null;
  try {
    setButtonBusy(ui.retryJobButton, true, "正在创建");
    closeProgressStream();
    setGenerationBusy(true);
    // POST /api/jobs allocates a new immutable job ID and has no QOJ export side effect.
    replacementJob = await requestJson("/api/jobs", {
      method: "POST",
      body: JSON.stringify(retryBrief),
    });
    renderJob(replacementJob);
    startProgressStream(replacementJob);
    showMessage("已按失败任务的原始出题需求创建新的 AI 任务", "info");
  } catch (error) {
    showMessage(error.message, "error");
    // A rejected creation request leaves the failed job available for another retry.
    if (!replacementJob) {
      setGenerationBusy(false);
    }
  } finally {
    setButtonBusy(ui.retryJobButton, false, "");
  }
}

/**
 * Apply the persisted generation lifecycle to the submit control without inventing an estimated completion state.
 * @param {boolean} isGenerating Whether the currently rendered server job is still running.
 * @returns {void} Completion after the button reflects the durable lifecycle.
 */
function setGenerationBusy(isGenerating) {
  // The label signals only that a real background job exists; individual work details remain in streamed event text.
  setButtonBusy(ui.generateButton, isGenerating, "任务进行中");
}

/**
 * Close the currently active EventSource before loading a different job or rendering a terminal result.
 * @returns {void} Completion after the browser has stopped listening to the prior job stream.
 */
function closeProgressStream() {
  if (activeProgressStream) {
    // Closing suppresses EventSource's automatic reconnect after the author starts a different generation job.
    activeProgressStream.close();
    activeProgressStream = null;
  }
}

/**
 * Subscribe to persisted server-sent events for a still-running job and reload its full artifact after the terminal event.
 * @param {object} generationJob Initial or restored GenerationJob response.
 * @returns {void} Completion after the EventSource handlers are registered.
 */
function startProgressStream(generationJob) {
  // Terminal jobs already contain their complete durable event history and do not need a live connection.
  if (!generationJob || generationJob.status !== "GENERATING") {
    return;
  }
  closeProgressStream();
  // The initial cursor avoids replaying events included in the POST/GET response while still allowing fresh events through.
  const afterSequence = highestProgressSequence(generationJob.progressEvents);
  const streamParameters = new URLSearchParams({ afterSequence: String(afterSequence) });
  const streamJobId = generationJob.id;
  const progressStream = new EventSource(`/api/jobs/${encodeURIComponent(streamJobId)}/events?${streamParameters.toString()}`);
  activeProgressStream = progressStream;
  progressStream.addEventListener("progress", (streamEvent) => {
    // A stale stream can receive one buffered event after a new job begins, so the job ID remains the authority.
    if (currentJobId !== streamJobId) {
      return;
    }
    try {
      const progressEvent = JSON.parse(streamEvent.data);
      appendProgressEvent(progressEvent);
    } catch (error) {
      // A malformed local SSE payload is reported without turning model-provided text into HTML.
      showMessage(`无法读取实时进度：${error.message}`, "error");
    }
  });
  progressStream.addEventListener("done", async () => {
    // Terminal notifications for an older hash/job cannot replace the author’s newer workspace state.
    if (currentJobId !== streamJobId) {
      return;
    }
    if (activeProgressStream === progressStream) {
      progressStream.close();
      activeProgressStream = null;
    }
    try {
      // The reload supplies candidate/reports written with the final lifecycle transition after the last progress event.
      const completedJob = await requestJson(`/api/jobs/${encodeURIComponent(streamJobId)}`);
      if (currentJobId === streamJobId) {
        renderJob(completedJob);
      }
    } catch (error) {
      setGenerationBusy(false);
      showMessage(`无法读取生成任务结果：${error.message}`, "error");
    }
  });
  progressStream.addEventListener("error", () => {
    // EventSource retries transient transport failures itself; only a stream for another job is explicitly abandoned.
    if (currentJobId !== streamJobId) {
      progressStream.close();
    }
  });
}

/**
 * Rebuild the visible event log from durable job data so refreshes and reconnects preserve the real work history.
 * @param {object} generationJob API GenerationJob response containing persisted progressEvents.
 * @returns {void} Completion after all valid event sequences are rendered in order.
 */
function renderProgressEvents(generationJob) {
  // A rendered job always has a progress region, including a failed job whose only evidence is a terminal error event.
  ui.progressPanel.classList.remove("is-hidden");
  ui.progressList.replaceChildren();
  renderedProgressSequences = new Set();
  // Older local documents may omit the new field, so a missing list is normalized to an empty event collection.
  const progressEvents = Array.isArray(generationJob.progressEvents) ? generationJob.progressEvents : [];
  const sortedEvents = [...progressEvents].sort((leftEvent, rightEvent) => leftEvent.sequence - rightEvent.sequence);
  sortedEvents.forEach((progressEvent) => appendProgressEvent(progressEvent));
}

/**
 * Append one sequence-unique backend event using DOM text nodes so every model-derived message stays safe to display.
 * @param {object} progressEvent Persisted ProgressEvent data parsed from JSON or an existing job response.
 * @returns {void} Completion after a new event is visible or an invalid/duplicate event is ignored.
 */
function appendProgressEvent(progressEvent) {
  // Sequence validation turns an untrusted network payload into a stable deduplication key before it reaches the DOM.
  const progressSequence = Number(progressEvent?.sequence);
  if (!Number.isInteger(progressSequence) || progressSequence < 1 || renderedProgressSequences.has(progressSequence)) {
    return;
  }
  renderedProgressSequences.add(progressSequence);
  // The view follows new work only when the author is already reading the newest entry and has not scrolled upward.
  const wasReadingLatest = ui.progressList.scrollTop + ui.progressList.clientHeight >= ui.progressList.scrollHeight - 24;
  // The row structure keeps timestamp, phase, and message independently scannable during a long agent run.
  const progressItem = document.createElement("li");
  progressItem.className = `layui-timeline-item progress-event ${progressLevelClass(progressEvent.level)}`;
  const progressAxis = document.createElement("i");
  progressAxis.className = "layui-icon layui-timeline-axis";
  progressAxis.textContent = "\ue63f";
  const progressContent = document.createElement("div");
  progressContent.className = "layui-timeline-content layui-text";
  const progressMeta = document.createElement("div");
  progressMeta.className = "progress-event-meta";
  const progressTime = document.createElement("time");
  progressTime.dateTime = typeof progressEvent.createdAt === "string" ? progressEvent.createdAt : "";
  progressTime.textContent = formatDateTime(progressEvent.createdAt);
  const progressPhase = document.createElement("span");
  progressPhase.className = "progress-event-phase";
  progressPhase.textContent = String(progressEvent.phase || "workflow");
  const progressLevel = document.createElement("span");
  progressLevel.className = "progress-event-level";
  progressLevel.textContent = String(progressEvent.level || "INFO");
  const progressMessage = document.createElement("p");
  progressMessage.className = "progress-event-message";
  progressMessage.textContent = String(progressEvent.message || "");
  progressMeta.append(progressTime, progressPhase, progressLevel);
  progressContent.append(progressMeta, progressMessage);
  progressItem.append(progressAxis, progressContent);
  ui.progressList.append(progressItem);
  if (wasReadingLatest) {
    // The latest real event stays in view during a long workflow without disrupting a manual review of earlier records.
    ui.progressList.scrollTop = ui.progressList.scrollHeight;
  }
  // Keeping currentJob synchronized lets a terminal reload preserve a locally received final event during network races.
  if (currentJob) {
    const existingEvents = Array.isArray(currentJob.progressEvents) ? currentJob.progressEvents : [];
    const alreadyStored = existingEvents.some((storedEvent) => Number(storedEvent.sequence) === progressSequence);
    if (!alreadyStored) {
      currentJob.progressEvents = [...existingEvents, progressEvent];
    }
  }
}

/**
 * Convert the event level contract into a known CSS class without passing arbitrary server text into class names.
 * @param {unknown} eventLevel ProgressEvent level from the local backend.
 * @returns {string} Safe CSS modifier class.
 */
function progressLevelClass(eventLevel) {
  const normalizedLevel = String(eventLevel || "INFO").toLowerCase();
  return ["info", "success", "warning", "error"].includes(normalizedLevel) ? normalizedLevel : "info";
}

/**
 * Find the highest durable event sequence available in a job response before opening an SSE cursor.
 * @param {unknown} progressEvents Potential ProgressEvent array from a current or restored job.
 * @returns {number} Highest valid sequence, or zero when no event has been persisted yet.
 */
function highestProgressSequence(progressEvents) {
  if (!Array.isArray(progressEvents)) {
    return 0;
  }
  // Invalid values are ignored so a malformed historical row cannot prevent valid new events from being streamed.
  return progressEvents.reduce((highestSequence, progressEvent) => {
    const progressSequence = Number(progressEvent?.sequence);
    return Number.isInteger(progressSequence) && progressSequence > highestSequence ? progressSequence : highestSequence;
  }, 0);
}

/**
 * Render every persisted part of one job, including failed verification evidence rather than hiding it.
 * @param {object} generationJob API GenerationJob response.
 */
function renderJob(generationJob) {
  // The current in-memory object is reused only for review and export actions on this page.
  currentJob = generationJob;
  // The ID survives refresh in URL hash without placing a bearer token in browser storage.
  currentJobId = generationJob.id;
  window.location.hash = `job=${encodeURIComponent(currentJobId)}`;
  ui.resultSection.classList.remove("is-hidden");
  // Status class changes expose successful and failed lifecycle states through color and text.
  ui.jobStatusBadge.textContent = generationJob.status;
  ui.jobStatusBadge.className = `layui-badge job-status ${jobStatusClass(generationJob.status)}`;
  // Retrying is available only after a durable failure and is intentionally absent for reviewable or exported artifacts.
  ui.retryJobButton.classList.toggle("is-hidden", generationJob.status !== "FAILED");
  // Timestamps and job IDs let an author correlate a local review with a QOJ DRAFT audit record.
  ui.jobMetadata.textContent = `Job ${generationJob.id} | 创建 ${formatDateTime(generationJob.createdAt)} | 更新 ${formatDateTime(generationJob.updatedAt)}`;
  // Every load and terminal refresh rebuilds the durable event history before any new SSE record is appended.
  renderProgressEvents(generationJob);
  // The create button follows the actual persisted lifecycle, never a frontend timeout or estimated stage count.
  setGenerationBusy(generationJob.status === "GENERATING");
  if (generationJob.status !== "GENERATING") {
    closeProgressStream();
  }
  renderReports(generationJob);
  renderFailure(generationJob.failureReason);
  // Export eligibility follows the persisted job rather than optimistic browser form state.
  syncQojExportEligibility(generationJob);
  // A provider or schema failure can legitimately have no candidate to render.
  const candidate = generationJob.candidate;
  const hasCandidate = Boolean(candidate);
  ui.candidateRegion.classList.toggle("is-hidden", !hasCandidate);
  ui.testArea.classList.toggle("is-hidden", !hasCandidate);
  ui.reviewForm.classList.toggle("is-hidden", !hasCandidate);
  if (candidate) {
    ui.candidateTitle.textContent = candidate.title;
    ui.statementOutput.textContent = candidate.statementMarkdown;
    ui.inputFormatOutput.textContent = candidate.inputFormatMarkdown;
    ui.outputFormatOutput.textContent = candidate.outputFormatMarkdown;
    ui.solutionExplanationOutput.textContent = candidate.solutionExplanationMarkdown;
    ui.referenceSolutionOutput.textContent = candidate.referenceSolutionCpp17;
    renderVerifiedCases(generationJob);
  }
  // Existing review state is loaded so a refreshed page does not accidentally overwrite the prior decision.
  const humanReview = generationJob.humanReview || {};
  ui.reviewerNameInput.value = humanReview.reviewerName || "";
  ui.reviewNotesInput.value = humanReview.notes || "";
  ui.approvalInput.checked = humanReview.approved === true;
  // Layui mirrors the native approval checkbox, so it must redraw after a restored review decision is applied.
  renderLayuiForm();
  renderExportResult(generationJob.qojExport);
}

/**
 * Convert a lifecycle status into a CSS modifier that remains readable without relying only on color.
 * @param {string} lifecycleStatus Job lifecycle status.
 * @returns {string} CSS modifier class.
 */
function jobStatusClass(lifecycleStatus) {
  if (lifecycleStatus === "READY_FOR_REVIEW" || lifecycleStatus === "EXPORTED") {
    return "ready";
  }
  if (lifecycleStatus === "FAILED") {
    return "failed";
  }
  return "";
}

/**
 * Render static, critic, and reference reports in stable columns for fast review scanning.
 * @param {object} generationJob API GenerationJob response.
 */
function renderReports(generationJob) {
  // The report definitions describe both label and JSON property to avoid duplicated layout code.
  const reportDefinitions = [
    { label: "格式校验", report: generationJob.staticReport },
    { label: "独立审题", report: generationJob.criticReview },
    { label: "标程验证", report: generationJob.referenceReport },
  ];
  // Individual report panels are joined only after all text values have been safely escaped.
  const reportPanels = reportDefinitions.map((reportDefinition) => renderReportPanel(reportDefinition));
  ui.reportGrid.innerHTML = reportPanels.join("");
}

/**
 * Create one safe HTML report panel from a static/reference report or critic review object.
 * @param {object} reportDefinition Label and report object.
 * @returns {string} Escaped panel HTML.
 */
function renderReportPanel(reportDefinition) {
  // The arbitrary report object is normalized to a falsy value when an upstream workflow phase did not run.
  const report = reportDefinition.report;
  if (!report) {
    return `<article class="layui-panel report-panel"><h3>${escapeHtml(reportDefinition.label)}</h3><p>未执行</p></article>`;
  }
  // Critic reports use a boolean while deterministic reports use a PASSED/FAILED status string.
  const isPassed = Object.hasOwn(report, "hasCriticalIssues") ? !report.hasCriticalIssues : report.status === "PASSED";
  // Critical issue fields and static errors share one visible list; suggestions stay non-blocking text below.
  const errorItems = report.criticalIssues || report.errors || [];
  const warningItems = report.suggestions || report.warnings || [];
  // Every list item is escaped because errors can include a model-produced compiler message.
  const errorMarkup = errorItems.length
    ? `<ul>${errorItems.map((itemText) => `<li>${escapeHtml(itemText)}</li>`).join("")}</ul>`
    : "<p>无阻断项</p>";
  // Warning markup is optional because a clean report does not need visual filler.
  const warningMarkup = warningItems.length
    ? `<p class="report-warnings">提示：${warningItems.map((itemText) => escapeHtml(itemText)).join("；")}</p>`
    : "";
  // The status wording remains explicit for screen readers and human audit records.
  const stateLabel = isPassed ? "通过" : "未通过";
  return `<article class="layui-panel report-panel ${isPassed ? "passed" : "failed"}"><h3>${escapeHtml(reportDefinition.label)}：${stateLabel}</h3>${errorMarkup}${warningMarkup}</article>`;
}

/**
 * Display a model/provider failure only when the backend could not produce a reviewable candidate.
 * @param {string|null|undefined} failureReason Safe backend failure reason.
 */
function renderFailure(failureReason) {
  if (!failureReason) {
    ui.failureRegion.replaceChildren();
    return;
  }
  // Text content avoids treating an upstream provider response as trusted HTML.
  const failureBox = document.createElement("div");
  failureBox.className = "failure-box";
  failureBox.textContent = displayFailureReason(failureReason);
  ui.failureRegion.replaceChildren(failureBox);
}

/**
 * Derive the first unmet prerequisite that prevents the rendered job from creating a QOJ draft.
 * @param {object|null|undefined} generationJob Persisted generation job used to evaluate export eligibility.
 * @returns {string} Empty only when the job, review, and QOJ session all permit draft export.
 */
function getQojExportBlockReason(generationJob) {
  // No selected job means the operator has not started the AI workflow yet.
  if (!generationJob) {
    return "请先生成并完成审核题目。";
  }
  // A background workflow may not have produced the complete validated artifact required by QOJ.
  if (generationJob.status === "GENERATING") {
    return "AI 任务仍在生成和验证中，完成后才能创建 QOJ 草稿。";
  }
  // A failed model or verification stage must be retried as a new audited generation attempt.
  if (generationJob.status === "FAILED") {
    return "当前 AI 任务失败，请先处理失败原因并点击“再次执行”。";
  }
  // Export is intentionally idempotence-safe: a completed export is recorded rather than recreated.
  if (generationJob.status === "EXPORTED") {
    return "当前任务已创建 QOJ 草稿，无需重复导出。";
  }
  // Any future lifecycle state remains blocked until the backend explicitly exposes it as reviewable.
  if (generationJob.status !== "READY_FOR_REVIEW") {
    return "当前任务尚未达到可审核状态，不能创建 QOJ 草稿。";
  }
  // The human gate remains mandatory even after all deterministic and model-based validation reports pass.
  if (generationJob.humanReview?.approved !== true) {
    return "请先在“人工审核”中勾选批准并记录审核决定。";
  }
  // A verified server-side QOJ session is required because browser JavaScript never holds an access token.
  if (!hasQojServerSession) {
    return "请先登录或验证 QOJ AI 教师账号会话。";
  }
  return "";
}

/**
 * Disable or enable the QOJ export command from durable job, approval, and session state.
 * @param {object|null|undefined} generationJob Persisted generation job currently shown to the author.
 * @returns {void} Completion after the export button and its explanatory state are synchronized.
 */
function syncQojExportEligibility(generationJob) {
  // One centralized reason keeps the visible hint, native disabled state, and submit guard consistent.
  const blockReason = getQojExportBlockReason(generationJob);
  const canExport = !blockReason;
  ui.exportQojButton.disabled = !canExport;
  ui.exportQojButton.title = blockReason;
  ui.exportEligibility.textContent = canExport ? "已满足导出条件，可以创建 QOJ 草稿。" : blockReason;
  ui.exportEligibility.className = `export-eligibility ${canExport ? "is-ready" : "is-blocked"}`;
}

/**
 * Convert a legacy Cloudflare HTML timeout into the same concise guidance used by the current backend.
 * @param {string} failureReason Persisted provider or workflow failure reason.
 * @returns {string} Safe, compact diagnostic text for the task card.
 */
function displayFailureReason(failureReason) {
  // Failed jobs created before the backend fix contain Cloudflare's complete HTML error document.
  const failureText = String(failureReason).trim();
  if (/HTTP\s*524\b/i.test(failureText) && /cloudflare|<html/i.test(failureText)) {
    return "模型 API 网关超时（HTTP 524）：上游服务在完整响应返回前被 Cloudflare 断开。当前为非流式响应，本机的 300 秒等待不能延长网关限制；请将推理强度调低至 high 或 medium、选择更快的模型，或切换到不受该网关限制的 API 地址后再次执行。";
  }
  return failureText;
}

/**
 * Render QOJ-ready visible and hidden cases whose outputs came only from reference execution.
 * @param {object} generationJob API GenerationJob response.
 */
function renderVerifiedCases(generationJob) {
  // Candidate metadata provides sample explanations and hidden-case purpose text.
  const candidate = generationJob.candidate;
  // Reference reports may be absent on a failed job, in which case no output is safe to claim verified.
  const referenceReport = generationJob.referenceReport || {};
  // The verified samples retain the same order as candidate.samples inside the Docker runner.
  const verifiedSamples = referenceReport.verifiedSamples || [];
  // The verified hidden cases carry caseNo, normalized input, and canonical output.
  const verifiedTestCases = referenceReport.verifiedTestCases || [];
  // Sample rows combine agent teaching metadata with Docker-derived output values.
  const sampleRows = verifiedSamples.map((verifiedSample, sampleIndex) => {
    // The optional source sample contributes a reviewer-facing learning focus.
    const sourceSample = candidate.samples[sampleIndex] || {};
    return renderCaseRow("样例", verifiedSample.caseNo, verifiedSample.input, verifiedSample.output, sourceSample.assessmentFocus || verifiedSample.purpose || "");
  });
  // Hidden rows expose purpose locally but QOJ receives only the input/output pair at export time.
  const hiddenRows = verifiedTestCases.map((verifiedCase) =>
    renderCaseRow("隐藏", verifiedCase.caseNo, verifiedCase.input, verifiedCase.output, verifiedCase.purpose || ""),
  );
  // A message makes it clear that non-verified test input is intentionally not displayed as output evidence.
  const rows = [...sampleRows, ...hiddenRows];
  ui.testCasesOutput.innerHTML = rows.length
    ? rows.join("")
    : "<tr><td colspan=\"5\">尚无通过标程验证的测试输出</td></tr>";
}

/**
 * Format one test case as an escaped table row with preformatted input and output cells.
 * @param {string} caseType Visible type label.
 * @param {number} caseNumber QOJ case number.
 * @param {string} inputText Normalized input text.
 * @param {string} outputText Reference-derived expected output text.
 * @param {string} purposeText Human review explanation.
 * @returns {string} Safe HTML table row.
 */
function renderCaseRow(caseType, caseNumber, inputText, outputText, purposeText) {
  return `<tr><td>${escapeHtml(caseType)}</td><td>${escapeHtml(String(caseNumber))}</td><td><pre>${escapeHtml(inputText)}</pre></td><td><pre>${escapeHtml(outputText)}</pre></td><td>${escapeHtml(purposeText)}</td></tr>`;
}

/**
 * Persist the human review decision, which is mandatory even for automatically verified jobs.
 * @param {SubmitEvent} submitEvent Form submission event.
 * @returns {Promise<void>} Completion after the updated job is rendered.
 */
async function handleReviewSubmit(submitEvent) {
  submitEvent.preventDefault();
  if (!currentJobId) {
    showMessage("请先生成题目", "error");
    return;
  }
  // The decision payload is durable audit data and deliberately contains no QOJ credential.
  const reviewPayload = {
    reviewerName: ui.reviewerNameInput.value.trim(),
    approved: ui.approvalInput.checked,
    notes: ui.reviewNotesInput.value.trim(),
  };
  // The form submit control is reused for stable busy feedback.
  const submitButton = ui.reviewForm.querySelector('button[type="submit"]');
  try {
    setButtonBusy(submitButton, true, "正在记录");
    // The backend rejects a job that failed verification before it can receive approval.
    const reviewedJob = await requestJson(`/api/jobs/${encodeURIComponent(currentJobId)}/review`, {
      method: "POST",
      body: JSON.stringify(reviewPayload),
    });
    renderJob(reviewedJob);
    showMessage(reviewPayload.approved ? "人工审核已批准" : "人工审核已记录为未批准", "success");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    setButtonBusy(submitButton, false, "");
  }
}

/**
 * Fetch a fresh QOJ CAPTCHA image and remember its matching identifier only in page memory.
 * @returns {Promise<void>} Completion after the captcha is visible or an error is displayed.
 */
async function loadQojCaptcha() {
  // A blank API address is rejected before a network request that would produce a confusing browser error.
  const qojBaseUrl = ui.qojBaseUrlInput.value.trim();
  if (!qojBaseUrl) {
    throw new Error("请先填写 QOJ API 地址");
  }
  setButtonBusy(ui.refreshCaptchaButton, true, "刷新中");
  try {
    // URLSearchParams safely encodes an operator-supplied QOJ endpoint as a single query value.
    const queryParameters = new URLSearchParams({ qojBaseUrl });
    const captchaPayload = await requestJson(`/api/qoj/captcha?${queryParameters.toString()}`);
    // QOJ implementations use image/imageBase64 naming variants; only a returned data URL/base64 is displayed.
    const captchaImageValue = captchaPayload.imageBase64 || captchaPayload.image || captchaPayload.captchaImage || "";
    const captchaId = captchaPayload.captchaId || "";
    if (!captchaImageValue || !captchaId) {
      throw new Error("QOJ 验证码响应缺少图片或 captchaId");
    }
    // Raw QOJ base64 is converted to a browser data URL, while an existing data URL remains unchanged.
    const imageSource = captchaImageValue.startsWith("data:")
      ? captchaImageValue
      : `data:image/png;base64,${captchaImageValue}`;
    currentCaptchaId = captchaId;
    ui.captchaImage.src = imageSource;
    ui.captchaImage.style.display = "block";
    ui.captchaInput.value = "";
  } catch (error) {
    currentCaptchaId = "";
    ui.captchaImage.removeAttribute("src");
    ui.captchaImage.style.display = "none";
    throw error;
  } finally {
    setButtonBusy(ui.refreshCaptchaButton, false, "");
  }
}

/**
 * Read a friendly account name from the browser-safe QOJ session API response.
 * @param {object} sessionPayload The profile and QOJ host returned after login, restore, or manual-token verification.
 * @returns {string} A safe account label for the visible session state.
 */
function getQojAccountName(sessionPayload) {
  // The profile field is explicit in the new API, while the fallback keeps the renderer compatible with older responses.
  const profilePayload = sessionPayload.profile || sessionPayload;
  return profilePayload.displayName || profilePayload.username || "AI 教师账号";
}

/**
 * Render one verified server-side QOJ session without ever exposing its token values to browser JavaScript.
 * @param {object} sessionPayload The browser-safe local API response containing profile metadata.
 * @param {string} detailPrefix Evidence that explains how the session was established or restored.
 * @returns {void} Completion after the connected QOJ badge and detail have been updated.
 */
function applyConnectedQojSession(sessionPayload, detailPrefix) {
  // The name is kept only for display while the opaque HttpOnly cookie maps to tokens in server memory.
  activeQojAccountName = getQojAccountName(sessionPayload);
  hasQojServerSession = true;
  setQojSessionStatus("已登录", "connected", `${detailPrefix}：${activeQojAccountName}。刷新页面后会自动验证当前会话。`);
  // A previously approved review can become exportable as soon as this browser proves the QOJ teacher session.
  syncQojExportEligibility(currentJob);
}

/**
 * Restore the opaque browser-session cookie after a page refresh and verify its current QOJ teacher identity.
 * @returns {Promise<void>} Completion after the badge reports a restored, absent, expired, or failed session.
 */
async function restoreQojSession() {
  try {
    setQojSessionStatus("正在恢复会话", "checking", "正在验证本地服务保存的 QOJ AI 教师会话。");
    const sessionPayload = await requestJson("/api/qoj/session");
    applyConnectedQojSession(sessionPayload, "已恢复并验证 QOJ AI 教师账号");
  } catch (error) {
    hasQojServerSession = false;
    activeQojAccountName = "";
    // A browser with no session cookie should start quietly in the normal anonymous state.
    if (Number(error?.statusCode) === 401 && /尚未登录/.test(String(error?.message || ""))) {
      setQojSessionStatus("未登录", "anonymous", "尚未建立 AI 教师账号会话。");
      return;
    }
    if (isQojTokenFailure(error)) {
      setQojSessionStatus("令牌已过期", "expired", "QOJ 会话已过期，请重新登录后继续。");
      return;
    }
    setQojSessionStatus("连接异常", "failed", `无法恢复 QOJ 会话：${error.message}`);
  }
}

/**
 * Authenticate a dedicated QOJ teacher account through the current human-entered CAPTCHA.
 * @param {SubmitEvent} submitEvent Form submission event.
 * @returns {Promise<void>} Completion after the backend creates an HttpOnly browser session.
 */
async function handleQojLoginSubmit(submitEvent) {
  submitEvent.preventDefault();
  // Login requires a currently displayed CAPTCHA rather than a stale ID after QOJ invalidates an attempt.
  if (!currentCaptchaId) {
    showMessage("请先刷新验证码", "error");
    return;
  }
  // The login body is sent once to the local backend and is never persisted in browser or SQLite storage.
  const loginPayload = {
    username: ui.qojUsernameInput.value.trim(),
    password: ui.qojPasswordInput.value,
    captchaId: currentCaptchaId,
    captcha: ui.captchaInput.value.trim(),
    qojBaseUrl: ui.qojBaseUrlInput.value.trim(),
  };
  // The submit button shows request progress without allowing password/CAPTCHA duplicate submissions.
  const submitButton = ui.qojLoginForm.querySelector('button[type="submit"]');
  try {
    setButtonBusy(submitButton, true, "正在登录");
    setQojSessionStatus("正在登录", "checking", "正在提交验证码并建立 AI 教师账号会话。");
    const sessionPayload = await requestJson("/api/qoj/login", {
      method: "POST",
      body: JSON.stringify(loginPayload),
    });
    // A successful password login supersedes any manual token and clears sensitive form values immediately.
    ui.manualAccessTokenInput.value = "";
    ui.qojPasswordInput.value = "";
    ui.captchaInput.value = "";
    currentCaptchaId = "";
    ui.captchaImage.removeAttribute("src");
    ui.captchaImage.style.display = "none";
    applyConnectedQojSession(sessionPayload, "AI 教师账号登录成功");
    showMessage("AI 教师账号登录成功", "success");
  } catch (error) {
    setQojSessionStatus("登录失败", "failed", `无法建立 QOJ 登录会话：${error.message}`);
    showMessage(error.message, "error");
    try {
      await loadQojCaptcha();
    } catch (captchaError) {
      showMessage(captchaError.message, "error");
    }
  } finally {
    setButtonBusy(submitButton, false, "");
  }
}

/**
 * Verify the server-side QOJ session or convert a manually pasted temporary token into that session.
 * @returns {Promise<void>} Completion after the badge reflects a verified, expired, or failed state.
 */
async function handleVerifySession() {
  // A manual token is deliberately read only for this validation request and never retained by browser JavaScript.
  const manualAccessToken = ui.manualAccessTokenInput.value.trim();
  try {
    setButtonBusy(ui.verifySessionButton, true, "验证中");
    setQojSessionStatus("正在验证", "checking", "正在向 QOJ 验证 AI 教师身份。");
    let sessionPayload;
    if (manualAccessToken) {
      const manualSessionPayload = {
        accessToken: manualAccessToken,
        qojBaseUrl: ui.qojBaseUrlInput.value.trim(),
      };
      sessionPayload = await requestJson("/api/qoj/manual-session", {
        method: "POST",
        body: JSON.stringify(manualSessionPayload),
      });
      ui.manualAccessTokenInput.value = "";
      applyConnectedQojSession(sessionPayload, "已验证临时 Access Token 对应的教师账号");
    } else {
      sessionPayload = await requestJson("/api/qoj/session");
      applyConnectedQojSession(sessionPayload, "已验证 QOJ AI 教师账号");
    }
    showMessage("QOJ 会话有效", "success");
  } catch (error) {
    if (isQojTokenFailure(error)) {
      markQojTokenExpired(error);
    } else {
      setQojSessionStatus("连接异常", "failed", `无法验证 QOJ 会话：${error.message}`);
    }
    showMessage(error.message, "error");
  } finally {
    setButtonBusy(ui.verifySessionButton, false, "");
  }
}

/**
 * Mark an opaque server-side QOJ session unusable after an authentication failure or expired-token response.
 * @param {Error} error QOJ request error used only for a safe human-readable state detail.
 * @returns {void} Completion after browser-only session display state and manual input have been cleared.
 */
function markQojTokenExpired(error) {
  // The browser owns no QOJ tokens; clearing the optional manual input avoids displaying an already rejected token.
  hasQojServerSession = false;
  activeQojAccountName = "";
  ui.manualAccessTokenInput.value = "";
  // The displayed reason is bounded by the browser error message and never includes any credential value.
  setQojSessionStatus("令牌已过期", "expired", `QOJ 拒绝了当前会话：${error.message}。请重新登录后继续。`);
  // An expired server-side session immediately closes the browser-side export gate as well.
  syncQojExportEligibility(currentJob);
}

/**
 * Identify authentication failures emitted directly by FastAPI or wrapped by the local QOJ proxy.
 * @param {unknown} error Error returned by requestJson, a session restore, or a QOJ request proxy.
 * @returns {boolean} Whether the failed operation demonstrates an expired or invalid authentication token.
 */
function isQojTokenFailure(error) {
  // Direct HTTP statuses are available for local API errors, while QOJ's underlying status appears in proxy text.
  const statusCode = Number(error?.statusCode);
  const errorText = String(error?.message || "").toLowerCase();
  return (
    statusCode === 401 ||
    statusCode === 403 ||
    /\bhttp\s+(401|403)\b/.test(errorText) ||
    /\b(unauthorized|unauthenticated|invalid token|expired token|jwt|authorization)\b/.test(errorText) ||
    /令牌|token|认证失败|登录过期|会话过期/.test(errorText)
  );
}

/**
 * Update the Layui session badge and its explanatory text with a fixed state vocabulary.
 * @param {string} statusText Short visible session state.
 * @param {"anonymous"|"pending"|"checking"|"connected"|"expired"|"failed"} sessionState Stable state used for CSS and accessibility.
 * @param {string} detailText Human-readable evidence or next action for the current state.
 * @returns {void} Completion after the status region has been redrawn.
 */
function setQojSessionStatus(statusText, sessionState, detailText) {
  // Only known state strings reach className so upstream error content cannot alter page styling or markup.
  const knownStates = ["anonymous", "pending", "checking", "connected", "expired", "failed"];
  const safeSessionState = knownStates.includes(sessionState) ? sessionState : "failed";
  ui.qojSessionStatus.textContent = statusText;
  ui.qojSessionStatus.className = `layui-badge session-status is-${safeSessionState}`;
  ui.qojSessionStatus.dataset.sessionState = safeSessionState;
  ui.qojSessionDetail.textContent = detailText;
}

/**
 * Reflect a manually supplied transient token before it is validated, without treating it as an authenticated session.
 * @returns {void} Completion after the session badge reports the current input-backed state.
 */
function handleManualAccessTokenInput() {
  const manualAccessToken = ui.manualAccessTokenInput.value.trim();
  if (manualAccessToken) {
    setQojSessionStatus("令牌待验证", "pending", "已输入临时 Access Token，点击“验证会话”后才能确认登录状态。");
  } else if (hasQojServerSession) {
    setQojSessionStatus("已登录", "connected", `QOJ 已验证教师账号：${activeQojAccountName || "AI 教师账号"}。刷新页面后会自动验证当前会话。`);
  } else {
    setQojSessionStatus("未登录", "anonymous", "尚未建立 AI 教师账号会话。");
  }
}

/**
 * Export the current approved job through QOJ's three-step draft API sequence.
 * @param {SubmitEvent} submitEvent Export-form submission event.
 * @returns {Promise<void>} Completion after a QOJ DRAFT result is persisted and rendered.
 */
async function handleQojExport(submitEvent) {
  submitEvent.preventDefault();
  // The client-side guard avoids sending a known-invalid export request; the backend repeats this enforcement.
  const exportBlockReason = getQojExportBlockReason(currentJob);
  if (exportBlockReason) {
    syncQojExportEligibility(currentJob);
    showMessage(exportBlockReason, "error");
    return;
  }
  try {
    // Export metadata is intentionally collected only after human review, immediately before QOJ draft creation.
    const exportPayload = buildQojExportPayload();
    setButtonBusy(ui.exportQojButton, true, "正在创建草稿");
    setQojSessionStatus("正在验证", "checking", "正在使用已恢复的本地 QOJ 会话确认教师身份并创建草稿。");
    const exportedJob = await requestJson(`/api/jobs/${encodeURIComponent(currentJobId)}/export-qoj`, {
      method: "POST",
      body: JSON.stringify(exportPayload),
    });
    renderJob(exportedJob);
    hasQojServerSession = true;
    setQojSessionStatus("已登录", "connected", "QOJ 已完成草稿创建，当前教师会话仍可用于本浏览器会话中的后续操作。");
    showMessage("QOJ 草稿已创建，状态为 DRAFT", "success");
  } catch (error) {
    if (isQojTokenFailure(error)) {
      markQojTokenExpired(error);
    } else {
      setQojSessionStatus("连接异常", "failed", `无法创建 QOJ 草稿：${error.message}`);
    }
    showMessage(error.message, "error");
  } finally {
    // A successful export becomes EXPORTED, so restoring a busy button must reapply lifecycle eligibility first.
    syncQojExportEligibility(currentJob);
  }
}

/**
 * Render the QOJ export audit payload after a successful DRAFT-only commit.
 * @param {object|null|undefined} qojExport Persisted QOJ export record.
 */
function renderExportResult(qojExport) {
  if (!qojExport) {
    ui.exportResult.textContent = "";
    ui.exportResult.className = "export-result";
    return;
  }
  // QOJ problem fields vary slightly by deployment, so common identifier variants are selected defensively.
  const exportedProblem = qojExport.problem || {};
  const problemId = exportedProblem.id || exportedProblem.problemId || "已创建";
  ui.exportResult.textContent = `QOJ Draft ${qojExport.draftId} | Problem ${problemId} | ${qojExport.publishStatus}`;
  ui.exportResult.className = "export-result success";
}

/**
 * Escape dynamic text before it is inserted into generated report and test-table HTML.
 * @param {unknown} unsafeValue Arbitrary text from a model, compiler, or server response.
 * @returns {string} HTML-safe text.
 */
function escapeHtml(unsafeValue) {
  // String conversion ensures numbers and null values cannot bypass the replacement table.
  const sourceText = String(unsafeValue ?? "");
  // The character map handles all five HTML metacharacters that could change element structure.
  const escapeMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return sourceText.replace(/[&<>"']/g, (characterValue) => escapeMap[characterValue]);
}

/**
 * Render an ISO timestamp in the local browser timezone for practical audit scanning.
 * @param {string} isoTimestamp UTC ISO timestamp from the backend.
 * @returns {string} Localized timestamp or original value on parse failure.
 */
function formatDateTime(isoTimestamp) {
  // Invalid/empty timestamps are preserved as text instead of throwing during a failed-job render.
  const timestampDate = new Date(isoTimestamp);
  if (Number.isNaN(timestampDate.getTime())) {
    return isoTimestamp || "-";
  }
  return timestampDate.toLocaleString();
}

/**
 * Check local backend health without revealing key configuration details to the browser.
 * @returns {Promise<void>} Completion after the topbar status changes.
 */
async function checkHealth() {
  try {
    const healthPayload = await requestJson("/api/health");
    ui.serviceStatus.lastElementChild.textContent = healthPayload.status === "ok" ? "服务已就绪" : "服务异常";
  } catch (error) {
    ui.serviceStatus.lastElementChild.textContent = "服务不可用";
    ui.serviceStatus.querySelector(".status-dot").style.background = "#e46767";
    showMessage(error.message, "error");
  }
}

/**
 * Restore a non-secret job from the URL hash after a browser refresh.
 * @returns {Promise<void>} Completion after the prior job is rendered when available.
 */
async function restoreJobFromHash() {
  // The hash payload does not carry any provider or QOJ token.
  const hashParameters = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  // A missing job parameter simply leaves the workspace ready for new brief input.
  const savedJobId = hashParameters.get("job");
  if (!savedJobId) {
    return;
  }
  try {
    const restoredJob = await requestJson(`/api/jobs/${encodeURIComponent(savedJobId)}`);
    renderJob(restoredJob);
    // A restored in-flight job resumes from its persisted sequence history rather than restarting or simulating stages.
    startProgressStream(restoredJob);
  } catch (error) {
    showMessage(`无法恢复历史任务：${error.message}`, "error");
  }
}

/**
 * Start the raw HTML application after all static DOM elements are available through defer loading.
 * @returns {Promise<void>} Completion after settings, health, and optional job restoration finish.
 */
async function initializeApplication() {
  try {
    // Settings are loaded first because CAPTCHA/login may be requested immediately after page load.
    await loadRuntimeSettings();
    await checkHealth();
    await restoreQojSession();
    await restoreJobFromHash();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

// The settings event persists configurable base URLs and model name.
ui.settingsForm.addEventListener("submit", handleSettingsSubmit);
// The explicit clear toggle controls whether the blank API-key field means preserve or remove.
ui.clearApiKeyInput.addEventListener("change", syncApiKeyControls);
// The Layui callback handles clicks on the rendered checkbox wrapper as well as direct native interactions.
initializeLayuiFormEvents();
// The brief event starts the entire LangGraph workflow.
ui.briefForm.addEventListener("submit", handleBriefSubmit);
// The retry action creates a separate job from the current failed job's persisted author brief.
ui.retryJobButton.addEventListener("click", handleRetryJob);
// The review event records the mandatory human approval or rejection.
ui.reviewForm.addEventListener("submit", handleReviewSubmit);
// The login event forwards credentials and a human CAPTCHA only to QOJ through the local backend.
ui.qojLoginForm.addEventListener("submit", handleQojLoginSubmit);
// The CAPTCHA action loads a fresh image/id pair before teacher login.
ui.refreshCaptchaButton.addEventListener("click", async () => {
  try {
    await loadQojCaptcha();
  } catch (error) {
    showMessage(error.message, "error");
  }
});
// The session action verifies an existing opaque server session or one manually pasted temporary token.
ui.verifySessionButton.addEventListener("click", handleVerifySession);
// The manual token input reports a pending state until QOJ confirms its validity.
ui.manualAccessTokenInput.addEventListener("input", handleManualAccessTokenInput);
// The access-scope change enables the major-ID field only for major-scoped QOJ drafts.
ui.accessScopeInput.addEventListener("change", syncQojExportMetadataControls);
// The export form creates a QOJ DRAFT only after server-side gates revalidate approval.
ui.qojExportForm.addEventListener("submit", handleQojExport);
// The initial session state is explicit so the badge and explanatory text never diverge before the first action.
setQojSessionStatus("未登录", "anonymous", "尚未建立 AI 教师账号会话。");
// The key field begins enabled because an unchecked clear toggle means preserve or replace the active credential.
syncApiKeyControls();
// The initial metadata state disables the irrelevant major-ID field before Layui renders the select control.
syncQojExportMetadataControls();
// Application initialization runs once because this script is loaded with defer at the end of document parsing.
initializeApplication();
