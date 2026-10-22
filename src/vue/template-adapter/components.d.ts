import 'vue';
declare module 'vue' {
  export interface GlobalComponents {
    Pagination: typeof import("../../../vendor/vue3-element-admin/src/components/Pagination/index.vue")["default"];
    ElColorPicker: typeof import('element-plus')['ElColorPicker'];
  }
}
