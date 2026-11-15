import { copyFileSync, cpSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { execFileSync } from "node:child_process"
import { type Json, readJson } from "./paths.ts"

export const ORIGINAL = "draft_content.json.orig"

export function readContent(project: string): Json {
  const path = join(project, "draft_content.json")
  const json = readJson(path)
  if (!json) {
    throw new Error("draft_content.json is not plain JSON. This CapCut version probably encrypts drafts; this skill cannot write it.")
  }
  return json
}

// CapCut keeps a second copy of the timeline in Timelines/<id>/. Both must hold the same content.
export function timelinePaths(project: string): string[] {
  const main = join(project, "draft_content.json")
  const id = readJson(main)?.id
  const copy = join(project, "Timelines", String(id), "draft_content.json")
  return existsSync(copy) ? [main, copy] : [main]
}

export function segmentCount(json: Json): number {
  return (json.tracks ?? []).reduce((sum: number, track: Json) => sum + (track.segments?.length ?? 0), 0)
}

// The base is the untouched timeline from before this skill's first write, so builds can be repeated.
export function readBase(project: string, force: boolean, dryRun: boolean): Json {
  const original = join(project, ORIGINAL)
  if (existsSync(original)) {
    return readJson(original)
  }
  const json = readContent(project)
  if (segmentCount(json) > 0 && !force) {
    throw new Error("the timeline already holds clips that this skill did not write. Use an empty project, or pass --force to replace them.")
  }
  if (!dryRun) {
    copyFileSync(join(project, "draft_content.json"), original)
  }
  return json
}

export function backup(project: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const target = join(tmpdir(), "capcut-backups", `${basename(project)}-${stamp}`)
  cpSync(project, target, { recursive: true })
  return target
}

export function writeTimeline(project: string, json: Json) {
  const text = JSON.stringify(json)
  for (const path of timelinePaths(project)) {
    writeFileSync(path, text)
  }
}

export function restoreOriginal(project: string) {
  const original = join(project, ORIGINAL)
  if (!existsSync(original)) {
    throw new Error(`no ${ORIGINAL} in this project, nothing to restore`)
  }
  const text = readFileSync(original, "utf8")
  for (const path of timelinePaths(project)) {
    writeFileSync(path, text)
  }
}

function processList(): string {
  try {
    if (process.platform === "win32") {
      return execFileSync("tasklist", ["/FI", "IMAGENAME eq CapCut.exe"], { encoding: "utf8" })
    }
    return execFileSync("pgrep", ["-l", "CapCut"], { encoding: "utf8" })
  } catch {
    return ""
  }
}

export function capcutRunning(): boolean {
  return /capcut/i.test(processList())
}
