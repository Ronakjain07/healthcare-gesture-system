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

// Add totalBlinks to the props
const Metrics = ({ blinkCount, lastAction, currentEAR, totalBlinks }) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        left: "20px",
        zIndex: 10,
        display: "flex",
      }}
    >
      <div style={metricStyle}>
        <div style={valueStyle}>{blinkCount}</div>
        <div style={labelStyle}>Consecutive Blinks</div>
      </div>
      {/* New Metric Box for Total Blinks */}
      <div style={metricStyle}>
        <div style={valueStyle}>{totalBlinks}</div>
        <div style={labelStyle}>Total Blinks</div>
      </div>
      <div style={metricStyle}>
        <div style={valueStyle}>{lastAction || "None"}</div>
        <div style={labelStyle}>Last Action</div>
      </div>
      <div style={{ ...metricStyle, backgroundColor: "#552222" }}>
        <div style={{ ...valueStyle, color: "#ff7777" }}>
          {(currentEAR || 0).toFixed(2)}
        </div>
        <div style={labelStyle}>Current EAR</div>
      </div>
    </div>
  );
};

export default Metrics;
