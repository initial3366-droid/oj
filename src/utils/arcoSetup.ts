/**
 * arcoSetup工具模块。提供无页面依赖的通用处理能力。
 */
import "@arco-design/web-react/es/_util/react-19-adapter";
import "@arco-design/web-react/dist/css/arco.css";
import { Message } from "@arco-design/web-react";
import "./arcoMessagePatch";

Message.config({
  maxCount: 3,
  duration: 3000,
});
