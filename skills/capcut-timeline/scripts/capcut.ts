import { basename } from "node:path"
import { findProject } from "./lib/paths.ts"
import { backup, capcutRunning, readBase, restoreOriginal, writeTimeline } from "./lib/draft.ts"
import { inspectProject, listProjects } from "./lib/inspect.ts"
import { buildTracks, mainTrackGaps, readSpec } from "./lib/spec.ts"
import { findTemplates } from "./lib/templates.ts"
import { finish, makeTracks, newDraft } from "./lib/segment.ts"

const USAGE = `usage:
  bun scripts/capcut.ts list
  bun scripts/capcut.ts inspect <project>
  bun scripts/capcut.ts build <project> <timeline.json> [--dry-run] [--force]
  bun scripts/capcut.ts restore <project>

<project> is the project name shown in CapCut, its folder name, or its folder path.
build and restore need CapCut closed. --dry-run writes nothing and works while CapCut is open.
--force replaces a timeline that already holds clips.`

const args = process.argv.slice(2)
const flags = new Set(args.filter(arg => arg.startsWith("--")))
const [command, projectArg, specArg] = args.filter(arg => !arg.startsWith("--"))

function requireClosed() {
  if (capcutRunning()) {
    throw new Error("CapCut is running. Close it first: it rewrites the draft on exit and would undo this change.")
  }
}

function build(project: string, specPath: string) {
  const dryRun = flags.has("--dry-run")
  if (!dryRun) {
    requireClosed()
  }
  const spec = readSpec(specPath)
  const base = readBase(project, flags.has("--force"), dryRun)
  const canvas = { width: base.canvas_config?.width ?? 1920, height: base.canvas_config?.height ?? 1080, fps: base.fps || 30 }
  const tracks = buildTracks(spec, specPath, canvas)
  const draft = newDraft(base, findTemplates(base.new_version))
  const json = finish(draft, makeTracks(draft, tracks))
  for (const gap of mainTrackGaps(tracks, canvas.fps)) {
    console.log(`warning: gap on the main track from ${gap}. CapCut closes main-track gaps on the next edit.`)
  }
  console.log(`canvas ${canvas.width}x${canvas.height} ${canvas.fps} fps, length ${(json.duration / 1e6).toFixed(2)}s`)
  for (const track of tracks) {
    console.log(`${track.type} "${track.name}": ${track.clips.map(clip => basename(clip.path)).join(", ")}`)
  }
  if (dryRun) {
    console.log("dry run: nothing written")
    return
  }
  console.log(`backup: ${backup(project)}`)
  writeTimeline(project, json)
  console.log(`written: ${project}`)
}

function restore(project: string) {
  requireClosed()
  console.log(`backup: ${backup(project)}`)
  restoreOriginal(project)
  console.log("restored the timeline from before the first build")
}

function main() {
  if (command === "list") {
    return listProjects()
  }
  if (!projectArg || flags.has("--help")) {
    throw new Error(USAGE)
  }
  const project = findProject(projectArg)
  if (command === "inspect") {
    return inspectProject(project)
  }
  if (command === "build" && specArg) {
    return build(project, specArg)
  }
  if (command === "restore") {
    return restore(project)
  }
  throw new Error(USAGE)
}

try {
  main()
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
