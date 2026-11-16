# CapCut Agent Skill

An agent skill that lets an AI agent (Claude Code or any agent that supports `SKILL.md` skills) build and inspect **CapCut desktop timelines**.

CapCut has no scripting API, plugin system or CLI. It does store each project's timeline as plain JSON (`draft_content.json`). This skill writes that file safely: it clones clip structures CapCut itself produced, fills in your media and timing, and never invents CapCut's schema.

Verified on CapCut 9.4 for Windows.

## What it can do

- List CapCut projects and inspect their tracks and clips
- Place **video, image and audio** clips on any number of tracks
- Set timeline start/end, source in-point, speed, volume, scale, position and opacity
- Back up every project before writing, and restore the original timeline

It does **not** write text, captions, stickers, effects, filters, transitions, animations, keyframes or masks. Build the cut with the skill, then add those in CapCut.

## Requirements

- [Bun](https://bun.sh) or Node.js 23.6+
- `ffprobe` (part of [FFmpeg](https://ffmpeg.org)) on `PATH`
- CapCut desktop with unencrypted (plain JSON) drafts

## Install

Pick whichever fits you. After installing, just ask your agent, for example: *"Put these three clips on my CapCut project 'Demo' with the voiceover underneath."*

### Any agent (Claude Code, Cursor, Codex, Copilot, Windsurf, Gemini, ...)

```bash
npx skills add pcwikiacademy/capcut-agent-skill
```

It detects the agents on your machine and asks where to install. Add `-g` to install for all projects. Needs Node.js 22.20+.

### Claude Code plugin

Inside Claude Code, add the marketplace, then install the plugin from it:

```
/plugin marketplace add pcwikiacademy/capcut-agent-skill
/plugin install capcut-timeline@pcwikiacademy
```

Or from a terminal:

```
claude plugin marketplace add pcwikiacademy/capcut-agent-skill
claude plugin install capcut-timeline@pcwikiacademy
```

### Manual download (no terminal)

1. Download [capcut-timeline.zip](https://github.com/pcwikiacademy/capcut-agent-skill/releases/latest/download/capcut-timeline.zip).
2. Extract it into your agent's skills folder, so you end up with a `capcut-timeline` folder containing `SKILL.md`. For Claude Code that is `C:\Users\<you>\.claude\skills\` on Windows or `~/.claude/skills/` on macOS.
3. Restart the agent.

> The skill edits CapCut files on your own computer, so it needs a local agent such as Claude Code. It does not work in the claude.ai web chat, which runs in a cloud sandbox.

## Manual usage

Run from the `skills/capcut-timeline` folder:

```bash
bun scripts/capcut.ts list
bun scripts/capcut.ts inspect <project>
bun scripts/capcut.ts build <project> timeline.json --dry-run
bun scripts/capcut.ts build <project> timeline.json
bun scripts/capcut.ts restore <project>
```

`<project>` is the name shown in CapCut, its folder name, or the full folder path. Set `CAPCUT_DRAFTS` if your drafts are not in the default location.

**Close CapCut before `build` and `restore`.** CapCut rewrites the draft when it exits and would undo the change; the script refuses to run while CapCut is open.

## Timeline file

A timeline is a JSON file describing tracks and clips. See [timeline-spec.md](skills/capcut-timeline/references/timeline-spec.md) for the format and [example-timeline.json](skills/capcut-timeline/assets/example-timeline.json) for an example.

## Safety

- Only writes into an empty project or one this skill built (unless `--force`)
- Backs up the whole project folder to `<temp>/capcut-backups/` before every build
- Keeps the untouched first timeline as `draft_content.json.orig` for `restore`
- Never modifies other projects; they are only read to borrow clip templates

## Project layout

```
skills/capcut-timeline/
  SKILL.md               Instructions the agent reads
  scripts/capcut.ts      CLI entry point
  scripts/lib/           Draft reading, writing, templates, media probing
  references/            Timeline spec and CapCut draft format notes
  assets/                Example timeline and clip templates
.claude-plugin/          Claude Code plugin and marketplace manifests
.github/workflows/       Builds capcut-timeline.zip for each release
```

## License

[MIT](LICENSE)

## Disclaimer

Not affiliated with or endorsed by CapCut or ByteDance. The draft format is undocumented and may change between CapCut versions; always keep backups.
