import { createHash, randomUUID } from "node:crypto"
import { basename } from "node:path"
import { type Json } from "./paths.ts"
import { type Template, type Templates } from "./templates.ts"
import { type Clip, type Track } from "./spec.ts"

// CapCut gives every still image this length in the source.
const PHOTO_DURATION = 10_800_000_000
// Times are rounded to microseconds, so a clip placed at its full length can overrun its file by a hair.
const MAX_OVERRUN = 1000

export type Draft = {
  json: Json
  materials: Record<string, Json[]>
  templates: Templates
  fps: number
}

export function newDraft(base: Json, templates: Templates): Draft {
  let materials: Record<string, Json[]> = {}
  for (const kind of Object.keys(base.materials ?? {})) {
    materials[kind] = Array.isArray(base.materials[kind]) ? [] : base.materials[kind]
  }
  return { json: base, materials, templates, fps: base.fps || 30 }
}

function newId(): string {
  return randomUUID().toUpperCase()
}

function micro(draft: Draft, frames: number): number {
  return Math.round((frames * 1_000_000) / draft.fps)
}

function addMaterial(draft: Draft, kind: string, material: Json) {
  if (!Array.isArray(draft.materials[kind])) {
    draft.materials[kind] = []
  }
  draft.materials[kind].push(material)
}

function cloneRefs(draft: Draft, template: Template, speed: number): string[] {
  return template.refs.map(ref => {
    let copy = structuredClone(ref.material)
    copy.id = newId()
    if (ref.kind === "speeds") {
      copy.speed = speed
    }
    addMaterial(draft, ref.kind, copy)
    return copy.id
  })
}

function fullCrop(): Json {
  return {
    upper_left_x: 0.0, upper_left_y: 0.0, upper_right_x: 1.0, upper_right_y: 0.0,
    lower_left_x: 0.0, lower_left_y: 1.0, lower_right_x: 1.0, lower_right_y: 1.0,
  }
}

function mediaMaterial(draft: Draft, template: Template, clip: Clip): Json {
  let material = structuredClone(template.material)
  material.id = newId()
  material.path = clip.path
  material.unique_id = createHash("md5").update(clip.path).digest("hex")
  if ("local_material_id" in material) {
    material.local_material_id = randomUUID()
  }
  if (clip.media.kind === "audio") {
    material.name = basename(clip.path)
    material.duration = Math.round(clip.media.duration * 1_000_000)
    material.music_id = randomUUID()
  } else {
    material.material_name = basename(clip.path)
    material.width = clip.media.width
    material.height = clip.media.height
    material.has_audio = clip.media.hasAudio
    material.duration = clip.media.kind === "photo" ? PHOTO_DURATION : Math.round(clip.media.duration * 1_000_000)
    material.crop = fullCrop()
  }
  addMaterial(draft, template.materialKind, material)
  return material
}

function sourceRange(clip: Clip, duration: number, material: Json): Json {
  const start = Math.round(clip.sourceIn * 1_000_000)
  let length = Math.round(duration * clip.speed)
  if (clip.media.kind === "photo") {
    return { start, duration: length }
  }
  const overrun = start + length - material.duration
  if (overrun > 0 && overrun < MAX_OVERRUN) {
    length -= overrun
  }
  if (start + length > material.duration) {
    throw new Error(`${basename(clip.path)} is too short for its place on the timeline (check "in", "end" and "speed")`)
  }
  return { start, duration: length }
}

function resetLook(segment: Json, clip: Clip) {
  segment.keyframe_refs = []
  segment.common_keyframes = []
  if (!segment.clip) {
    return
  }
  segment.clip = {
    scale: { x: clip.scale, y: clip.scale },
    rotation: 0.0,
    transform: { x: clip.x, y: clip.y },
    flip: { vertical: false, horizontal: false },
    alpha: clip.alpha,
  }
  // Not the scale: CapCut sets y to x / value on the next Scale edit, so anything but 1 squeezes the clip.
  segment.uniform_scale = { on: true, value: 1.0 }
}

function makeSegment(draft: Draft, clip: Clip, layer: number): Json {
  const template = draft.templates[clip.media.kind]
  const material = mediaMaterial(draft, template, clip)
  const start = micro(draft, clip.startFrame)
  const duration = micro(draft, clip.endFrame) - start
  let segment = structuredClone(template.segment)
  segment.id = newId()
  segment.material_id = material.id
  segment.extra_material_refs = cloneRefs(draft, template, clip.speed)
  segment.target_timerange = { start, duration }
  segment.source_timerange = sourceRange(clip, duration, material)
  segment.speed = clip.speed
  segment.volume = clip.volume
  segment.last_nonzero_volume = 1.0
  segment.render_index = clip.media.kind === "audio" ? 0 : layer
  segment.track_render_index = layer
  segment.visible = true
  resetLook(segment, clip)
  return segment
}

function checkKinds(track: Track) {
  for (const clip of track.clips) {
    const isAudio = clip.media.kind === "audio"
    if (isAudio !== (track.type === "audio")) {
      throw new Error(`${basename(clip.path)} cannot go on the ${track.type} track "${track.name}"`)
    }
  }
}

// The first video track is CapCut's main track (flag 0). Later tracks draw on top of earlier ones.
export function makeTracks(draft: Draft, tracks: Track[]): Json[] {
  const mainIndex = tracks.findIndex(track => track.type === "video")
  return tracks.map((track, layer) => {
    checkKinds(track)
    const main = layer === mainIndex
    return {
      id: newId(),
      type: track.type,
      flag: main ? 0 : track.type === "video" ? 2 : 0,
      attribute: 0,
      name: track.name,
      is_default_name: false,
      segments: track.clips.map(clip => makeSegment(draft, clip, layer)),
    }
  })
}

export function finish(draft: Draft, tracks: Json[]): Json {
  let json = draft.json
  json.tracks = tracks
  json.materials = draft.materials
  const ends = tracks.flatMap(track => track.segments.map((segment: Json) => segment.target_timerange.start + segment.target_timerange.duration))
  json.duration = Math.max(0, ...ends)
  return json
}
