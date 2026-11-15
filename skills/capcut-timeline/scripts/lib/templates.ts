import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { type Json, projectFolders, readJson, userCacheDir } from "./paths.ts"
import { type Kind } from "./media.ts"

// The small helper materials a plain clip needs. Animations, transitions, effects and nested drafts are left out.
const KEPT_REFS = ["speeds", "placeholder_infos", "canvases", "sound_channel_mappings", "material_colors", "vocal_separations", "beats", "loudnesses"]
const KINDS: Kind[] = ["video", "photo", "audio"]
const BUNDLED = join(import.meta.dirname, "..", "..", "assets")

export type Template = {
  segment: Json
  material: Json
  materialKind: string
  refs: { kind: string; material: Json }[]
}

export type Templates = Record<Kind, Template>

function indexMaterials(draft: Json): Map<string, { kind: string; material: Json }> {
  let index = new Map<string, { kind: string; material: Json }>()
  for (const [kind, list] of Object.entries(draft.materials ?? {})) {
    if (!Array.isArray(list)) {
      continue
    }
    for (const material of list) {
      if (material?.id) {
        index.set(material.id, { kind, material })
      }
    }
  }
  return index
}

function kindOfMaterial(material: Json): Kind | null {
  const path = String(material.path ?? "")
  if (!path || path.includes("##_draftpath_placeholder") || path.includes("/Resources/")) {
    return null
  }
  if (material.type === "video") {
    return "video"
  }
  if (material.type === "photo") {
    return "photo"
  }
  if (material.type === "extract_music") {
    return "audio"
  }
  return null
}

function collect(draft: Json, found: Partial<Templates>) {
  const index = indexMaterials(draft)
  for (const track of draft.tracks ?? []) {
    for (const segment of track.segments ?? []) {
      const entry = index.get(segment.material_id)
      const kind = entry ? kindOfMaterial(entry.material) : null
      if (!entry || !kind || found[kind]) {
        continue
      }
      const refs = (segment.extra_material_refs ?? [])
        .map((id: string) => index.get(id))
        .filter((ref: Json) => ref && KEPT_REFS.includes(ref.kind))
      found[kind] = { segment, material: entry.material, materialKind: entry.kind, refs }
    }
  }
  for (const nested of draft.materials?.drafts ?? []) {
    if (nested.draft) {
      collect(nested.draft, found)
    }
  }
}

function fromProjects(version: string): Partial<Templates> {
  let found: Partial<Templates> = {}
  for (const folder of projectFolders()) {
    const draft = readJson(join(folder, "draft_content.json"))
    if (draft?.tracks && draft.new_version === version) {
      collect(draft, found)
    }
  }
  return found
}

function cacheFile(dir: string, version: string): string {
  return join(dir, `templates-${version}.json`)
}

function fromFile(path: string): Partial<Templates> {
  return existsSync(path) ? readJson(path)?.templates ?? {} : {}
}

function saveCache(version: string, templates: Templates) {
  mkdirSync(userCacheDir(), { recursive: true })
  writeFileSync(cacheFile(userCacheDir(), version), JSON.stringify({ version, templates }, null, 2) + "\n")
}

function merge(sources: Partial<Templates>[]): Partial<Templates> {
  let merged: Partial<Templates> = {}
  for (const kind of KINDS) {
    merged[kind] = sources.map(source => source[kind]).find(Boolean)
  }
  return merged
}

// Templates are cloned from real clips CapCut itself wrote, never invented: first from the user's own projects
// of the same draft version (read only), then from the user cache, then from the copy bundled with the skill.
export function findTemplates(version: string): Templates {
  const local = fromProjects(version)
  if (KINDS.every(kind => local[kind])) {
    saveCache(version, local as Templates)
    return local as Templates
  }
  const found = merge([local, fromFile(cacheFile(userCacheDir(), version)), fromFile(cacheFile(BUNDLED, version))])
  const missing = KINDS.filter(kind => !found[kind])
  if (missing.length > 0) {
    throw new Error(`no ${missing.join(", ")} template for draft version ${version}. In CapCut, make any project with one video, one image and one audio clip on its timeline, close CapCut, and run again.`)
  }
  return found as Templates
}
