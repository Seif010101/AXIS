<template>
  <canvas ref="canvas" class="matrix-canvas" :class="{ hidden: !isDark }" />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// Observe data-theme attribute changes reactively
const isDark = ref(document.documentElement.getAttribute('data-theme') !== 'light')
let _themeObserver = null

const canvas = ref(null)
let ctx, raf, cols, drops = [], stars = []

const CHARS = 'ﾑｱﾓｻﾘﾛｦｿﾃﾄｼｽｾ01アウエカキクコサシスセソABCDEFGHIJKLM0123456789@#$%&∑√∆Ω'
const FONT_SIZE = 13

function resize() {
  if (!canvas.value) return
  const c = canvas.value
  c.width = window.innerWidth
  c.height = window.innerHeight
  ctx = c.getContext('2d')
  cols = Math.floor(c.width / FONT_SIZE)

  // init drops — randomize start positions
  drops = Array.from({ length: cols }, () => Math.random() * -(c.height / FONT_SIZE))

  // generate stars
  stars = Array.from({ length: 250 }, () => ({
    x: Math.random() * c.width,
    y: Math.random() * c.height,
    r: Math.random() * 1.4 + 0.2,
    phase: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.012 + 0.004,
  }))
}

function draw() {
  if (!canvas.value || !ctx) return
  const { width, height } = canvas.value

  // Fade trail
  ctx.fillStyle = 'rgba(0, 0, 8, 0.08)'
  ctx.fillRect(0, 0, width, height)

  // Stars
  const now = Date.now() / 1000
  stars.forEach(s => {
    const brightness = 0.4 + 0.6 * Math.sin(now * s.speed + s.phase)
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(180, 220, 255, ${brightness * 0.7})`
    ctx.fill()
  })

  // Matrix rain
  ctx.font = `${FONT_SIZE}px 'Courier New', monospace`
  for (let i = 0; i < cols; i++) {
    const y = drops[i] * FONT_SIZE
    if (y < 0) { drops[i] += 0.4; continue }

    const char = CHARS[Math.floor(Math.random() * CHARS.length)]

    // Dim trail characters
    ctx.fillStyle = 'rgba(0, 200, 60, 0.55)'
    ctx.fillText(char, i * FONT_SIZE, y)

    // Bright glowing head
    if (Math.random() > 0.7) {
      ctx.shadowColor = '#00ff41'
      ctx.shadowBlur = 10
      ctx.fillStyle = 'rgba(180, 255, 180, 0.95)'
      ctx.fillText(char, i * FONT_SIZE, y)
      ctx.shadowBlur = 0
    }

    // Reset drop
    if (y > height && Math.random() > 0.975) {
      drops[i] = 0
    }
    drops[i] += 0.45
  }

  raf = requestAnimationFrame(draw)
}

onMounted(() => {
  resize()
  draw()
  window.addEventListener('resize', resize)
  // Watch data-theme attribute changes
  _themeObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.getAttribute('data-theme') !== 'light'
  })
  _themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  _themeObserver?.disconnect()
})
</script>

<style scoped>
.matrix-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  opacity: 0.3;
  transition: opacity 0.4s;
}
.matrix-canvas.hidden {
  opacity: 0;
  pointer-events: none;
}
</style>
