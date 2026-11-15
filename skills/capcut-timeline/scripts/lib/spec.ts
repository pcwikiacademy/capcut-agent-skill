import { existsSync, readFileSync } from "node:fs"
import { dirname, isAbsolute, resolve } from "node:path"
import { type Media, probe } from "./media.ts"

export type SpecClip = {
  file: string
  start?: number
  end?: number
  duration?: number
  in?: number
  speed?: number
  volume?: number
  scale?: number
  width?: number
  fill?: boolean
  x?: number
  y?: number
  opacity?: number
}

export type SpecTrack = {
  type: "video" | "audio"
  name?: string
  clips: SpecClip[]
}

export type Spec = {
  tracks: SpecTrack[]
}

export type Canvas = { width: number; height: number; fps: number }

// Frames on the timeline, seconds in the source file, CapCut's own units for scale and position.
export type Clip = {
  path: string
  media: Media
  startFrame: number
  endFrame: number
  sourceIn: number
  speed: number
  volume: number
  scale: number
  x: number
  y: number
  alpha: number
}

export type Track = { type: "video" | "audio"; name: string; clips: Clip[] }

const PHOTO_SECONDS = 5

export function readSpec(path: string): Spec {
  const spec = JSON.parse(readFileSync(path, "utf8"))
  if (!Array.isArray(spec?.tracks) || spec.tracks.length === 0) {
    throw new Error("the timeline file needs a non-empty \"tracks\" list")
  }
  return spec
}

function filePath(file: string, base: string): string {
  const path = isAbsolute(file) ? file : resolve(base, file)
  if (!existsSync(path)) {
    throw new Error(`media file not found: ${path}`)
  }
  return path.replace(/\\/g, "/")
}

function lengthOf(clip: SpecClip, media: Media, sourceIn: number, speed: number): number {
  if (clip.duration !== undefined) {
    return clip.duration
  }
  if (media.kind === "photo") {
    return PHOTO_SECONDS
  }
  return (media.duration - sourceIn) / speed
}

// CapCut scale 1 fits the picture inside the canvas. Position is the picture center's offset in half canvas sizes, y up.
function placement(clip: SpecClip, media: Media, canvas: Canvas): { scale: number; x: number; y: number } {
  if (media.kind === "audio" || !media.width) {
    return { scale: 1, x: 0, y: 0 }
  }
  const fit = Math.min(canvas.width / media.width, canvas.height / media.height)
  const fill = Math.max(canvas.width / media.width, canvas.height / media.height)
  let scale = clip.scale ?? (clip.fill ? fill / fit : 1)
  if (clip.width !== undefined) {
    scale = clip.width / (media.width * fit)
  }
  const halfW = canvas.width / 2
  const halfH = canvas.height / 2
  const x = clip.x === undefined ? 0 : (clip.x - halfW) / halfW
  const y = clip.y === undefined ? 0 : (halfH - clip.y) / halfH
  return { scale, x, y }
}

function toClip(clip: SpecClip, previousEnd: number, base: string, canvas: Canvas): Clip {
  const path = filePath(clip.file, base)
  const media = probe(path)
  const speed = clip.speed ?? 1
  const sourceIn = clip.in ?? 0
  const start = clip.start ?? previousEnd
  const end = clip.end ?? start + lengthOf(clip, media, sourceIn, speed)
  if (end <= start) {
    throw new Error(`${clip.file}: end must be after start`)
  }
  return {
    path,
    media,
    startFrame: Math.round(start * canvas.fps),
    endFrame: Math.round(end * canvas.fps),
    sourceIn,
    speed,
    volume: clip.volume ?? 1,
    alpha: clip.opacity ?? 1,
    ...placement(clip, media, canvas),
  }
}

function checkOverlaps(track: Track) {
  for (let i = 1; i < track.clips.length; i++) {
    if (track.clips[i].startFrame < track.clips[i - 1].endFrame) {
      throw new Error(`clips overlap on track "${track.name}". Put overlapping clips on separate tracks.`)
    }
  }
}

function toTrack(track: SpecTrack, index: number, base: string, canvas: Canvas): Track {
  let clips: Clip[] = []
  let previousEnd = 0
  for (const clip of track.clips ?? []) {
    const made = toClip(clip, previousEnd, base, canvas)
    clips.push(made)
    previousEnd = made.endFrame / canvas.fps
  }
  clips.sort((a, b) => a.startFrame - b.startFrame)
  const made: Track = { type: track.type, name: track.name ?? `${track.type} ${index + 1}`, clips }
  checkOverlaps(made)
  return made
}

export function buildTracks(spec: Spec, specPath: string, canvas: Canvas): Track[] {
  const base = dirname(resolve(specPath))
  return spec.tracks.map((track, index) => {
    if (track.type !== "video" && track.type !== "audio") {
      throw new Error(`track ${index + 1}: type must be "video" or "audio"`)
    }
    return toTrack(track, index, base, canvas)
  })
}

export function mainTrackGaps(tracks: Track[], fps: number): string[] {
  const main = tracks.find(track => track.type === "video")
  let gaps: string[] = []
  let previous = 0
  for (const clip of main?.clips ?? []) {
    if (clip.startFrame !== previous) {
      gaps.push(`${(previous / fps).toFixed(2)}s to ${(clip.startFrame / fps).toFixed(2)}s`)
    }
    previous = clip.endFrame
  }
  return gaps
}
