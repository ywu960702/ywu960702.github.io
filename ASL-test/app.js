const SUBMISSION_ENDPOINT = "https://script.google.com/macros/s/AKfycbwczJ8KJ8GgBnC5BArm4TS3-aG0Em6aCSLaf4ELjQGWKqvDHsp4nHh34YTYBHcsnxE9/exec";
const METHODS = ["A", "B", "C"];
const RATINGS = [1, 2, 3, 4, 5];
const FULL_PROGRESS_KEY = "asl-alignment-full-progress-v1";
const FULL_PROGRESS_VERSION = 1;

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
  sessionId: createSessionId(),
  submitting: false,
};

const card = document.querySelector("#study-card");

function createSessionId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

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

function readFullProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(FULL_PROGRESS_KEY) || "null");
    if (!saved || saved.version !== FULL_PROGRESS_VERSION || saved.mode !== "full") return null;

    const answers = {};
    samples.forEach(({ n }) => {
      const source = saved.answers && saved.answers[n];
      if (!source || typeof source !== "object") return;
      const sampleAnswers = {};
      METHODS.forEach((method) => {
        const score = Number(source[method]);
        if (RATINGS.includes(score)) sampleAnswers[method] = score;
      });
      if (Object.keys(sampleAnswers).length) answers[n] = sampleAnswers;
    });

    const currentIndex = Number.isInteger(saved.currentIndex)
      ? Math.min(Math.max(saved.currentIndex, 0), samples.length - 1)
      : 0;
    const played = Array.isArray(saved.played)
      ? saved.played.map(Number).filter((sample) => sample >= 1 && sample <= samples.length)
      : [];

    return {
      version: FULL_PROGRESS_VERSION,
      mode: "full",
      stage: ["participant", "instructions", "sample", "review"].includes(saved.stage)
        ? saved.stage
        : "participant",
      participantId: String(saved.participantId || "").slice(0, 120),
      familiarity: String(saved.familiarity || ""),
      proficiency: String(saved.proficiency || ""),
      answers,
      played,
      currentIndex,
      sessionId: String(saved.sessionId || createSessionId()),
      savedAt: String(saved.savedAt || ""),
    };
  } catch {
    return null;
  }
}

function saveFullProgress(stage) {
  if (state.mode !== "full") return;
  try {
    localStorage.setItem(FULL_PROGRESS_KEY, JSON.stringify({
      version: FULL_PROGRESS_VERSION,
      mode: "full",
      stage,
      participantId: state.participantId,
      familiarity: state.familiarity,
      proficiency: state.proficiency,
      answers: state.answers,
      played: Array.from(state.played),
      currentIndex: state.currentIndex,
      sessionId: state.sessionId,
      savedAt: new Date().toISOString(),
    }));
  } catch {
    // The study remains usable when browser storage is unavailable.
  }
}

function clearFullProgress() {
  try {
    localStorage.removeItem(FULL_PROGRESS_KEY);
  } catch {
    // Ignore storage restrictions after a completed submission.
  }
}

function resetEvaluation(mode) {
  state.mode = mode;
  state.activeSamples = mode === "full" ? samples : samples.slice(0, 2);
  state.participantId = "";
  state.familiarity = "";
  state.proficiency = "";
  state.answers = {};
  state.played = new Set();
  state.currentIndex = 0;
  state.sessionId = createSessionId();
  state.submitting = false;
}

function startNewEvaluation(mode) {
  if (mode === "full") clearFullProgress();
  resetEvaluation(mode);
  saveFullProgress("participant");
  renderParticipant();
}

function restoreFullEvaluation() {
  const saved = readFullProgress();
  if (!saved) {
    startNewEvaluation("full");
    return;
  }

  state.mode = "full";
  state.activeSamples = samples;
  state.participantId = saved.participantId;
  state.familiarity = saved.familiarity;
  state.proficiency = saved.proficiency;
  state.answers = saved.answers;
  state.played = new Set(saved.played);
  state.currentIndex = saved.currentIndex;
  state.sessionId = saved.sessionId;
  state.submitting = false;

  if (!state.participantId || !state.familiarity || !state.proficiency || saved.stage === "participant") {
    renderParticipant();
  } else if (saved.stage === "instructions") {
    renderInstructions();
  } else if (saved.stage === "review" && samples.every(({ n }) => isSampleComplete(n))) {
    renderReview();
  } else {
    renderSample();
  }
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

function renderConsent() {
  renderShell(`
    <div class="title-block centered">
      <span class="section-number">01</span>
      <p class="kicker">Consent information</p>
      <h1>Generated Sign-Text Alignment Evaluation</h1>
      <p class="lead">Thank you for considering this study. Your perspective can help us better understand how clearly generated signing aligns with written text.</p>
    </div>
    <div class="consent-copy">
      <section class="consent-section">
        <h2>What you will do</h2>
        <p>You will watch short comparison videos and rate Method A, Method B, and Method C on a scale from 1 to 5. You may choose the full evaluation with 30 videos or a quick test with 2 videos, and you may replay a video before answering.</p>
      </section>
      <section class="consent-section">
        <h2>What we collect</h2>
        <p>We collect the participant ID provided by the research team, your self-reported ASL familiarity and proficiency, your ratings, and the submission date and time. We do not ask for your name or email address.</p>
      </section>
      <section class="consent-section">
        <h2>Your choice and comfort</h2>
        <p>Taking part is completely voluntary. You may pause, take a break, or leave the page at any time before submitting. The activity involves ordinary screen and video viewing; please stop whenever you feel tired or uncomfortable.</p>
      </section>
      <section class="consent-section">
        <h2>Progress and privacy</h2>
        <p>If you choose the full evaluation, an unfinished draft is saved only in this browser so you can return and continue. After you submit, the draft is removed and your response is stored in the research team's results workbook.</p>
      </section>
      <p class="consent-contact">Questions about the study are welcome. Please contact <a href="mailto:yi.wu-1@ou.edu">yi.wu-1@ou.edu</a>.</p>
      <p class="consent-affirmation">By selecting “I agree to participate,” you confirm that you have read this information and voluntarily choose to take part.</p>
    </div>
    <div class="action-row action-row--center">
      <button class="action action--primary" id="agree-consent" type="button">I agree to participate</button>
      <button class="action action--quiet" id="decline-consent" type="button">I do not agree</button>
    </div>
  `, { wide: true });

  document.querySelector("#agree-consent").addEventListener("click", renderWelcome);
  document.querySelector("#decline-consent").addEventListener("click", renderDeclined);
}

function renderDeclined() {
  renderShell(`
    <div class="centered-message">
      <p class="kicker">Participation declined</p>
      <h1>No response has been recorded.</h1>
      <p>Thank you for taking the time to consider the study. You may close this page now.</p>
      <button class="action action--quiet" id="return-to-consent" type="button">Return to consent information</button>
    </div>
  `);
  document.querySelector("#return-to-consent").addEventListener("click", renderConsent);
}

function renderWelcome() {
  const saved = readFullProgress();
  const completedCount = saved
    ? samples.filter(({ n }) => METHODS.every((method) => RATINGS.includes(Number(saved.answers[n]?.[method])))).length
    : 0;
  const completedWording = completedCount === 1 ? "video has" : "videos have";
  const resumeMarkup = saved
    ? `<section class="resume-panel" aria-label="Saved full evaluation">
        <div class="resume-copy">
          <p class="kicker">Saved full evaluation</p>
          <h2>Continue from video ${saved.currentIndex + 1} of 30</h2>
          <p>${completedCount} ${completedWording} all three ratings completed. Your draft is stored only in this browser.</p>
        </div>
        <div class="resume-actions">
          <button class="action action--primary" id="resume-full" type="button">Continue saved evaluation</button>
          <button class="action action--quiet" id="restart-full" type="button">Restart full evaluation</button>
        </div>
      </section>`
    : "";

  renderShell(`
    <div class="title-block centered">
      <span class="section-number">02</span>
      <p class="kicker">Choose a study length</p>
      <h1>How would you like to participate?</h1>
      <p class="lead">Both options use the same videos and rating scale. Choose the length that works best for you today.</p>
    </div>
    <div class="mode-grid" role="group" aria-label="Evaluation length">
      <button class="mode-choice" id="full-mode" type="button">
        <span class="mode-count">30 videos</span>
        <strong>Full evaluation</strong>
        <small>${saved ? "A saved draft is ready to continue." : "Progress is saved in this browser so you can return later."}</small>
      </button>
      <button class="mode-choice" id="test-mode" type="button">
        <span class="mode-count">2 videos</span>
        <strong>Quick test</strong>
        <small>Check the workflow with a short version.</small>
      </button>
    </div>
    ${resumeMarkup}
    <p class="quiet-note">Participation is voluntary. You may stop at any time before submitting.</p>
  `, { wide: true });

  document.querySelector("#full-mode").addEventListener("click", () => {
    if (saved) restoreFullEvaluation();
    else startNewEvaluation("full");
  });
  document.querySelector("#test-mode").addEventListener("click", () => startNewEvaluation("test2"));
  document.querySelector("#resume-full")?.addEventListener("click", restoreFullEvaluation);
  document.querySelector("#restart-full")?.addEventListener("click", () => {
    if (window.confirm("Delete the saved full-evaluation draft and start again?")) {
      startNewEvaluation("full");
    }
  });
}

function renderParticipant() {
  renderShell(`
    <div class="title-block">
      <span class="section-number">03</span>
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
    saveFullProgress("instructions");
    renderInstructions();
  });
}

function renderInstructions() {
  renderShell(`
    <div class="title-block">
      <span class="section-number">04</span>
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
    saveFullProgress("sample");
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
    saveFullProgress("sample");
    updateNextState();
  }, { once: true });

  document.querySelectorAll(".score-option input").forEach((input) => {
    input.addEventListener("change", () => {
      const method = input.name.split("-").at(-1);
      getSampleAnswers(sample.n)[method] = Number(input.value);
      saveFullProgress("sample");
      updateNextState();
    });
  });

  document.querySelector("#previous-step").addEventListener("click", () => {
    if (state.currentIndex === 0) {
      saveFullProgress("instructions");
      renderInstructions();
    }
    else {
      state.currentIndex -= 1;
      saveFullProgress("sample");
      renderSample();
    }
  });

  next.addEventListener("click", () => {
    if (state.currentIndex === state.activeSamples.length - 1) renderReview();
    else {
      state.currentIndex += 1;
      saveFullProgress("sample");
      renderSample();
    }
  });
}

function renderReview() {
  const scoreCount = state.activeSamples.length * METHODS.length;
  saveFullProgress("review");
  renderShell(`
    <div class="title-block">
      <span class="section-number">05</span>
      <div>
        <p class="kicker">Final review</p>
        <h1>Ready to submit</h1>
      </div>
    </div>
    <dl class="review-list">
      <div><dt>Study mode</dt><dd>${modeLabel()} (${state.activeSamples.length} videos)</dd></div>
      <div><dt>Participant ID</dt><dd>${escapeHtml(state.participantId)}</dd></div>
      <div><dt>Ratings completed</dt><dd>${scoreCount} of ${scoreCount}</dd></div>
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
  button.textContent = "Submitting...";

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
    if (state.mode === "full") clearFullProgress();
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
      <p>Your response was recorded successfully. You may now close this page.</p>
      <button class="action action--quiet" id="start-over" type="button">Start another response</button>
    </div>
  `);
  document.querySelector("#start-over").addEventListener("click", () => window.location.reload());
}

renderConsent();
