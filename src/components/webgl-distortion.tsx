"use client"

import { useEffect, useRef, useState } from "react"
import type * as THREE from "three"

const VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`

const FRAG = `
uniform sampler2D uTexture;
uniform vec2 uMouse;
uniform float uHover;
uniform float uTime;
uniform float uIntensity;
uniform vec2 uResolution;
uniform vec2 uImageResolution;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec2 s = uResolution;
  vec2 i = uImageResolution;
  float rs = s.x / max(s.y, 1.0);
  float ri = i.x / max(i.y, 1.0);
  vec2 newUv = uv;
  if (rs > ri) { newUv.y = (uv.y - 0.5) * (ri / rs) + 0.5; }
  else          { newUv.x = (uv.x - 0.5) * (rs / ri) + 0.5; }

  vec2 distVec = newUv - uMouse;
  float dist = length(distVec);
  float wave = sin(dist * 22.0 - uTime * 3.5) * exp(-dist * 4.5) * 0.045 * uHover * uIntensity;
  float ambient = sin(newUv.x * 12.0 + uTime * 2.0) * cos(newUv.y * 12.0 + uTime * 1.8) * 0.015 * uHover * uIntensity;
  vec2 distorted = newUv + normalize(distVec + vec2(0.0001)) * wave + vec2(ambient);
  distorted = clamp(distorted, 0.001, 0.999);

  vec4 col = texture2D(uTexture, distorted);
  if (uHover > 0.01) {
    float r = texture2D(uTexture, distorted + vec2(wave * 0.4, 0.0)).r;
    float b = texture2D(uTexture, distorted - vec2(wave * 0.4, 0.0)).b;
    col = vec4(r, col.g, b, col.a);
  }
  gl_FragColor = col;
}
`

export function WebGLDistortion({
  src,
  alt,
  intensity = 1.0,
  speed = 1.0,
  className = "",
  style,
}: {
  src: string
  alt: string
  intensity?: number
  speed?: number
  className?: string
  style?: React.CSSProperties
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const matRef = useRef<THREE.ShaderMaterial | null>(null)
  const rafRef = useRef<number | null>(null)
  const mouseTarget = useRef({ x: 0.5, y: 0.5 })
  const mouseCurrent = useRef({ x: 0.5, y: 0.5 })
  const hoverTarget = useRef(0)
  const hoverCurrent = useRef(0)
  const [glReady, setGlReady] = useState(false)
  const disposeRef = useRef<(() => void) | null>(null)

  const cleanup = () => {
    if (disposeRef.current) {
      disposeRef.current()
      disposeRef.current = null
    }
    setGlReady(false)
  }

  const initGL = async () => {
    if (disposeRef.current || !containerRef.current || !canvasRef.current) return
    const THREE = await import('three')
    let isDisposed = false
    try {
      const container = containerRef.current
      const canvasLayer = canvasRef.current
      const w = container.clientWidth || 300
      const h = container.clientHeight || 200

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0))
      renderer.setSize(w, h)
      renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"

      while (canvasLayer.firstChild) canvasLayer.removeChild(canvasLayer.firstChild)
      canvasLayer.appendChild(renderer.domElement)

      const scene = new THREE.Scene()
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

      const tex = new THREE.TextureLoader().load(
        src,
        (t) => {
          if (isDisposed) return
          t.generateMipmaps = true
          t.minFilter = THREE.LinearMipmapLinearFilter
          t.magFilter = THREE.LinearFilter
          if (matRef.current) {
            matRef.current.uniforms.uImageResolution.value.set(t.image.width, t.image.height)
          }
          setGlReady(true)
        },
        undefined,
        () => {
          if (!isDisposed) {
            cleanup()
          }
        }
      )

      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        uniforms: {
          uTexture: { value: tex },
          uMouse: { value: new THREE.Vector2(mouseTarget.current.x, mouseTarget.current.y) },
          uHover: { value: 0.0 },
          uTime: { value: 0.0 },
          uIntensity: { value: intensity },
          uResolution: { value: new THREE.Vector2(w, h) },
          uImageResolution: { value: new THREE.Vector2(16, 9) },
        },
      })
      matRef.current = mat
      const geom = new THREE.PlaneGeometry(2, 2)
      const mesh = new THREE.Mesh(geom, mat)
      scene.add(mesh)

      const ro = new ResizeObserver(([e]) => {
        if (isDisposed) return
        const nw = e.contentRect.width
        const nh = e.contentRect.height
        if (nw > 0 && nh > 0) {
          renderer.setSize(nw, nh)
          mat.uniforms.uResolution.value.set(nw, nh)
        }
      })
      ro.observe(container)

      const t0 = performance.now()
      const loop = () => {
        if (isDisposed) return
        mouseCurrent.current.x += (mouseTarget.current.x - mouseCurrent.current.x) * 0.1
        mouseCurrent.current.y += (mouseTarget.current.y - mouseCurrent.current.y) * 0.1
        hoverCurrent.current += (hoverTarget.current - hoverCurrent.current) * 0.1
        mat.uniforms.uTime.value = (performance.now() - t0) * 0.001 * speed
        mat.uniforms.uMouse.value.set(mouseCurrent.current.x, mouseCurrent.current.y)
        mat.uniforms.uHover.value = hoverCurrent.current
        renderer.render(scene, camera)
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)

      disposeRef.current = () => {
        isDisposed = true
        ro.disconnect()
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
        geom.dispose()
        mat.dispose()
        tex.dispose()
        renderer.dispose()
        renderer.forceContextLoss?.()
        if (renderer.domElement?.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement)
        }
        matRef.current = null
      }
    } catch {
      cleanup()
    }
  }

  useEffect(() => {
    return () => {
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  const updateCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current) return
    const r = containerRef.current.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) {
      const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
      const y = Math.max(0, Math.min(1, 1 - (clientY - r.top) / r.height))
      mouseTarget.current = { x, y }
    }
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    hoverTarget.current = 1.0
    updateCoords(e.clientX, e.clientY)
    mouseCurrent.current = { ...mouseTarget.current }
    initGL()
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    updateCoords(e.clientX, e.clientY)
  }

  const handleMouseLeave = () => {
    hoverTarget.current = 0.0
    mouseTarget.current = { x: 0.5, y: 0.5 }
    cleanup()
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      hoverTarget.current = 1.0
      updateCoords(e.touches[0].clientX, e.touches[0].clientY)
      mouseCurrent.current = { ...mouseTarget.current }
      initGL()
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      updateCoords(e.touches[0].clientX, e.touches[0].clientY)
    }
  }

  const handleTouchEnd = () => {
    hoverTarget.current = 0.0
    mouseTarget.current = { x: 0.5, y: 0.5 }
    cleanup()
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 2,
          opacity: glReady ? 1 : 0,
          transition: "opacity 0.25s ease-out",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          position: "relative",
          zIndex: 1,
          imageRendering: "-webkit-optimize-contrast",
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
        }}
      />
    </div>
  )
}
