/** Vue is the sole runtime for every frontend route. */
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("找不到应用根节点 #root");
}
const appRoot: HTMLElement = rootElement;

async function bootstrap() {
  try {
    const { mountVueApplication } = await import("./vue/main");
    mountVueApplication(appRoot);
  } catch (error) {
    console.error("QOJ 页面启动失败", error);
    appRoot.textContent = "页面加载失败，请刷新重试。";
  }
}

void bootstrap();
