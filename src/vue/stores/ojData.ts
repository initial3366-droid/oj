import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { hydrateStateFromApi } from "../../data/apiClient";
import type { CarouselSlide, Contest, OjState } from "../../data/types";
import { getFrontendAccessToken, getFrontendRefreshToken } from "../../api/authSession";

const STORAGE_KEY = "qoj.frontend.state.v1";

function emptyState(): OjState {
  return {
    activeUser: null,
    problems: [],
    contests: [],
    ratings: [],
    submissions: [],
    carouselSlides: [],
    judgeSettings: { enabled: true, enableSandbox: false },
  };
}

function initialState(): OjState {
  if (typeof window === "undefined") return emptyState();
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return emptyState();
    const cached = JSON.parse(stored) as OjState;
    if (!getFrontendAccessToken() && !getFrontendRefreshToken()) return { ...cached, activeUser: null };
    return cached;
  } catch {
    return emptyState();
  }
}

function persist(state: OjState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable in private browsing modes.
  }
}

export const useOjDataStore = defineStore("oj-data", () => {
  const state = ref<OjState>(initialState());
  const activeUser = computed(() => state.value.activeUser);
  const hydrated = ref(false);
  const id = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  async function hydrate() {
    if (hydrated.value) return;
    hydrated.value = true;
    state.value = await hydrateStateFromApi(state.value);
  }

  function updateState(updater: (current: OjState) => OjState) {
    state.value = updater(state.value);
    persist(state.value);
  }

  function upsertSlide(slide: CarouselSlide) {
    updateState((current) => {
      const normalized = { ...slide, id: slide.id || id("slide") };
      const exists = current.carouselSlides.some((item) => item.id === normalized.id);
      return { ...current, carouselSlides: exists
        ? current.carouselSlides.map((item) => item.id === normalized.id ? normalized : item)
        : [...current.carouselSlides, normalized] };
    });
  }

  function removeSlide(slideId: string) {
    updateState((current) => ({ ...current, carouselSlides: current.carouselSlides.filter((slide) => slide.id !== slideId) }));
  }

  function upsertContest(contest: Contest) {
    updateState((current) => {
      const normalized = { ...contest, id: contest.id || id("contest") };
      const exists = current.contests.some((item) => item.id === normalized.id);
      return { ...current, contests: exists
        ? current.contests.map((item) => item.id === normalized.id ? normalized : item)
        : [...current.contests, normalized] };
    });
  }

  function removeContest(contestId: string) {
    updateState((current) => ({ ...current, contests: current.contests.filter((contest) => contest.id !== contestId) }));
  }

  window.addEventListener("qoj:auth-cleared", () => {
    state.value = { ...state.value, activeUser: null };
    persist(state.value);
  });

  return { state, activeUser, hydrated, hydrate, updateState, upsertSlide, removeSlide, upsertContest, removeContest };
});
