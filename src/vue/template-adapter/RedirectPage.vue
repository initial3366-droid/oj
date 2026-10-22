<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
const route = useRoute();
const router = useRouter();
onMounted(() => {
  const value = route.params.path;
  const path = Array.isArray(value) ? value.join('/') : value || '';
  void router.replace({ path: `/${path.replace(/^\/+/, '')}`, query: route.query, hash: route.hash });
});
</script>
<template><span /></template>
