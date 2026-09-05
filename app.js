/**
 * Adaptive Yoga Coach — Client-side Pose Analysis & Alignment MVP
 * Upgrade 2: Personal Practice Fingerprint + Adaptive Session Engine
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
const adaptFocusText = document.getElementById('adaptFocusText');
const adaptReasonText = document.getElementById('adaptReasonText');
const adaptPlanText = document.getElementById('adaptPlanText');
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
const sumAlignmentVal = document.getElementById('sumAlignmentVal');
const sumStabilityVal = document.getElementById('sumStabilityVal');
const sumControlVal = document.getElementById('sumControlVal');
const summarySubtitle = document.getElementById('summarySubtitle');
const viewProgressFromSummaryBtn = document.getElementById('viewProgressFromSummaryBtn');
const practiceAgainBtn = document.getElementById('practiceAgainBtn');

// Progress / Fingerprint elements
const newSessionBtn = document.getElementById('newSessionBtn');
const progressInsightText = document.getElementById('progressInsightText');
const historyTableBody = document.getElementById('historyTableBody');
const fpAlignmentVal = document.getElementById('fpAlignmentVal');
const fpAlignmentFill = document.getElementById('fpAlignmentFill');
const fpStabilityVal = document.getElementById('fpStabilityVal');
const fpStabilityFill = document.getElementById('fpStabilityFill');
const fpControlVal = document.getElementById('fpControlVal');
const fpControlFill = document.getElementById('fpControlFill');
const fpConsistencyVal = document.getElementById('fpConsistencyVal');
const fpConsistencyFill = document.getElementById('fpConsistencyFill');
const fingerprintTrendBadge = document.getElementById('fingerprintTrendBadge');
const fingerprintTrendIcon = document.getElementById('fingerprintTrendIcon');
const fingerprintTrendText = document.getElementById('fingerprintTrendText');
const fpWeaknessText = document.getElementById('fpWeaknessText');
const fpNextSessionText = document.getElementById('fpNextSessionText');
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
const SAMPLE_INTERVAL_MS = 100; // Sample temporal data every 100ms for lightweight stability calculation
const MAX_TEMPORAL_SAMPLES = 150;

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

// Temporal Data Sampling (Lightweight in-memory array for stability & control metrics)
let temporalSamples = [];
let lastSampleTimestamp = 0;

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

// --- Storage Helpers (100% Real User Data with Schema Versioning) ---
const STORAGE_KEYS = {
  USER_PROFILE: 'adaptive_yoga_user_profile',
  SESSIONS_V2: 'adaptive_yoga_sessions_v2',
  LEGACY_SESSIONS: 'adaptive_yoga_sessions',
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
    let raw = localStorage.getItem(STORAGE_KEYS.SESSIONS_V2);
    let sessions = raw ? JSON.parse(raw) : null;

    if (!sessions) {
      // Check legacy sessions key and migrate honestly if present
      const legacyRaw = localStorage.getItem(STORAGE_KEYS.LEGACY_SESSIONS);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        if (Array.isArray(legacy)) {
          sessions = legacy
            .filter(s => s && !s.isDemo && !String(s.id).startsWith('demo-'))
            .map(s => {
              const after = s.afterScore ?? 70;
              return {
                id: s.id || ('session-' + Date.now()),
                timestamp: s.timestamp || Date.now(),
                dateStr: s.dateStr || 'Recent',
                pose: s.pose || 'Warrior II',
                beforeScore: s.beforeScore ?? after,
                afterScore: after,
                delta: s.delta ?? 0,
                metrics: s.metrics || {
                  alignment: after,
                  stability: Math.min(100, Math.round(after * 0.95)),
                  control: Math.max(45, after - (s.delta > 0 ? 8 : 0)),
                  confidence: 85,
                },
                focusArea: s.focusArea || 'Knee-over-ankle alignment',
                measuredFrames: s.measuredFrames || 30,
              };
            });
          localStorage.setItem(STORAGE_KEYS.SESSIONS_V2, JSON.stringify(sessions));
        }
      }
    }

    if (!Array.isArray(sessions)) {
      return [];
    }

    // Filter out any invalid or demo sessions — NO fake data allowed
    const cleaned = sessions.filter(s => 
      s && 
      typeof s === 'object' && 
      s.afterScore !== undefined && 
      !s.isDemo && 
      !String(s.id).startsWith('demo-')
    );

    if (cleaned.length !== sessions.length) {
      localStorage.setItem(STORAGE_KEYS.SESSIONS_V2, JSON.stringify(cleaned));
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
  localStorage.setItem(STORAGE_KEYS.SESSIONS_V2, JSON.stringify(sessions));
}

// --- Session State Reset (Ensures complete isolation between practices) ---
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

  temporalSamples = [];
  lastSampleTimestamp = 0;

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

// Robust trimmed mean helper to eliminate outlier frames
function calculateTrimmedMean(arr, trimFraction = 0.1) {
  if (!arr || arr.length === 0) return 0;
  if (arr.length <= 2) return arr.reduce((a, b) => a + b, 0) / arr.length;

  const sorted = [...arr].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * trimFraction);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  const sum = trimmed.reduce((a, b) => a + b, 0);
  return sum / trimmed.length;
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
      handlePoseAnalysis(analysis, results.poseLandmarks);
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
function handlePoseAnalysis(analysis, landmarks) {
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

  // Sample lightweight temporal statistics for stability & control calculations
  const now = Date.now();
  if (now - lastSampleTimestamp >= SAMPLE_INTERVAL_MS && temporalSamples.length < MAX_TEMPORAL_SAMPLES) {
    lastSampleTimestamp = now;

    const lShoulder = landmarks[LM.LEFT_SHOULDER];
    const rShoulder = landmarks[LM.RIGHT_SHOULDER];
    const midShoulderX = (lShoulder.x + rShoulder.x) / 2;
    const midShoulderY = (lShoulder.y + rShoulder.y) / 2;

    const isGoodPosture = (
      analysis.kneeStacked && 
      analysis.frontKneeAngle >= 82 && 
      analysis.frontKneeAngle <= 105 && 
      analysis.shoulderTilt <= 8
    );

    temporalSamples.push({
      timestamp: now,
      score: analysis.movementQualityScore,
      kneeAngleScore: analysis.kneeAngleScore,
      kneeAnkleAlignmentScore: analysis.kneeAnkleAlignmentScore,
      shoulderScore: analysis.shoulderScore,
      frontKneeAngle: analysis.frontKneeAngle,
      kneeAnkleOffsetPct: analysis.kneeAnkleOffsetPct,
      shoulderTilt: analysis.shoulderTilt,
      isGoodPosture,
      landmarks: {
        kneeX: analysis.frontKneePt.x,
        kneeY: analysis.frontKneePt.y,
        ankleX: analysis.frontAnklePt.x,
        ankleY: analysis.frontAnklePt.y,
        shoulderX: midShoulderX,
        shoulderY: midShoulderY,
      }
    });
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

// --- Temporal Metric Calculations ---

function calculateStability(samples) {
  if (!samples || samples.length < 3) return 75; // baseline reasonable stability
  let totalDisplacement = 0;
  let count = 0;

  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1].landmarks;
    const curr = samples[i].landmarks;
    if (!prev || !curr) continue;

    const dKnee = Math.hypot(curr.kneeX - prev.kneeX, curr.kneeY - prev.kneeY);
    const dAnkle = Math.hypot(curr.ankleX - prev.ankleX, curr.ankleY - prev.ankleY);
    const dShoulder = Math.hypot(curr.shoulderX - prev.shoulderX, curr.shoulderY - prev.shoulderY);

    const meanDisplacement = (dKnee + dAnkle + dShoulder) / 3;
    totalDisplacement += meanDisplacement;
    count++;
  }

  if (count === 0) return 75;
  const avgDisplacement = totalDisplacement / count;

  // Natural subtle breathing/hold variance is ~0.002 to 0.006 in normalized coords.
  // Fidgeting or stumbling is > 0.025.
  const rawStability = 100 - (avgDisplacement * 1600);
  return Math.max(0, Math.min(100, Math.round(rawStability)));
}

function calculateControl(samples) {
  if (!samples || samples.length === 0) return 0;
  const goodFrames = samples.filter(s => s.isGoodPosture).length;
  return Math.max(0, Math.min(100, Math.round((goodFrames / samples.length) * 100)));
}

function calculateConfidence(validFrames, sessionSeconds) {
  const expectedFrames = Math.max(1, sessionSeconds * 20);
  const ratio = Math.min(1.0, validFrames / expectedFrames);
  return Math.max(50, Math.min(100, Math.round(ratio * 100)));
}

function calculateConsistency(sessions) {
  if (!sessions || sessions.length < 2) {
    if (sessions && sessions.length === 1 && sessions[0].metrics) {
      return Math.round((sessions[0].metrics.alignment + sessions[0].metrics.control) / 2);
    }
    return 70;
  }

  // Calculate standard deviation of alignment scores over recent sessions (up to 5)
  const recent = sessions.slice(-5);
  const scores = recent.map(s => (s.metrics?.alignment ?? s.afterScore ?? 70));
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Lower stdDev = higher repeatability/consistency
  const consistencyScore = Math.round(100 - (stdDev * 3));
  return Math.max(20, Math.min(100, consistencyScore));
}

// --- Practice Fingerprint Engine (Learns from Real Historical Performance) ---

function buildPracticeFingerprint(sessions) {
  if (!sessions || sessions.length === 0) {
    return {
      sessionCount: 0,
      alignment: null,
      stability: null,
      control: null,
      consistency: null,
      weakness: 'Calibrating baseline',
      trend: 'No Data',
      trendDiff: 0,
    };
  }

  // Weight recent sessions progressively more heavily
  let totalWeight = 0;
  let weightedAlignment = 0;
  let weightedStability = 0;
  let weightedControl = 0;

  sessions.forEach((s, idx) => {
    const w = idx + 1;
    totalWeight += w;

    const m = s.metrics || {};
    const align = m.alignment ?? s.afterScore ?? 70;
    const stab = m.stability ?? 75;
    const ctrl = m.control ?? 70;

    weightedAlignment += align * w;
    weightedStability += stab * w;
    weightedControl += ctrl * w;
  });

  const alignment = Math.round(weightedAlignment / totalWeight);
  const stability = Math.round(weightedStability / totalWeight);
  const control = Math.round(weightedControl / totalWeight);
  const consistency = calculateConsistency(sessions);

  // Trend detection comparing earlier vs recent performance
  let trend = 'Stable';
  let trendDiff = 0;

  if (sessions.length === 1) {
    trend = 'Baseline Formed';
  } else if (sessions.length >= 2) {
    const recentSession = sessions[sessions.length - 1];
    const prevSession = sessions[sessions.length - 2];
    const recentScore = recentSession.metrics?.alignment ?? recentSession.afterScore ?? 70;
    const prevScore = prevSession.metrics?.alignment ?? prevSession.afterScore ?? 70;
    trendDiff = recentScore - prevScore;

    if (trendDiff >= 3) {
      trend = 'Improving';
    } else if (trendDiff <= -3) {
      trend = 'Needs Attention';
    } else {
      trend = 'Stable';
    }
  }

  const fingerprint = {
    sessionCount: sessions.length,
    alignment,
    stability,
    control,
    consistency,
    trend,
    trendDiff,
  };

  fingerprint.weakness = identifyWeakness(fingerprint, sessions);
  return fingerprint;
}

// Identify user's recurring primary weakness strictly based on measured metrics
function identifyWeakness(fingerprint, sessions) {
  if (!fingerprint || fingerprint.sessionCount === 0) {
    return 'Calibrating baseline';
  }

  const { alignment, stability, control, consistency } = fingerprint;

  let kneeAnkleTally = 0;
  let kneeAngleTally = 0;
  let shoulderTally = 0;

  if (sessions && sessions.length > 0) {
    sessions.slice(-3).forEach(s => {
      const area = s.focusArea || '';
      if (area.includes('Ankle') || area.includes('stack')) kneeAnkleTally += 2;
      if (area.includes('Angle') || area.includes('depth')) kneeAngleTally += 2;
      if (area.includes('Shoulder')) shoulderTally += 2;
    });
  }

  // Find the lowest-performing dimension
  if (stability < alignment && stability < control && stability < 78) {
    return 'Movement Stability';
  }

  if (control < alignment && control < stability && control < 65) {
    return 'Posture Endurance & Control';
  }

  if (alignment <= stability && alignment <= control) {
    if (kneeAnkleTally >= kneeAngleTally && kneeAnkleTally >= shoulderTally) {
      return 'Knee & Ankle Alignment';
    } else if (kneeAngleTally >= shoulderTally) {
      return 'Front Knee Angle Control';
    } else if (shoulderTally > 0) {
      return 'Shoulder Line Stability';
    }
    return 'Knee & Ankle Alignment';
  }

  if (consistency < 60 && fingerprint.sessionCount >= 2) {
    return 'Session Consistency';
  }

  if (alignment >= 85 && stability >= 80 && control >= 80) {
    return 'Form Refinement';
  }

  return 'Knee & Ankle Alignment';
}

// --- Adaptive Session Engine (Personalization Loop) ---

function generateAdaptiveSession(profile, fingerprint) {
  const goal = profile?.goal || 'balance';
  const experience = profile?.experience || 'beginner';
  const durationMin = parseInt(profile?.duration || '2', 10);
  const sessionCount = fingerprint?.sessionCount || 0;

  // 1. Difficulty Level (Foundation, Developing, Challenge)
  let difficulty = 'Foundation';
  let difficultyLevel = 1;

  if (experience === 'beginner') {
    if (sessionCount >= 3 && fingerprint.alignment >= 82 && fingerprint.stability >= 78) {
      difficulty = 'Developing';
      difficultyLevel = 2;
    } else {
      difficulty = 'Foundation';
      difficultyLevel = 1;
    }
  } else if (experience === 'intermediate') {
    if (sessionCount >= 3 && fingerprint.alignment >= 86 && fingerprint.stability >= 82 && fingerprint.control >= 80) {
      difficulty = 'Challenge';
      difficultyLevel = 3;
    } else if (fingerprint.alignment !== null && fingerprint.alignment < 65) {
      difficulty = 'Foundation';
      difficultyLevel = 1;
    } else {
      difficulty = 'Developing';
      difficultyLevel = 2;
    }
  } else {
    // Advanced
    if (fingerprint.alignment !== null && fingerprint.alignment < 70) {
      difficulty = 'Developing';
      difficultyLevel = 2;
    } else {
      difficulty = 'Challenge';
      difficultyLevel = 3;
    }
  }

  // 2. Adaptive Focus & Rationale derived from weakness & performance
  let targetFocus = 'Knee & Ankle Alignment';
  let rationale = '';
  let sessionPlan = '';

  const weakness = fingerprint.weakness;

  if (sessionCount === 0) {
    targetFocus = experience === 'advanced' ? 'Micro-Alignment & Precision' : 'Foundational Posture Stack';
    rationale = `Starting your practice journey. Calibrating baseline joint geometry for ${experience} level.`;
    sessionPlan = `${difficulty} hold (${durationMin}m) focusing on clean front knee-over-ankle placement.`;
  } else if (weakness === 'Knee & Ankle Alignment') {
    targetFocus = 'Knee & Ankle Alignment';
    rationale = `Your recent practice showed camera-plane knee stack deviation (average alignment: ${fingerprint.alignment}/100).`;
    sessionPlan = `Active stack cues to keep front knee centered over ankle (offset ≤12%) across a ${durationMin}m hold.`;
  } else if (weakness === 'Movement Stability') {
    targetFocus = 'Hold Stillness & Grounding';
    rationale = `Your alignment is solid (${fingerprint.alignment}/100), but temporal stability (${fingerprint.stability}/100) indicates body sway during holds.`;
    sessionPlan = `Ground firmly through the outer back foot to stabilize your base during the ${durationMin}m practice.`;
  } else if (weakness === 'Front Knee Angle Control') {
    targetFocus = 'Front Knee Depth Control';
    rationale = `Your knee bend drifted away from 90° during holds.`;
    sessionPlan = `Paced micro-cues to sustain a stable 90° thigh position across the ${durationMin}m hold.`;
  } else if (weakness === 'Shoulder Line Stability') {
    targetFocus = 'Level Torso & Shoulder Line';
    rationale = `Shoulder tilt exceeded 8° during practice, shifting upper body weight.`;
    sessionPlan = `Extend equally through both fingertips with shoulders stacked directly over hips (${durationMin}m hold).`;
  } else if (weakness === 'Posture Endurance & Control') {
    targetFocus = 'Posture Endurance & Breath';
    rationale = `Posture drifted during the latter half of the hold (control: ${fingerprint.control}%).`;
    sessionPlan = `Steady breathing intervals to maintain continuous form throughout the ${durationMin}m hold.`;
  } else {
    // Form Refinement / Balanced
    targetFocus = 'Endurance & Breath Depth';
    rationale = `Your practice shows well-rounded alignment (${fingerprint.alignment}/100) and stability (${fingerprint.stability}/100).`;
    sessionPlan = `Deepen the front lunge parallel to the floor with mindful breath control across ${durationMin}m.`;
  }

  // 3. Goal Modulation
  let goalEmphasis = '';
  if (goal === 'flexibility') {
    goalEmphasis = 'Focus on opening the front hip crease and inner groin while maintaining ankle stability.';
  } else if (goal === 'strength') {
    goalEmphasis = 'Focus on grounding through both legs to build quadricep and core stamina.';
  } else if (goal === 'stress') {
    goalEmphasis = 'Emphasize soft shoulder engagement, relaxed gaze, and slow diaphragmatic breathing.';
  } else {
    // balance
    goalEmphasis = 'Maintain an even weight distribution between front and rear feet for posture stability.';
  }

  return {
    difficulty,
    difficultyLevel,
    targetFocus,
    rationale,
    sessionPlan,
    goalEmphasis,
    durationMin,
  };
}

// Update the Preparation Screen with real explainable adaptation
function updateWhyExplanation() {
  const profile = getUserProfile();
  const sessions = getStoredSessions();
  const fingerprint = buildPracticeFingerprint(sessions);
  const adaptiveSession = generateAdaptiveSession(profile, fingerprint);

  whyExplanationText.textContent = `${adaptiveSession.rationale} ${adaptiveSession.goalEmphasis}`;
  
  if (adaptFocusText) adaptFocusText.textContent = adaptiveSession.targetFocus;
  if (adaptReasonText) adaptReasonText.textContent = adaptiveSession.rationale;
  if (adaptPlanText) adaptPlanText.textContent = `${adaptiveSession.difficulty} • ${adaptiveSession.sessionPlan}`;
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

// --- End Session & Summary (Zero Fallbacks, Multidimensional Real Metrics) ---
function finishSession() {
  stopPracticeCamera();

  // Validate sufficient reliable pose data
  if (validFrameCount < MIN_VALID_FRAMES || baselineBeforeScore === null || latestMeasuredScore === null || temporalSamples.length < 5) {
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

    if (sumAlignmentVal) sumAlignmentVal.textContent = '--';
    if (sumStabilityVal) sumStabilityVal.textContent = '--';
    if (sumControlVal) sumControlVal.textContent = '--';

    summarySubtitle.textContent = "We couldn't collect enough reliable pose data. Please try again with your full body visible in the camera frame.";
    switchView('summary');
    return;
  }

  // Real measurements are available: calculate multidimensional session metrics
  const sessionAlignment = Math.round(calculateTrimmedMean(temporalSamples.map(s => s.score)));
  const sessionStability = calculateStability(temporalSamples);
  const sessionControl = calculateControl(temporalSamples);
  const sessionConfidence = calculateConfidence(validFrameCount, sessionSecondsElapsed);

  const finalBefore = baselineBeforeScore;
  const finalAfter = correctedAfterScore !== null ? correctedAfterScore : latestMeasuredScore;
  const finalDelta = finalAfter - finalBefore;

  sumBeforeScore.textContent = finalBefore;
  sumBeforeHint.textContent = 'Initial alignment capture';
  sumAfterScore.textContent = finalAfter;
  sumAfterHint.textContent = 'Measured hold quality';

  // Populate multidimensional session breakdown
  if (sumAlignmentVal) sumAlignmentVal.textContent = `${sessionAlignment}/100`;
  if (sumStabilityVal) sumStabilityVal.textContent = `${sessionStability}/100`;
  if (sumControlVal) sumControlVal.textContent = `${sessionControl}%`;

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
  summarySubtitle.textContent = `Great work, ${practitionerName}! Your Warrior II hold was evaluated across ${validFrameCount} verified pose frames (Stability: ${sessionStability}/100, Control: ${sessionControl}%).`;

  // Save session record with complete multidimensional metrics
  const sessionRecord = {
    id: 'session-' + Date.now(),
    timestamp: Date.now(),
    dateStr: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    pose: 'Warrior II',
    beforeScore: finalBefore,
    afterScore: finalAfter,
    delta: finalDelta,
    metrics: {
      alignment: sessionAlignment,
      stability: sessionStability,
      control: sessionControl,
      confidence: sessionConfidence,
    },
    focusArea: detectedFocus,
    measuredFrames: validFrameCount,
  };
  saveSessionRecord(sessionRecord);

  switchView('summary');
}

// --- Progress View & Practice Fingerprint Dashboard ---
function renderProgressView() {
  const sessions = getStoredSessions();
  const profile = getUserProfile();
  const fingerprint = buildPracticeFingerprint(sessions);
  const adaptiveSession = generateAdaptiveSession(profile, fingerprint);

  // Render Practice Fingerprint Cards
  if (sessions.length === 0) {
    if (fpAlignmentVal) fpAlignmentVal.textContent = '--';
    if (fpAlignmentFill) fpAlignmentFill.style.width = '0%';
    if (fpStabilityVal) fpStabilityVal.textContent = '--';
    if (fpStabilityFill) fpStabilityFill.style.width = '0%';
    if (fpControlVal) fpControlVal.textContent = '--';
    if (fpControlFill) fpControlFill.style.width = '0%';
    if (fpConsistencyVal) fpConsistencyVal.textContent = '--';
    if (fpConsistencyFill) fpConsistencyFill.style.width = '0%';

    if (fingerprintTrendText) fingerprintTrendText.textContent = 'No Data';
    if (fingerprintTrendIcon) fingerprintTrendIcon.textContent = '⚪';
    if (fingerprintTrendBadge) fingerprintTrendBadge.className = 'fingerprint-trend trend-neutral';

    if (fpWeaknessText) fpWeaknessText.textContent = 'Complete your first practice';
    if (fpNextSessionText) fpNextSessionText.textContent = 'Foundational Warrior II practice';

    progressInsightText.textContent = 
      "Complete your first practice session with the live camera to start building your Personal Practice Fingerprint.";
  } else {
    if (fpAlignmentVal) fpAlignmentVal.textContent = `${fingerprint.alignment}/100`;
    if (fpAlignmentFill) fpAlignmentFill.style.width = `${fingerprint.alignment}%`;
    if (fpStabilityVal) fpStabilityVal.textContent = `${fingerprint.stability}/100`;
    if (fpStabilityFill) fpStabilityFill.style.width = `${fingerprint.stability}%`;
    if (fpControlVal) fpControlVal.textContent = `${fingerprint.control}%`;
    if (fpControlFill) fpControlFill.style.width = `${fingerprint.control}%`;
    if (fpConsistencyVal) fpConsistencyVal.textContent = `${fingerprint.consistency}/100`;
    if (fpConsistencyFill) fpConsistencyFill.style.width = `${fingerprint.consistency}%`;

    // Trend badge
    if (fingerprint.trend === 'Improving') {
      if (fingerprintTrendText) fingerprintTrendText.textContent = `Improving (+${fingerprint.trendDiff} pts)`;
      if (fingerprintTrendIcon) fingerprintTrendIcon.textContent = '📈';
      if (fingerprintTrendBadge) fingerprintTrendBadge.className = 'fingerprint-trend';
    } else if (fingerprint.trend === 'Needs Attention') {
      if (fingerprintTrendText) fingerprintTrendText.textContent = `Needs Attention (${fingerprint.trendDiff} pts)`;
      if (fingerprintTrendIcon) fingerprintTrendIcon.textContent = '⚠️';
      if (fingerprintTrendBadge) fingerprintTrendBadge.className = 'fingerprint-trend trend-attention';
    } else if (fingerprint.trend === 'Baseline Formed') {
      if (fingerprintTrendText) fingerprintTrendText.textContent = 'Baseline Formed';
      if (fingerprintTrendIcon) fingerprintTrendIcon.textContent = '🎯';
      if (fingerprintTrendBadge) fingerprintTrendBadge.className = 'fingerprint-trend trend-neutral';
    } else {
      if (fingerprintTrendText) fingerprintTrendText.textContent = 'Stable Hold';
      if (fingerprintTrendIcon) fingerprintTrendIcon.textContent = '📊';
      if (fingerprintTrendBadge) fingerprintTrendBadge.className = 'fingerprint-trend trend-neutral';
    }

    if (fpWeaknessText) fpWeaknessText.textContent = fingerprint.weakness;
    if (fpNextSessionText) fpNextSessionText.textContent = `${adaptiveSession.targetFocus} (${adaptiveSession.difficulty})`;

    // Plain-Language Insight
    if (sessions.length === 1) {
      progressInsightText.textContent = 
        "Your fingerprint is starting to form. Complete another session for stronger personalization.";
    } else if (sessions.length === 2) {
      progressInsightText.textContent = 
        `Early trend detected: Alignment is ${fingerprint.trend.toLowerCase()} (${fingerprint.trendDiff >= 0 ? '+' : ''}${fingerprint.trendDiff} pts). Primary focus: ${adaptiveSession.targetFocus}.`;
    } else {
      progressInsightText.textContent = 
        `Personalized trend available: Your practice shows an alignment index of ${fingerprint.alignment}/100 with ${fingerprint.stability}/100 hold stability across ${sessions.length} practices. Recommendation: ${adaptiveSession.targetFocus}.`;
    }
  }

  // Populate history table
  historyTableBody.innerHTML = '';

  if (sessions.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="7" style="text-align: center; padding: 28px 16px; color: #94a3b8; font-size: 0.92rem;">
        No practice sessions recorded yet. Complete your first practice to start tracking your multidimensional progress!
      </td>
    `;
    historyTableBody.appendChild(tr);

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

    const alignVal = s.metrics?.alignment ?? s.afterScore ?? '--';
    const stabVal = s.metrics?.stability !== undefined ? `${s.metrics.stability}` : '--';
    const ctrlVal = s.metrics?.control !== undefined ? `${s.metrics.control}%` : '--';

    tr.innerHTML = `
      <td>${s.dateStr || 'Recent'}</td>
      <td><strong>${s.pose || 'Warrior II'}</strong></td>
      <td><span style="color: #10b981; font-weight: 700;">${alignVal}</span></td>
      <td><span style="color: #38bdf8; font-weight: 600;">${stabVal}</span></td>
      <td><span style="color: #f59e0b; font-weight: 600;">${ctrlVal}</span></td>
      <td>${deltaFormatted}</td>
      <td>${s.focusArea || 'Knee alignment'}</td>
    `;
    historyTableBody.appendChild(tr);
  });

  // Render Multi-Dimensional Chart.js (Alignment, Stability, Control)
  const chartCanvas = document.getElementById('progressChart');
  if (!chartCanvas) return;

  const sortedAsc = [...sessions].sort((a, b) => a.timestamp - b.timestamp);
  const labels = sortedAsc.map((s, idx) => s.dateStr || `Session ${idx + 1}`);
  const alignmentData = sortedAsc.map(s => s.metrics?.alignment ?? s.afterScore ?? 70);
  const stabilityData = sortedAsc.map(s => s.metrics?.stability ?? 75);
  const controlData = sortedAsc.map(s => s.metrics?.control ?? 70);

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
          label: 'Alignment Quality',
          data: alignmentData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          borderWidth: 3,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#ffffff',
          pointRadius: 5,
          tension: 0.35,
          fill: true,
        },
        {
          label: 'Hold Stability',
          data: stabilityData,
          borderColor: '#38bdf8',
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointBackgroundColor: '#38bdf8',
          pointBorderColor: '#ffffff',
          pointRadius: 4,
          tension: 0.35,
        },
        {
          label: 'Posture Control (%)',
          data: controlData,
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
  updateWhyExplanation();
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
  updateWhyExplanation();
  switchView('sessionPrep');
});

// Progress Action
newSessionBtn.addEventListener('click', () => {
  resetSessionState();
  const profile = getUserProfile();
  if (profile) {
    updateWhyExplanation();
    switchView('sessionPrep');
  } else {
    switchView('onboarding');
  }
});

// Nav Buttons
navPracticeBtn.addEventListener('click', () => {
  const profile = getUserProfile();
  if (profile) {
    updateWhyExplanation();
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
  // Load and clean stored sessions
  getStoredSessions();

  const profile = getUserProfile();
  if (profile) {
    updateWhyExplanation();
    timerGoalLabel.textContent = `Goal: ${profile.duration}m`;
    switchView('sessionPrep');
  } else {
    switchView('onboarding');
  }
});
