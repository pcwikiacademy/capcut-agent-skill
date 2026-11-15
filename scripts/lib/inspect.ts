import { existsSync } from "node:fs"
import { basename, join } from "node:path"
import { type Json, projectFolders, projectName, readJson } from "./paths.ts"
import { ORIGINAL, segmentCount } from "./draft.ts"

function seconds(micro: number): string {
  return (micro / 1e6).toFixed(2)
}

function summary(folder: string): string {
  const json = readJson(join(folder, "draft_content.json"))
  if (!json) {
    return `${projectName(folder)} | ${folder} | unreadable (encrypted?)`
  }
  const canvas = json.canvas_config ?? {}
  const built = existsSync(join(folder, ORIGINAL)) ? " | built by this skill" : ""
  return `${projectName(folder)} | ${folder} | ${canvas.width}x${canvas.height} ${json.fps} fps | v${json.new_version} | ${segmentCount(json)} clips${built}`
}

export function listProjects() {
  for (const folder of projectFolders()) {
    console.log(summary(folder))
  }
}

function materialIndex(json: Json): Map<string, Json> {
  let index = new Map<string, Json>()
  for (const list of Object.values(json.materials ?? {})) {
    if (Array.isArray(list)) {
      for (const material of list) {
        index.set(material?.id, material)
      }
    }
  }
  return index
}

function describeSegment(segment: Json, index: Map<string, Json>): string {
  const material = index.get(segment.material_id) ?? {}
  const name = material.path ? basename(material.path) : material.type ?? "?"
  const { start, duration } = segment.target_timerange
  const source = segment.source_timerange ? ` in ${seconds(segment.source_timerange.start)}` : ""
  const look = segment.clip ? ` scale ${segment.clip.scale.x.toFixed(3)} pos ${segment.clip.transform.x.toFixed(3)},${segment.clip.transform.y.toFixed(3)}` : ""
  return `  ${seconds(start)}-${seconds(start + duration)} ${name}${source} speed ${segment.speed ?? 1} vol ${segment.volume ?? 1}${look}`
}

export function inspectProject(folder: string) {
  const json = readJson(join(folder, "draft_content.json"))
  if (!json) {
    throw new Error("draft_content.json is not plain JSON")
  }
  console.log(summary(folder))
  console.log(`length ${seconds(json.duration ?? 0)}s`)
  const index = materialIndex(json)
  for (const track of json.tracks ?? []) {
    const role = track.type === "video" && track.flag === 0 ? " (main)" : ""
    console.log(`${track.type} track "${track.name ?? ""}"${role}: ${track.segments.length} segments`)
    for (const segment of track.segments) {
      console.log(describeSegment(segment, index))
    }
  }
}
