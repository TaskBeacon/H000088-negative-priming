import {
  StimBank, SubInfo, TaskSettings, TrialBuilder, mountTaskApp, next_trial_id,
  parsePsyflowConfig, reset_trial_counter, set_trial_context,
  type CompiledTrial, type ReducedTrialRow
} from "psyflow-web";
import { runTrial } from "./src/run_trial";
import { generatePrimeProbePairs, summarize, type PrimeProbePair, type SettingsView } from "./src/utils";

const TASK_ID = "H000088-negative-priming";

async function loadConfig() {
  const response = await fetch(new URL("./config/config.yaml", import.meta.url));
  if (!response.ok) throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
  return parsePsyflowConfig(await response.text(), import.meta.url);
}

function waitScreen(stimBank: StimBank, id: string, stimId: string, trialIndex: number,
  values?: (rows: ReducedTrialRow[]) => Record<string, unknown>): CompiledTrial {
  const trial = new TrialBuilder({ trial_id: id, block_id: id, trial_index: trialIndex, condition: id });
  const unit = trial.unit(id).addStim(
    values ? (_snapshot, runtime) => stimBank.get_and_format(stimId, values(runtime.getReducedRows())) : stimBank.get(stimId)
  );
  set_trial_context(unit, { trial_id: id, phase: id, deadline_s: null, valid_keys: ["space"], block_id: id,
    condition_id: id, task_factors: { stage: id }, stim_id: stimId });
  unit.waitAndContinue({ keys: ["space"] });
  return trial.build();
}

function compilePair(settings: SettingsView, stimBank: StimBank, pair: PrimeProbePair,
  blockId: string, blockIdx: number, trialIndex: number, isPractice: boolean): CompiledTrial {
  const trial = new TrialBuilder({ trial_id: next_trial_id(), block_id: blockId, trial_index: trialIndex, condition: pair.condition_id });
  runTrial(trial, pair, { settings, stimBank, block_idx: blockIdx, is_practice: isPractice });
  return trial.build();
}

function buildTrials(settings: SettingsView, stimBank: StimBank) {
  reset_trial_counter();
  const labels = (settings.conditions as unknown[]).map(String);
  const shapes = (settings.shape_ids as unknown[]).map(String);
  const responseKeys = settings.response_keys as Record<string, unknown>;
  const trials: CompiledTrial[] = [waitScreen(stimBank, "instruction", "instruction_general", -3)];
  const practice = generatePrimeProbePairs(Number(settings.practice_trials), labels, Number(settings.overall_seed) + 9000, shapes, responseKeys);
  practice.forEach((pair, index) => trials.push(compilePair(settings, stimBank, pair, "practice", 0, index, true)));

  for (let blockIdx = 0; blockIdx < Number(settings.total_blocks); blockIdx += 1) {
    const blockNumber = blockIdx + 1;
    trials.push(waitScreen(stimBank, `block_start_${blockNumber}`, "block_start", -2 + blockIdx,
      () => ({ block_number: blockNumber, total_blocks: Number(settings.total_blocks) })));
    const blockId = `block_${blockNumber}`;
    const seed = Number((settings.block_seed as unknown[])[blockIdx] ?? settings.overall_seed);
    const pairs = generatePrimeProbePairs(Number(settings.trials_per_block), labels, seed, shapes, responseKeys);
    pairs.forEach((pair, index) => trials.push(compilePair(settings, stimBank, pair, blockId, blockIdx, index, false)));
    if (blockIdx < Number(settings.total_blocks) - 1) {
      trials.push(waitScreen(stimBank, `block_break_${blockNumber}`, "block_break", 9000 + blockIdx, (rows) => {
        const blockRows = rows.filter((row) => row.block_id === blockId && row.is_practice === false);
        const accuracy = blockRows.length ? blockRows.filter((row) => row.pair_correct === true).length / blockRows.length : 0;
        return { block_number: blockNumber, accuracy };
      }));
    }
  }
  trials.push(waitScreen(stimBank, "good_bye", "good_bye", 9999, summarize));
  return trials;
}

export async function main(root: HTMLElement) {
  const parsed = await loadConfig();
  const settings = TaskSettings.from_dict(parsed.task_config) as SettingsView;
  settings.triggers = parsed.trigger_config;
  const stimBank = new StimBank(parsed.stim_config);
  return mountTaskApp({
    root, task_id: TASK_ID, task_name: "Negative Priming",
    task_description: "Browser companion for canonical T000088, preserving the abstract-shape prime-probe identity manipulation and F/J same-different responses.",
    settings, subInfo: new SubInfo(parsed.subform_config), stimBank,
    buildTrials: () => buildTrials(settings, stimBank)
  });
}

export default main;
