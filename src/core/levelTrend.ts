export interface LevelTrendEstimate {
    /** Observed levels gained per game week. */
    slope: number | null;
    /** Reciprocal of a positive slope, in game weeks per level. */
    weeksPerLevel: number | null;
    state: 'insufficient' | 'no-progress' | 'estimated';
}

/** Fits observed level coordinates without inventing intermediate weeks. */
export function estimateLevelTrend(points: readonly { x: number; y: number }[]): LevelTrendEstimate {
    const byWeek = new Map<number, number>();
    for (const point of points) {
        if (Number.isInteger(point.x) && Number.isFinite(point.y) && point.y >= 0 && point.y <= 18) {
            byWeek.set(point.x, point.y);
        }
    }

    if (byWeek.size < 4) {
        return { slope: null, weeksPerLevel: null, state: 'insufficient' };
    }

    const observations = [...byWeek].sort(([a], [b]) => a - b);
    const meanX = observations.reduce((sum, [x]) => sum + x, 0) / observations.length;
    const meanY = observations.reduce((sum, [, y]) => sum + y, 0) / observations.length;
    let covariance = 0;
    let xVariance = 0;
    for (const [x, y] of observations) {
        const offset = x - meanX;
        covariance += offset * (y - meanY);
        xVariance += offset * offset;
    }
    const slope = covariance / xVariance;
    if (!Number.isFinite(slope)) {
        return { slope: null, weeksPerLevel: null, state: 'insufficient' };
    }
    if (slope <= 0) {
        return { slope, weeksPerLevel: null, state: 'no-progress' };
    }
    return { slope, weeksPerLevel: 1 / slope, state: 'estimated' };
}
