import { useMemo, useRef, useState } from 'preact/hooks'

// Scanner diagnostics (temporary): what the camera really delivers and every raw read, so the
// next scanner fix is based on measured data from the phone.

export interface CameraInfo {
  label: string
  settings: Record<string, unknown>
  capabilities: Record<string, unknown>
  devices: string[] // labels of all video inputs
  video: { width: number; height: number } // frames the detector gets
  view: { width: number; height: number; dpr: number } // preview size in CSS px
  formats: string[] // what the detector supports
}

export interface FrameRead {
  raw: string
  format: string
  code: string | null // the stored form, or null when the check rejected it
}

export interface ScanFrame {
  t: number // ms since the camera started
  ms: number // detect() time
  reads: FrameRead[]
  votes: number // frames in the window that agree with this frame's code
  accepted: string | null
}

export interface ScanDebugSink {
  camera(info: CameraInfo): void
  frame(frame: ScanFrame): void
}

export interface ReadRow extends FrameRead {
  t: number
  votes: number
  accepted: boolean
}

export interface FrameStats {
  frames: number
  withRead: number
  avgMs: number
}

const MAX_ROWS = 40

export function useScanDebugLog() {
  const [camera, setCamera] = useState<CameraInfo | null>(null)
  const [rows, setRows] = useState<ReadRow[]>([])
  const [stats, setStats] = useState<FrameStats>({ frames: 0, withRead: 0, avgMs: 0 })
  const totals = useRef({ frames: 0, withRead: 0, ms: 0, shownAt: 0 })

  const sink = useMemo<ScanDebugSink>(() => ({
    camera: setCamera,
    frame(f) {
      const s = totals.current
      s.frames++
      s.ms += f.ms
      if (f.reads.length > 0) {
        s.withRead++
        const frameCode = f.reads.find((r) => r.code)?.code ?? null
        const added = f.reads.map((r) => ({
          ...r,
          t: f.t,
          votes: r.code && r.code === frameCode ? f.votes : 0,
          accepted: r.code !== null && r.code === f.accepted,
        }))
        setRows((prev) => [...added.reverse(), ...prev].slice(0, MAX_ROWS))
      }
      // The counters change on every frame: show them at most twice a second.
      const now = performance.now()
      if (f.reads.length > 0 || now - s.shownAt > 500) {
        s.shownAt = now
        setStats({ frames: s.frames, withRead: s.withRead, avgMs: s.ms / s.frames })
      }
    },
  }), [])

  const clear = () => {
    totals.current = { frames: 0, withRead: 0, ms: 0, shownAt: 0 }
    setRows([])
    setStats({ frames: 0, withRead: 0, avgMs: 0 })
  }

  return { sink, camera, rows, stats, clear }
}

export type ScanDebugLog = ReturnType<typeof useScanDebugLog>

type Range = { min?: number; max?: number }

function range(r: unknown): string {
  if (!r || typeof r !== 'object') return '—'
  const { min, max } = r as Range
  return `${min ?? '?'}–${max ?? '?'}`
}

/** Short lines for the panel. */
export function cameraLines(c: CameraInfo): string[] {
  const s = c.settings
  const cap = c.capabilities
  const screenW = Math.round(c.view.width * c.view.dpr)
  const screenH = Math.round(c.view.height * c.view.dpr)
  const focusModes = Array.isArray(cap.focusMode) ? (cap.focusMode as string[]).join(', ') : 'none'
  return [
    `Camera: ${c.label || '(no label)'}`,
    `Stream: ${s.width ?? '?'}×${s.height ?? '?'} @ ${typeof s.frameRate === 'number' ? Math.round(s.frameRate) : '?'} fps · frames ${c.video.width}×${c.video.height}`,
    `Max: ${range(cap.width).split('–')[1]}×${range(cap.height).split('–')[1]} · resizeMode ${s.resizeMode ?? '—'}`,
    `Preview: ${c.view.width}×${c.view.height} css × ${c.view.dpr} = ${screenW}×${screenH} px`,
    `Focus: ${s.focusMode ?? '—'} (supports: ${focusModes}) · distance ${s.focusDistance ?? '—'} (${range(cap.focusDistance)})`,
    `Zoom: ${s.zoom ?? '—'} (${range(cap.zoom)}) · torch ${cap.torch ? 'yes' : 'no'}`,
    `Cameras: ${c.devices.map((d) => (d === c.label ? `[${d}]` : d)).join(' | ')}`,
    `Formats: ${c.formats.join(', ')}`,
  ]
}

/** The whole log as text, with the raw camera data, to paste into a chat. */
export function logText(log: Pick<ScanDebugLog, 'camera' | 'rows' | 'stats'>): string {
  const lines: string[] = [`UA: ${navigator.userAgent}`]
  if (log.camera) {
    lines.push(...cameraLines(log.camera))
    lines.push(`settings: ${JSON.stringify(log.camera.settings)}`)
    lines.push(`capabilities: ${JSON.stringify(log.camera.capabilities)}`)
  }
  const { frames, withRead, avgMs } = log.stats
  lines.push(`Frames: ${frames} · with a read: ${withRead} · detect ${Math.round(avgMs)} ms`)
  lines.push('t(s)  raw  format  check  votes  accepted')
  for (const r of log.rows) {
    lines.push(`${(r.t / 1000).toFixed(1)}  ${r.raw}  ${r.format}  ${r.code ? 'ok' : 'FAIL'}  ${r.votes}  ${r.accepted ? 'YES' : ''}`)
  }
  return lines.join('\n')
}
