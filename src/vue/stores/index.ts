import type { App } from "vue";
import { store } from "../template-adapter/store";
export function setupStore(app: App<Element>) { app.use(store); }
