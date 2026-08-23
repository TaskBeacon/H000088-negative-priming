# T000088 -> H000088 Transfer Audit

## Canonical Source

`T000088-negative-priming` is canonical. `H000088` is a browser-native re-authoring of its stable config, generated prime-probe identity schedule, visible stimuli, timing, response rules, trial metadata, and scoring.

## Alignment Matrix

| Contract | Python canonical | Web port | Status |
|---|---|---|---|
| Identity | T000088 / `negative-priming` | H000088 / `variant: html` | aligned |
| Conditions | no distractor, control, negative priming | same | aligned |
| Pair counts | 36 practice; 4 x 42 experimental | same | aligned |
| Balance | 14 pairs per condition per 42-pair block | same | aligned |
| Critical identity | ignored red prime distractor becomes green probe target | same | aligned |
| Carryover guard | previous probe shapes excluded from next prime | same | aligned |
| Display | green target + optional red distractor left; white reference right | native SVG outlines, same geometry/colors/positions | aligned |
| Timeline | ready -> 1.1 s blank -> 0.5 s fixation -> prime -> 0.1 s blank -> 0.5 s fixation -> probe | same | aligned |
| Response | F different; J same; 5.0 s maximum per display | same | aligned |
| Scoring | both displays correct; median probe-RT NP minus control | same | aligned |
| Reduced data | identities, match flags, keys, RTs, correctness, timeout, pair outcome | same field meanings | aligned |

## Intentional Web-Only Differences

- Browser registration, fullscreen request, force quit, and result downloads are handled by the shared `psyflow-web` application shell.
- The shared browser runtime does not expose a standalone immediate trigger send for the self-paced ready screen, so its visible state and key contract are preserved but trigger code 10 is not emitted independently. All timed-stage onset, response, and timeout triggers remain mapped.
- PsychoPy `ShapeStim` outlines map to SVG polygon outlines in degree units. Config vertices, line colors, apparent scale, and positions are preserved; antialiasing can differ by browser and display.
- Subject-derived block seeds use the shared web runtime's stable participant hash. Within-participant reproducibility and condition balance are preserved, but the exact randomized order need not match CPython byte-for-byte.

## Integration

`.github/workflows/notify-psyflow-web.yml` dispatches `html-task-updated` to `TaskBeacon/psyflow-web` when this H task is pushed.

## Validation Evidence

- Isolated TypeScript compilation: PASS using the shared runner's locked TypeScript compiler.
- TAPS web-profile validation: PASS (5/5 checks, no warnings).
- Port contract tests: PASS (2 tests covering 42-pair condition balance, carryover exclusions, critical red-to-green identity repetition, native shape construction, and seven-stage timing/key contracts).
- Shared runner production build: PASS under the final canonical config (91 HTML tasks discovered; 1,442 modules transformed; the count includes concurrent workspace tasks).
- In-browser visual QA: PASS after correcting SVG stroke width to the renderer's coordinate space. Green/red/white stimuli render as unfilled irregular outlines at canonical positions and scale.
- Interaction QA: PASS with three practice and three experimental pairs; correct, incorrect, and prime-timeout outcomes were observed across all three conditions.
- Result QA: PASS with 45 raw stage rows and six reduced trial rows. Identity, match, response, RT, correctness, timeout, pair outcome, condition, and practice fields were visible in the reduced JSON result.
- Export controls: raw JSONL, reduced CSV, and reduced JSON buttons rendered and were activated. The in-app browser did not expose the browser-managed Blob download event, so serialization was verified from the result view rather than a downloaded file.
