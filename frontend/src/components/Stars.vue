<template>
  <!-- نجوم الخلفية المتحركة -->
  <div class="stars-container" aria-hidden="true">
    <div
      v-for="star in stars"
      :key="star.id"
      class="star"
      :style="star.style"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const stars = ref([])

onMounted(() => {
  const count = 120
  stars.value = Array.from({ length: count }, (_, i) => ({
    id: i,
    style: {
      left: Math.random() * 100 + '%',
      top: Math.random() * 100 + '%',
      width: Math.random() * 3 + 1 + 'px',
      height: Math.random() * 3 + 1 + 'px',
      animationDelay: Math.random() * 4 + 's',
      animationDuration: Math.random() * 3 + 2 + 's',
      opacity: Math.random() * 0.7 + 0.1,
    }
  }))
})
</script>

<style scoped>
.stars-container {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.star {
  position: absolute;
  background: white;
  border-radius: 50%;
  animation: twinkle var(--duration, 3s) ease-in-out infinite;
  animation-delay: var(--delay, 0s);
}

@keyframes twinkle {
  0%, 100% { opacity: 0.2; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.4); }
}
</style>
