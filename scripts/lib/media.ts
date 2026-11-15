import { execFileSync } from "node:child_process"
import { extname } from "node:path"

export type Kind = "video" | "photo" | "audio"

export type Media = {
  kind: Kind
  duration: number
  width: number
  height: number
  hasAudio: boolean
}

const PHOTO_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff"]
const AUDIO_EXTS = [".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".opus"]

export function kindOfPath(path: string): Kind {
  const ext = extname(path).toLowerCase()
  if (PHOTO_EXTS.includes(ext)) {
    return "photo"
  }
  if (AUDIO_EXTS.includes(ext)) {
    return "audio"
  }
  return "video"
}

function ffprobe(path: string): any {
  const args = ["-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", path]
  try {
    return JSON.parse(execFileSync("ffprobe", args, { encoding: "utf8" }))
  } catch (error) {
    if ((error as any).code === "ENOENT") {
      throw new Error("ffprobe not found. Install FFmpeg and put it on PATH.")
    }
    throw new Error(`ffprobe could not read ${path}`)
  }
}

export function probe(path: string): Media {
  const info = ffprobe(path)
  const streams: any[] = info.streams ?? []
  const picture = streams.find(stream => stream.codec_type === "video")
  return {
    kind: kindOfPath(path),
    duration: Number(info.format?.duration ?? 0),
    width: picture?.width ?? 0,
    height: picture?.height ?? 0,
    hasAudio: streams.some(stream => stream.codec_type === "audio"),
  }
}
