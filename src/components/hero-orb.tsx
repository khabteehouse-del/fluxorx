'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import * as THREE from 'three'

function Orb({ slow }: { slow: boolean }) {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)

  useFrame((state, delta) => {
    const speed = slow ? 0.04 : 1
    if (group.current) {
      group.current.rotation.y += delta * 0.25 * speed
      group.current.rotation.x += delta * 0.06 * speed
      group.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.08
    }
    if (ring.current) {
      ring.current.rotation.z += delta * 0.12 * speed
    }
  })

  return (
    <group ref={group}>
      {/* Outer amber wireframe shell */}
      <mesh>
        <icosahedronGeometry args={[1.45, 1]} />
        <meshBasicMaterial color="#FFB347" wireframe transparent opacity={0.55} />
      </mesh>

      {/* Inner blue wireframe shell */}
      <mesh rotation={[0.4, 0.2, 0]}>
        <icosahedronGeometry args={[1.02, 1]} />
        <meshBasicMaterial color="#5C8BE6" wireframe transparent opacity={0.35} />
      </mesh>

      {/* Glowing core */}
      <mesh>
        <sphereGeometry args={[0.34, 28, 28]} />
        <meshBasicMaterial color="#FF9A4D" transparent opacity={0.55} />
      </mesh>

      {/* Orbiting ring */}
      <mesh ref={ring} rotation={[1.45, 0.3, 0]}>
        <torusGeometry args={[1.95, 0.012, 12, 90]} />
        <meshBasicMaterial color="#FFB347" transparent opacity={0.4} />
      </mesh>
    </group>
  )
}

export default function HeroOrb() {
  const reduce = useReducedMotion() ?? false

  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <Orb slow={reduce} />
    </Canvas>
  )
}
