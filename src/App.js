// src/App.js
import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import { FaceMesh, FACEMESH_TESSELATION } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors } from "@mediapipe/drawing_utils";
import Metrics from "./Metrics";
import "./App.css";

// --- Configuration Constants ---
const BLINK_THRESHOLD = 0.23;
const SLEEP_THRESHOLD_FRAMES = 210; // ~7 seconds
const AWAKE_THRESHOLD_FRAMES = 210; // ~7 seconds
const SMILE_THRESHOLD = 0.42;
const MOUTH_OPEN_THRESHOLD = 0.18;
const BLINK_RESET_FRAMES = 50;
const NOSE_X_THRESHOLD_LEFT = 0.45,
  NOSE_X_THRESHOLD_RIGHT = 0.55;
const NOSE_Y_THRESHOLD_UP = 0.45,
  NOSE_Y_THRESHOLD_DOWN = 0.6;
const GESTURE_SEQUENCE_FRAMES = 60;
const GESTURE_ACTIONS = {
  WASHROOM: ["Left", "Right", "Left", "Right"],
  EMERGENCY: ["Up", "Down", "Up", "Down"],
};
const RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144];
const LEFT_EYE_INDICES = [362, 385, 387, 263, 373, 380];

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const pipCanvasRef = useRef(null);

  const [lastAction, setLastAction] = useState("None");
  const [headPose, setHeadPose] = useState("Center");
  const [blinkCount, setBlinkCount] = useState(0);
  const [totalBlinks, setTotalBlinks] = useState(0);
  const [patientStatus, setPatientStatus] = useState("Awake");
  const [currentExpression, setCurrentExpression] = useState("Neutral");

  const expressionDurationsRef = useRef({ Happy: 0, Surprised: 0, Neutral: 0 });
  const lastFrameTimeRef = useRef(performance.now());
  const consecutiveBlinksRef = useRef(0);
  const inBlinkRef = useRef(false);
  const blinkFrameCounterRef = useRef(0);
  const eyesClosedFrameCounterRef = useRef(0);
  const eyesOpenFrameCounterRef = useRef(0);
  const gestureSequenceRef = useRef([]);
  const gestureFrameCounterRef = useRef(0);
  const lastDirectionRef = useRef(null);
  const lastActionSentRef = useRef("None");

  const onResults = (results) => {
    if (
      !canvasRef.current ||
      !pipCanvasRef.current ||
      !results.multiFaceLandmarks ||
      !results.multiFaceLandmarks[0]
    )
      return;

    const now = performance.now();
    const deltaTime = (now - lastFrameTimeRef.current) / 1000;
    lastFrameTimeRef.current = now;

    const canvasCtx = canvasRef.current.getContext("2d");
    canvasCtx.save();
    canvasCtx.clearRect(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );
    canvasCtx.drawImage(
      results.image,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    const landmarks = results.multiFaceLandmarks[0];

    const pipCtx = pipCanvasRef.current.getContext("2d");
    pipCtx.save();
    pipCtx.clearRect(
      0,
      0,
      pipCanvasRef.current.width,
      pipCanvasRef.current.height
    );
    pipCtx.drawImage(
      results.image,
      0,
      0,
      pipCanvasRef.current.width,
      pipCanvasRef.current.height
    );
    drawConnectors(pipCtx, landmarks, FACEMESH_TESSELATION, {
      color: "#4dff4d70",
      lineWidth: 0.5,
    });
    pipCtx.restore();

    const euclideanDistance = (p1, p2) =>
      Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    const calculateEAR = (landmarks, eyeIndices) => {
      const p1 = landmarks[eyeIndices[0]],
        p2 = landmarks[eyeIndices[1]],
        p3 = landmarks[eyeIndices[2]],
        p4 = landmarks[eyeIndices[3]],
        p5 = landmarks[eyeIndices[4]],
        p6 = landmarks[eyeIndices[5]];
      return (
        (euclideanDistance(p2, p6) + euclideanDistance(p3, p5)) /
        (2.0 * euclideanDistance(p1, p4))
      );
    };

    const rightEAR = calculateEAR(landmarks, RIGHT_EYE_INDICES);
    const leftEAR = calculateEAR(landmarks, LEFT_EYE_INDICES);
    const avgEAR = (leftEAR + rightEAR) / 2.0;

    if (avgEAR < BLINK_THRESHOLD) {
      if (!inBlinkRef.current) {
        inBlinkRef.current = true;
        consecutiveBlinksRef.current++;
        setBlinkCount(consecutiveBlinksRef.current);
        setTotalBlinks((prev) => prev + 1);
      }
      blinkFrameCounterRef.current = 0;
      eyesOpenFrameCounterRef.current = 0;
      eyesClosedFrameCounterRef.current++;
      if (eyesClosedFrameCounterRef.current > SLEEP_THRESHOLD_FRAMES) {
        // --- FIX #1: Use functional update to avoid stale state ---
        setPatientStatus((currentStatus) =>
          currentStatus === "Awake" ? "Sleeping" : currentStatus
        );
      }
    } else {
      inBlinkRef.current = false;
      eyesClosedFrameCounterRef.current = 0;
      eyesOpenFrameCounterRef.current++;
      if (eyesOpenFrameCounterRef.current > AWAKE_THRESHOLD_FRAMES) {
        // --- FIX #2: Use functional update to avoid stale state ---
        setPatientStatus((currentStatus) =>
          currentStatus === "Sleeping" ? "Awake" : currentStatus
        );
      }
      blinkFrameCounterRef.current++;
      if (blinkFrameCounterRef.current > BLINK_RESET_FRAMES) {
        if (consecutiveBlinksRef.current === 5)
          setLastAction("Water Requested");
        else if (consecutiveBlinksRef.current === 7)
          setLastAction("Food Requested");
        consecutiveBlinksRef.current = 0;
        setBlinkCount(0);
      }
    }

    const processHeadGesture = (direction) => {
      if (direction !== lastDirectionRef.current && direction !== "Center") {
        gestureSequenceRef.current.push(direction);
        lastDirectionRef.current = direction;
        gestureFrameCounterRef.current = 0;
        if (
          gestureSequenceRef.current.slice(-4).join(",") ===
          GESTURE_ACTIONS.WASHROOM.join(",")
        ) {
          setLastAction("Washroom Requested");
          gestureSequenceRef.current = [];
        }
        if (
          gestureSequenceRef.current.slice(-4).join(",") ===
          GESTURE_ACTIONS.EMERGENCY.join(",")
        ) {
          setLastAction("EMERGENCY ALERT");
          gestureSequenceRef.current = [];
        }
      }
    };

    const nose = landmarks[1];
    if (nose) {
      const mirroredX = 1.0 - nose.x;
      const noseY = nose.y;
      let currentDirection = "Center";
      const deltaX = Math.abs(mirroredX - 0.5);
      const deltaY = Math.abs(noseY - 0.5);
      if (deltaX > deltaY) {
        if (mirroredX < NOSE_X_THRESHOLD_LEFT) currentDirection = "Left";
        else if (mirroredX > NOSE_X_THRESHOLD_RIGHT) currentDirection = "Right";
      } else {
        if (noseY < NOSE_Y_THRESHOLD_UP) currentDirection = "Up";
        else if (noseY > NOSE_Y_THRESHOLD_DOWN) currentDirection = "Down";
      }
      setHeadPose(currentDirection);
      processHeadGesture(currentDirection);
    }

    const leftMouth = landmarks[61],
      rightMouth = landmarks[291];
    const topLip = landmarks[13],
      bottomLip = landmarks[14];
    const leftFace = landmarks[234],
      rightFace = landmarks[454];
    if (
      leftMouth &&
      rightMouth &&
      topLip &&
      bottomLip &&
      leftFace &&
      rightFace
    ) {
      const mouthWidth = euclideanDistance(leftMouth, rightMouth);
      const faceWidth = euclideanDistance(leftFace, rightFace);
      const smileRatio = mouthWidth / faceWidth;
      const mouthHeight = euclideanDistance(topLip, bottomLip);
      const faceHeight = Math.abs(landmarks[10].y - landmarks[152].y);
      const mouthOpenRatio = mouthHeight / faceHeight;

      let detectedExpression = "Neutral";
      if (smileRatio > SMILE_THRESHOLD) {
        detectedExpression = "Happy";
      } else if (mouthOpenRatio > MOUTH_OPEN_THRESHOLD) {
        detectedExpression = "Surprised";
      }

      setCurrentExpression(detectedExpression);
      expressionDurationsRef.current[detectedExpression] += deltaTime;
    }

    gestureFrameCounterRef.current++;
    if (gestureFrameCounterRef.current > GESTURE_SEQUENCE_FRAMES) {
      gestureSequenceRef.current = [];
      lastDirectionRef.current = "Center";
    }
    canvasCtx.restore();
  };

  useEffect(() => {
    let messageToSend = null;
    if (lastAction !== "None" && lastAction !== lastActionSentRef.current) {
      messageToSend = `🚨 Patient Alert: ${lastAction}`;
      lastActionSentRef.current = lastAction;
    } else if (
      patientStatus === "Sleeping" &&
      lastActionSentRef.current !== "Patient is Sleeping"
    ) {
      messageToSend = `💤 Patient Status: Sleeping`;
      lastActionSentRef.current = "Patient is Sleeping";
    } else if (
      patientStatus === "Awake" &&
      lastActionSentRef.current === "Patient is Sleeping"
    ) {
      messageToSend = `☀️ Patient Status: Awake`;
      lastActionSentRef.current = "Awake";
    }
    if (messageToSend) {
      fetch("http://localhost:3001/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend }),
      }).catch((error) => console.error("Error sending notification:", error));
    }
    fetch("http://localhost:3001/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: patientStatus }),
    }).catch((error) => console.error("Error updating server status:", error));
  }, [lastAction, patientStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetch("http://localhost:3001/update-expressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durations: expressionDurationsRef.current }),
      }).catch((error) => console.error("Error updating expressions:", error));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const faceMesh = new FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    faceMesh.onResults(onResults);
    if (webcamRef.current && webcamRef.current.video) {
      const camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (webcamRef.current && webcamRef.current.video)
            await faceMesh.send({ image: webcamRef.current.video });
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }
  }, []);

  return (
    <div className="App">
      <h1>Healthcare Gesture Control System</h1>
      <div className="container">
        <Webcam ref={webcamRef} className="webcam" />
        <canvas ref={canvasRef} className="canvas" />
        <canvas ref={pipCanvasRef} className="pip-canvas" />
      </div>
      <Metrics
        blinkCount={blinkCount}
        lastAction={lastAction}
        totalBlinks={totalBlinks}
        headPose={headPose}
        patientStatus={patientStatus}
        currentExpression={currentExpression}
      />
    </div>
  );
}

export default App;
