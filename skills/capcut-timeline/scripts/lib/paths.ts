import { existsSync, readFileSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export type Json = any

export function readJson(path: string): Json | null {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return null
  }
}

function defaultRoots(): string[] {
  const local = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local")
  return [
    join(local, "CapCut", "User Data", "Projects", "com.lveditor.draft"),
    join(homedir(), "Movies", "CapCut", "User Data", "Projects", "com.lveditor.draft"),
  ]
}

export function draftsRoot(): string {
  const custom = process.env.CAPCUT_DRAFTS
  if (custom) {
    return custom
  }
  const found = defaultRoots().find(root => existsSync(root))
  if (!found) {
    throw new Error("CapCut drafts folder not found. Set CAPCUT_DRAFTS to the com.lveditor.draft folder.")
  }
  return found
}

export function projectFolders(): string[] {
  const root = draftsRoot()
  return readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(root, entry.name))
    .filter(folder => existsSync(join(folder, "draft_meta_info.json")))
}

export function projectName(folder: string): string {
  return readJson(join(folder, "draft_meta_info.json"))?.draft_name ?? ""
}

// A project is found by its name in CapCut, by its folder name, or by a full folder path.
export function findProject(nameOrPath: string): string {
  if (existsSync(join(nameOrPath, "draft_meta_info.json"))) {
    return nameOrPath
  }
  const folders = projectFolders()
  const match = folders.find(folder => projectName(folder) === nameOrPath)
    ?? folders.find(folder => folder.endsWith(nameOrPath))
  if (!match) {
    throw new Error(`no CapCut project named "${nameOrPath}". Run "list" to see the projects.`)
  }
  return match
}

export function userCacheDir(): string {
  return join(homedir(), ".capcut-timeline")
}
