import { useRef, useEffect, useCallback, useState } from 'react'
import './App.css'

class Star {
  constructor(canvasWidth, canvasHeight) {
    this.x = Math.random() * canvasWidth
    this.y = Math.random() * canvasHeight
    this.size = Math.random() * 2
    this.twinkleSpeed = Math.random() * 0.005 + 0.001
    this.alpha = Math.random()
  }

  update() {
    this.alpha += Math.sin(Date.now() * this.twinkleSpeed) * 0.05
    this.alpha = Math.max(0, Math.min(1, this.alpha))
  }

  draw(ctx) {
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`
    ctx.fill()
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x
    this.y = y
    this.color = color
    this.radius = Math.random() * 2 + 1
    this.velocity = {
      x: Math.random() * 6 - 3,
      y: Math.random() * 6 - 3
    }
    this.gravity = 0.2
    this.life = 100
  }

  update(ctx) {
    this.velocity.y += this.gravity
    this.x += this.velocity.x
    this.y += this.velocity.y
    this.life--

    if (this.life < 20) {
      this.radius = Math.max(0, this.radius - 0.1)
    }

    this.draw(ctx)
  }

  draw(ctx) {
    if (this.radius > 0) {
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI)
      ctx.fillStyle = this.color
      ctx.fill()
    }
  }
}

class Rocket {
  constructor(x, y) {
    this.x = x
    this.y = y
    this.radius = 2
    this.velocity = {
      x: Math.random() * 2 - 1,
      y: -Math.random() * 3 - 9
    }
    this.gravity = 0.1
    this.color = `hsl(${Math.random() * 360}, 50%, 50%)`

    // We'll store previous positions for the trail:
    this.positions = []
  }

  update(ctx) {
    this.velocity.y += this.gravity
    this.x += this.velocity.x
    this.y += this.velocity.y

    this.positions.push({ x: this.x, y: this.y, life: 20, color: this.color })
    this.draw(ctx)

    // If rocket velocity.y > 0 => means it's falling => time to explode
    return this.velocity.y > 0
  }

  draw(ctx) {
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI)
    ctx.fillStyle = this.color
    ctx.fill()

    this.drawTrail(ctx)
  }

  drawTrail(ctx) {
    for (let i = 0; i < this.positions.length; i++) {
      const p = this.positions[i]
      // alpha fades from 1 down to 0 as p.life goes from 20 to 0
      const alpha = p.life / 20

      ctx.beginPath()
      ctx.arc(p.x, p.y, 2, 0, 2 * Math.PI)
      ctx.fillStyle = `${this.color.slice(0, -1)}, ${alpha})`
      ctx.fill()

      // Decrement life each frame
      p.life--
      if (p.life <= 0) {
        this.positions.splice(i, 1)
        i--
      }
    }
  }
}

function App() {
  const canvasRef = useRef(null)
  const requestIdRef = useRef(null)
  const starsRef = useRef([])
  const rocketsRef = useRef([])
  const particlesRef = useRef([])
  const [isMouseDown, setIsMouseDown] = useState(false)
  const mousePositionRef = useRef({ x: 0, y: 0 })
  const fireworkIntervalRef = useRef(null)

  const createFirework = useCallback((x, y) => {
    rocketsRef.current.push(new Rocket(x, y))
  }, [])

  const explodeFirework = useCallback((x, y, color) => {
    const particleCount = 50
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push(new Particle(x, y, color))
    }
  }, [])

  const startContinuousFireworks = useCallback(
    (x, y) => {
      mousePositionRef.current = { x, y }
      if (!fireworkIntervalRef.current) {
        fireworkIntervalRef.current = setInterval(() => {
          const { x, y } = mousePositionRef.current
          createFirework(x, y)
        }, 100)
      }
    },
    [createFirework]
  )

  const stopContinuousFireworks = useCallback(() => {
    if (fireworkIntervalRef.current) {
      clearInterval(fireworkIntervalRef.current)
      fireworkIntervalRef.current = null
    }
  }, [])

  const handleMouseMove = useCallback(
    (e) => {
      if (isMouseDown) {
        mousePositionRef.current = { x: e.clientX, y: e.clientY }
      }
    },
    [isMouseDown]
  )

  const handleCanvasClick = useCallback(
    (e) => {
      setIsMouseDown(true)
      startContinuousFireworks(e.clientX, e.clientY)
    },
    [startContinuousFireworks]
  )

  const handleMouseUp = useCallback(() => {
    setIsMouseDown(false)
    stopContinuousFireworks()
  }, [stopContinuousFireworks])

  const handleTouchStart = useCallback(
    (e) => {
      const touch = e.touches[0]
      setIsMouseDown(true)
      startContinuousFireworks(touch.clientX, touch.clientY)
    },
    [startContinuousFireworks]
  )

  const handleTouchMove = useCallback(
    (e) => {
      if (isMouseDown) {
        const touch = e.touches[0]
        mousePositionRef.current = { x: touch.clientX, y: touch.clientY }
      }
    },
    [isMouseDown]
  )

  const handleTouchEnd = useCallback(() => {
    setIsMouseDown(false)
    stopContinuousFireworks()
  }, [stopContinuousFireworks])

  useEffect(() => {
    const canvas = canvasRef.current

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      starsRef.current = Array.from(
        { length: 200 },
        () => new Star(canvas.width, canvas.height)
      )
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    starsRef.current = Array.from(
      { length: 200 },
      () => new Star(canvas.width, canvas.height)
    )

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const animate = () => {
      // 1) Fully clear canvas each frame => no indefinite lingering
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 2) Lighten blending for a bright effect
      ctx.globalCompositeOperation = 'lighter'

      // 3) Update/draw stars
      starsRef.current.forEach((star) => {
        star.update()
        star.draw(ctx)
      })

      // 4) Update rockets
      const nextRockets = []
      for (const rocket of rocketsRef.current) {
        const shouldExplode = rocket.update(ctx)
        if (shouldExplode) {
          explodeFirework(rocket.x, rocket.y, rocket.color)
        } else {
          nextRockets.push(rocket)
        }
      }
      rocketsRef.current = nextRockets

      // 5) Update particles
      const nextParticles = []
      for (const particle of particlesRef.current) {
        particle.update(ctx)
        if (particle.life > 0 && particle.radius > 0) {
          nextParticles.push(particle)
        }
      }
      particlesRef.current = nextParticles

      requestIdRef.current = requestAnimationFrame(animate)
    }

    requestIdRef.current = requestAnimationFrame(animate)

    return () => {
      if (requestIdRef.current) {
        cancelAnimationFrame(requestIdRef.current)
      }
    }
  }, [explodeFirework])

  useEffect(() => {
    return () => {
      stopContinuousFireworks()
    }
  }, [stopContinuousFireworks])

  // Add touch event listeners with passive: false
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const options = { passive: false }

    const preventScroll = (e) => e.preventDefault()

    canvas.addEventListener('touchstart', preventScroll, options)
    canvas.addEventListener('touchmove', preventScroll, options)

    return () => {
      canvas.removeEventListener('touchstart', preventScroll)
      canvas.removeEventListener('touchmove', preventScroll)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleCanvasClick}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className='fireworks-canvas'
    />
  )
}

export default App
