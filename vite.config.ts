/**
 * Vite 构建与开发服务器配置。
 * 开发环境将 HTTP 与 WebSocket 请求代理到同一个后端来源，避免浏览器跨域差异。
 */
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * 构建完成后将所有 CSS 与 JS chunk 显式写入入口 HTML，便于静态部署时统一加载资源。
 * JS 使用 modulepreload，避免把带有共享依赖的 chunk 当作独立入口重复执行。
 */
function preloadAllBuildAssets(): Plugin {
  return {
    name: "preload-all-build-assets",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const indexAsset = bundle["index.html"];
      if (!indexAsset || indexAsset.type !== "asset" || typeof indexAsset.source !== "string") return;

      const existingReferences: Record<string, boolean> = {};
      const references = indexAsset.source.match(/(?:src|href)="\/(assets\/[^\"]+)"/g) || [];
      references.forEach((reference) => {
        const match = reference.match(/\/(assets\/[^\"]+)"/);
        if (match) existingReferences[match[1]] = true;
      });

      const assetFiles: string[] = [];
      Object.keys(bundle).forEach((key) => {
        const fileName = bundle[key].fileName;
        if (/^assets\/.+\.(css|js)$/.test(fileName) && !existingReferences[fileName]) {
          assetFiles.push(fileName);
        }
      });
      assetFiles.sort();
      const assetLinks = assetFiles
        .map((fileName) => fileName.slice(-3) === ".js"
          ? `<link rel="modulepreload" crossorigin href="/${fileName}">`
          : `<link rel="stylesheet" crossorigin href="/${fileName}">`)
        .join("\n    ");

      if (assetLinks) {
        indexAsset.source = indexAsset.source.replace("</head>", `    ${assetLinks}\n  </head>`);
      }
      // index.html 只包含入口标签和资源引用，去掉构建产物中的无意义空白以减小体积。
      indexAsset.source = indexAsset.source
        .replace(/>\s+</g, "><")
        .replace(/\s{2,}/g, " ")
        .trim();
    },
  };
}

declare const process: {
  cwd: () => string;
  env: Record<string, string | undefined>;
};

export default defineConfig(({ mode }) => {
  // loadEnv 的第三个参数为空字符串，表示同时读取带前缀和不带前缀的本地构建变量。
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget =
    process.env.VITE_API_PROXY_TARGET ?? env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:18080";
  // 保留主机、端口和路径，仅把 http(s) 协议映射为 ws(s) 供 Vite WebSocket 代理使用。
  const wsProxyTarget = apiProxyTarget.replace(/^http/, "ws");

  return {
    plugins: [react(), tailwindcss(), preloadAllBuildAssets()],
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
    build: {
      // Monaco 编辑器等大型依赖属于预期体积，避免构建时反复输出误导性的 500KB 警告。
      chunkSizeWarningLimit: 5000,
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
