/**
 * DOM Observer for Single Page Application (SPA) navigation.
 * Detects when the squad table is ready in the DOM.
 */
import { scheduleIdle } from '../utils/scheduleIdle';

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Initializes the MutationObserver.
 * @param {Function} onTableFound - Callback when the target table is detected.
 * @param {Function} [onPlayerPageFound] - Callback when the player page is detected.
 * @param {Function} [onSquadReady] - Callback fired (in idle) when the user lands on /app/squad/.
 */
export function initObserver(
    onTableFound: (container: HTMLElement) => void,
    onPlayerPageFound?: (container: HTMLElement) => void,
    onSquadReady?: () => void
): void {
    if (observer) return;

    const targetNode = document.body;
    const config = { childList: true, subtree: true };
    let lastProcessedUrl = '';
    let lastProcessedAt = 0;
    const COOLDOWN_MS = 2000;

    const runPageProcessing = () => {
        const currentPath = window.location.href;
        const now = Date.now();

        // SPA frameworks (Vue here) re-render frequently. Without a cooldown,
        // each mutation triggers a new processing pass — hammering network
        // calls and causing UI effects to churn. We still process immediately
        // when the URL changes (user navigated).
        if (currentPath === lastProcessedUrl && now - lastProcessedAt < COOLDOWN_MS) {
            return;
        }
        lastProcessedUrl = currentPath;
        lastProcessedAt = now;

        if (currentPath.includes('/app/squad')) {
            const squadContainer = findSquadContainer();
            if (squadContainer) {
                onTableFound(squadContainer);
                if (onSquadReady) {
                    scheduleIdle(onSquadReady);
                }
            }
        } else if (currentPath.includes('/player/PID/') || currentPath.includes('/player/ID_player/')) {
            const playerContainer = findPlayerContainer();
            if (playerContainer && onPlayerPageFound) {
                onPlayerPageFound(playerContainer);
            }
        }
    };

    observer = new MutationObserver((mutationsList) => {
        // Debounce to avoid multiple calls during rendering
        if (debounceTimer) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            runPageProcessing();
        }, 500); // 500ms debounce
    });

    observer.observe(targetNode, config);
    runPageProcessing();
    // console.log('Sokker++ Observer initialized');
}

/**
 * Heuristic to find the squad container.
 * @returns {HTMLElement|null}
 */
function findSquadContainer(): HTMLElement | null {
    // The new layout uses .view-squad as the main container
    const viewSquad = document.querySelector<HTMLElement>('.view-squad');
    if (viewSquad) return viewSquad;

    // Fallback: look for player boxes directly
    const playerBoxes = document.querySelectorAll('.player-box');
    if (playerBoxes.length > 0) return document.body; // Return body or a parent if boxes found

    return null;
}

/**
 * Heuristic to find the player profile container.
 * @returns {HTMLElement|null}
 */
function findPlayerContainer(): HTMLElement | null {
    // We look for the skills table which is unique to the player view
    const skillsTable = document.querySelector<HTMLElement>('.table-skills');
    if (skillsTable) {
        // Return the closest container or body
        return document.querySelector('.l-main__inner') as HTMLElement || document.body;
    }
    return null;
}
