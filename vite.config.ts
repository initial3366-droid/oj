/**
 * Vite 构建与开发服务器配置。
 * 开发环境将 HTTP 与 WebSocket 请求代理到同一个后端来源，避免浏览器跨域差异。
 */
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

declare const process: {
  cwd: () => string;
  env: Record<string, string | undefined>;
};

export default defineConfig(({ mode }) => {
  // loadEnv 的第三个参数为空字符串，表示同时读取带前缀和不带前缀的本地构建变量。
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget =
    env.VITE_API_PROXY_TARGET ?? process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:18080";
  // 保留主机、端口和路径，仅把 http(s) 协议映射为 ws(s) 供 Vite WebSocket 代理使用。
  const wsProxyTarget = apiProxyTarget.replace(/^http/, "ws");

  return {
    plugins: [react(), tailwindcss()],
    define: {
      global: "globalThis",
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
    server: {
      proxy: {
        "/api": apiProxyTarget,
        "/ws": {
          target: wsProxyTarget,
          ws: true,
        },
      },
    },
  };
});
