<script setup lang="ts">
import { inject } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";
import { managementBrandKey } from "./branding";

defineProps<{ to: RouteLocationRaw }>();
const brand = inject(managementBrandKey, undefined);
</script>

<template><RouterLink :to="brand?.home ?? to"><slot /></RouterLink></template>
