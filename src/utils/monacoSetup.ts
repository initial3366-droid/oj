/**
 * monacoSetup工具模块。提供无页面依赖的通用处理能力。
 */
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import "monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js";
import "monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution.js";
import "monaco-editor/esm/vs/basic-languages/go/go.contribution.js";
import "monaco-editor/esm/vs/basic-languages/java/java.contribution.js";
import "monaco-editor/esm/vs/basic-languages/kotlin/kotlin.contribution.js";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution.js";
import "monaco-editor/esm/vs/basic-languages/rust/rust.contribution.js";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

declare global {
  /**
   * Window接口，明确该模块内部及 API 边界使用的数据结构。
   */
  interface Window {
    MonacoEnvironment?: {
      getWorker: (workerId: string, label: string) => Worker;
    };
  }
}

window.MonacoEnvironment = {
  /**
   * 读取Worker并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  getWorker(_workerId: string, label: string) {
    return new editorWorker();
  },
};

loader.config({ monaco });
