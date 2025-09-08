// src/App.js
import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import Metrics from "./Metrics";
import "./App.css";

// --- Configuration Constants ---
const BLINK_THRESHOLD = 0.23;
const BLINK_RESET_FRAMES = 50;

// --- TUNED VALUES FOR HEAD GESTURES ---
// The "center" zone for left/right is now wider, making it easier to return to center.
const NOSE_X_THRESHOLD_LEFT = 0.45; // Was 0.48
const NOSE_X_THRESHOLD_RIGHT = 0.55; // Was 0.52
const NOSE_Y_THRESHOLD_UP = 0.45;
const NOSE_Y_THRESHOLD_DOWN = 0.6;

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

  const [lastAction, setLastAction] = useState("None");
  const [headPose, setHeadPose] = useState("Center");
  const [blinkCount, setBlinkCount] = useState(0);
  const [totalBlinks, setTotalBlinks] = useState(0);

  const consecutiveBlinksRef = useRef(0);
  const inBlinkRef = useRef(false);
  const blinkFrameCounterRef = useRef(0);
  const gestureSequenceRef = useRef([]);
  const gestureFrameCounterRef = useRef(0);
  const lastDirectionRef = useRef(null);
  const lastActionSentRef = useRef("None");

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

  const onResults = (results) => {
    if (
      !canvasRef.current ||
      !results.multiFaceLandmarks ||
      !results.multiFaceLandmarks[0]
    )
      return;
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
    } else {
      inBlinkRef.current = false;
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

    gestureFrameCounterRef.current++;
    if (gestureFrameCounterRef.current > GESTURE_SEQUENCE_FRAMES) {
      gestureSequenceRef.current = [];
      lastDirectionRef.current = "Center";
    }
    canvasCtx.restore();
  };

  useEffect(() => {
    if (lastAction !== "None" && lastAction !== lastActionSentRef.current) {
      console.log(`Action triggered: ${lastAction}. Sending notification...`);
      fetch("http://localhost:3001/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `🚨 Patient Alert: ${lastAction}` }),
      })
        .then((response) => response.json())
        .then((data) => console.log("Server response:", data))
        .catch((error) => console.error("Error sending notification:", error));

      lastActionSentRef.current = lastAction;
    }
  }, [lastAction]);

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
      </div>
      <Metrics
        blinkCount={blinkCount}
        lastAction={lastAction}
        totalBlinks={totalBlinks}
        headPose={headPose}
      />
    </div>
  );
}

export default App;
