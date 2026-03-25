/**
 * League rules for this deployment. All games use regulation length below;
 * extra innings extend linescores and inning pickers as needed.
 */
export const REGULATION_INNINGS = 7;

/** Upper bound for inning dropdowns (regulation + extra innings). */
export const MAX_SELECTABLE_INNING = 20;

/** Values shown in inning `<select>`s: 1 … {@link MAX_SELECTABLE_INNING}. */
export const INNING_SELECT_VALUES: readonly number[] = Array.from(
  { length: MAX_SELECTABLE_INNING },
  (_, i) => i + 1
);
