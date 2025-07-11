import { createRoot } from "react-dom/client";
import { VSCodeFlowEditor } from "./VSCodeFlowEditor";
import { getBootstrapData } from "./bootstrap";
import { safelyAcquireApi } from "./vscode-ports";
import "./index.css";

const bootstrap = getBootstrapData();

// Apply dark mode class to body if needed
if (bootstrap?.darkMode) {
  document.body.classList.add('dark');
} else {
  document.body.classList.remove('dark');
}

const root = createRoot(document.getElementById("root") as HTMLElement);

if (!bootstrap) {
  // Show a nice error message
  root.render(
    <div style={{ padding: "20px", color: "#666", backgroundColor: "#1e1e1e", textAlign: "center" }}>
      <h1>Unable to load flow editor</h1>
      <p>Please try reopening the file</p>
    </div>
  );
} else {
  root.render(<VSCodeFlowEditor {...bootstrap} />);
}


window.addEventListener("message", (event) => {
  const { data } = event;
  if (data && data.type === "__webviewTestingCommand") {
    let response: any;
    let error: any;
    switch (data.command) {
      case "$$": {
        const { selector } = data.params;
        const elements = document.querySelectorAll(selector);
        response = Array.from(elements).map((element) => {
          return {
            innerHTML: element.innerHTML,
            textContent: element.textContent,
            outerHTML: element.outerHTML,
          };
        });
        break;
      }
      case "click": {
        const { selector } = data.params;
        const element = document.querySelector(selector);
        if (element) {
          (element as HTMLElement).click();
          response = {};
        } else {
          error = `Element not found: ${selector}`;
        }
        break;
      }
      case "clickByText": {
        const { text, tagName = "button" } = data.params;
        const elements = document.querySelectorAll(tagName);
        let found = false;
        for (const element of elements) {
          if (element.textContent && element.textContent.toLowerCase().includes(text.toLowerCase())) {
            (element as HTMLElement).click();
            found = true;
            break;
          }
        }
        if (found) {
          response = {};
        } else {
          error = `Element with text "${text}" not found`;
        }
        break;
      }
      case "getDebuggerEvents": {
        response = (window as any).__testCapturedDebuggerEvents || [];
        // Clear events after retrieval to avoid accumulation
        if ((window as any).__testCapturedDebuggerEvents) {
          (window as any).__testCapturedDebuggerEvents = [];
        }
        break;
      }
      default: {
        error = `Unknown command: ${data.command}`;
      }
    }

    const vscode = safelyAcquireApi();
    
    if (!vscode) {
      return;
    }

    vscode.postMessage(
      { type: "__webviewTestingResponse", response, error },
      "*"
    );
  }
});