---
name: capcut-timeline
description: Build or inspect a CapCut desktop timeline by writing the project's draft files directly, since CapCut has no scripting API. Use when the user wants an AI agent to place videos, images and audio on a CapCut timeline (cuts, in-points, speed, volume, scale, position, overlays, voiceover, music), to read what a CapCut project contains, or to undo such a build. Works on CapCut desktop drafts stored as plain JSON (verified on CapCut 9.4 for Windows).
---

# CapCut timeline

CapCut desktop has no API, plugin system or command line. What it does have is a project folder per draft with the timeline in `draft_content.json`. This skill writes that file safely: it clones clip structures CapCut itself wrote, fills in your media and timing, and never invents CapCut's schema.

The helper is `scripts/capcut.ts`. It runs with Bun (`bun scripts/capcut.ts ...`) or Node 23.6+ (`node scripts/capcut.ts ...`), and needs `ffprobe` (FFmpeg) on PATH to measure media. Run it from this skill's folder or give the full path.

## Rules that protect the user's work

1. **CapCut must be closed** for `build` and `restore`. CapCut rewrites the draft when it exits and would undo the change. The script refuses while CapCut runs. Ask the user to close it; never kill it without their permission, they may have unsaved work.
2. **Only write into an empty project, or one this skill built.** The script refuses a timeline that holds clips it did not write. Pass `--force` only when the user said that timeline may be replaced.
3. **Always `--dry-run` first**, then the real build.
4. Every real build backs the whole project folder up to `<temp>/capcut-backups/` and keeps the untouched first timeline as `draft_content.json.orig`. Later builds start again from that original, so a build can be repeated after every fix. `restore` puts the original back.
5. Never touch other projects. They are only read, to borrow clip templates.

## Workflow

1. **Find the project.** `bun scripts/capcut.ts list` prints every draft: name, folder, canvas, fps, draft version, clip count. If the user has no project yet, ask them to create an empty one in CapCut with the canvas and frame rate they want, then close CapCut.
2. **Look at it.** `bun scripts/capcut.ts inspect <project>` prints the tracks and segments with times in seconds.
3. **Write a timeline file**, a JSON description of tracks and clips. See [references/timeline-spec.md](references/timeline-spec.md) and the example in [assets/example-timeline.json](assets/example-timeline.json). Relative media paths resolve against the timeline file's folder.
4. **Dry run:** `bun scripts/capcut.ts build <project> timeline.json --dry-run`. Fix every error it prints.
5. **Build:** `bun scripts/capcut.ts build <project> timeline.json` with CapCut closed.
6. **Check:** run `inspect` again and compare with what you meant. Then ask the user to open the project in CapCut and look at it; the file being right is not proof that playback is right.
7. **Undo if needed:** `bun scripts/capcut.ts restore <project>`.

`<project>` is the name shown in CapCut, the folder name, or the full folder path. Set `CAPCUT_DRAFTS` to the drafts root when it is not in the default place (Windows: `%LOCALAPPDATA%\CapCut\User Data\Projects\com.lveditor.draft`, macOS: `~/Movies/CapCut/User Data/Projects/com.lveditor.draft`).

## What the script can and cannot do

It can place video, image and audio clips on any number of video and audio tracks, with timeline start and end, source in-point, speed, volume, scale, position and opacity.

It does not write text, captions, stickers, effects, filters, transitions, animations, keyframes, masks or compound clips. Those are downloaded resources with ids and cache paths, and a wrong one can break the project. Build the cut with the script, then let the user add those in CapCut (or use computer use on the CapCut window if it is available and the user agrees).

## Editing advice that keeps the timeline easy to work with

- The first video track is CapCut's **main track**. It is magnetic: CapCut closes gaps on it on the next edit. Keep it gapless from 0:00. The script warns about gaps.
- Mute video clips (`"volume": 0`) and put sound on its own audio track when the sound needs separate control, for example a voiceover over screen recordings.
- Overlays (logos, pictures, a transparent `.mov`) go on a second video track above the main one. Later tracks draw on top.
- Keep CapCut's project frame rate and canvas; the script reads both from the project. Frame times are rounded to that frame rate, so clips meet exactly.
- Use ProRes 4444 `.mov` for video with transparency. CapCut does not reliably handle VP9 `.webm` alpha or image sequences.

## When something goes wrong

- *"not plain JSON"*: this CapCut version encrypts drafts. The method does not work there; tell the user, change nothing.
- *"no video, photo, audio template"*: the draft version has no known template yet. Ask the user to make any project with one video, one image and one audio clip on its timeline, close CapCut, and run again. Templates are then cached in `~/.capcut-timeline/`.
- *"too short for its place"*: `in` + length × `speed` runs past the end of the file.
- CapCut opens the project but clips show as missing media: a path was wrong or the file moved. Paths are stored absolute.

More about the file format, for debugging or extending the script: [references/draft-format.md](references/draft-format.md).
