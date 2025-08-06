import { useState } from "react";

/**
 * Simple test component to debug useState issue
 */
function TestApp() {
  console.log("TestApp rendering...");
  
  try {
    const [count, setCount] = useState(0);
    console.log("useState working, count:", count);
    
    return (
      <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
        <h1>Test App</h1>
        <p>Count: {count}</p>
        <button 
          onClick={() => setCount(count + 1)}
          style={{ 
            padding: "10px 20px", 
            fontSize: "16px",
            cursor: "pointer"
          }}
        >
          Increment
        </button>
        <p>If you can see this and the button works, React is working properly!</p>
      </div>
    );
  } catch (error) {
    console.error("Error in TestApp:", error);
    return (
      <div style={{ padding: "20px", color: "red" }}>
        <h1>Error in TestApp</h1>
        <p>Error: {String(error)}</p>
      </div>
    );
  }
}

export default TestApp;