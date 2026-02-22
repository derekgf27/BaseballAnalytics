# Coach decision-first UI — design intent

This document describes the **MVP coach UI** built for a dugout decision board feel: one screen = one question, decisions over data, no spreadsheets.

## Design principles

- **Decisions > data** — Surfaces recommendations and alerts, not raw stats.
- **One screen = one question** — Today: “What do I need for today?” Lineup: “What’s the order?” Players: “Who do I have?”
- **Visual hierarchy** — Confidence (green/yellow/red), tags (POWER, CONTACT, SPEED), trend (hot/cold).
- **Human language** — “Hot”, “Risk”, “Platoon gained” instead of decimals and jargon.

## Pages (MVP)

| Page | Route | Purpose |
|------|--------|---------|
| **Today** | `/coach` | Game info, recommended lineup 1–9 (confidence + tags), alerts (hot/cold/risk), matchup summary bullets. |
| **Lineup builder** | `/coach/lineup` | Drag-and-drop order 1–9. Side panel: projected impact ↑/↓, platoon gained/lost, defensive risk (visual only). |
| **Players** | `/coach/players` | List of player cards; tap → detail. |
| **Player card** | `/coach/players/[id]` | Name, position, B/T, trend; strengths & weaknesses; situational value bars (RISP, late innings, defense); optional expandable notes. |
| **Game review** | `/analyst/games/[id]/review` | Analyst-facing. Inning timeline, key decisions (good / missed / neutral), minimal text. |

## Reusable components

- **`ConfidenceBar`** — Green / yellow / red / gray dot or segment (no numbers).
- **`PlayerTag`** — POWER, CONTACT, SPEED, EYE, CLUTCH.
- **`AlertBadge`** — Hot / Cold / Risk with one-line message.
- **`Card` / `CardTitle`** — Consistent panels and section labels.

## Data

- **Mock only** — `src/data/mock.ts`: `mockToday`, `mockPlayers`, `mockGameReview`. Static JSON-shaped data for demo; no backend required.
- **Decision colors** — In `globals.css`: `--decision-green`, `--decision-yellow`, `--decision-red`, `--decision-gray` for advantage / monitor / risk / no data.

## Tech

- **Next.js (App Router)** — Coach routes under `/coach`, analyst under `/analyst`.
- **Tailwind** — Existing dark theme + decision colors.
- **@dnd-kit** — Drag-and-drop for lineup builder.
- **Recharts** — Available for future charts (e.g. analyst Charts page); coach UI stays chart-light per spec.

## Demo flow (head coach)

1. **Home** → Choose **Coach**.
2. **Today** — See game, lineup 1–9 with confidence/tags, alerts, matchup bullets.
3. **Lineup** — Drag to reorder; side panel shows impact/platoon/defense.
4. **Players** — Tap a name → strengths, situational bars, trend, notes.
5. **Analyst** → **Games** → **Review** on a game → inning timeline and decision flags.
