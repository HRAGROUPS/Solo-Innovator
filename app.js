/**
 * Adaptive Yoga Coach — Client-side Pose Analysis & Alignment MVP
 * Upgrade 1: Credibility + Computer Vision Intelligence
 * Vanilla JS, MediaPipe Pose via CDN, Chart.js, LocalStorage, Web Speech API
 */

// --- DOM Elements ---
const views = {
  onboarding: document.getElementById('onboardingView'),
  sessionPrep: document.getElementById('sessionPrepView'),
  camera: document.getElementById('cameraView'),
  summary: document.getElementById('summaryView'),
  progress: document.getElementById('progressView'),
};

const navPracticeBtn = document.getElementById('navPracticeBtn');
const navProgressBtn = document.getElementById('navProgressBtn');
const navProfileBtn = document.getElementById('navProfileBtn');
const voiceCoachToggleBtn = document.getElementById('voiceCoachToggleBtn');
const voiceIcon = document.getElementById('voiceIcon');
const voiceStatusText = document.getElementById('voiceStatusText');

// Voice Coach State (Web Speech API)
let isVoiceCoachEnabled = true;
let lastSpokenText = '';
let lastSpokenTimestamp = 0;

function speakCoachCue(text) {
  if (!isVoiceCoachEnabled || !('speechSynthesis' in window)) return;
  const now = Date.now();
  // Prevent duplicate spoken cues within 5 seconds
  if (text === lastSpokenText && now - lastSpokenTimestamp < 5000) return;
  // Prevent any spoken cue if another was spoken in last 3 seconds
  if (now - lastSpokenTimestamp < 3000) return;

  try {
    window.speechSynthesis.cancel(); // cancel previous unfinished queue
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // calm, mindful pacing
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    lastSpokenText = text;
    lastSpokenTimestamp = now;
  } catch (e) {
    console.warn('Speech synthesis error:', e);
  }
}

if (voiceCoachToggleBtn) {
  voiceCoachToggleBtn.addEventListener('click', () => {
    isVoiceCoachEnabled = !isVoiceCoachEnabled;
    voiceIcon.textContent = isVoiceCoachEnabled ? '🔊' : '🔇';
    voiceStatusText.textContent = isVoiceCoachEnabled ? 'ON' : 'OFF';
    if (isVoiceCoachEnabled) {
      speakCoachCue('Voice coach active.');
    }
  });
}

// Onboarding elements
const onboardingForm = document.getElementById('onboardingForm');
const userNameInput = document.getElementById('userName');
const userGoalInput = document.getElementById('userGoal');
const userExperienceInput = document.getElementById('userExperience');
const userDurationInput = document.getElementById('userDuration');

// Session Prep elements
const whyExplanationText = document.getElementById('whyExplanationText');
const startPracticeBtn = document.getElementById('startPracticeBtn');

// Camera / Practice elements
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const cameraPrompt = document.getElementById('cameraPrompt');
const resumeCameraBtn = document.getElementById('resumeCameraBtn');

const livePill = document.getElementById('livePill');
const livePillText = document.getElementById('livePillText');
const liveScoreDisplay = document.getElementById('liveScoreDisplay');
const scoreGrade = document.getElementById('scoreGrade');
const feedbackBanner = document.getElementById('feedbackBanner');
const feedbackIcon = document.getElementById('feedbackIcon');
const feedbackText = document.getElementById('feedbackText');
const feedbackSub = document.getElementById('feedbackSub');
const deltaBadge = document.getElementById('deltaBadge');
const deltaBadgeText = document.getElementById('deltaBadgeText');

const frontKneeAngleDisplay = document.getElementById('frontKneeAngleDisplay');
const kneeAnkleOffsetDisplay = document.getElementById('kneeAnkleOffsetDisplay');
const kneeAnkleOffsetTarget = document.getElementById('kneeAnkleOffsetTarget');
const shoulderTiltDisplay = document.getElementById('shoulderTiltDisplay');
const stanceDisplay = document.getElementById('stanceDisplay');
const frontLegLabel = document.getElementById('frontLegLabel');
const sessionTimer = document.getElementById('sessionTimer');
const timerGoalLabel = document.getElementById('timerGoalLabel');
const endSessionBtn = document.getElementById('endSessionBtn');

// Summary elements
const sumBeforeScore = document.getElementById('sumBeforeScore');
const sumBeforeHint = document.getElementById('sumBeforeHint');
const sumAfterScore = document.getElementById('sumAfterScore');
const sumAfterHint = document.getElementById('sumAfterHint');
const sumDeltaScore = document.getElementById('sumDeltaScore');
const sumDeltaLabel = document.getElementById('sumDeltaLabel');
const sumDeltaHint = document.getElementById('sumDeltaHint');
const sumFocusArea = document.getElementById('sumFocusArea');
const sumFocusHint = document.getElementById('sumFocusHint');
const summarySubtitle = document.getElementById('summarySubtitle');
const viewProgressFromSummaryBtn = document.getElementById('viewProgressFromSummaryBtn');
const practiceAgainBtn = document.getElementById('practiceAgainBtn');

// Progress elements
const newSessionBtn = document.getElementById('newSessionBtn');
const progressInsightText = document.getElementById('progressInsightText');
const historyTableBody = document.getElementById('historyTableBody');
let progressChartInstance = null;

// --- State Variables ---
let camera = null;
let pose = null;
let isCameraRunning = false;
let sessionTimerInterval = null;
let sessionSecondsElapsed = 0;

// Debounce & Valid Frame Thresholds
const DEBOUNCE_THRESHOLD = 5; // Require 5 consecutive frames before shifting feedback
const MIN_VALID_FRAMES = 15;   // Require at least 15 verified frames (~0.5s at 30fps) for a scored session

// Session Measurement State
let validFrameCount = 0;
let currentFeedbackState = 'neutral'; // 'neutral' | 'warn' | 'good' | 'out_of_frame'
let activeFeedbackCategory = null;   // 'knee_ankle' | 'knee_open' | 'knee_closed' | 'shoulder' | 'good'
let pendingFeedbackCategory = null;
let pendingFeedbackFrames = 0;

let baselineBeforeScore = null;
let correctedAfterScore = null;
let latestMeasuredScore = null;
let peakScoreThisSession = 0;
let lastCalculatedDelta = null;

// Tally of detected issues for dynamic focusArea determination
let issueTally = {
  kneeAnkle: 0,
  kneeAngle: 0,
  shoulder: 0,
  good: 0,
};

// MediaPipe Landmark Mapping
const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

// --- Storage Helpers (100% Real User Data, Zero Fake Demos) ---
const STORAGE_KEYS = {
  USER_PROFILE: 'adaptive_yoga_user_profile',
  SESSIONS: 'adaptive_yoga_sessions',
};

function getUserProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Failed to load user profile:', e);
    return null;
  }
}

function saveUserProfile(profile) {
  localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
}

function getStoredSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    let sessions = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(sessions)) {
      return [];
    }

    // Filter out any legacy demo or invalid sessions — NO fake data allowed
    const cleaned = sessions.filter(s => 
      s && 
      typeof s === 'object' && 
      s.afterScore !== undefined && 
      !s.isDemo && 
      !String(s.id).startsWith('demo-')
    );

    // If legacy demo sessions were cleaned out, persist the clean array
    if (cleaned.length !== sessions.length) {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(cleaned));
    }

    return cleaned;
  } catch (e) {
    console.error('Failed to load sessions:', e);
    return [];
  }
}

function saveSessionRecord(record) {
  const sessions = getStoredSessions();
  sessions.push(record);
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
}

// --- Session State Reset ---
function resetSessionState() {
  validFrameCount = 0;
  currentFeedbackState = 'neutral';
  activeFeedbackCategory = null;
  pendingFeedbackCategory = null;
  pendingFeedbackFrames = 0;

  baselineBeforeScore = null;
  correctedAfterScore = null;
  latestMeasuredScore = null;
  peakScoreThisSession = 0;
  lastCalculatedDelta = null;

  issueTally = {
    kneeAnkle: 0,
    kneeAngle: 0,
    shoulder: 0,
    good: 0,
  };

  if (deltaBadge) {
    deltaBadge.style.display = 'none';
  }
  if (liveScoreDisplay) liveScoreDisplay.textContent = '--';
  if (scoreGrade) {
    scoreGrade.textContent = 'Stand in frame';
    scoreGrade.style.color = '#38bdf8';
  }
  if (frontKneeAngleDisplay) frontKneeAngleDisplay.textContent = '--°';
  if (kneeAnkleOffsetDisplay) {
    kneeAnkleOffsetDisplay.textContent = '--%';
    kneeAnkleOffsetDisplay.style.color = '#f8fafc';
  }
  if (kneeAnkleOffsetTarget) {
    kneeAnkleOffsetTarget.textContent = 'target ≤12%';
  }
  if (shoulderTiltDisplay) {
    shoulderTiltDisplay.textContent = '--°';
    shoulderTiltDisplay.style.color = '#f8fafc';
  }
  if (stanceDisplay) {
    stanceDisplay.textContent = 'Detecting...';
    stanceDisplay.style.color = '#64748b';
  }
  if (frontLegLabel) frontLegLabel.textContent = 'auto-detect';

  if (feedbackBanner) feedbackBanner.className = 'feedback-banner state-neutral';
  if (feedbackIcon) feedbackIcon.textContent = '🧘';
  if (feedbackText) feedbackText.textContent = 'Step into the camera frame to begin alignment tracking';
  if (feedbackSub) feedbackSub.textContent = 'Ensure your full body from shoulders to ankles is visible';
}

// --- View Router ---
function switchView(viewName) {
  Object.keys(views).forEach(key => {
    views[key].style.display = (key === viewName) ? 'block' : 'none';
  });

  navPracticeBtn.classList.toggle('active', ['sessionPrep', 'camera', 'summary'].includes(viewName));
  navProgressBtn.classList.toggle('active', viewName === 'progress');

  if (viewName === 'progress') {
    renderProgressView();
  }
}

// --- Dynamic Explanation & Adaptive Difficulty Logic ---
function updateWhyExplanation(level) {
  const sessions = getStoredSessions();
  const hasHistory = sessions.length > 0;
  const latestSession = hasHistory ? sessions[sessions.length - 1] : null;
  const recentScore = latestSession ? latestSession.afterScore : null;

  // Adaptive difficulty adjustment based strictly on real past performance
  if (recentScore !== null && recentScore >= 82) {
    whyExplanationText.innerHTML = 
      `<strong>Adaptive Progression:</strong> Based on your verified alignment score (<strong>${recentScore}/100</strong>) in your last session, today's practice advances to sustained endurance: focus on deepening your front thigh parallel to the floor while maintaining steady knee-over-ankle stack.`;
    return;
  }

  if (level === 'advanced') {
    whyExplanationText.textContent = 
      "For advanced practice, we're focusing on micro-adjustments: maintaining a clean 90° front knee bend while stabilizing the shoulder horizontal line to maximize hip openness and core engagement.";
  } else if (level === 'intermediate') {
    whyExplanationText.textContent = 
      "As an intermediate practitioner, today's practice emphasizes joint alignment: keeping the front knee securely stacked over the ankle while lengthening through both arms.";
  } else {
    // beginner
    whyExplanationText.textContent = 
      "Since you're a beginner, we're starting with a shorter hold to build alignment awareness first. Focus on keeping your front knee stacked over your ankle before sinking deeper into the lunge.";
  }
}

// --- Math & 2D Landmark Geometry Helpers ---
function calculateAngle2D(p1, p2, p3) {
  if (!p1 || !p2 || !p3) return 0;
  const v1x = p1.x - p2.x;
  const v1y = p1.y - p2.y;
  const v2x = p3.x - p2.x;
  const v2y = p3.y - p2.y;

  const dot = v1x * v2x + v1y * v2y;
  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);

  if (mag1 === 0 || mag2 === 0) return 0;

  // Strict clamp to [-1.0, 1.0] to safeguard against float precision domain errors in Math.acos
  const cosVal = Math.max(-1.0, Math.min(1.0, dot / (mag1 * mag2)));
  return Math.round((Math.acos(cosVal) * 180) / Math.PI);
}

function calculateHorizontalAngle(p1, p2) {
  if (!p1 || !p2) return 0;
  const dx = Math.abs(p2.x - p1.x);
  const dy = Math.abs(p2.y - p1.y);
  if (dx === 0 && dy === 0) return 0;
  return Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
}

// --- Warrior II Landmark Geometry & Pose Analysis ---
function analyzeWarriorIIPose(landmarks) {
  const keyNodes = [
    LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER,
    LM.LEFT_HIP, LM.RIGHT_HIP,
    LM.LEFT_KNEE, LM.RIGHT_KNEE,
    LM.LEFT_ANKLE, LM.RIGHT_ANKLE,
  ];

  let totalVis = 0;
  for (const idx of keyNodes) {
    totalVis += (landmarks[idx]?.visibility ?? 1.0);
  }
  const avgVis = totalVis / keyNodes.length;

  // Confidence gating: reject frames where key joints are hidden or out of frame
  if (avgVis < 0.55) {
    return { confidenceSufficient: false };
  }

  const lShoulder = landmarks[LM.LEFT_SHOULDER];
  const rShoulder = landmarks[LM.RIGHT_SHOULDER];
  const lHip = landmarks[LM.LEFT_HIP];
  const rHip = landmarks[LM.RIGHT_HIP];
  const lKnee = landmarks[LM.LEFT_KNEE];
  const rKnee = landmarks[LM.RIGHT_KNEE];
  const lAnkle = landmarks[LM.LEFT_ANKLE];
  const rAnkle = landmarks[LM.RIGHT_ANKLE];

  // Knee angles
  const lKneeAngle = calculateAngle2D(lHip, lKnee, lAnkle);
  const rKneeAngle = calculateAngle2D(rHip, rKnee, rAnkle);

  // Determine front bent leg (smaller angle corresponds to bent knee)
  let frontLeg = 'left';
  let frontKneeAngle = lKneeAngle;
  let rearKneeAngle = rKneeAngle;
  let frontKneePt = lKnee;
  let frontAnklePt = lAnkle;

  if (rKneeAngle < lKneeAngle) {
    frontLeg = 'right';
    frontKneeAngle = rKneeAngle;
    rearKneeAngle = lKneeAngle;
    frontKneePt = rKnee;
    frontAnklePt = rAnkle;
  }

  // --- Real Knee ↔ Ankle Alignment Geometry (2D camera-plane estimate) ---
  const horizontalDx = Math.abs(frontKneePt.x - frontAnklePt.x);
  const shinLength = Math.hypot(frontKneePt.x - frontAnklePt.x, frontKneePt.y - frontAnklePt.y);

  // Offset percentage of visible shin length (defensive check against zero shin length)
  const kneeAnkleOffsetPct = shinLength > 0.01 
    ? Math.round((horizontalDx / shinLength) * 100) 
    : 0;

  // Threshold: <= 12% is reasonably stacked in camera plane
  const kneeStacked = kneeAnkleOffsetPct <= 12;

  // Normalized Knee/Ankle alignment score (0 - 100)
  const kneeAnkleAlignmentScore = Math.max(0, Math.min(100, Math.round(100 - (kneeAnkleOffsetPct * 2.2))));

  // Knee angle control score (ideal front knee: 90°, acceptable range 85° - 105°)
  const idealKnee = 90;
  const kneeDiff = Math.abs(frontKneeAngle - idealKnee);
  const kneeAngleScore = Math.max(0, Math.min(100, Math.round(100 - (kneeDiff * 1.8))));

  // Shoulder horizontal line angle & stability score (ideal: 0°, acceptable < 8°)
  const shoulderTilt = calculateHorizontalAngle(lShoulder, rShoulder);
  const shoulderScore = Math.max(0, Math.min(100, Math.round(100 - (shoulderTilt * 4))));

  // Stance classification
  const isWarriorStance = (frontKneeAngle < 135 && rearKneeAngle > 130);

  // --- Upgraded Movement Quality Score (Transparent 45% / 35% / 20% weights) ---
  // 45% = knee angle control
  // 35% = knee/ankle spatial alignment
  // 20% = shoulder stability
  const movementQualityScore = Math.max(0, Math.min(100, Math.round(
    (kneeAngleScore * 0.45) +
    (kneeAnkleAlignmentScore * 0.35) +
    (shoulderScore * 0.20)
  )));

  return {
    confidenceSufficient: true,
    frontLeg,
    frontKneeAngle,
    rearKneeAngle,
    frontKneePt,
    frontAnklePt,
    kneeAnkleOffsetPct,
    kneeStacked,
    kneeAnkleAlignmentScore,
    kneeAngleScore,
    shoulderTilt,
    shoulderScore,
    isWarriorStance,
    movementQualityScore,
  };
}

// --- MediaPipe Callback ---
function onPoseResults(results) {
  if (canvasElement.width !== videoElement.videoWidth && videoElement.videoWidth > 0) {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
  }

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Mirror camera view for intuitive user experience
  canvasCtx.translate(canvasElement.width, 0);
  canvasCtx.scale(-1, 1);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.poseLandmarks && results.poseLandmarks.length > 0) {
    canvasCtx.lineCap = 'round';
    canvasCtx.lineJoin = 'round';

    // Draw skeleton connectors with clean stroke
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: '#00F0FF',
      lineWidth: 3,
    });

    // Draw landmarks
    drawLandmarks(canvasCtx, results.poseLandmarks, {
      color: '#FF2E93',
      fillColor: '#FFFFFF',
      lineWidth: 1.5,
      radius: 3.5,
    });

    // Analyze pose geometry
    const analysis = analyzeWarriorIIPose(results.poseLandmarks);

    if (!analysis.confidenceSufficient) {
      handleLowConfidence();
    } else {
      handlePoseAnalysis(analysis);
    }
  } else {
    handleNoPerson();
  }

  canvasCtx.restore();
}

// --- Out of Frame / No Person State Handlers ---
function handleLowConfidence() {
  currentFeedbackState = 'out_of_frame';
  liveScoreDisplay.textContent = '--';
  scoreGrade.textContent = 'Step in frame';
  scoreGrade.style.color = '#ef4444';
  frontKneeAngleDisplay.textContent = '--°';
  kneeAnkleOffsetDisplay.textContent = '--%';
  kneeAnkleOffsetDisplay.style.color = '#94a3b8';
  kneeAnkleOffsetTarget.textContent = 'target ≤12%';
  shoulderTiltDisplay.textContent = '--°';
  shoulderTiltDisplay.style.color = '#94a3b8';
  stanceDisplay.textContent = 'Partial view';
  stanceDisplay.style.color = '#ef4444';

  feedbackBanner.className = 'feedback-banner state-caution';
  feedbackIcon.textContent = '👤';
  feedbackText.textContent = 'Step fully into the camera frame';
  feedbackSub.textContent = 'Position yourself so your full body from shoulders to ankles is visible for accurate tracking';
  speakCoachCue('Please step fully into the camera frame.');
}

function handleNoPerson() {
  currentFeedbackState = 'neutral';
  liveScoreDisplay.textContent = '--';
  scoreGrade.textContent = 'No person detected';
  scoreGrade.style.color = '#64748b';
  frontKneeAngleDisplay.textContent = '--°';
  kneeAnkleOffsetDisplay.textContent = '--%';
  kneeAnkleOffsetDisplay.style.color = '#94a3b8';
  kneeAnkleOffsetTarget.textContent = 'target ≤12%';
  shoulderTiltDisplay.textContent = '--°';
  shoulderTiltDisplay.style.color = '#94a3b8';
  stanceDisplay.textContent = 'Stand in frame';
  stanceDisplay.style.color = '#64748b';

  feedbackBanner.className = 'feedback-banner state-neutral';
  feedbackIcon.textContent = '🧘';
  feedbackText.textContent = 'Step into the camera frame to begin practice';
  feedbackSub.textContent = 'Ensure good lighting and plenty of room to extend your arms';
}

// --- Pose Analysis & Measured Feedback State Machine ---
function handlePoseAnalysis(analysis) {
  // Track valid, confident frame
  validFrameCount++;
  latestMeasuredScore = analysis.movementQualityScore;

  // Capture baseline score on first confident valid frame
  if (baselineBeforeScore === null) {
    baselineBeforeScore = analysis.movementQualityScore;
  }

  // Track peak score
  if (analysis.movementQualityScore > peakScoreThisSession) {
    peakScoreThisSession = analysis.movementQualityScore;
  }

  // Update HUD values
  frontKneeAngleDisplay.textContent = `${analysis.frontKneeAngle}°`;
  kneeAnkleOffsetDisplay.textContent = `${analysis.kneeAnkleOffsetPct}%`;
  kneeAnkleOffsetDisplay.style.color = analysis.kneeStacked ? '#10b981' : '#f59e0b';
  kneeAnkleOffsetTarget.textContent = analysis.kneeStacked ? 'Stacked (≤12%)' : 'Needs alignment';

  shoulderTiltDisplay.textContent = `${analysis.shoulderTilt}°`;
  shoulderTiltDisplay.style.color = analysis.shoulderTilt <= 8 ? '#10b981' : '#f59e0b';

  liveScoreDisplay.textContent = analysis.movementQualityScore;
  frontLegLabel.textContent = `${analysis.frontLeg.toUpperCase()} leg forward`;

  if (analysis.isWarriorStance) {
    stanceDisplay.textContent = `Warrior II (${analysis.frontLeg.toUpperCase()})`;
    stanceDisplay.style.color = '#10b981';
  } else {
    stanceDisplay.textContent = `Aligning stance`;
    stanceDisplay.style.color = '#f59e0b';
  }

  // Draw angle tag on canvas directly at front knee
  const kx = analysis.frontKneePt.x * canvasElement.width;
  const ky = analysis.frontKneePt.y * canvasElement.height;
  canvasCtx.save();
  canvasCtx.scale(-1, 1);
  canvasCtx.font = 'bold 15px sans-serif';
  canvasCtx.fillStyle = '#ffffff';
  canvasCtx.strokeStyle = '#000000';
  canvasCtx.lineWidth = 3;
  canvasCtx.strokeText(`${analysis.frontKneeAngle}° (${analysis.kneeAnkleOffsetPct}%)`, -kx - 45, ky - 10);
  canvasCtx.fillText(`${analysis.frontKneeAngle}° (${analysis.kneeAnkleOffsetPct}%)`, -kx - 45, ky - 10);
  canvasCtx.restore();

  // Quality score grade label
  if (analysis.movementQualityScore >= 80) {
    scoreGrade.textContent = 'Optimal Alignment';
    scoreGrade.style.color = '#10b981';
  } else if (analysis.movementQualityScore >= 60) {
    scoreGrade.textContent = 'Fair Alignment';
    scoreGrade.style.color = '#f59e0b';
  } else {
    scoreGrade.textContent = 'Adjusting Posture';
    scoreGrade.style.color = '#ef4444';
  }

  // --- Strict Feedback Priority Matching Actual Measurements ---
  // Exactly ONE primary actionable correction at a time:
  // Priority A: Poor knee/ankle alignment (offset > 12%)
  // Priority B: Knee angle too open (> 105°)
  // Priority C: Knee angle too closed (< 82°)
  // Priority D: Shoulders tilted (> 8°)
  // Priority E: All major checks good
  let currentProblem = null;

  if (!analysis.kneeStacked) {
    currentProblem = {
      category: 'knee_ankle',
      isIssue: true,
      primary: 'Bring your front knee back over your ankle.',
      supporting: `Camera-plane knee/ankle offset: ${analysis.kneeAnkleOffsetPct}%. Aim for ≤12%.`,
      speech: 'Bring your front knee back over your ankle.'
    };
  } else if (analysis.frontKneeAngle > 105) {
    currentProblem = {
      category: 'knee_open',
      isIssue: true,
      primary: 'Bend your front knee a little deeper.',
      supporting: `Current knee angle: ${analysis.frontKneeAngle}°. Aim near 90°.`,
      speech: 'Bend your front knee a little deeper.'
    };
  } else if (analysis.frontKneeAngle < 82) {
    currentProblem = {
      category: 'knee_closed',
      isIssue: true,
      primary: 'Ease your front knee back slightly.',
      supporting: `Current knee angle: ${analysis.frontKneeAngle}°. Aim near 90°.`,
      speech: 'Ease your front knee back slightly.'
    };
  } else if (analysis.shoulderTilt > 8) {
    currentProblem = {
      category: 'shoulder',
      isIssue: true,
      primary: 'Level your shoulders.',
      supporting: `Current shoulder tilt: ${analysis.shoulderTilt}°. Keep arms parallel to floor.`,
      speech: 'Level your shoulders.'
    };
  } else {
    currentProblem = {
      category: 'good',
      isIssue: false,
      primary: 'Good alignment! Keep holding steady.',
      supporting: `Knee stacked (${analysis.kneeAnkleOffsetPct}%), knee angle ${analysis.frontKneeAngle}°, shoulders level.`,
      speech: 'Good alignment. Keep holding steady.'
    };
  }

  // Tally for focusArea determination
  if (currentProblem.category === 'knee_ankle') issueTally.kneeAnkle++;
  else if (currentProblem.category === 'knee_open' || currentProblem.category === 'knee_closed') issueTally.kneeAngle++;
  else if (currentProblem.category === 'shoulder') issueTally.shoulder++;
  else if (currentProblem.category === 'good') issueTally.good++;

  // --- Debouncing State Machine ---
  if (currentProblem.category === pendingFeedbackCategory) {
    pendingFeedbackFrames++;
  } else {
    pendingFeedbackCategory = currentProblem.category;
    pendingFeedbackFrames = 1;
  }

  if (pendingFeedbackFrames >= DEBOUNCE_THRESHOLD && activeFeedbackCategory !== pendingFeedbackCategory) {
    activeFeedbackCategory = pendingFeedbackCategory;

    if (currentProblem.isIssue) {
      currentFeedbackState = 'warn';
      feedbackBanner.className = 'feedback-banner state-warn';
      feedbackIcon.textContent = '⚠️';
      feedbackText.textContent = currentProblem.primary;
      feedbackSub.textContent = currentProblem.supporting;
      speakCoachCue(currentProblem.speech);
    } else {
      currentFeedbackState = 'good';
      feedbackBanner.className = 'feedback-banner state-good';
      feedbackIcon.textContent = '✨';
      feedbackText.textContent = currentProblem.primary;
      feedbackSub.textContent = currentProblem.supporting;
      speakCoachCue(currentProblem.speech);

      // User achieved corrected alignment
      correctedAfterScore = analysis.movementQualityScore;
      if (baselineBeforeScore !== null) {
        lastCalculatedDelta = correctedAfterScore - baselineBeforeScore;
        if (lastCalculatedDelta > 0) {
          deltaBadge.style.display = 'inline-flex';
          deltaBadgeText.textContent = `Movement quality improved by +${lastCalculatedDelta}`;
        } else {
          deltaBadge.style.display = 'none';
        }
      }
    }
  }
}

// --- Camera Management ---
async function startPracticeCamera() {
  try {
    if (!pose) {
      pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });
      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      pose.onResults(onPoseResults);
    }

    camera = new Camera(videoElement, {
      onFrame: async () => {
        if (isCameraRunning) {
          await pose.send({ image: videoElement });
        }
      },
      width: 640,
      height: 480,
    });

    await camera.start();
    isCameraRunning = true;
    cameraPrompt.style.display = 'none';
    livePillText.textContent = 'Live Tracking';

    // Start practice hold timer
    startSessionTimer();
  } catch (err) {
    console.error('Error starting camera:', err);
    alert('Unable to access webcam. Please check browser camera permissions and try again.');
  }
}

async function stopPracticeCamera() {
  if (camera) {
    isCameraRunning = false;
    await camera.stop();
    camera = null;
  }
  clearInterval(sessionTimerInterval);
}

function startSessionTimer() {
  sessionSecondsElapsed = 0;
  clearInterval(sessionTimerInterval);
  sessionTimer.textContent = '00:00';

  sessionTimerInterval = setInterval(() => {
    sessionSecondsElapsed++;
    const mins = String(Math.floor(sessionSecondsElapsed / 60)).padStart(2, '0');
    const secs = String(sessionSecondsElapsed % 60).padStart(2, '0');
    sessionTimer.textContent = `${mins}:${secs}`;
  }, 1000);
}

// --- End Session & Summary (Zero Fallbacks, Real CV Measurements Only) ---
function finishSession() {
  stopPracticeCamera();

  // Validate sufficient reliable pose data
  if (validFrameCount < MIN_VALID_FRAMES || baselineBeforeScore === null || latestMeasuredScore === null) {
    // Insufficient data: DO NOT invent scores, DO NOT save fake session
    sumBeforeScore.textContent = '--';
    sumBeforeHint.textContent = 'Insufficient data';
    sumAfterScore.textContent = '--';
    sumAfterHint.textContent = 'Insufficient data';
    sumDeltaScore.textContent = '--';
    sumDeltaScore.className = 'result-delta neutral';
    sumDeltaLabel.textContent = 'Measured Improvement';
    sumDeltaHint.textContent = 'Requires full-body visibility';

    sumFocusArea.textContent = 'Camera Visibility';
    sumFocusHint.textContent = 'Insufficient body tracking';

    summarySubtitle.textContent = "We couldn't collect enough reliable pose data. Please try again with your full body visible in the camera frame.";
    switchView('summary');
    return;
  }

  // Real measurements are available
  const finalBefore = baselineBeforeScore;
  // If user achieved corrected posture, compare to correctedAfterScore; otherwise latest measured score
  const finalAfter = correctedAfterScore !== null ? correctedAfterScore : latestMeasuredScore;
  const finalDelta = finalAfter - finalBefore;

  sumBeforeScore.textContent = finalBefore;
  sumBeforeHint.textContent = 'Initial alignment capture';
  sumAfterScore.textContent = finalAfter;
  sumAfterHint.textContent = 'Measured hold quality';

  // Format Delta truthfully (can be positive, zero, or negative)
  if (finalDelta > 0) {
    sumDeltaScore.textContent = `+${finalDelta}`;
    sumDeltaScore.className = 'result-delta';
    sumDeltaLabel.textContent = 'Measured Improvement';
    sumDeltaHint.textContent = 'Actual measured change';
  } else if (finalDelta === 0) {
    sumDeltaScore.textContent = '0';
    sumDeltaScore.className = 'result-delta neutral';
    sumDeltaLabel.textContent = 'Posture Consistency';
    sumDeltaHint.textContent = 'Maintained initial score';
  } else {
    sumDeltaScore.textContent = `${finalDelta}`;
    sumDeltaScore.className = 'result-delta negative';
    sumDeltaLabel.textContent = 'Measured Score Shift';
    sumDeltaHint.textContent = 'Posture drifted during hold';
  }

  // Determine focusArea from actual detected issues
  let detectedFocus = 'Knee-over-ankle alignment';
  let detectedFocusHint = 'Camera-plane alignment';

  if (issueTally.kneeAnkle >= issueTally.kneeAngle && issueTally.kneeAnkle >= issueTally.shoulder && issueTally.kneeAnkle > 0) {
    detectedFocus = 'Knee-over-ankle alignment';
    detectedFocusHint = 'Front knee stack over ankle';
  } else if (issueTally.kneeAngle >= issueTally.shoulder && issueTally.kneeAngle > 0) {
    detectedFocus = 'Knee angle control';
    detectedFocusHint = 'Front knee 90° depth';
  } else if (issueTally.shoulder > 0) {
    detectedFocus = 'Shoulder stability';
    detectedFocusHint = 'Horizontal arm/shoulder line';
  } else {
    detectedFocus = 'Steady alignment hold';
    detectedFocusHint = 'Maintained optimal posture';
  }

  sumFocusArea.textContent = detectedFocus;
  sumFocusHint.textContent = detectedFocusHint;

  const profile = getUserProfile();
  const practitionerName = profile ? profile.name : 'Practitioner';
  summarySubtitle.textContent = `Great work, ${practitionerName}! Your Warrior II hold was evaluated across ${validFrameCount} verified pose frames.`;

  // Save session record to localStorage
  const sessionRecord = {
    id: 'session-' + Date.now(),
    timestamp: Date.now(),
    dateStr: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    pose: 'Warrior II',
    beforeScore: finalBefore,
    afterScore: finalAfter,
    delta: finalDelta,
    focusArea: detectedFocus,
    measuredFrames: validFrameCount,
  };
  saveSessionRecord(sessionRecord);

  switchView('summary');
}

// --- Progress View & Chart.js (Safe for 0, 1, or N Real Sessions) ---
function renderProgressView() {
  const sessions = getStoredSessions();

  // Populate history table
  historyTableBody.innerHTML = '';

  if (sessions.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="6" style="text-align: center; padding: 28px 16px; color: #94a3b8; font-size: 0.92rem;">
        No practice sessions recorded yet. Complete your first practice to start tracking your alignment trajectory!
      </td>
    `;
    historyTableBody.appendChild(tr);

    progressInsightText.textContent = 
      "Welcome! Complete your first practice session with the live camera to unlock personal alignment tracking and insights.";

    if (progressChartInstance) {
      progressChartInstance.destroy();
      progressChartInstance = null;
    }
    return;
  }

  // Show most recent sessions first in table
  const sortedDesc = [...sessions].sort((a, b) => b.timestamp - a.timestamp);

  sortedDesc.forEach(s => {
    const tr = document.createElement('tr');
    const deltaFormatted = s.delta > 0 
      ? `<span style="color: #10b981; font-weight: 700;">+${s.delta} pts</span>`
      : s.delta === 0
        ? `<span style="color: #94a3b8; font-weight: 600;">0 pts</span>`
        : `<span style="color: #f59e0b; font-weight: 700;">${s.delta} pts</span>`;

    tr.innerHTML = `
      <td>${s.dateStr || 'Recent'}</td>
      <td><strong>${s.pose || 'Warrior II'}</strong></td>
      <td>${s.beforeScore !== undefined ? s.beforeScore : '--'}</td>
      <td><span style="color: #10b981; font-weight: 700;">${s.afterScore !== undefined ? s.afterScore : '--'}</span></td>
      <td>${deltaFormatted}</td>
      <td>${s.focusArea || 'Knee alignment'}</td>
    `;
    historyTableBody.appendChild(tr);
  });

  // Plain-Language Honest Insight Generator
  if (sessions.length === 1) {
    progressInsightText.textContent = 
      "Complete another practice to unlock a personal progress comparison.";
  } else {
    // Compare oldest vs newest session chronologically
    const sortedAsc = [...sessions].sort((a, b) => a.timestamp - b.timestamp);
    const firstSession = sortedAsc[0];
    const latestSession = sortedAsc[sortedAsc.length - 1];
    const totalChange = latestSession.afterScore - firstSession.afterScore;

    if (totalChange > 0) {
      progressInsightText.textContent = 
        `Your Warrior II alignment has improved by +${totalChange} points across your ${sessions.length} recorded practices. Your front knee and shoulder stability are steadily advancing!`;
    } else if (totalChange === 0) {
      progressInsightText.textContent = 
        `You have completed ${sessions.length} recorded Warrior II sessions with consistent alignment scores. Keep holding steady!`;
    } else {
      progressInsightText.textContent = 
        `You have completed ${sessions.length} recorded practices. Focus on keeping your front knee stacked over your ankle (≤12% offset) to elevate your alignment score.`;
    }
  }

  // Render Chart.js Line Graph
  const chartCanvas = document.getElementById('progressChart');
  if (!chartCanvas) return;

  // Chronological order for chart progression
  const sortedAsc = [...sessions].sort((a, b) => a.timestamp - b.timestamp);
  const labels = sortedAsc.map((s, idx) => s.dateStr || `Session ${idx + 1}`);
  const scores = sortedAsc.map(s => s.afterScore);
  const baselines = sortedAsc.map(s => s.beforeScore);

  if (progressChartInstance) {
    progressChartInstance.destroy();
  }

  const ctx = chartCanvas.getContext('2d');
  progressChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Final / Peak Score',
          data: scores,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          borderWidth: 3,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#ffffff',
          pointRadius: 5,
          tension: 0.35,
          fill: true,
        },
        {
          label: 'Initial Baseline Score',
          data: baselines,
          borderColor: '#f59e0b',
          borderDash: [5, 5],
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointBackgroundColor: '#f59e0b',
          pointRadius: 4,
          tension: 0.35,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            color: '#94a3b8',
            callback: (val) => `${val} pts`
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.06)'
          }
        },
        x: {
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(255, 255, 255, 0.04)' }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#f8fafc',
            font: { family: 'Plus Jakarta Sans', size: 12, weight: 600 },
            padding: 16,
            boxWidth: 12,
            usePointStyle: true,
          }
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f8fafc',
          bodyColor: '#94a3b8',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw} / 100`
          }
        }
      }
    }
  });
}

// --- Event Listeners ---

// Onboarding submit
onboardingForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const profile = {
    name: userNameInput.value.trim(),
    goal: userGoalInput.value,
    experience: userExperienceInput.value,
    duration: userDurationInput.value,
  };
  saveUserProfile(profile);
  updateWhyExplanation(profile.experience);
  timerGoalLabel.textContent = `Goal: ${profile.duration}m`;
  switchView('sessionPrep');
});

// Start Practice Button
startPracticeBtn.addEventListener('click', () => {
  resetSessionState();
  switchView('camera');
  speakCoachCue('Starting Warrior II practice.');
  startPracticeCamera();
});

// Resume Camera (if paused)
resumeCameraBtn.addEventListener('click', () => {
  startPracticeCamera();
});

// End Session Button
endSessionBtn.addEventListener('click', finishSession);

// Summary Actions
viewProgressFromSummaryBtn.addEventListener('click', () => switchView('progress'));
practiceAgainBtn.addEventListener('click', () => {
  resetSessionState();
  switchView('sessionPrep');
});

// Progress Action
newSessionBtn.addEventListener('click', () => {
  resetSessionState();
  const profile = getUserProfile();
  if (profile) {
    updateWhyExplanation(profile.experience);
    switchView('sessionPrep');
  } else {
    switchView('onboarding');
  }
});

// Nav Buttons
navPracticeBtn.addEventListener('click', () => {
  const profile = getUserProfile();
  if (profile) {
    updateWhyExplanation(profile.experience);
    switchView('sessionPrep');
  } else {
    switchView('onboarding');
  }
});

navProgressBtn.addEventListener('click', () => switchView('progress'));

navProfileBtn.addEventListener('click', () => {
  const profile = getUserProfile();
  if (profile) {
    userNameInput.value = profile.name;
    userGoalInput.value = profile.goal;
    userExperienceInput.value = profile.experience;
    userDurationInput.value = profile.duration;
  }
  switchView('onboarding');
});

// Keyboard shortcut (ESC to end live session)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isCameraRunning) {
    finishSession();
  }
});

// --- Application Initialization ---
window.addEventListener('DOMContentLoaded', () => {
  // Clean out any legacy demo sessions from localStorage
  getStoredSessions();

  const profile = getUserProfile();
  if (profile) {
    updateWhyExplanation(profile.experience);
    timerGoalLabel.textContent = `Goal: ${profile.duration}m`;
    switchView('sessionPrep');
  } else {
    switchView('onboarding');
  }
});
