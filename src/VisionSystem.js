// src/VisionSystem.js
import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import Metrics from "./Metrics";

// Make sure to set your calibrated threshold here!
const BLINK_THRESHOLD = 0.22; // Example value, use your own!
const BLINK_RESET_FRAMES = 30;

const RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144];
const LEFT_EYE_INDICES = [362, 385, 387, 263, 373, 380];

const VisionSystem = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  const [blinkCount, setBlinkCount] = useState(0);
  const [totalBlinks, setTotalBlinks] = useState(0); // <-- 1. ADD NEW STATE
  const [lastAction, setLastAction] = useState("None");
  const [currentEAR, setCurrentEAR] = useState(0);

  const frameCounterRef = useRef(0);
  const consecutiveBlinksRef = useRef(0);
  const inBlinkRef = useRef(false);

  const euclideanDistance = (p1, p2) => {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  };

  const calculateEAR = (landmarks, eyeIndices) => {
    const p1 = landmarks[eyeIndices[0]];
    const p2 = landmarks[eyeIndices[1]];
    const p3 = landmarks[eyeIndices[2]];
    const p4 = landmarks[eyeIndices[3]];
    const p5 = landmarks[eyeIndices[4]];
    const p6 = landmarks[eyeIndices[5]];
    const verticalDist = euclideanDistance(p2, p6) + euclideanDistance(p3, p5);
    const horizontalDist = euclideanDistance(p1, p4);
    return verticalDist / (2.0 * horizontalDist);
  };

  function onResults(results) {
    if (
      canvasRef.current &&
      results.multiFaceLandmarks &&
      results.multiFaceLandmarks[0]
    ) {
      const landmarks = results.multiFaceLandmarks[0];
      const rightEAR = calculateEAR(landmarks, RIGHT_EYE_INDICES);
      const leftEAR = calculateEAR(landmarks, LEFT_EYE_INDICES);
      const avgEAR = (leftEAR + rightEAR) / 2.0;
      setCurrentEAR(avgEAR);

      if (avgEAR < BLINK_THRESHOLD) {
        if (!inBlinkRef.current) {
          inBlinkRef.current = true;
          consecutiveBlinksRef.current += 1;
          setBlinkCount(consecutiveBlinksRef.current);
          setTotalBlinks((prevTotal) => prevTotal + 1); // <-- 2. INCREMENT TOTAL BLINKS
        }
        frameCounterRef.current = 0;
      } else {
        inBlinkRef.current = false;
        frameCounterRef.current += 1;
        if (frameCounterRef.current > BLINK_RESET_FRAMES) {
          if (consecutiveBlinksRef.current === 5) {
            setLastAction("Water Requested");
          } else if (consecutiveBlinksRef.current === 7) {
            setLastAction("Food Requested");
          }
          consecutiveBlinksRef.current = 0;
          setBlinkCount(0);
        }
      }

      const canvasElement = canvasRef.current;
      const canvasCtx = canvasElement.getContext("2d");
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );
      canvasCtx.restore();
    }
  }

  useEffect(() => {
    // ... (useEffect hook remains exactly the same, no changes needed here)
    const faceMesh = new FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
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
    <div>
      {/* Pass the new totalBlinks state down to the metrics component */}
      <Metrics
        blinkCount={blinkCount}
        lastAction={lastAction}
        currentEAR={currentEAR}
        totalBlinks={totalBlinks}
      />
      <Webcam
        ref={webcamRef}
        style={{
          position: "absolute",
          marginLeft: "auto",
          marginRight: "auto",
          left: 0,
          right: 0,
          textAlign: "center",
          zIndex: 8,
          width: 640,
          height: 480,
          visibility: "hidden",
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          marginLeft: "auto",
          marginRight: "auto",
          left: 0,
          right: 0,
          textAlign: "center",
          zIndex: 8,
          width: 640,
          height: 480,
        }}
      ></canvas>
    </div>
  );
};

export default VisionSystem;
