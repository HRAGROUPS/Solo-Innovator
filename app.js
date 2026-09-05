// Step 2: Warrior II Angle Calculations and Stance Detection
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const startCameraBtn = document.getElementById('startCameraBtn');
const cameraPrompt = document.getElementById('cameraPrompt');

let camera = null;
let pose = null;

const LM = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
};

function calculateAngle2D(p1, p2, p3) {
  const v1x = p1.x - p2.x, v1y = p1.y - p2.y;
  const v2x = p3.x - p2.x, v2y = p3.y - p2.y;
  const dot = v1x * v2x + v1y * v2y;
  const mag1 = Math.hypot(v1x, v1y), mag2 = Math.hypot(v2x, v2y);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cosVal = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.round((Math.acos(cosVal) * 180) / Math.PI);
}

function calculateHorizontalAngle(p1, p2) {
  const dx = Math.abs(p2.x - p1.x), dy = Math.abs(p2.y - p1.y);
  if (dx === 0 && dy === 0) return 0;
  return Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
}

function analyzeWarriorII(landmarks) {
  const lKneeAngle = calculateAngle2D(landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE], landmarks[LM.LEFT_ANKLE]);
  const rKneeAngle = calculateAngle2D(landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_KNEE], landmarks[LM.RIGHT_ANKLE]);

  const frontLeg = lKneeAngle < rKneeAngle ? 'left' : 'right';
  const frontKneeAngle = Math.min(lKneeAngle, rKneeAngle);
  const rearKneeAngle = Math.max(lKneeAngle, rKneeAngle);
  const shoulderTilt = calculateHorizontalAngle(landmarks[LM.LEFT_SHOULDER], landmarks[LM.RIGHT_SHOULDER]);
  const isWarriorStance = frontKneeAngle < 135 && rearKneeAngle > 130;

  return { frontLeg, frontKneeAngle, rearKneeAngle, shoulderTilt, isWarriorStance };
}

function initPose() {
  pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
  });
  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  pose.onResults(onResults);
}

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.translate(canvasElement.width, 0);
  canvasCtx.scale(-1, 1);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.poseLandmarks) {
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00F0FF', lineWidth: 4 });
    drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#FF2E93', lineWidth: 2, radius: 4 });

    const analysis = analyzeWarriorII(results.poseLandmarks);
    console.log(`[Warrior II] Front knee (${analysis.frontLeg}): ${analysis.frontKneeAngle}° | Shoulder tilt: ${analysis.shoulderTilt}°`);
  }
  canvasCtx.restore();
}

async function startCamera() {
  initPose();
  camera = new Camera(videoElement, {
    onFrame: async () => {
      await pose.send({ image: videoElement });
    },
    width: 640,
    height: 480,
  });
  await camera.start();
  cameraPrompt.style.display = 'none';
}

startCameraBtn.addEventListener('click', startCamera);
