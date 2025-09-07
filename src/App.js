// src/App.js
import "./App.css";
import VisionSystem from "./VisionSystem";

function App() {
  return (
    <div className="App">
      <h1>Healthcare Gesture Control System</h1>
      <div style={{ position: "relative", width: "640px", height: "480px" }}>
        <VisionSystem />
      </div>
    </div>
  );
}

export default App;
