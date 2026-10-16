import type { JuniorPoint } from './juniorTypes';
import { estimateLevelTrend } from './levelTrend';

export interface JuniorTalentEstimate {
    /** Fitted levels gained per graph week. This is not Sokker's native talent. */
    slope: number | null;
    /** Reciprocal of a positive slope, in weeks per level. */
    weeksPerLevel: number | null;
    state: 'insufficient' | 'no-progress' | 'estimated';
}

/** Uses observed graph coordinates without filling missing weeks or correcting level drops. */
export function estimateJuniorTalent(points: readonly JuniorPoint[]): JuniorTalentEstimate {
    return estimateLevelTrend(points);
}
