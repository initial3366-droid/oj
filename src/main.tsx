/**
 * 应用入口模块。集中声明该文件对外提供的前端能力与初始化逻辑。
 */
import React from "react";
import ReactDOM from "react-dom/client";
import "@douyinfe/semi-ui/react19-adapter";
import { BrowserRouter } from "react-router-dom";
import { filterReact19RefWarning } from "./utils/filterReact19RefWarning";
import { App } from "./App";
import { OjDataProvider } from "./data/OjDataProvider";
import "./styles/semi-base.css";
import "./styles/semi-theme.css";
import "./styles/semi-overrides.css";
import "./styles.css";

filterReact19RefWarning();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <OjDataProvider>
        <App />
      </OjDataProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
