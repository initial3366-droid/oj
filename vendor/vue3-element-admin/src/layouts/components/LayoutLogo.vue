<template>
  <div class="layout-logo">
    <transition enter-active-class="animate__animated animate__fadeInLeft">
      <router-link :key="+collapse" class="wh-full flex-center" to="/">
        <img :src="logo" class="w20px h20px" />
        <span v-if="!collapse" class="layout-logo__title">
          {{ appConfig.title }}
        </span>
      </router-link>
    </transition>
  </div>
</template>

<script lang="ts" setup>
import { appConfig as defaultConfig } from "@/settings";
import { computed, inject } from "vue";
import RouterLink from "../../../../../src/vue/template-adapter/ManagementHomeLink.vue";
import { managementBrandKey } from "../../../../../src/vue/template-adapter/branding";
import defaultLogo from "@/assets/images/logo.png";
const brand = inject(managementBrandKey, undefined);
const logo = computed(() => brand?.value.logo || defaultLogo);
const appConfig = computed(() => ({ title: brand?.value.title || defaultConfig.title }));

defineProps({
  collapse: {
    type: Boolean,
    required: true,
  },
});
</script>

<style lang="scss" scoped>
.layout-logo {
  width: 100%;
  height: $navbar-height;
  background-color: $sidebar-logo-background;

  &__title {
    flex-shrink: 0;
    margin-left: 10px;
    font-size: 14px;
    font-weight: bold;
    color: $sidebar-logo-text-color;
  }
}
</style>

<style lang="scss">
.layout-root.layout--top,
.layout-root.layout--mix {
  .layout-logo {
    background-color: transparent !important;

    &__title {
      color: var(--menu-text);
    }
  }
}

.layout-root.is-sidebar-open {
  &.layout--top .layout-header__left .layout-logo,
  &.layout--mix .layout-header__logo .layout-logo {
    width: $sidebar-width;
  }
}

.layout-root.is-sidebar-collapsed {
  &.layout--top .layout-header__left .layout-logo,
  &.layout--mix .layout-header__logo .layout-logo {
    width: $sidebar-width-collapsed;
  }

  .layout-logo__title {
    display: none;
  }
}
</style>
