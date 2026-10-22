<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { readAuthToken } from "../../api/tokenStorage";
import { adminPath } from "../../utils/adminPath";
import { adminWsClient, wsClient } from "../../utils/websocket";

const route = useRoute();
const authRevision = ref(0);
const adminRoot = adminPath("/").replace(/\/$/, "");

function isManagementPath(path: string) {
  return path === adminRoot || path.startsWith(`${adminRoot}/`);
}

function identityFor(token: string | null) {
  if (!token) return "";
  try {
    const payload = JSON.parse(window.atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return `${payload.accountType ?? ""}:${payload.sub ?? ""}`;
  } catch {
    return token;
  }
}

function refreshSession() {
  authRevision.value += 1;
}

onMounted(() => {
  window.addEventListener("storage", refreshSession);
  window.addEventListener("qoj:auth-cleared", refreshSession);
  window.addEventListener("qoj:admin-auth-changed", refreshSession);
});

onUnmounted(() => {
  window.removeEventListener("storage", refreshSession);
  window.removeEventListener("qoj:auth-cleared", refreshSession);
  window.removeEventListener("qoj:admin-auth-changed", refreshSession);
});

watch(
  () => {
    authRevision.value;
    const management = isManagementPath(route.path);
    const token = readAuthToken(management ? "admin" : "frontend");
    const identity = identityFor(token);
    return JSON.stringify([management ? "admin" : "frontend", identity]);
  },
  (sessionKey, _previous, onCleanup) => {
    const [portal, identity] = JSON.parse(sessionKey) as [string, string];
    if (!identity) return;
    const management = portal === "admin";

    const socket = management ? adminWsClient : wsClient;
    void socket.connect().catch(() => {
      // Connection state is surfaced by the contest messaging panel.
    });
    onCleanup(() => socket.disconnect());
  },
  { immediate: true },
);
</script>

<template />
