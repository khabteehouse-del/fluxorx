'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo } from 'react'
import * as THREE from 'three'

type Mode = 'idle' | 'thinking' | 'answer'

const MODE_CONFIG = {
  idle:     { spread: 1.0, speed: 0.4,  coreColor: '#2A5A9F', nodeColorA: '#36D1FF', nodeColorB: '#6FB7FF', lineOpacity: 0.18, coreSize: 0.22 },
  thinking: { spread: 1.42, speed: 1.8,  coreColor: '#00E5FF', nodeColorA: '#00C8FF', nodeColorB: '#FFB347', lineOpacity: 0.45, coreSize: 0.32 },
  answer:   { spread: 1.15, speed: 0.7,  coreColor: '#3FB984', nodeColorA: '#4FFFAA', nodeColorB: '#3FB984', lineOpacity: 0.30, coreSize: 0.27 },
}

const NODE_COUNT = 28
const CONNECT_DIST = 1.6

function Constellation({ mode }: { mode: Mode }) {
  const groupRef   = useRef<THREE.Group>(null)
  const coreRef    = useRef<THREE.Mesh>(null)
  const linesRef   = useRef<THREE.LineSegments>(null)
  const pointsRef  = useRef<THREE.Points>(null)

  const basePositions = useMemo(() => {
    const pos = new Float32Array(NODE_COUNT * 3)
    for (let i = 0; i < NODE_COUNT; i++) {
      const phi   = Math.acos(2 * Math.random() - 1)
      const theta = Math.random() * Math.PI * 2
      const r     = 0.7 + Math.random() * 0.9
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
    }
    return pos
  }, [])

  const nodeColors = useMemo(() => {
    const c = new Float32Array(NODE_COUNT * 3)
    const ca = new THREE.Color('#36D1FF')
    const cb = new THREE.Color('#6FB7FF')
    for (let i = 0; i < NODE_COUNT; i++) {
      const col = i % 3 === 0 ? cb : ca
      c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b
    }
    return c
  }, [])

  const maxLines  = NODE_COUNT * NODE_COUNT
  const linePositions = useMemo(() => new Float32Array(maxLines * 6), [maxLines])
  const lineColors    = useMemo(() => new Float32Array(maxLines * 6), [maxLines])

  const currentSpread = useRef(1.0)
  const currentCoreSize = useRef(0.22)

  useFrame((state, delta) => {
    const t      = state.clock.elapsedTime
    const cfg    = MODE_CONFIG[mode]
    const lerpT  = delta * (mode === 'thinking' ? 3.5 : 2.0)

    currentSpread.current   += (cfg.spread   - currentSpread.current)   * lerpT
    currentCoreSize.current += (cfg.coreSize - currentCoreSize.current) * lerpT

    const spread = currentSpread.current

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * cfg.speed * 0.22
      groupRef.current.rotation.x += delta * cfg.speed * 0.08
    }

    // Update node positions with spread + gentle drift
    const pts = pointsRef.current
    if (pts) {
      const attr = pts.geometry.getAttribute('position') as THREE.BufferAttribute
      const arr  = attr.array as Float32Array
      for (let i = 0; i < NODE_COUNT; i++) {
        const bx = basePositions[i * 3], by = basePositions[i * 3 + 1], bz = basePositions[i * 3 + 2]
        arr[i * 3]     = bx * spread + Math.sin(t * 0.6 + i * 1.3) * 0.04
        arr[i * 3 + 1] = by * spread + Math.sin(t * 0.8 + i * 0.9) * 0.04
        arr[i * 3 + 2] = bz * spread + Math.sin(t * 0.5 + i * 1.7) * 0.04
      }
      attr.needsUpdate = true

      // Update node colors
      const colAttr = pts.geometry.getAttribute('color') as THREE.BufferAttribute
      const colArr  = colAttr.array as Float32Array
      const ca = new THREE.Color(cfg.nodeColorA)
      const cb = new THREE.Color(cfg.nodeColorB)
      for (let i = 0; i < NODE_COUNT; i++) {
        const col = i % 3 === 0 ? cb : ca
        colArr[i * 3] = col.r; colArr[i * 3 + 1] = col.g; colArr[i * 3 + 2] = col.b
      }
      colAttr.needsUpdate = true

      // Update connecting lines
      if (linesRef.current) {
        let li = 0
        const lineColor = new THREE.Color(cfg.nodeColorA)
        for (let i = 0; i < NODE_COUNT; i++) {
          for (let j = i + 1; j < NODE_COUNT; j++) {
            const ax = arr[i * 3], ay = arr[i * 3 + 1], az = arr[i * 3 + 2]
            const bx = arr[j * 3], by = arr[j * 3 + 1], bz = arr[j * 3 + 2]
            const dist = Math.sqrt((ax-bx)**2 + (ay-by)**2 + (az-bz)**2)
            if (dist < CONNECT_DIST) {
              linePositions[li * 6]     = ax; linePositions[li * 6 + 1] = ay; linePositions[li * 6 + 2] = az
              linePositions[li * 6 + 3] = bx; linePositions[li * 6 + 4] = by; linePositions[li * 6 + 5] = bz
              const alpha = (1 - dist / CONNECT_DIST) * cfg.lineOpacity
              lineColors[li * 6]     = lineColor.r * alpha; lineColors[li * 6 + 1] = lineColor.g * alpha; lineColors[li * 6 + 2] = lineColor.b * alpha
              lineColors[li * 6 + 3] = lineColor.r * alpha; lineColors[li * 6 + 4] = lineColor.g * alpha; lineColors[li * 6 + 5] = lineColor.b * alpha
              li++
            }
          }
        }
        const lGeo = linesRef.current.geometry
        const lPos = lGeo.getAttribute('position') as THREE.BufferAttribute
        const lCol = lGeo.getAttribute('color') as THREE.BufferAttribute
        const lArr = lPos.array as Float32Array
        const cArr = lCol.array as Float32Array
        for (let k = 0; k < li * 6; k++) { lArr[k] = linePositions[k]; cArr[k] = lineColors[k] }
        for (let k = li * 6; k < maxLines * 6; k++) { lArr[k] = 0; cArr[k] = 0 }
        lPos.needsUpdate = true; lCol.needsUpdate = true
      }
    }

    // Core
    if (coreRef.current) {
      const pulse = mode === 'thinking'
        ? currentCoreSize.current + Math.sin(t * 7) * 0.05
        : currentCoreSize.current + Math.sin(t * 1.8) * 0.015
      coreRef.current.scale.setScalar(pulse)
      ;(coreRef.current.material as THREE.MeshBasicMaterial).color.set(cfg.coreColor)
    }
  })

  const initPos = useMemo(() => {
    const p = new Float32Array(NODE_COUNT * 3)
    for (let i = 0; i < NODE_COUNT * 3; i++) p[i] = basePositions[i]
    return p
  }, [basePositions])

  const initLinePos = useMemo(() => new Float32Array(maxLines * 6), [maxLines])
  const initLineCol = useMemo(() => new Float32Array(maxLines * 6), [maxLines])

  return (
    <group ref={groupRef}>
      {/* Connecting lines */}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[initLinePos, 3]} />
          <bufferAttribute attach="attributes-color"    args={[initLineCol, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={1} depthWrite={false} />
      </lineSegments>

      {/* Nodes */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[initPos,    3]} />
          <bufferAttribute attach="attributes-color"    args={[nodeColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.09} vertexColors transparent depthWrite={false}
          blending={THREE.AdditiveBlending} sizeAttenuation toneMapped={false}
        />
      </points>

      {/* Glowing core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshBasicMaterial
          color="#2A5A9F" transparent opacity={0.55}
          blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}
        />
      </mesh>
    </group>
  )
}

export default function AIReactor({ mode }: { mode: Mode }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.5], fov: 62 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent', pointerEvents: 'none' }}
    >
      <Constellation mode={mode} />
    </Canvas>
  )
}
