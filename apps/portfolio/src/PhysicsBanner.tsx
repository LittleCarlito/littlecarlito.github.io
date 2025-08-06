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

const LOGO_SIZE = 110
const PHYSICS_WIDTH = 700
const PHYSICS_HEIGHT = 400

interface LogoData {
  src: string
  alt: string
  row: number
  col: number
}

class PhysicsBanner extends React.Component {
  private canvasRef = React.createRef<HTMLCanvasElement>()
  private engineRef: Matter.Engine | null = null
  private renderRef: Matter.Render | null = null
  private runnerRef: Matter.Runner | null = null

  private logos: LogoData[] = [
    { src: reactLogo, alt: 'React', row: 0, col: 0 },
    { src: awsLogo, alt: 'AWS', row: 0, col: 1 },
    { src: dockerLogo, alt: 'Docker', row: 0, col: 2 },
    { src: junitLogo, alt: 'JUnit', row: 0, col: 3 },
    { src: kubernetesLogo, alt: 'Kubernetes', row: 0, col: 4 },
    { src: springLogo, alt: 'Spring', row: 0, col: 5 },
    { src: javaLogo, alt: 'Java', row: 1, col: 0 },
    { src: jsLogo, alt: 'JavaScript', row: 1, col: 2 },
    { src: gdscriptLogo, alt: 'GDScript', row: 2, col: 0 },
    { src: webGlLogo, alt: 'WebGL', row: 2, col: 1 },
    { src: htmlLogo, alt: 'HTML', row: 2, col: 2 },
    { src: sqlLogo, alt: 'SQL', row: 2, col: 3 },
    { src: threejsLogo, alt: 'ThreeJS', row: 2, col: 4 },
    { src: tsLogo, alt: 'TypeScript', row: 2, col: 5 }
  ]

  private createTextTexture = (text: string, fontSize: number = 32): string => {
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

    engine.world.gravity.y = 0.6
    engine.world.gravity.scale = 0.001

    const canvas = this.canvasRef.current!
    canvas.width = PHYSICS_WIDTH
    canvas.height = PHYSICS_HEIGHT
    
    const render = Render.create({
      canvas: canvas,
      engine: engine,
      options: {
        width: PHYSICS_WIDTH,
        height: PHYSICS_HEIGHT,
        wireframes: false,
        background: 'transparent',
        showAngleIndicator: false,
        showVelocity: false,
        showDebug: false
      }
    })
    this.renderRef = render

    const ground = Bodies.rectangle(PHYSICS_WIDTH / 2, PHYSICS_HEIGHT - 10, PHYSICS_WIDTH + 10, 60, { 
      isStatic: true,
      render: { visible: false }
    })
    const leftWall = Bodies.rectangle(-5, PHYSICS_HEIGHT / 2, 60, PHYSICS_HEIGHT, { 
      isStatic: true,
      render: { visible: false }
    })
    const rightWall = Bodies.rectangle(PHYSICS_WIDTH + 5, PHYSICS_HEIGHT / 2, 60, PHYSICS_HEIGHT, { 
      isStatic: true,
      render: { visible: false }
    })

    const logoSize = LOGO_SIZE
    const spacing = 80
    const startX = 140
    const startY = 50

    const physicsBodies: Matter.Body[] = []

    this.logos.forEach((logo) => {
      const x = startX + (logo.col * spacing) - (logo.row === 1 && logo.col > 1 ? spacing : 0)
      const y = startY + (logo.row * 80)
      
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

    const stevenTexture = this.createTextTexture('Steven', 32)
    const stevenBody = Bodies.rectangle(300, 140, 120, 50, {
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
    })

    const meierTexture = this.createTextTexture('Meier', 32)
    const meierBody = Bodies.rectangle(500, 140, 100, 50, {
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
    })

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
  }

  componentWillUnmount(): void {
    this.cleanupPhysics()
  }

  render(): React.ReactNode {
    return (
      <div style={{ 
        width: '100%', 
        maxWidth: '700px', 
        margin: '32px auto 8px auto',
        position: 'relative'
      }}>        
        <canvas 
          ref={this.canvasRef}
          style={{
            width: '100%',
            height: '400px',
            display: 'block'
          }}
        />
      </div>
    )
  }
}

export default PhysicsBanner