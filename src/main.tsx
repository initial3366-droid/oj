import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@arco-design/web-react/es/_util/react-19-adapter";
import "./utils/arcoMessagePatch";
import { filterReact19RefWarning } from "./utils/filterReact19RefWarning";
import "./utils/monacoSetup";
import { App } from "./App";
import { OjDataProvider } from "./data/OjDataProvider";
import { Message } from "@arco-design/web-react";
import "@arco-design/web-react/dist/css/arco.css";
import "./styles/semi-base.css";
import "./styles/semi-theme.css";
import "./styles/semi-overrides.css";
import "./styles.css";

filterReact19RefWarning();

// 配置 Arco Design Message 使用 React 18 的 createRoot API
Message.config({
  maxCount: 3,
  duration: 3000,
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <OjDataProvider>
        <App />
      </OjDataProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
