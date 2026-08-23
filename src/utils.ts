import { PythonRandom, type ReducedTrialRow, type StimSpec, type TaskSettings } from "psyflow-web";

export type ConditionId = "no_distractor" | "control" | "negative_priming";

export interface PrimeProbePair {
  condition_id: ConditionId;
  pair_index: number;
  prime_target: string;
  prime_distractor: string | null;
  prime_reference: string;
  prime_match: boolean;
  prime_correct_key: string;
  probe_target: string;
  probe_distractor: string;
  probe_reference: string;
  probe_match: boolean;
  probe_correct_key: string;
}

export type SettingsView = TaskSettings & Record<string, unknown>;

function balancedLabels(nTrials: number, labels: ConditionId[], rng: PythonRandom): ConditionId[] {
  const counts = labels.map(() => Math.floor(nTrials / labels.length));
  for (let index = 0; index < nTrials % labels.length; index += 1) counts[index] += 1;
  const sequence = labels.flatMap((label, index) => new Array(counts[index]).fill(label));
  for (let attempt = 0; attempt < 100; attempt += 1) {
    rng.shuffle(sequence);
    const valid = sequence.every((label, index) =>
      index < 3 || !(label === sequence[index - 1] && label === sequence[index - 2] && label === sequence[index - 3])
    );
    if (valid) return sequence;
  }
  return sequence;
}

function responsePairs(count: number, rng: PythonRandom): Array<[boolean, boolean]> {
  const cycle: Array<[boolean, boolean]> = [[false, false], [true, true], [false, true], [true, false]];
  return rng.shuffle(Array.from({ length: count }, (_, index) => cycle[index % cycle.length]));
}

function choiceExcluding(rng: PythonRandom, pool: string[], excluded: Set<string>): string {
  const options = pool.filter((item) => !excluded.has(item));
  if (options.length === 0) throw new Error("Shape pool is too small for identity constraints");
  return options[rng.randBelow(options.length)];
}

export function generatePrimeProbePairs(
  nTrials: number,
  conditionLabels: unknown[],
  seed: number,
  shapeIds: unknown[],
  responseKeys: Record<string, unknown>
): PrimeProbePair[] {
  const labels = conditionLabels.map(String) as ConditionId[];
  const expected = ["control", "negative_priming", "no_distractor"];
  if (labels.length !== 3 || [...new Set(labels)].sort().join("|") !== expected.join("|")) {
    throw new Error("Negative Priming requires exactly three canonical conditions");
  }
  const pool = shapeIds.map(String);
  if (pool.length < 8 || new Set(pool).size !== pool.length) throw new Error("Eight unique shapes are required");
  const keys = { different: String(responseKeys.different), same: String(responseKeys.same) };
  const rng = new PythonRandom(Math.trunc(seed));
  const schedule = balancedLabels(nTrials, labels, rng);
  const decks = new Map<ConditionId, Array<[boolean, boolean]>>();
  labels.forEach((label) => decks.set(label, responsePairs(schedule.filter((value) => value === label).length, rng)));
  const deckIndex = new Map<ConditionId, number>(labels.map((label) => [label, 0]));
  let previousProbe = new Set<string>();

  return schedule.map((condition_id, pair_index) => {
    const index = deckIndex.get(condition_id) ?? 0;
    const [prime_match, probe_match] = decks.get(condition_id)![index];
    deckIndex.set(condition_id, index + 1);
    const prime_target = choiceExcluding(rng, pool, previousProbe);
    const usedPrime = new Set([prime_target]);
    const prime_distractor = condition_id === "no_distractor"
      ? null
      : choiceExcluding(rng, pool, new Set([...previousProbe, ...usedPrime]));
    if (prime_distractor) usedPrime.add(prime_distractor);
    const prime_reference = prime_match
      ? prime_target
      : choiceExcluding(rng, pool, new Set([...previousProbe, ...usedPrime]));
    usedPrime.add(prime_reference);
    const probe_target = condition_id === "negative_priming"
      ? String(prime_distractor)
      : choiceExcluding(rng, pool, usedPrime);
    const probe_distractor = choiceExcluding(rng, pool, new Set([...usedPrime, probe_target]));
    const probe_reference = probe_match
      ? probe_target
      : choiceExcluding(rng, pool, new Set([...usedPrime, probe_target, probe_distractor]));
    previousProbe = new Set([probe_target, probe_distractor, probe_reference]);
    return {
      condition_id, pair_index, prime_target, prime_distractor, prime_reference, prime_match,
      prime_correct_key: keys[prime_match ? "same" : "different"],
      probe_target, probe_distractor, probe_reference, probe_match,
      probe_correct_key: keys[probe_match ? "same" : "different"]
    };
  });
}

export function buildShapeDisplay(settings: SettingsView, pair: PrimeProbePair, phase: "prime" | "probe"): StimSpec[] {
  const specs = settings.shape_specs as Record<string, Array<[number, number]>>;
  const colors = settings.colors as Record<string, string>;
  const layout = settings.layout as Record<string, unknown>;
  const leftPos = (layout.left_pos as number[]).map(Number) as [number, number];
  const rightPos = (layout.right_pos as number[]).map(Number) as [number, number];
  const size = Number(layout.shape_scale);
  const shape = (id: string, pos: [number, number], lineColor: string): StimSpec => ({
    type: "shape", vertices: specs[id].map(([x, y]) => [Number(x), Number(y)]), size, pos,
    units: "deg", fillColor: "transparent", lineColor, lineWidth: 0.08
  });
  const target = String(pair[`${phase}_target`]);
  const reference = String(pair[`${phase}_reference`]);
  const distractor = pair[`${phase}_distractor`];
  const stimuli: StimSpec[] = [];
  if (distractor) stimuli.push(shape(String(distractor), leftPos, colors.distractor));
  stimuli.push(shape(target, leftPos, colors.target));
  stimuli.push(shape(reference, rightPos, colors.reference));
  return stimuli;
}

export function summarize(rows: ReducedTrialRow[]) {
  const scored = rows.filter((row) => row.is_practice === false && typeof row.pair_correct === "boolean");
  const accuracy = scored.length ? scored.filter((row) => row.pair_correct === true).length / scored.length : 0;
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const probeRts = (condition: ConditionId) => scored
    .filter((row) => row.condition_id === condition && row.pair_correct === true && typeof row.probe_rt === "number")
    .map((row) => Number(row.probe_rt));
  const np = median(probeRts("negative_priming"));
  const control = median(probeRts("control"));
  const effect = np === null || control === null ? null : (np - control) * 1000;
  return { accuracy, negative_priming_ms: effect, negative_priming_text: effect === null ? "数据不足" : `${effect.toFixed(1)} ms` };
}
