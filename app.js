// Step 1: Webcam feed + MediaPipe Pose skeleton overlay
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const startCameraBtn = document.getElementById('startCameraBtn');
const cameraPrompt = document.getElementById('cameraPrompt');

let camera = null;
let pose = null;

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
