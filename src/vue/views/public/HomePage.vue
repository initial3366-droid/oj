<script setup lang="ts">
import { ArrowRight } from "@element-plus/icons-vue";
import { useOjDataStore } from "../../stores/ojData";
import SectionTitle from "../../../../vendor/vue3-element-admin/src/components/SectionTitle/index.vue";
import PinnedAnnouncementCard from "../../components/PinnedAnnouncementCard.vue";
import AnnouncementCard from "../../components/AnnouncementCard.vue";
import HomeCarousel from "../../components/HomeCarousel.vue";
import RatingTable from "../../components/RatingTable.vue";
import UpcomingContests from "../../components/UpcomingContests.vue";
const ojData = useOjDataStore();
</script>

<template>
  <div class="page-container h-auto" data-testid="frontend-home">
    <PinnedAnnouncementCard />
    <el-row :gutter="10" class="home-hero">
      <el-col v-if="ojData.state.carouselSlides.length" :xs="24" :lg="16" class="mb-10px"><HomeCarousel /></el-col>
      <el-col :xs="24" :lg="ojData.state.carouselSlides.length ? 8 : 24" class="mb-10px"><UpcomingContests /></el-col>
    </el-row>
    <AnnouncementCard />
    <el-card shadow="never">
      <template #header><div class="flex-x-between flex-wrap gap-2"><SectionTitle title="全站 AC 榜" tip="每日 00:00 刷新前十名" /><RouterLink to="/leaderboard"><el-button text type="primary">完整榜单<el-icon class="ml-1"><ArrowRight /></el-icon></el-button></RouterLink></div></template>
      <RatingTable />
    </el-card>
  </div>
</template>

<style scoped>
.home-hero{--home-hero-height:70vh;--home-hero-height:70dvh}
.home-hero :deep(.el-col > .el-card){height:calc(var(--home-hero-height) + 2px)}
.home-hero :deep(.el-col > .el-card > .el-card__body){box-sizing:border-box}
</style>
