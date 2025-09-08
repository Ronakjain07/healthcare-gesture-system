// src/Metrics.js
import React from "react";

const metricStyle = {
  backgroundColor: "#333",
  borderRadius: "8px",
  padding: "15px",
  margin: "10px",
  minWidth: "150px",
  textAlign: "center",
};

const valueStyle = {
  fontSize: "2rem",
  fontWeight: "bold",
  color: "#4dff4d",
};

const labelStyle = {
  fontSize: "1rem",
  color: "#ccc",
};

const Metrics = ({
  blinkCount,
  lastAction,
  totalBlinks,
  headPose,
  patientStatus,
  currentExpression,
}) => {
  return (
    <div
      style={{
        zIndex: 10,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        marginTop: "20px",
      }}
    >
      <div style={{ ...metricStyle, backgroundColor: "#a67c00" }}>
        <div
          style={{
            ...valueStyle,
            color: "#ffd700",
            fontSize: "1.5rem",
            minHeight: "38px",
          }}
        >
          {currentExpression || "Neutral"}
        </div>
        <div style={labelStyle}>Current Expression</div>
      </div>
      <div style={{ ...metricStyle, backgroundColor: "#5c3c8a" }}>
        <div
          style={{
            ...valueStyle,
            color: "#d9a9ff",
            fontSize: "1.5rem",
            minHeight: "38px",
          }}
        >
          {patientStatus || "Awake"}
        </div>
        <div style={labelStyle}>Patient Status</div>
      </div>
      <div style={metricStyle}>
        <div style={valueStyle}>{blinkCount}</div>
        <div style={labelStyle}>Consecutive Blinks</div>
      </div>
      <div style={metricStyle}>
        <div style={valueStyle}>{totalBlinks}</div>
        <div style={labelStyle}>Total Blinks</div>
      </div>
      <div style={{ ...metricStyle, backgroundColor: "#223355" }}>
        <div
          style={{
            ...valueStyle,
            color: "#77aaff",
            fontSize: "1.5rem",
            minHeight: "38px",
          }}
        >
          {headPose || "Center"}
        </div>
        <div style={labelStyle}>Head Pose</div>
      </div>
      <div style={metricStyle}>
        <div style={valueStyle}>{lastAction || "None"}</div>
        <div style={labelStyle}>Last Action</div>
      </div>
    </div>
  );
};

export default Metrics;
