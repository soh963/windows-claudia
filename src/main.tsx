import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./assets/shimmer.css";
import "./styles.css";

// Ensure DOM is ready
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Failed to find the root element. Make sure there is a <div id='root'></div> in your HTML.");
}

console.log("React version:", React.version);
console.log("Root element:", rootElement);

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
