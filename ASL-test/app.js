const SUBMISSION_ENDPOINT = "https://script.google.com/macros/s/AKfycbwczJ8KJ8GgBnC5BArm4TS3-aG0Em6aCSLaf4ELjQGWKqvDHsp4nHh34YTYBHcsnxE9/exec";
const RESULT_EMAIL = "yi.wu-1@ou.edu";
const METHODS = ["A", "B", "C"];
const RATINGS = [1, 2, 3, 4, 5];

const samples = [
  { n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }, { n: 5 }, { n: 6 },
  { n: 7 }, { n: 8 }, { n: 9 }, { n: 10 }, { n: 11 }, { n: 12 },
  { n: 13 }, { n: 14 }, { n: 15 }, { n: 16 }, { n: 17 }, { n: 18 },
  { n: 19 }, { n: 20 }, { n: 21 }, { n: 22 }, { n: 23 }, { n: 24 },
  { n: 25 }, { n: 26 }, { n: 27 }, { n: 28 }, { n: 29 }, { n: 30 },
];

const state = {
  mode: "",
  activeSamples: [],
  participantId: "",
  familiarity: "",
  proficiency: "",
  answers: {},
  played: new Set(),
  currentIndex: 0,
  sessionId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  submitting: false,
};

const card = document.querySelector("#study-card");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function videoPath(sample) {
  return `videos/sample-${String(sample).padStart(2, "0")}.mp4`;
}

function modeLabel() {
  return state.mode === "full" ? "Full evaluation" : "Quick test";
}

function renderShell(content, options = {}) {
  const progress = options.progress;
  const progressHeader = Number.isFinite(progress)
    ? `<header class="study-progress" aria-label="Study progress">
        <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
        <span>${Math.round(progress)}%</span>
      </header>`
    : "";

  card.className = options.wide ? "study-card study-card--wide" : "study-card";
  card.innerHTML = `${progressHeader}${content}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderWelcome() {
  renderShell(`
    <div class="title-block centered">
      <span class="section-number">01</span>
      <p class="kicker">Choose a study length</p>
      <h1>Generated Sign-Text Alignment Evaluation</h1>
      <p class="lead">Watch comparison videos and rate how closely each generated signing method matches the text.</p>
    </div>
    <div class="mode-grid" role="group" aria-label="Evaluation length">
      <button class="mode-choice" id="full-mode" type="button">
        <span class="mode-count">30 videos</span>
        <strong>Full evaluation</strong>
        <small>Complete the full study.</small>
      </button>
      <button class="mode-choice" id="test-mode" type="button">
        <span class="mode-count">2 videos</span>
        <strong>Quick test</strong>
        <small>Check the workflow with a short version.</small>
      </button>
    </div>
    <p class="quiet-note">Participation is voluntary. You may stop at any time before submitting.</p>
  `, { wide: true });

  document.querySelector("#full-mode").addEventListener("click", () => selectMode("full"));
  document.querySelector("#test-mode").addEventListener("click", () => selectMode("test2"));
}

function selectMode(mode) {
  state.mode = mode;
  state.activeSamples = mode === "full" ? samples : samples.slice(0, 2);
  state.answers = {};
  state.played = new Set();
  state.currentIndex = 0;
  renderParticipant();
}

function renderParticipant() {
  renderShell(`
    <div class="title-block">
      <span class="section-number">02</span>
      <div>
        <p class="kicker">Participant information</p>
        <h1>Before you begin</h1>
        <p class="lead compact-lead">${modeLabel()} selected. No participant name is collected.</p>
      </div>
    </div>
    <form id="participant-form" class="participant-form">
      <label class="field-label" for="participant-id">Participant ID</label>
      <input id="participant-id" type="text" maxlength="120"
        placeholder="Enter the ID provided by the research team"
        value="${escapeHtml(state.participantId)}" required>

      <fieldset class="question-block">
        <legend>Are you familiar with American Sign Language (ASL)?</legend>
        <div class="choice-row">
          ${["Yes", "No"].map((option) => `
            <label class="choice-pill">
              <input type="radio" name="familiarity" value="${option}"
                ${state.familiarity === option ? "checked" : ""} required>
              <span>${option}</span>
            </label>`).join("")}
        </div>
      </fieldset>

      <fieldset class="question-block">
        <legend>How would you describe your ASL proficiency?</legend>
        <div class="choice-row choice-row--wrap">
          ${["Native or near-native", "Advanced", "Intermediate", "Beginner", "No ASL knowledge"]
            .map((option) => `
              <label class="choice-pill">
                <input type="radio" name="proficiency" value="${option}"
                  ${state.proficiency === option ? "checked" : ""} required>
                <span>${option}</span>
              </label>`).join("")}
        </div>
      </fieldset>

      <p id="participant-error" class="status-line status-line--error" hidden></p>
      <div class="action-row action-row--split">
        <button class="action action--quiet" id="back-to-mode" type="button">Back</button>
        <button class="action action--primary" type="submit">Continue</button>
      </div>
    </form>
  `);

  document.querySelector("#back-to-mode").addEventListener("click", renderWelcome);
  document.querySelector("#participant-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    state.participantId = document.querySelector("#participant-id").value.trim();
    state.familiarity = String(formData.get("familiarity") || "");
    state.proficiency = String(formData.get("proficiency") || "");

    if (!state.participantId || !state.familiarity || !state.proficiency) {
      const error = document.querySelector("#participant-error");
      error.textContent = "Please complete all three fields.";
      error.hidden = false;
      return;
    }
    renderInstructions();
  });
}

function renderInstructions() {
  renderShell(`
    <div class="title-block">
      <span class="section-number">03</span>
      <div>
        <p class="kicker">How to rate</p>
        <h1>Use one score for each method</h1>
      </div>
    </div>
    <p class="lead">Watch the complete video, then rate Method A, Method B, and Method C independently.</p>
    <div class="scale-line" aria-label="Rating scale from 1 to 5">
      <span><strong>1</strong> Not aligned at all</span>
      <span><strong>3</strong> Moderately aligned</span>
      <span><strong>5</strong> Completely aligned</span>
    </div>
    <ul class="procedure-list">
      <li>You may replay each video.</li>
      <li>Multiple methods may receive the same score.</li>
      <li>All three scores are required before continuing.</li>
    </ul>
    <div class="action-row action-row--split">
      <button class="action action--quiet" id="back-to-participant" type="button">Back</button>
      <button class="action action--primary" id="begin-evaluation" type="button">Begin evaluation</button>
    </div>
  `);

  document.querySelector("#back-to-participant").addEventListener("click", renderParticipant);
  document.querySelector("#begin-evaluation").addEventListener("click", () => {
    state.currentIndex = 0;
    renderSample();
  });
}

function getSampleAnswers(sampleNumber) {
  if (!state.answers[sampleNumber]) state.answers[sampleNumber] = {};
  return state.answers[sampleNumber];
}

function isSampleComplete(sampleNumber) {
  const answers = getSampleAnswers(sampleNumber);
  return METHODS.every((method) => RATINGS.includes(Number(answers[method])));
}

function ratingMarkup(sampleNumber, method) {
  const answers = getSampleAnswers(sampleNumber);
  return `
    <fieldset class="method-row">
      <legend>Method ${method}</legend>
      <div class="score-control" role="radiogroup" aria-label="Method ${method} score">
        ${RATINGS.map((score) => `
          <label class="score-option" title="Score ${score}">
            <input type="radio" name="sample-${sampleNumber}-${method}" value="${score}"
              ${Number(answers[method]) === score ? "checked" : ""}>
            <span>${score}</span>
          </label>`).join("")}
      </div>
    </fieldset>`;
}

function renderSample() {
  const sample = state.activeSamples[state.currentIndex];
  const progress = Math.round(((state.currentIndex + 1) / (state.activeSamples.length + 1)) * 100);
  const completed = isSampleComplete(sample.n);
  const played = state.played.has(sample.n);

  renderShell(`
    <div class="trial-heading">
      <div>
        <p class="kicker">${modeLabel()}</p>
        <h1>Video ${state.currentIndex + 1} of ${state.activeSamples.length}</h1>
      </div>
      <span class="sample-id">Sample ${sample.n}</span>
    </div>
    <div class="video-shell">
      <video id="sample-video" aria-label="Comparison video for sample ${sample.n}"
        controls muted playsinline preload="metadata" src="${videoPath(sample.n)}">
        Your browser does not support embedded MP4 video.
      </video>
    </div>
    <p class="scale-hint"><strong>1</strong> Not aligned at all <span></span> <strong>5</strong> Completely aligned</p>
    <div class="method-list">
      ${METHODS.map((method) => ratingMarkup(sample.n, method)).join("")}
    </div>
    <p id="sample-status" class="status-line">${played ? "Video played." : "Play the video before continuing."}</p>
    <div class="action-row action-row--split">
      <button class="action action--quiet" id="previous-step" type="button">Back</button>
      <button class="action action--primary" id="next-step" type="button"
        ${played && completed ? "" : "disabled"}>
        ${state.currentIndex === state.activeSamples.length - 1 ? "Review responses" : "Next video"}
      </button>
    </div>
  `, { progress, wide: true });

  const video = document.querySelector("#sample-video");
  const next = document.querySelector("#next-step");
  const status = document.querySelector("#sample-status");

  function updateNextState() {
    const ready = state.played.has(sample.n) && isSampleComplete(sample.n);
    next.disabled = !ready;
    status.textContent = ready
      ? "All three scores are complete."
      : state.played.has(sample.n)
        ? "Select one score for each method."
        : "Play the video before continuing.";
  }

  video.addEventListener("play", () => {
    state.played.add(sample.n);
    updateNextState();
  }, { once: true });

  document.querySelectorAll(".score-option input").forEach((input) => {
    input.addEventListener("change", () => {
      const method = input.name.split("-").at(-1);
      getSampleAnswers(sample.n)[method] = Number(input.value);
      updateNextState();
    });
  });

  document.querySelector("#previous-step").addEventListener("click", () => {
    if (state.currentIndex === 0) renderInstructions();
    else {
      state.currentIndex -= 1;
      renderSample();
    }
  });

  next.addEventListener("click", () => {
    if (state.currentIndex === state.activeSamples.length - 1) renderReview();
    else {
      state.currentIndex += 1;
      renderSample();
    }
  });
}

function renderReview() {
  const scoreCount = state.activeSamples.length * METHODS.length;
  renderShell(`
    <div class="title-block">
      <span class="section-number">04</span>
      <div>
        <p class="kicker">Final review</p>
        <h1>Ready to submit</h1>
      </div>
    </div>
    <dl class="review-list">
      <div><dt>Study mode</dt><dd>${modeLabel()} (${state.activeSamples.length} videos)</dd></div>
      <div><dt>Participant ID</dt><dd>${escapeHtml(state.participantId)}</dd></div>
      <div><dt>Ratings completed</dt><dd>${scoreCount} of ${scoreCount}</dd></div>
      <div><dt>Results delivery</dt><dd>Excel workbook emailed to ${RESULT_EMAIL}</dd></div>
    </dl>
    <p id="submit-error" class="status-line status-line--error" hidden></p>
    <div class="action-row action-row--split">
      <button class="action action--quiet" id="back-to-last" type="button">Back</button>
      <button class="action action--primary" id="submit-results" type="button">Submit results</button>
    </div>
  `, { progress: 100 });

  document.querySelector("#back-to-last").addEventListener("click", () => {
    state.currentIndex = state.activeSamples.length - 1;
    renderSample();
  });
  document.querySelector("#submit-results").addEventListener("click", submitResults);
}

async function submitResults() {
  if (state.submitting) return;
  const button = document.querySelector("#submit-results");
  const error = document.querySelector("#submit-error");
  error.hidden = true;

  if (SUBMISSION_ENDPOINT.includes("__APPS_SCRIPT")) {
    error.textContent = "The response service is not connected yet.";
    error.hidden = false;
    return;
  }

  state.submitting = true;
  button.disabled = true;
  button.textContent = "Sending...";

  const payload = {
    version: 2,
    sessionId: state.sessionId,
    submittedAt: new Date().toISOString(),
    mode: state.mode,
    participantId: state.participantId,
    familiarity: state.familiarity,
    proficiency: state.proficiency,
    answers: state.answers,
  };

  try {
    await fetch(SUBMISSION_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    renderComplete();
  } catch {
    state.submitting = false;
    button.disabled = false;
    button.textContent = "Submit results";
    error.textContent = "The results could not be sent. Check your connection and try again.";
    error.hidden = false;
  }
}

function renderComplete() {
  renderShell(`
    <div class="completion-mark" aria-hidden="true">OK</div>
    <div class="centered-message">
      <p class="kicker">Submission complete</p>
      <h1>Thank you for completing the evaluation.</h1>
      <p>Your response was recorded. The latest Excel workbook is being emailed to ${RESULT_EMAIL}.</p>
      <button class="action action--quiet" id="start-over" type="button">Start another response</button>
    </div>
  `);
  document.querySelector("#start-over").addEventListener("click", () => window.location.reload());
}

renderWelcome();
