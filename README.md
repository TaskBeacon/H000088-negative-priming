# Negative Priming (Web)

| Metadata | Value |
|---|---|
| Task ID | `H000088` |
| Canonical source | `T000088-negative-priming` |
| Version | 0.1.0 |
| Runtime | `psyflow-web` / TAPS `v0.2.0` |
| Language | Chinese |

## Overview

This source-only browser task ports the canonical Friedman and Miyake (2004) abstract-shape negative-priming procedure. Participants compare a green target outline on the left with a white reference outline on the right while ignoring an overlapping red distractor.

Each logical trial is a prime-probe pair: ready cue, 1,100 ms blank, 500 ms fixation, prime response, 100 ms blank, 500 ms fixation, and probe response. `F` means different and `J` means same. In `negative_priming` pairs, the ignored red prime distractor becomes the green probe target.

The human profile contains 36 practice pairs and four blocks of 42 experimental pairs, balanced across no-distractor, control, and negative-priming conditions. The primary summary is median correct probe RT in negative-priming pairs minus control pairs.

## Local validation

From this folder:

```bash
npx tsc --noEmit -p tsconfig.json
```

The shared runner discovers this sibling folder from `psyflow-web`, where it can be built and launched with `?task=H000088-negative-priming`.

## Transfer audit

See `transfer_node.md` for the canonical-to-web alignment matrix, intentional browser differences, and validation evidence.
