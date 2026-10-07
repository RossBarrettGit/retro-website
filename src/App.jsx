import { useCallback, useEffect, useRef, useState } from 'react'

const PHOSPHORS = {
  green: '#39ff88',
  amber: '#ffb000',
  cyan: '#4df3ff',
}

const BOOT_LINES = [
  'RETRO-BIOS v2.86   (C) 1986 RETRO SYSTEMS INC.',
  '',
  'CPU: Z80-TURBO @ 4.77 MHz .............. OK',
  'MEMORY TEST: 640K ...................... OK',
  'VIDEO: PHOSPHOR CRT 80x25 .............. OK',
  'DRIVE A: 5.25" FLOPPY .................. OK',
  'SOUND: PC BEEPER ....................... OK',
  '',
  'LOADING RETRO-OS ...',
]

const ASCII_LOGO = `██████╗ ███████╗████████╗██████╗  ██████╗
██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔═══██╗
██████╔╝█████╗     ██║   ██████╔╝██║   ██║
██╔══██╗██╔══╝     ██║   ██╔══██╗██║   ██║
██║  ██║███████╗   ██║   ██║  ██║╚██████╔╝
╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝`

const FORTUNES = [
  'THE FUTURE IS 8-BIT.',
  'HAVE YOU TRIED TURNING IT OFF AND ON AGAIN?',
  'BE KIND, REWIND.',
  'INSERT DISK 2 TO CONTINUE YOUR DESTINY.',
  'ALL YOUR BASE ARE BELONG TO YOU.',
]

const FLOATERS = [
  { type: 'tri', color: '#ff2a6d', x: 6, y: 14, s: 54, d: 16, delay: 0 },
  { type: 'ring', color: '#4df3ff', x: 86, y: 10, s: 62, d: 19, delay: -4 },
  { type: 'disk', color: '#ffb000', x: 90, y: 58, s: 48, d: 22, delay: -9 },
  { type: 'sq', color: '#b967ff', x: 4, y: 62, s: 44, d: 18, delay: -6 },
  { type: 'plus', color: '#39ff88', x: 18, y: 38, s: 30, d: 13, delay: -2 },
  { type: 'tri', color: '#4df3ff', x: 76, y: 34, s: 34, d: 15, delay: -11 },
  { type: 'ring', color: '#ff2a6d', x: 50, y: 6, s: 26, d: 12, delay: -7 },
]

/* Runs a requestAnimationFrame loop on a DPR-aware canvas.
   `setup` returns a draw(ctx, w, h, t, dt) function. */
function useCanvas(setup, deps) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const draw = setup()
    let w = 0
    let h = 0
    let raf
    let last = performance.now()

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      // client sizes ignore CSS transforms (e.g. the CRT power-on squash)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      draw(ctx, w, h, now / 1000, dt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return ref
}

function Starfield() {
  const ref = useCanvas(() => {
    const spawn = (z = Math.random()) => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z,
      hue: Math.random() < 0.15 ? '#ff7edb' : '#ffffff',
    })
    const stars = Array.from({ length: 320 }, () => spawn())

    return (ctx, w, h, t, dt) => {
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        s.z -= dt * 0.06
        if (s.z <= 0.02) Object.assign(s, spawn(1))
        const px = w / 2 + (s.x / s.z) * w * 0.25
        const py = h * 0.35 + (s.y / s.z) * h * 0.25
        if (px < 0 || px > w || py < 0 || py > h) {
          Object.assign(s, spawn(1))
          continue
        }
        const size = (1 - s.z) * 2.2 + 0.3
        const twinkle = 0.6 + 0.4 * Math.sin(t * 3 + s.x * 40)
        ctx.globalAlpha = (1 - s.z) * twinkle
        ctx.fillStyle = s.hue
        ctx.fillRect(px, py, size, size)
      }
      ctx.globalAlpha = 1
    }
  }, [])
  return <canvas ref={ref} className="absolute inset-x-0 top-0 h-[62%] w-full" aria-hidden="true" />
}

const CUBE_V = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
]
const CUBE_E = [
  [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6],
  [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7],
]
const OCTA_V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
const OCTA_E = []
for (let i = 0; i < 6; i++) {
  for (let j = i + 1; j < 6; j++) {
    if (Math.floor(i / 2) !== Math.floor(j / 2)) OCTA_E.push([i, j])
  }
}

function project([x, y, z], ax, ay, scale, w, h) {
  let c = Math.cos(ay)
  let s = Math.sin(ay)
  ;[x, z] = [x * c - z * s, x * s + z * c]
  c = Math.cos(ax)
  s = Math.sin(ax)
  ;[y, z] = [y * c - z * s, y * s + z * c]
  const p = 3.2 / (z + 4.5)
  return [w / 2 + x * p * scale, h / 2 + y * p * scale]
}

function WireCube({ color }) {
  const ref = useCanvas(() => {
    const shape = (ctx, verts, edges, ax, ay, scale, w, h) => {
      const pts = verts.map((v) => project(v, ax, ay, scale, w, h))
      ctx.beginPath()
      for (const [a, b] of edges) {
        ctx.moveTo(...pts[a])
        ctx.lineTo(...pts[b])
      }
      ctx.stroke()
      for (const [px, py] of pts) ctx.fillRect(px - 2, py - 2, 4, 4)
    }

    return (ctx, w, h, t) => {
      ctx.clearRect(0, 0, w, h)
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 10
      ctx.lineWidth = 1.5
      const scale = Math.min(w, h) * 0.42
      shape(ctx, CUBE_V, CUBE_E, t * 0.7, t * 0.9, scale, w, h)
      ctx.globalAlpha = 0.7
      shape(ctx, OCTA_V, OCTA_E, -t * 1.1, -t * 0.6, scale * 0.85, w, h)
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
    }
  }, [color])
  return <canvas ref={ref} className="block h-[110px] w-full" aria-label="Rotating wireframe cube" />
}

function Oscilloscope({ color }) {
  const ref = useCanvas(() => (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.15
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 1; i < 8; i++) {
      ctx.moveTo((w / 8) * i, 0)
      ctx.lineTo((w / 8) * i, h)
    }
    for (let i = 1; i < 6; i++) {
      ctx.moveTo(0, (h / 6) * i)
      ctx.lineTo(w, (h / 6) * i)
    }
    ctx.stroke()

    ctx.globalAlpha = 1
    ctx.shadowColor = color
    ctx.shadowBlur = 12
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = 0; x <= w; x += 2) {
      const n = x / w
      const env = 0.6 + 0.4 * Math.sin(t * 0.8)
      const y =
        h / 2 +
        (Math.sin(n * 14 + t * 3) * 0.32 * env +
          Math.sin(n * 37 - t * 7) * 0.08 +
          Math.sin(n * 5 + t * 1.3) * 0.12) *
          h
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.shadowBlur = 0
  }, [color])
  return <canvas ref={ref} className="block h-[110px] w-full" aria-label="Animated oscilloscope signal" />
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return <span>{now.toLocaleTimeString('en-GB')}</span>
}


function Cursor({ className = 'animate-blink' }) {
  return <span className={`ml-1 inline-block motion-reduce:animate-none ${className}`}>█</span>
}

function Boot({ onDone }) {
  const [count, setCount] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let id
    if (count < BOOT_LINES.length) {
      id = setTimeout(() => setCount((c) => c + 1), 180)
    } else if (progress < 100) {
      id = setTimeout(() => setProgress((p) => Math.min(100, p + 5)), 45)
    } else {
      id = setTimeout(onDone, 450)
    }
    return () => clearTimeout(id)
  }, [count, progress, onDone])

  useEffect(() => {
    window.addEventListener('keydown', onDone)
    return () => window.removeEventListener('keydown', onDone)
  }, [onDone])

  const filled = Math.round(progress / 5)
  return (
    <div className="absolute inset-0 cursor-pointer p-[clamp(14px,2.5vw,24px)] whitespace-pre-wrap" onClick={onDone}>
      {BOOT_LINES.slice(0, count).map((line, i) => (
        <div key={i}>{line || '\u00a0'}</div>
      ))}
      {count >= BOOT_LINES.length && (
        <div>
          [{'█'.repeat(filled)}
          {'░'.repeat(20 - filled)}] {progress}%
        </div>
      )}
      <Cursor />
      <div className="absolute right-7 bottom-6 animate-blink-slow text-[0.8em] opacity-60">PRESS ANY KEY TO SKIP</div>
    </div>
  )
}

function Window({ title, className = '', children, ...props }) {
  return (
    <section
      className={`min-w-0 border-2 border-(--phos) bg-(--phos)/3 shadow-[0_0_12px_var(--phos-faint),inset_0_0_12px_var(--phos-faint)] ${className}`}
      {...props}
    >
      <header className="flex justify-between border-b-2 border-(--phos) px-2 py-[3px] font-pixel text-[9px] tracking-[1px]">
        <span>■ {title}</span>
        <span className="opacity-70">▪ ▪ ▪</span>
      </header>
      {children}
    </section>
  )
}

function Terminal({ onColor, onReboot }) {
  const [lines, setLines] = useState([
    'RETRO-OS READY.',
    'TYPE "HELP" FOR A LIST OF COMMANDS.',
  ])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([])
  const [histIdx, setHistIdx] = useState(-1)
  const logRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const el = logRef.current
    el.scrollTop = el.scrollHeight
  }, [lines])

  const run = (raw) => {
    const [cmd, ...args] = raw.trim().split(/\s+/)
    const c = (cmd || '').toLowerCase()
    const out = []
    switch (c) {
      case '':
        break
      case 'help':
        out.push(
          'HELP ............ THIS LIST',
          'ABOUT ........... ABOUT THIS MACHINE',
          'DATE ............ CURRENT DATE & TIME',
          'COLOR <NAME> .... GREEN | AMBER | CYAN',
          'FORTUNE ......... WISDOM FROM THE MAINFRAME',
          'ECHO <TEXT> ..... REPEAT AFTER ME',
          'CLEAR ........... CLEAR THE SCREEN',
          'REBOOT .......... RESTART THE SYSTEM',
        )
        break
      case 'about':
        out.push('RETRO-OS 1.0 // BUILT WITH REACT + VITE + TAILWIND.', 'PIXELS LOVINGLY HAND-GLOWED SINCE 1986.')
        break
      case 'date':
        out.push(new Date().toString().toUpperCase())
        break
      case 'color': {
        const name = (args[0] || '').toLowerCase()
        if (PHOSPHORS[name]) {
          onColor(name)
          out.push(`PHOSPHOR SET TO ${name.toUpperCase()}.`)
        } else {
          out.push('USAGE: COLOR GREEN | AMBER | CYAN')
        }
        break
      }
      case 'fortune':
        out.push(FORTUNES[Math.floor(Math.random() * FORTUNES.length)])
        break
      case 'echo':
        out.push(args.join(' ').toUpperCase())
        break
      case 'clear':
        setLines([])
        return
      case 'reboot':
        onReboot()
        return
      default:
        out.push(`BAD COMMAND OR FILE NAME: ${cmd.toUpperCase()}`)
    }
    setLines((prev) => [...prev, `C:\\> ${raw.toUpperCase()}`, ...out])
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      run(input)
      if (input.trim()) setHistory((h) => [input, ...h])
      setHistIdx(-1)
      setInput('')
    } else if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault()
      const i = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(i)
      setInput(history[i])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const i = histIdx - 1
      setHistIdx(Math.max(i, -1))
      setInput(i >= 0 ? history[i] : '')
    }
  }

  return (
    <Window title="COMMAND.COM" className="cursor-text" onClick={() => inputRef.current?.focus()}>
      <div
        ref={logRef}
        className="h-[110px] overflow-y-auto px-3 py-2 [scrollbar-color:var(--phos)_transparent] [scrollbar-width:thin]"
      >
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
        <label className="flex gap-2">
          <span>C:\&gt;</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck="false"
            autoComplete="off"
            aria-label="Terminal command"
            className="min-w-0 flex-1 border-0 bg-transparent text-(--phos) uppercase caret-(--phos) outline-none [font:inherit] [text-shadow:inherit]"
          />
        </label>
      </div>
    </Window>
  )
}

function Desktop({ color, colorName, onColor, onReboot }) {
  const names = Object.keys(PHOSPHORS)
  const cycle = () => onColor(names[(names.indexOf(colorName) + 1) % names.length])

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-(--phos) px-3 py-1.5 font-pixel text-[10px] text-ink shadow-[0_0_16px_var(--phos-dim)] [text-shadow:none]">
        <span>◆ RETRO-OS 1.0</span>
        <button
          className="cursor-pointer border border-dashed border-current px-2 py-1 font-pixel text-[10px] hover:bg-ink hover:text-(--phos)"
          onClick={cycle}
        >
          PHOSPHOR: {colorName.toUpperCase()}
        </button>
        <Clock />
      </div>

      <div className="py-1 text-center">
        <pre
          className="m-0 inline-block animate-ascii-glow text-left font-ascii text-[clamp(6px,1.3vw,12px)] leading-[1.05] motion-reduce:animate-none"
          aria-label="RETRO"
        >
          {ASCII_LOGO}
        </pre>
        <p className="mt-2.5 font-pixel text-[clamp(9px,1.2vw,12px)] tracking-[2px]">
          WELCOME TO THE FUTURE OF 1986
          <Cursor />
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Window title="3D.EXE">
          <WireCube color={color} />
        </Window>
        <Window title="SIGNAL.DAT">
          <Oscilloscope color={color} />
        </Window>
        <Window title="SYSMON">
          <div className="grid h-[110px] content-center gap-1 px-3 py-2 leading-none">
            {['CPU', 'MEM', 'DSK', 'NET', 'PWR'].map((m, i) => (
              <div className="grid grid-cols-[36px_1fr] items-center gap-2" key={m}>
                <span>{m}</span>
                <div className="h-3 border border-(--phos-dim) p-px">
                  <div
                    className="meter-fill h-full animate-meter"
                    style={{ '--d': `${2.2 + i * 0.7}s`, '--delay': `${-i * 0.9}s` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Window>
      </div>

      <Terminal onColor={onColor} onReboot={onReboot} />

      <div className="overflow-hidden border-y border-dashed border-(--phos-dim) py-1 whitespace-nowrap" aria-hidden="true">
        <div className="inline-flex animate-ticker">
          {[0, 1].map((k) => (
            <span key={k}>
              ★ SYSTEM NOMINAL ★ 640K OUGHT TO BE ENOUGH FOR ANYBODY ★ NOW WITH 16 GLORIOUS COLOURS ★ TRY
              TYPING "FORTUNE" ★ DON&apos;T FORGET TO DEFRAG ★&nbsp;
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function Monitor() {
  const [phase, setPhase] = useState('boot') // 'boot' | 'desktop' | 'off'
  const [colorName, setColorName] = useState('green')
  const [bootKey, setBootKey] = useState(0)
  const color = PHOSPHORS[colorName]
  const isOff = phase === 'off'

  const finishBoot = useCallback(() => setPhase('desktop'), [])
  const reboot = useCallback(() => {
    setBootKey((k) => k + 1)
    setPhase('boot')
  }, [])
  const togglePower = () => (isOff ? reboot() : setPhase('off'))

  return (
    <div className="phosphor relative z-2 w-full max-w-[860px] animate-monitor-in motion-reduce:animate-none" style={{ '--phos': color }}>
      <div className="bezel rounded-t-[28px] rounded-b-[10px] p-[clamp(12px,2.5vw,26px)]">
        <div className="crt-screen relative overflow-hidden">
          <div
            key={bootKey}
            className={`phos-glow relative p-[clamp(14px,2.5vw,24px)] font-term text-[clamp(16px,1.8vw,19px)] leading-[1.2] text-(--phos) ${
              isOff ? 'animate-crt-off' : 'animate-crt-on motion-reduce:animate-none'
            }`}
          >
            {/* The desktop always stays laid out (just hidden during boot) so the screen keeps one size. */}
            <div className={phase === 'boot' ? 'invisible' : ''} aria-hidden={phase === 'boot'}>
              <Desktop color={color} colorName={colorName} onColor={setColorName} onReboot={reboot} />
            </div>
            {phase === 'boot' && <Boot onDone={finishBoot} />}
          </div>
          <div className="scanlines pointer-events-none absolute inset-0 rounded-[inherit]" aria-hidden="true" />
          <div
            className="rollbar pointer-events-none absolute inset-x-0 top-0 h-[22%] animate-roll motion-reduce:hidden"
            aria-hidden="true"
          />
          <div className="glass pointer-events-none absolute inset-0 rounded-[inherit]" aria-hidden="true" />
        </div>
      </div>

      <div className="chin -mt-0.5 flex items-center justify-between gap-4 rounded-b-[20px] px-[clamp(14px,2.5vw,26px)] pt-3 pb-3.5 text-case-text">
        <div className="font-pixel text-[10px] tracking-[1px] whitespace-nowrap">
          <span className="text-neon-pink">▲</span> RETRO SYSTEMS <em className="text-case-accent not-italic">RS-1986</em>
        </div>
        <div className="hidden flex-1 justify-center gap-[5px] md:flex" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="h-[18px] w-1 rounded-sm bg-[#8c8065] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
          ))}
        </div>
        <div className="flex items-center gap-3">
          {[0, 1].map((k) => (
            <span
              key={k}
              className="hidden size-[18px] rounded-full bg-radial-[at_35%_35%] from-[#e6dcc3] to-[#8c8065] shadow-[0_2px_3px_rgba(0,0,0,0.4)] md:block"
              aria-hidden="true"
            />
          ))}
          <span
            className={`size-[9px] rounded-full ${
              isOff ? 'bg-[#4a4436]' : 'animate-led bg-(--phos) shadow-[0_0_6px_var(--phos),0_0_14px_var(--phos)]'
            }`}
            aria-hidden="true"
          />
          <button
            className="size-[34px] cursor-pointer rounded-lg bg-linear-to-b from-[#e6dcc3] to-[#a99c7c] text-base text-case-text shadow-[0_3px_0_#7d715a,0_4px_8px_rgba(0,0,0,0.35)] transition-[translate,box-shadow] duration-75 active:translate-y-[3px] active:shadow-[0_0_0_#7d715a,0_1px_3px_rgba(0,0,0,0.35)]"
            onClick={togglePower}
            aria-label={isOff ? 'Power on' : 'Power off'}
          >
            ⏻
          </button>
        </div>
      </div>

      <div
        className="mx-auto h-[28px] w-3/5 bg-linear-to-b from-[#9c8f71] to-[#c9bd9f] drop-shadow-[0_20px_20px_rgba(0,0,0,0.6)] [clip-path:polygon(18%_0,82%_0,100%_100%,0_100%)] md:w-[38%]"
        aria-hidden="true"
      />
    </div>
  )
}

function Floater({ type, color, x, y, s, d, delay }) {
  const stroke = { fill: 'none', stroke: color, strokeWidth: 2 }
  return (
    <svg
      className="pointer-events-none fixed z-1 animate-drift opacity-85 [filter:drop-shadow(0_0_6px_var(--c))_drop-shadow(0_0_14px_var(--c))]"
      viewBox="0 0 40 40"
      aria-hidden="true"
      style={{ left: `${x}%`, top: `${y}%`, width: s, '--d': `${d}s`, '--delay': `${delay}s`, '--c': color }}
    >
      {type === 'tri' && <polygon points="20,4 36,34 4,34" {...stroke} />}
      {type === 'sq' && <rect x="6" y="6" width="28" height="28" {...stroke} />}
      {type === 'ring' && (
        <g {...stroke}>
          <circle cx="20" cy="20" r="15" />
          <circle cx="20" cy="20" r="8" />
        </g>
      )}
      {type === 'plus' && <path d="M20 4v32M4 20h32" {...stroke} />}
      {type === 'disk' && (
        <g {...stroke}>
          <rect x="5" y="5" width="30" height="30" rx="2" />
          <rect x="12" y="5" width="16" height="10" />
          <rect x="10" y="22" width="20" height="13" />
        </g>
      )}
    </svg>
  )
}

export default function App() {
  return (
    <main className="relative grid min-h-screen grid-cols-[minmax(0,1fr)] place-items-center overflow-hidden px-4 pt-6 pb-10 md:pt-8">
      <div className="sky fixed inset-0 z-0" aria-hidden="true">
        <Starfield />
        <div className="sun absolute bottom-[38%] left-1/2 aspect-square w-[min(46vw,460px)] -translate-x-1/2 translate-y-1/2 animate-sun rounded-full motion-reduce:animate-none" />
        <div className="absolute inset-x-0 bottom-0 h-[38%] overflow-hidden bg-linear-to-b from-[#2a0845] to-night to-70% perspective-[260px] perspective-origin-top">
          <div className="floor-grid absolute -inset-x-1/2 top-0 h-[300%] origin-top rotate-x-70 animate-floor motion-reduce:animate-none" />
        </div>
      </div>
      {FLOATERS.map((f, i) => (
        <Floater key={i} {...f} />
      ))}
      <Monitor />
    </main>
  )
}
