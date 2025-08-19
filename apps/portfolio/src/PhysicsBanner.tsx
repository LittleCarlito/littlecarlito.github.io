import React from 'react'
import Matter from 'matter-js'
import reactLogo from './assets/react.svg'
import awsLogo from './assets/aws_alt.svg'
import dockerLogo from './assets/docker.svg'
import gdscriptLogo from './assets/gdscript.svg'
import htmlLogo from './assets/html.svg'
import javaLogo from './assets/java.svg'
import jsLogo from './assets/js.svg'
import junitLogo from './assets/junit.svg'
import kubernetesLogo from './assets/kubernetes.svg'
import springLogo from './assets/spring.svg'
import sqlLogo from './assets/sql.svg'
import threejsLogo from './assets/threejs.svg'
import tsLogo from './assets/ts.svg'
import webGlLogo from './assets/web_gl.svg'

const BANNER_SCALE = .6
const GRAVITY = 0.15
const OBJECT_SCALE = 1.2
const LOGO_SCALE = 1.4
const BASE_WIDTH = 2000 * BANNER_SCALE
const BASE_HEIGHT = 800 * BANNER_SCALE

interface LogoData {
  src: string
  alt: string
  row: number
  col: number
}

class PhysicsBanner extends React.Component {
  private canvasRef = React.createRef<HTMLCanvasElement>()
  private containerRef = React.createRef<HTMLDivElement>()
  private engineRef: Matter.Engine | null = null
  private renderRef: Matter.Render | null = null
  private runnerRef: Matter.Runner | null = null
  private resizeObserver: ResizeObserver | null = null

  private logos: LogoData[] = [
    { src: reactLogo, alt: 'React', row: 0, col: 0 },
    { src: awsLogo, alt: 'AWS', row: 0, col: 1 },
    { src: dockerLogo, alt: 'Docker', row: 0, col: 2 },
    { src: junitLogo, alt: 'JUnit', row: 0, col: 3 },
    { src: kubernetesLogo, alt: 'Kubernetes', row: 0, col: 4 },
    { src: springLogo, alt: 'Spring', row: 0, col: 5 },
    { src: javaLogo, alt: 'Java', row: 1, col: 0 },
    { src: jsLogo, alt: 'JavaScript', row: 1, col: 3 },
    { src: gdscriptLogo, alt: 'GDScript', row: 2, col: 0 },
    { src: webGlLogo, alt: 'WebGL', row: 2, col: 1 },
    { src: htmlLogo, alt: 'HTML', row: 2, col: 2 },
    { src: sqlLogo, alt: 'SQL', row: 2, col: 3 },
    { src: threejsLogo, alt: 'ThreeJS', row: 2, col: 4 },
    { src: tsLogo, alt: 'TypeScript', row: 2, col: 5 }
  ]

  private updateCanvasSize = (): void => {
    const container = this.containerRef.current
    const canvas = this.canvasRef.current
    if (!container || !canvas) return

    const containerWidth = container.clientWidth
    const aspectRatio = BASE_WIDTH / BASE_HEIGHT
    const displayWidth = Math.min(containerWidth, BASE_WIDTH)
    const displayHeight = displayWidth / aspectRatio

    canvas.style.width = `${displayWidth}px`
    canvas.style.height = `${displayHeight}px`
  }

  private createTextTexture = (text: string, fontSize: number = 32 * BANNER_SCALE * OBJECT_SCALE): string => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    canvas.width = text.length * fontSize * 0.7
    canvas.height = fontSize * 1.5
    
    ctx.fillStyle = '#39ff14'
    ctx.font = `bold ${fontSize}px 'Fira Mono', monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2)
    
    return canvas.toDataURL()
  }

  private initPhysics = (): void => {
    if (this.engineRef) return

    const Engine = Matter.Engine
    const Render = Matter.Render
    const World = Matter.World
    const Bodies = Matter.Bodies
    const Mouse = Matter.Mouse
    const MouseConstraint = Matter.MouseConstraint
    const Runner = Matter.Runner

    const engine = Engine.create()
    this.engineRef = engine

    engine.world.gravity.y = GRAVITY
    engine.world.gravity.scale = 0.001

    const canvas = this.canvasRef.current!
    canvas.width = BASE_WIDTH
    canvas.height = BASE_HEIGHT
    
    const render = Render.create({
      canvas: canvas,
      engine: engine,
      options: {
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
        wireframes: false,
        background: 'transparent',
        showAngleIndicator: false,
        showVelocity: false,
        showDebug: false
      }
    })
    this.renderRef = render

    const ground = Bodies.rectangle(BASE_WIDTH / 2, BASE_HEIGHT - 20 * BANNER_SCALE, BASE_WIDTH + 20 * BANNER_SCALE, 120 * BANNER_SCALE, { 
      isStatic: true,
      render: { visible: false }
    })
    const leftWall = Bodies.rectangle(-10 * BANNER_SCALE, BASE_HEIGHT / 2, 120 * BANNER_SCALE, BASE_HEIGHT, { 
      isStatic: true,
      render: { visible: false }
    })
    const rightWall = Bodies.rectangle(BASE_WIDTH + 10 * BANNER_SCALE, BASE_HEIGHT / 2, 120 * BANNER_SCALE, BASE_HEIGHT, { 
      isStatic: true,
      render: { visible: false }
    })

    const logoSize = 110 * BANNER_SCALE * OBJECT_SCALE * LOGO_SCALE
    const spacing = 160 * BANNER_SCALE * OBJECT_SCALE
    
    const gridWidth = 5 * spacing
    const gridHeight = 2 * spacing
    const startX = (BASE_WIDTH - gridWidth) / 2
    const startY = (BASE_HEIGHT - gridHeight) / 2 - 100 * BANNER_SCALE * OBJECT_SCALE

    const physicsBodies: Matter.Body[] = []

    const nameCenterX = startX + (1.5 * spacing)
    
    this.logos.forEach((logo) => {
      let x = startX + (logo.col * spacing)
      const y = startY + (logo.row * spacing)
      
      if (logo.row === 0 || logo.row === 2) {
        const rowCenterOffset = nameCenterX - (startX + (2.5 * spacing))
        x = startX + (logo.col * spacing) + rowCenterOffset
      }
      
      const body = Bodies.circle(x, y, logoSize * 0.3, {
        restitution: 0.6,
        friction: 0.4,
        frictionAir: 0.01,
        render: {
          sprite: {
            texture: logo.src,
            xScale: logoSize / 100,
            yScale: logoSize / 100
          }
        }
      })
      
      physicsBodies.push(body)
    })

    const stevenTexture = this.createTextTexture('Steven', 64 * BANNER_SCALE * OBJECT_SCALE)
    const stevenBody = Bodies.rectangle(
      startX + (1 * spacing),
      startY + spacing,
      240 * BANNER_SCALE * OBJECT_SCALE, 
      100 * BANNER_SCALE * OBJECT_SCALE, 
      {
        restitution: 0.6,
        friction: 0.4,
        frictionAir: 0.01,
        render: {
          sprite: {
            texture: stevenTexture,
            xScale: 1,
            yScale: 1
          }
        }
      }
    )

    const meierTexture = this.createTextTexture('Meier', 64 * BANNER_SCALE * OBJECT_SCALE)
    const meierBody = Bodies.rectangle(
      startX + (2 * spacing),
      startY + spacing,
      200 * BANNER_SCALE * OBJECT_SCALE, 
      100 * BANNER_SCALE * OBJECT_SCALE, 
      {
        restitution: 0.6,
        friction: 0.4,
        frictionAir: 0.01,
        render: {
          sprite: {
            texture: meierTexture,
            xScale: 1,
            yScale: 1
          }
        }
      }
    )

    physicsBodies.push(stevenBody, meierBody)

    World.add(engine.world, [ground, leftWall, rightWall, ...physicsBodies])

    const mouse = Mouse.create(render.canvas)
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: {
          visible: false
        }
      }
    })

    World.add(engine.world, mouseConstraint)

    Render.run(render)
    const runner = Runner.create()
    this.runnerRef = runner
    Runner.run(runner, engine)

    this.updateCanvasSize()
  }

  private cleanupPhysics = (): void => {
    if (this.renderRef) {
      Matter.Render.stop(this.renderRef)
      this.renderRef = null
    }
    if (this.runnerRef && this.engineRef) {
      Matter.Runner.stop(this.runnerRef)
      this.runnerRef = null
    }
    if (this.engineRef) {
      Matter.Engine.clear(this.engineRef)
      this.engineRef = null
    }
  }

  componentDidMount(): void {
    this.initPhysics()
    
    this.resizeObserver = new ResizeObserver(() => {
      this.updateCanvasSize()
    })
    
    if (this.containerRef.current) {
      this.resizeObserver.observe(this.containerRef.current)
    }
  }

  componentWillUnmount(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }
    this.cleanupPhysics()
  }

  render(): React.ReactNode {
    return (
      <div 
        ref={this.containerRef}
        style={{ 
          width: '100%', 
          maxWidth: `${BASE_WIDTH}px`, 
          margin: 'auto',
          position: 'relative'
        }}
      >        
        <canvas 
          ref={this.canvasRef}
          style={{
            display: 'block',
            imageRendering: 'pixelated'
          }}
        />
      </div>
    )
  }
}

export default PhysicsBanner