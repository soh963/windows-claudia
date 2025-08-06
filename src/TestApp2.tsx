// Alternative import method
import * as React from "react";

/**
 * Test component with alternative React import
 */
function TestApp2() {
  console.log("TestApp2 rendering...");
  console.log("React object:", React);
  console.log("React.useState:", React.useState);
  
  try {
    // Use React.useState explicitly
    const [count, setCount] = React.useState(0);
    console.log("React.useState working, count:", count);
    
    return (
      <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
        <h1>Test App 2 - Alternative Import</h1>
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
        <p>Using React.useState explicitly</p>
      </div>
    );
  } catch (error) {
    console.error("Error in TestApp2:", error);
    return (
      <div style={{ padding: "20px", color: "red" }}>
        <h1>Error in TestApp2</h1>
        <p>Error: {String(error)}</p>
      </div>
    );
  }
}

export default TestApp2;