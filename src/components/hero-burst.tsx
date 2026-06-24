'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

function easeOutExpo(x: number) {
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)
}
function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3)
}

function Burst({ count }: { count: number }) {
  const pointsRef = useRef<THREE.Points>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const startTime = useRef<number | null>(null)

  const { positions, colors, dirs, radii } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const dirs = new Float32Array(count * 3)
    const radii = new Float32Array(count)

    const cInner = new THREE.Color('#EAF6FF')
    const cMid = new THREE.Color('#36D1FF')
    const cOuter = new THREE.Color('#5B7CFF')

    for (let i = 0; i < count; i++) {
      const u = Math.random()
      const v = Math.random()
      const theta = 2 * Math.PI * u
      const phi = Math.acos(2 * v - 1)
      dirs[i * 3] = Math.sin(phi) * Math.cos(theta)
      dirs[i * 3 + 1] = Math.sin(phi) * Math.sin(theta)
      dirs[i * 3 + 2] = Math.cos(phi)

      const r = 0.7 + Math.pow(Math.random(), 0.6) * 1.5
      radii[i] = r

      const tcol = THREE.MathUtils.clamp((r - 0.7) / 1.5, 0, 1)
      const col =
        tcol < 0.5
          ? cInner.clone().lerp(cMid, tcol / 0.5)
          : cMid.clone().lerp(cOuter, (tcol - 0.5) / 0.5)
      colors[i * 3] = col.r
      colors[i * 3 + 1] = col.g
      colors[i * 3 + 2] = col.b
    }
    return { positions, colors, dirs, radii }
  }, [count])

  const sprite = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const g = c.getContext('2d')!
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grd.addColorStop(0, 'rgba(255,255,255,1)')
    grd.addColorStop(0.25, 'rgba(255,255,255,0.75)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  }, [])

  useFrame((state) => {
    if (startTime.current === null) startTime.current = state.clock.elapsedTime
    const t = state.clock.elapsedTime - startTime.current

    const riseEnd = 1.1
    const explodeStart = 1.0
    const explodeEnd = 2.3

    const rp = THREE.MathUtils.clamp(t / riseEnd, 0, 1)
    const groupY = THREE.MathUtils.lerp(-3.2, 0, easeOutCubic(rp))

    const e = easeOutExpo(
      THREE.MathUtils.clamp((t - explodeStart) / (explodeEnd - explodeStart), 0, 1)
    )
    const settled = t > explodeEnd
    const breathe = settled ? 1 + Math.sin((t - explodeEnd) * 0.7) * 0.02 : 1

    const pts = pointsRef.current
    if (pts) {
      const attr = pts.geometry.getAttribute('position') as THREE.BufferAttribute
      const arr = attr.array as Float32Array
      for (let i = 0; i < count; i++) {
        const r = radii[i] * (0.02 + e * 0.98) * breathe
        arr[i * 3] = dirs[i * 3] * r
        arr[i * 3 + 1] = dirs[i * 3 + 1] * r
        arr[i * 3 + 2] = dirs[i * 3 + 2] * r
      }
      attr.needsUpdate = true
      pts.position.y = groupY
      pts.rotation.y += 0.0009
    }

    if (coreRef.current) {
      coreRef.current.position.y = groupY
      const mat = coreRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = THREE.MathUtils.clamp(1 - e * 1.3, 0, 1) * 0.9
      coreRef.current.scale.setScalar(0.22 + (1 - e) * 0.22)
    }
  })

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.05}
          map={sprite}
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          toneMapped={false}
        />
      </points>

      <mesh ref={coreRef}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          color="#CDEEFF"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

export default function HeroBurst() {
  // Lighten the load on phones so it runs smoothly.
  const isMobile =
    typeof window !== 'undefined' && window.innerWidth < 768
  const count = isMobile ? 900 : 2400

  return (
    <Canvas
      camera={{ position: [0, 0, 5.2], fov: 45 }}
      dpr={isMobile ? 1.25 : [1, 2]}
      gl={{ antialias: !isMobile, alpha: true, powerPreference: 'high-performance' }}
      style={{ background: 'transparent', pointerEvents: 'none' }}
    >
      <Burst count={count} />
    </Canvas>
  )
}
