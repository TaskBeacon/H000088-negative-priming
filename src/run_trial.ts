import { set_trial_context, TrialBuilder, type StimBank, type TrialSnapshot } from "psyflow-web";
import { buildShapeDisplay, type PrimeProbePair, type SettingsView } from "./utils";

function triggerMap(settings: SettingsView): Record<string, number> {
  const raw = settings.triggers as Record<string, unknown> | undefined;
  const nested = raw?.map;
  return (nested && typeof nested === "object" ? nested : raw ?? {}) as Record<string, number>;
}

function context(trial: TrialBuilder, pair: PrimeProbePair, phase: string, deadline: number | null, keys: string[], stimId: string) {
  return {
    trial_id: trial.trial_id,
    phase,
    deadline_s: deadline,
    valid_keys: keys,
    block_id: trial.block_id,
    condition_id: pair.condition_id,
    task_factors: { ...pair },
    stim_id: stimId
  };
}

function unitHit(snapshot: TrialSnapshot, label: string): boolean {
  return snapshot.units[label]?.hit === true;
}

export function runTrial(
  trial: TrialBuilder,
  pair: PrimeProbePair,
  options: { settings: SettingsView; stimBank: StimBank; block_idx: number; is_practice: boolean }
): TrialBuilder {
  const { settings, stimBank, block_idx, is_practice } = options;
  const trigger = triggerMap(settings);
  const keys = Object.values(settings.response_keys as Record<string, unknown>).map(String);
  const readyBlank = Number(settings.ready_blank_duration);
  const fixation = Number(settings.fixation_duration);
  const interBlank = Number(settings.inter_display_duration);
  const timeout = Number(settings.response_timeout);

  Object.entries({ ...pair, block_idx, is_practice }).forEach(([key, value]) => trial.setTrialState(key, value));

  const ready = trial.unit("ready").addStim(stimBank.get("ready_prompt"));
  set_trial_context(ready, context(trial, pair, "ready", null, ["space"], "ready_prompt"));
  ready.waitAndContinue({ keys: ["space"] });

  const preBlank = trial.unit("pre_pair_blank").addStim(stimBank.get("blank_screen"));
  set_trial_context(preBlank, context(trial, pair, "pre_pair_blank", readyBlank, [], "blank_screen"));
  preBlank.show({ duration: readyBlank, onset_trigger: trigger.pre_pair_blank });

  const primeFix = trial.unit("prime_fixation").addStim(stimBank.get("fixation"));
  set_trial_context(primeFix, context(trial, pair, "prime_fixation", fixation, [], "fixation"));
  primeFix.show({ duration: fixation, onset_trigger: trigger.prime_fixation });

  const prime = trial.unit("prime_response").addStim(...buildShapeDisplay(settings, pair, "prime"));
  set_trial_context(prime, context(trial, pair, "prime_response", timeout, keys, `${pair.condition_id}_prime`));
  prime.captureResponse({
    keys, duration: timeout, correct_keys: [pair.prime_correct_key],
    onset_trigger: trigger[`prime_${pair.condition_id}`],
    response_trigger: { [keys[0]]: trigger.response_different, [keys[1]]: trigger.response_same },
    timeout_trigger: trigger.prime_timeout
  });

  const gap = trial.unit("inter_display_blank").addStim(stimBank.get("blank_screen"));
  set_trial_context(gap, context(trial, pair, "inter_display_blank", interBlank, [], "blank_screen"));
  gap.show({ duration: interBlank, onset_trigger: trigger.inter_display_blank });

  const probeFix = trial.unit("probe_fixation").addStim(stimBank.get("fixation"));
  set_trial_context(probeFix, context(trial, pair, "probe_fixation", fixation, [], "fixation"));
  probeFix.show({ duration: fixation, onset_trigger: trigger.probe_fixation });

  const probe = trial.unit("probe_response").addStim(...buildShapeDisplay(settings, pair, "probe"));
  set_trial_context(probe, context(trial, pair, "probe_response", timeout, keys, `${pair.condition_id}_probe`));
  probe.captureResponse({
    keys, duration: timeout, correct_keys: [pair.probe_correct_key],
    onset_trigger: trigger[`probe_${pair.condition_id}`],
    response_trigger: { [keys[0]]: trigger.probe_response_different, [keys[1]]: trigger.probe_response_same },
    timeout_trigger: trigger.probe_timeout
  });

  trial.finalize((snapshot, _runtime, helpers) => {
    const primeCorrect = unitHit(snapshot, "prime_response");
    const probeCorrect = unitHit(snapshot, "probe_response");
    const primeResponse = snapshot.units.prime_response?.response ?? null;
    const probeResponse = snapshot.units.probe_response?.response ?? null;
    helpers.setTrialState("prime_response", primeResponse);
    helpers.setTrialState("prime_rt", snapshot.units.prime_response?.rt ?? null);
    helpers.setTrialState("prime_correct", primeCorrect);
    helpers.setTrialState("prime_timed_out", primeResponse === null);
    helpers.setTrialState("probe_response", probeResponse);
    helpers.setTrialState("probe_rt", snapshot.units.probe_response?.rt ?? null);
    helpers.setTrialState("probe_correct", probeCorrect);
    helpers.setTrialState("probe_timed_out", probeResponse === null);
    helpers.setTrialState("pair_correct", primeCorrect && probeCorrect);
    helpers.setTrialState("correct", primeCorrect && probeCorrect);
    helpers.setTrialState("outcome", primeCorrect && probeCorrect ? "correct" : primeResponse === null || probeResponse === null ? "timeout" : "incorrect");
  });
  return trial;
}

export { runTrial as run_trial };
export default runTrial;
