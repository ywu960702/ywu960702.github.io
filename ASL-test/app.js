const formEndpoint =
  "https://docs.google.com/forms/d/e/1FAIpQLSeUJ_aOHjd4Bl0iKHAE_Vh_X4UScqd3_UP1kP0Yi3Ud7_OTBg/formResponse";

const participantEntry = "747785341";
const familiarityEntry = "101509960";
const proficiencyEntry = "580743664";

const ratings = [
  { score: 1, label: "Not aligned at all", value: "1 \u2014 Not aligned at all" },
  { score: 2, label: "Slightly aligned", value: "2 \u2014 Slightly aligned" },
  { score: 3, label: "Moderately aligned", value: "3 \u2014 Moderately aligned" },
  { score: 4, label: "Well aligned", value: "4 \u2014 Well aligned" },
  { score: 5, label: "Completely aligned", value: "5 \u2014 Completely aligned" },
];

const samples = [
  { n: 1, entries: { A: "1528364991", B: "609670683", C: "1513250008" } },
  { n: 2, entries: { A: "516305822", B: "1992036312", C: "1010857658" } },
  { n: 3, entries: { A: "1384397939", B: "337808088", C: "1466988148" } },
  { n: 4, entries: { A: "1512549686", B: "1645784889", C: "1678896126" } },
  { n: 5, entries: { A: "529756573", B: "1381329523", C: "532971934" } },
  { n: 6, entries: { A: "1102084549", B: "184009412", C: "1168277656" } },
  { n: 7, entries: { A: "1696184201", B: "1647060227", C: "215669029" } },
  { n: 8, entries: { A: "1212010733", B: "124159197", C: "843166521" } },
  { n: 9, entries: { A: "1243174572", B: "1328671152", C: "1755075817" } },
  { n: 10, entries: { A: "1884358613", B: "1552676893", C: "428159799" } },
  { n: 11, entries: { A: "479833574", B: "1005942399", C: "1497886207" } },
  { n: 12, entries: { A: "111092163", B: "946977052", C: "221139436" } },
  { n: 13, entries: { A: "1144841792", B: "1316052078", C: "776668256" } },
  { n: 14, entries: { A: "1862909936", B: "214196372", C: "1961016701" } },
  { n: 15, entries: { A: "1658573837", B: "565903525", C: "2101097341" } },
  { n: 16, entries: { A: "1777527172", B: "65973017", C: "932782269" } },
  { n: 17, entries: { A: "1002748724", B: "487460333", C: "2039361957" } },
  { n: 18, entries: { A: "43590863", B: "1782086015", C: "183941265" } },
  { n: 19, entries: { A: "309892260", B: "1300749314", C: "1512759730" } },
  { n: 20, entries: { A: "1747836422", B: "1283493014", C: "2144731777" } },
  { n: 21, entries: { A: "1202594469", B: "142368287", C: "1451355542" } },
  { n: 22, entries: { A: "2009499642", B: "1594346278", C: "1212592773" } },
  { n: 23, entries: { A: "1100971715", B: "1278734927", C: "66558015" } },
  { n: 24, entries: { A: "2033675001", B: "520175322", C: "699087461" } },
  { n: 25, entries: { A: "1202666874", B: "721459622", C: "1529801713" } },
  { n: 26, entries: { A: "1581275395", B: "390827257", C: "1491217462" } },
  { n: 27, entries: { A: "1927634369", B: "21828340", C: "1429210650" } },
  { n: 28, entries: { A: "1813873609", B: "812553446", C: "2007409174" } },
  { n: 29, entries: { A: "1288304941", B: "2061594453", C: "1517516970" } },
  { n: 30, entries: { A: "815150177", B: "336131899", C: "291443491" } },
];

const methods = ["A", "B", "C"];
const answers = {};
const totalRatings = samples.length * methods.length;

const form = document.querySelector("#evaluation");
const samplesContainer = document.querySelector("#samples");
const participantId = document.querySelector("#participant-id");
const progressBar = document.querySelector("#progress-bar");
const progressFill = document.querySelector("#progress-fill");
const ratingCount = document.querySelector("#rating-count");
const submitButton = document.querySelector("#submit-button");
const errorMessage = document.querySelector("#error-message");
const successMessage = document.querySelector("#success-message");
let submitting = false;

function answerKey(sample, method) {
  return `${sample}-${method}`;
}

function videoPath(sample) {
  return `videos/sample-${String(sample).padStart(2, "0")}.mp4`;
}

function selectedValue(name) {
  return form.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function isReady() {
  return Boolean(
    participantId.value.trim() &&
      selectedValue("familiarity") &&
      selectedValue("proficiency") &&
      Object.keys(answers).length === totalRatings &&
      !submitting,
  );
}

function updateProgress() {
  const answered = Object.keys(answers).length;
  const progress = Math.round((answered / totalRatings) * 100);
  ratingCount.textContent = `${answered} / ${totalRatings} ratings complete`;
  progressFill.style.width = `${progress}%`;
  progressBar.setAttribute("aria-label", `${progress}% complete`);
  submitButton.disabled = !isReady();
}

function createRating(sample, method, rating) {
  const label = document.createElement("label");
  label.className = "rating";

  const input = document.createElement("input");
  input.type = "radio";
  input.name = `sample-${sample}-${method}`;
  input.value = rating.value;
  input.required = true;
  input.addEventListener("change", () => {
    answers[answerKey(sample, method)] = rating.value;
    label.closest(".rating-row").querySelectorAll(".rating").forEach((item) => {
      item.classList.toggle("selected", item.contains(input));
    });
    updateProgress();
  });

  const score = document.createElement("strong");
  score.textContent = String(rating.score);
  const description = document.createElement("span");
  description.textContent = rating.label;

  label.append(input, score, description);
  return label;
}

function createSample(sample) {
  const article = document.createElement("article");
  article.className = "sample-card";

  const header = document.createElement("div");
  header.className = "sample-head";
  header.innerHTML = `
    <div>
      <span>Sample ${sample.n} of ${samples.length}</span>
      <h2>Rate semantic alignment after watching the complete video.</h2>
    </div>
  `;

  const videoShell = document.createElement("div");
  videoShell.className = "video-shell";
  const video = document.createElement("video");
  video.setAttribute("aria-label", `Comparison video for sample ${sample.n}`);
  video.controls = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = videoPath(sample.n);
  video.textContent = "Your browser does not support embedded MP4 video.";
  videoShell.append(video);

  const methodGrid = document.createElement("div");
  methodGrid.className = "method-grid";
  methods.forEach((method) => {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "method";
    const legend = document.createElement("legend");
    legend.textContent = `Method ${method}`;
    const ratingRow = document.createElement("div");
    ratingRow.className = "rating-row";
    ratings.forEach((rating) => ratingRow.append(createRating(sample.n, method, rating)));
    fieldset.append(legend, ratingRow);
    methodGrid.append(fieldset);
  });

  article.append(header, videoShell, methodGrid);
  return article;
}

samples.forEach((sample) => samplesContainer.append(createSample(sample)));
participantId.addEventListener("input", updateProgress);
form.querySelectorAll('input[name="familiarity"], input[name="proficiency"]').forEach((input) => {
  input.addEventListener("change", updateProgress);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  successMessage.hidden = true;

  if (!isReady()) {
    errorMessage.textContent =
      "Please complete participant information and all 90 ratings before submitting.";
    errorMessage.hidden = false;
    return;
  }

  const payload = new FormData();
  payload.set(`entry.${participantEntry}`, participantId.value.trim());
  payload.set(`entry.${familiarityEntry}`, selectedValue("familiarity"));
  payload.set(`entry.${proficiencyEntry}`, selectedValue("proficiency"));

  samples.forEach((sample) => {
    methods.forEach((method) => {
      payload.set(`entry.${sample.entries[method]}`, answers[answerKey(sample.n, method)]);
    });
  });

  submitting = true;
  submitButton.textContent = "Submitting...";
  updateProgress();

  try {
    await fetch(formEndpoint, { method: "POST", body: payload, mode: "no-cors" });
    successMessage.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch {
    errorMessage.textContent =
      "Submission did not complete. Please check your network connection and try again.";
    errorMessage.hidden = false;
  } finally {
    submitting = false;
    submitButton.textContent = "Submit evaluation";
    updateProgress();
  }
});

updateProgress();
