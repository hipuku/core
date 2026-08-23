import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import * as common from "@zxcvbn-ts/language-common";
import * as en from "@zxcvbn-ts/language-en";

let factory: ZxcvbnFactory | null = null;

/** Build the estimator once, lazily, with English + common dictionaries. */
function estimator(): ZxcvbnFactory {
  if (!factory) {
    factory = new ZxcvbnFactory({
      dictionary: { ...common.dictionary, ...en.dictionary },
      graphs: common.adjacencyGraphs,
      translations: en.translations,
    });
  }
  return factory;
}

export interface Strength {
  /** 0 (weakest) to 4 (strongest). */
  score: number;
  label: string;
  /** A single actionable hint, if any. */
  hint: string | null;
}

const LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong"];

export function scorePassword(password: string): Strength {
  if (!password) return { score: 0, label: "", hint: null };
  const result = estimator().check(password);
  const hint = result.feedback.warning || result.feedback.suggestions[0] || null;
  return { score: result.score, label: LABELS[result.score], hint };
}
