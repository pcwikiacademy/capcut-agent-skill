# CapCut draft format

Found on CapCut desktop 9.4 for Windows, draft version `185.0.0`. Check again when CapCut updates; the installed version is the folder name in `%LOCALAPPDATA%\CapCut\Apps\`.

## Folders

- Drafts root: Windows `%LOCALAPPDATA%\CapCut\User Data\Projects\com.lveditor.draft\`, macOS `~/Movies/CapCut/User Data/Projects/com.lveditor.draft/` (macOS not verified).
- One folder per project. `draft_meta_info.json` holds its display name (`draft_name`) and the Media panel imports (`draft_materials`, the group with `type` 0, items with `file_Path` and `metetype`).
- CapCut renames a new project's folder from a date like `1022` to the project name on a later launch. Find projects by `draft_name` each time instead of remembering a path.
- The timeline is `draft_content.json`. A second copy lives in `Timelines/<id>/draft_content.json`, where `<id>` is the top-level `id`. Write both with the same content.
- Leave `draft_meta_info.json`, `root_meta_info.json`, `.bak` and `.tmp` files alone. CapCut rewrites them itself.
- CapCut writes the draft when it closes, so any file change made while it is open is lost or overwritten.

## `draft_content.json`

- Plain JSON in 9.4. Some versions encrypt it; then nothing here applies.
- All times are integer **microseconds**. `fps` is the project frame rate, `canvas_config` has `width`, `height`, `ratio`.
- `new_version` is the draft schema version. Templates must come from a draft with the same value.
- `duration` is the end of the last segment.
- `materials` is an object of lists by kind: `videos` (video and images), `audios`, `speeds`, `canvases`, `texts`, `effects`, `transitions`, ... Every entry has an `id`.
- `tracks` is an ordered list. Later tracks draw on top of earlier ones.

## Track

```json
{ "id": "…", "type": "video", "flag": 0, "attribute": 0, "name": "Main", "is_default_name": false, "segments": [] }
```

The first video track has `flag` 0 and is the magnetic main track. Other video tracks have `flag` 2; audio tracks `flag` 0.

## Segment

| Field | Meaning |
| --- | --- |
| `material_id` | The media material in `materials.videos` or `materials.audios` |
| `extra_material_refs` | Ids of the segment's own helper materials: `speeds`, `canvases`, `placeholder_infos`, `sound_channel_mappings`, `material_colors`, `vocal_separations`, `beats`, `loudnesses`. Each segment needs its own copies |
| `target_timerange` | `{ start, duration }` on the timeline |
| `source_timerange` | `{ start, duration }` in the file. Source duration = timeline duration × speed |
| `speed` | Also stored in the segment's `speeds` material |
| `volume` | Linear gain |
| `clip.scale` | `{ x, y }`. `1` fits the media inside the canvas |
| `clip.transform` | `{ x, y }`: the media center's offset in half canvas sizes, `y` up. Pixel center `(px, py)` → `x = (px − W/2) / (W/2)`, `y = (H/2 − py) / (H/2)` |
| `clip.alpha` | Opacity |
| `uniform_scale` | Keep `{ on: true, value: 1 }`. `value` is not the scale: on the next Scale edit CapCut sets `y = x / value`, so any other value squeezes the clip |
| `render_index`, `track_render_index` | Draw order; the track index for video, `0` for audio segments |

CapCut's Position field in the Video → Basic panel shows about twice the pixel offset, so give users framing by eye or in canvas pixels, not as panel numbers.

## Media material

Cloned from a template and then changed: new `id`, `path` (absolute, forward slashes), `unique_id` (md5 of the path), `local_material_id`, and for pictures `material_name`, `width`, `height`, `has_audio`, `duration`, and a full `crop`. For audio `name`, `duration`, `music_id`. Images (`type` `"photo"`) get the duration `10800000000`. Audio materials have `type` `"extract_music"`.

## Why templates

Segments and materials have dozens of fields that change between CapCut versions. Writing them by hand breaks drafts. The script copies a real video, photo and audio segment from any of the user's projects with the same `new_version`, keeps only the plain helper materials, and resets keyframes, crop, scale and position. A copy of the last full set is kept in `~/.capcut-timeline/templates-<version>.json`, and the skill ships one for `185.0.0` in `assets/`.

## Things that are not written

Text, captions, stickers, effects, filters, transitions, animations, keyframes, masks, compound clips and nested drafts. They reference downloaded resources by id and cache path. To support one, copy a working example from a draft CapCut wrote, the same way the media templates work, and test the result in CapCut before trusting it.
