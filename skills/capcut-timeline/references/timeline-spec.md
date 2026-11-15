# Timeline file

The input of `build`. A JSON object with a `tracks` list. Tracks are drawn in order: the first video track is the main track, later video tracks lie on top of earlier ones.

```json
{
  "tracks": [
    {
      "type": "video",
      "name": "Main",
      "clips": [
        { "file": "footage/intro.mp4", "in": 2.5, "duration": 4, "volume": 0 },
        { "file": "footage/screenshot.png", "duration": 3, "fill": true },
        { "file": "footage/demo.mp4", "in": 10, "end": 15, "speed": 1.5, "volume": 0 }
      ]
    },
    {
      "type": "video",
      "name": "Overlay",
      "clips": [
        { "file": "logo.png", "start": 1, "end": 6, "width": 300, "x": 1700, "y": 140, "opacity": 0.9 }
      ]
    },
    {
      "type": "audio",
      "name": "Voice",
      "clips": [{ "file": "audio/voice.wav", "start": 0 }]
    },
    {
      "type": "audio",
      "name": "Music",
      "clips": [{ "file": "music.mp3", "start": 0, "end": 12, "volume": 0.1 }]
    }
  ]
}
```

## Track

| Field | Meaning |
| --- | --- |
| `type` | `"video"` (video and images) or `"audio"` |
| `name` | Track name shown in CapCut. Optional |
| `clips` | The clips, in any order. Clips on one track must not overlap |

## Clip

All times are seconds.

| Field | Default | Meaning |
| --- | --- | --- |
| `file` | required | Media path, absolute or relative to the timeline file |
| `start` | end of the previous clip on the track | Where the clip starts on the timeline |
| `end` | | Where it ends on the timeline. Give `end` or `duration`, or neither |
| `duration` | rest of the file ÷ `speed`; 5 s for an image | Length on the timeline |
| `in` | `0` | Source in-point: seconds into the file |
| `speed` | `1` | Playback speed. `2` is twice as fast and uses twice as much source |
| `volume` | `1` | Linear gain. `0` mutes. -6 dB ≈ 0.5, -12 dB ≈ 0.25, -20 dB ≈ 0.1 |
| `scale` | `1` | CapCut's own scale: `1` fits the picture inside the canvas |
| `fill` | `false` | Scale so the picture covers the whole canvas (crops the overflow) |
| `width` | | Displayed width in canvas pixels. Overrides `scale` and `fill` |
| `x`, `y` | canvas center | Where the picture's center goes, in canvas pixels from the top left |
| `opacity` | `1` | `0` to `1` |

Scale, position and opacity are ignored for audio. Clips placed without `start` follow each other with no gap, which is the easy way to build a gapless main track.

## Checks the script makes

- Every file exists and `ffprobe` can read it.
- An audio file goes on an audio track, a picture on a video track.
- No overlaps on a track.
- `in` + length × `speed` stays inside the file.
- Gaps on the main track are reported as warnings.
