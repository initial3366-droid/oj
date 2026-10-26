/** Vue 管理端应用入口，沿用模板的插件式应用装配方式。 */
import { createApp } from "vue";
import "../styles/tokens.css";
import "element-plus/dist/index.css";
import "./styles/global.css";
import "element-plus/theme-chalk/dark/css-vars.css";
import "../../vendor/vue3-element-admin/src/styles/index.scss";
import "uno.css";
import "animate.css";
import "./template-adapter/theme.css";
import "./styles/management.css";
import "./styles/content.css";
import "./styles/management-spacing.css";
import { setupI18n } from "../../vendor/vue3-element-admin/src/lang";
import * as ElementPlusIcons from "@element-plus/icons-vue";
import App from "./App.vue";
import router from "./router";
import { setupStore } from "./stores";

export function mountVueApplication(rootElement: HTMLElement) {
  rootElement.replaceChildren();
  const app = createApp(App);
  setupStore(app);
  setupI18n(app);
  Object.entries(ElementPlusIcons).forEach(([name, component]) => app.component(name, component));
  app.use(router);
  app.mount(rootElement);
  return app;
}
