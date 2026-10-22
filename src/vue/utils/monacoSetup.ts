import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import "monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js";
import "monaco-editor/esm/vs/basic-languages/java/java.contribution.js";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution.js";
import "monaco-editor/min/vs/editor/editor.main.css";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker&inline";

declare global {
  interface Window {
    MonacoEnvironment?: { getWorker: (workerId: string, label: string) => Worker };
  }
}

window.MonacoEnvironment = {
  getWorker() { return new editorWorker(); },
};

monaco.editor.defineTheme("qoj-light", {
  base: "vs", inherit: true, rules: [],
  colors: { "editor.lineHighlightBackground": "#f3f4f6", "editor.lineHighlightBorder": "#00000000" },
});
monaco.editor.defineTheme("qoj-dark", {
  base: "vs-dark", inherit: true, rules: [],
  colors: { "editor.lineHighlightBackground": "#282828", "editor.lineHighlightBorder": "#00000000" },
});

export { monaco };
