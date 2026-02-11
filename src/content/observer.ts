/**
 * DOM Observer for Single Page Application (SPA) navigation.
 * Detects when the squad table is ready in the DOM.
 */

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Initializes the MutationObserver.
 * @param {Function} onTableFound - Callback when the target table is detected.
 */
export function initObserver(onTableFound: (container: HTMLElement) => void): void {
    if (observer) return;

    const targetNode = document.body;
    const config = { childList: true, subtree: true };

    observer = new MutationObserver((mutationsList) => {
        // Debounce to avoid multiple calls during rendering
        if (debounceTimer) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            if (window.location.href.includes('/app/squad')) {
                const squadContainer = findSquadContainer();
                if (squadContainer) {
                    onTableFound(squadContainer);
                }
            }
        }, 500); // 500ms debounce
    });

    observer.observe(targetNode, config);
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
