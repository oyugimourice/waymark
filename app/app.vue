<script setup lang="ts">
useHead({
  title: 'Aurora',
  meta: [{ name: 'description', content: 'Aurora — a quiet way to remember the places you find.' }]
})
</script>

<template>
  <div class="page">
    <NuxtRouteAnnouncer />
    <main class="hero">
      <h1>aurora</h1>
      <p class="tagline">a quiet way to remember the places you find</p>
    </main>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  min-height: 100dvh;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  color: #1c1c1a;
  font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.875rem;
  padding: 2rem;
  text-align: center;
  animation: rise 1.4s ease-out;
}

h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 300;
  letter-spacing: 0.35em;
  text-transform: lowercase;
  text-indent: 0.35em; /* re-center the trailing letter-spacing gap */
}

.tagline {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: #9b9a94;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero {
    animation: none;
  }
}
</style>
