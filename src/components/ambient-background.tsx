'use client'

import { useEffect, useRef } from 'react'

type Point = { x: number; y: number; vx: number; vy: number; amber: boolean }

export default function AmbientBackground({
  aurora = true,
}: {
  aurora?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let raf = 0
    let points: Point[] = []

    function resize() {
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.min(70, Math.max(26, Math.floor((width * height) / 24000)))
      points = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        amber: Math.random() < 0.16,
      }))
    }

    function draw() {
      ctx.clearRect(0, 0, width, height)
      for (let i = 0; i < points.length; i++) {
        const a = points[i]
        for (let j = i + 1; j < points.length; j++) {
          const b = points[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist < 134) {
            const alpha = (1 - dist / 134) * 0.16
            ctx.strokeStyle = `rgba(155,180,215,${alpha})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }
      for (const p of points) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.amber ? 1.7 : 1.3, 0, Math.PI * 2)
        ctx.fillStyle = p.amber
          ? 'rgba(255,179,71,0.78)'
          : 'rgba(175,196,226,0.72)'
        ctx.fill()
      }
    }

    function step() {
      for (const p of points) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > width) p.vx *= -1
        if (p.y < 0 || p.y > height) p.vy *= -1
      }
      draw()
      raf = requestAnimationFrame(step)
    }

    resize()
    raf = requestAnimationFrame(step)

    const onResize = () => resize()
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {aurora && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(50% 45% at 88% 8%, rgba(70,120,210,0.12) 0%, rgba(6,8,13,0) 60%), radial-gradient(55% 50% at 8% 100%, rgba(255,135,55,0.14) 0%, rgba(6,8,13,0) 62%)',
          }}
        />
      )}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-90" />
    </div>
  )
}
