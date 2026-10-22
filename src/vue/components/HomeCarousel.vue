<script setup lang="ts">
import { computed } from "vue";
import { useOjDataStore } from "../stores/ojData";
const ojData = useOjDataStore();
const slides = computed(() => ojData.state.carouselSlides);
</script>
<template>
  <el-card v-if="slides.length" shadow="never" :body-style="{ padding: '0' }">
    <el-carousel :interval="5200" :autoplay="slides.length > 1" :arrow="slides.length > 1 ? 'hover' : 'never'" :indicator-position="slides.length > 1 ? 'inside' : 'none'" height="var(--home-hero-height, 420px)">
      <el-carousel-item v-for="slide in slides" :key="slide.id"><el-image :src="slide.imageUrl" :alt="slide.title" fit="cover" class="wh-full" /></el-carousel-item>
    </el-carousel>
  </el-card>
</template>
