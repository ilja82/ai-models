import {TokenScale} from './ai-model.model';

/** Factors from the token counts of an older Intelligence Index run to the newest version. */
export const TOKEN_SCALES: Record<string, TokenScale> = {
  'v4.3.2': {
    input: 1.807,
    output: 0.852,
    cacheMiss: 0.638,
  },
};
