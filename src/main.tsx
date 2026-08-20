/**
 * 应用入口模块。集中声明该文件对外提供的前端能力与初始化逻辑。
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { filterReact19RefWarning } from "./utils/filterReact19RefWarning";
import { App } from "./App";
import { OjDataProvider } from "./data/OjDataProvider";
import "katex/dist/katex.min.css";
import "./styles/tokens.css";
import "./styles.css";

filterReact19RefWarning();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ConfigProvider locale={zhCN}>
        <OjDataProvider>
          <App />
        </OjDataProvider>
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
