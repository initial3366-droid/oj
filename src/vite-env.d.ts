/// <reference types="vite/client" />
/**
 * viteenv模块。集中声明该文件对外提供的前端能力与初始化逻辑。
 */

interface ImportMetaEnv {
  readonly VITE_API_PROXY_TARGET: string;
  readonly VITE_WS_URL: string;
}

/**
 * ImportMeta接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
