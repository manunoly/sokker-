import { getPlayerHistory } from '../core/repository';
import { showTooltip, hideTooltip, updatePosition, scheduleHide, openZoomChart, showHistoryTooltip } from './tooltip';
import { PlayerData, Skills } from '../types/index';
import { mapSkillLabelToKey } from './i18n';

// Inject CSS for skill arrows
const style = document.createElement('style');
style.textContent = `
    .skill-arrow {
        display: inline-block;
        margin-left: 4px;
        font-size: 10px;
        vertical-align: middle;
        font-weight: bold;
    }
    .skill-arrow-up {
        color: #28a745; /* Green */
    }
    .skill-arrow-up::after {
        content: '\\25B2'; /* Unicode Triangle Up */
    }
    .skill-arrow-down {
        color: #dc3545; /* Red */
    }
    .skill-arrow-down::after {
        content: '\\25BC'; /* Unicode Triangle Down */
    }
`;
document.head.appendChild(style);

/**
 * Processes the Squad View (Cards layout) to inject analytics.
 * @param {HTMLElement} container 
 */
export async function processSquadTable(container: HTMLElement): Promise<void> {
    // console.log('Processing Squad View...');

    // Find all player cards
    const playerBoxes = container.querySelectorAll('.player-box, .player-box--sm');
    // console.log(`[Sokker++] Found ${playerBoxes.length} player boxes.`);

    for (const box of playerBoxes) {
        const playerId = extractPlayerId(box as HTMLElement);
        if (!playerId) {
            console.warn('[Sokker++] Could not extract player ID from box', box);
            continue;
        }
        // console.log(`[Sokker++] Processing player ${playerId}`);

        // Fetch history
        const historyData = await getPlayerHistory(playerId);

        const history = historyData?.history || [];
        const currentData = history.length > 0 ? history[history.length - 1] : null;
        let previousData = null;

        if (currentData) {
            // Simplified History Lookup:
            // Since sync.ts and repository.ts now guarantee that:
            // 1. We always have the latest data for the current week (overwritten if needed).
            // 2. We always have the latest data for the previous stored week (refreshed if needed).
            // 3. We overwrite gaps to avoid stale comparisons.
            //
            // We can simply compare currentData (Last item) with the immediate predecessor (Second to last item).

            if (history.length >= 2) {
                // Get the entry immediately before the current one
                previousData = history[history.length - 2];
            }
        }

        // console.log(`[Sokker++] Player ${playerId} history length: ${history.length} | Current Week: ${currentData?.week} | Previous Comparator Week: ${previousData?.week || 'None'}`);

        if (currentData && currentData.skills) {
            // Highlight changes and attach tooltips
            processPlayerSkills(box as HTMLElement, playerId, currentData.skills, previousData?.skills);
            attachTooltipEventsToSkills(box as HTMLElement, playerId);
        }
    }
}

/**
 * Extracts Player ID from a player box.
 * @param {HTMLElement} box 
 * @returns {number|null}
 */
function extractPlayerId(box: HTMLElement): number | null {
    // Updated to handle /PID/ as seen in recent HTML
    // Look for link in the header: <a href=".../app/player/PID/..." ...>
    const link = box.querySelector<HTMLAnchorElement>('a[href*="/player/PID/"], a[href*="/player/ID_player/"]');
    if (link) {
        // Match both formats
        const match = link.href.match(/\/player\/(?:PID|ID_player)\/(\d+)/);
        if (match) return parseInt(match[1], 10);
    }
    return null;
}

/**
 * Processes skills for a single player card.
 * @param {HTMLElement} box 
 * @param {number} playerId 
 * @param {Object} currentSkills 
 * @param {Object} currentSkills 
 * @param {Object} [previousSkills] 
 */
function processPlayerSkills(box: HTMLElement, playerId: number, currentSkills: Skills, previousSkills?: Skills | null): void {
    // Skills are in .skill-list__item or .skill-list-item
    const skillItems = box.querySelectorAll('.skill-list__item, .skill-list-item');

    skillItems.forEach(item => {
        // Try to find the skill name in the button text first (new layout)
        // Structure: .skill-list-item > button > ... > .text-overflow (Stamina)
        // Or .skill-list-item > .headline (in some views)
        let descEl = item.querySelector('.skillLabel, .text-overflow, .headline');

        if (!descEl) {
            descEl = item.querySelector('.skill-list-desc .text-overflow, .skill-list__desc .text-overflow');
        }

        if (!descEl) {
            // Fallback to direct description element
            descEl = item.querySelector('.skill-list__desc, .skill-list-desc, .skill-list-desc--t1');
        }

        if (!descEl) {
            // console.log('[Sokker++] No descEl found in item:', item.className);
            return;
        }

        const skillLabel = descEl.textContent ? descEl.textContent.trim() : '';
        const skillKey = mapSkillLabelToKey(skillLabel);

        if (!skillKey) {
            // console.warn(`[Sokker++] Unknown skill label: "${skillLabel}"`);
            return;
        }

        // Attach data for tooltip to the label (descEl)
        (descEl as HTMLElement).dataset.skillName = skillKey;

        // Loop continues...




        // Do NOT mark label as clickable to avoid interfering with native functionality
        // ... rest of the code for values ...

        // Do NOT mark label as clickable to avoid interfering with native functionality

        // Try to find value element (Number)
        let valueEl = item.querySelector<HTMLElement>('.skill-list__value');

        // Also try to find the text description element (e.g. "(Good)")
        // It's often a sibling span or div without a specific class in some views, 
        // or .skill-list__level-desc, or just inside the item text.
        // We'll look for elements containing parenthesis that aren't the label or value.
        const allChildren = Array.from(item.children) as HTMLElement[];
        let textDescEl: HTMLElement | null = null;

        for (const child of allChildren) {
            if (child === descEl || child === valueEl) continue;

            // Check if it has parenthesis
            if (child.textContent && child.textContent.includes('(') && child.textContent.includes(')')) {
                textDescEl = child;
                break;
            }
        }

        // If not found via parenthesis, try common classes
        if (!textDescEl) {
            textDescEl = item.querySelector('.skill-list__level-desc');
        }

        if (valueEl) {
            valueEl.dataset.skillName = skillKey;
            valueEl.dataset.clickable = 'true'; // Mark as clickable
        }

        if (textDescEl) {
            textDescEl.dataset.skillName = skillKey;
            textDescEl.dataset.clickable = 'true'; // Mark as clickable
        }



        // Highlight changes
        if (currentSkills && previousSkills) {
            const curr = currentSkills[skillKey] as number;
            const prev = previousSkills[skillKey] as number;

            if (curr !== undefined && prev !== undefined && curr !== prev) {
                const isImprovement = curr > prev;
                // console.log(`[Sokker++] Skill change detected for ${skillLabel} (${skillKey}): ${prev} -> ${curr}`);

                // 1. Colorize the numeric value if it exists
                if (valueEl) {
                    valueEl.style.color = isImprovement ? '#28a745' : '#dc3545';
                    valueEl.style.fontWeight = 'bold';
                    valueEl.title = `Previous: ${prev}`;
                }

                // 2. Add visual indicator (arrow) next to the text (descEl)
                const parent = descEl.parentElement;

                // Check if we already added an arrow to this specific skill item
                let existingArrow = item.querySelector('.skill-arrow');

                if (!existingArrow) {
                    const arrow = document.createElement('span');
                    arrow.className = 'skill-arrow';
                    arrow.innerText = isImprovement ? '▲' : '▼'; // Direct text content
                    // Updated Style for absolute positioning relative to label
                    // This prevents wrapping to the next line ("too low")
                    arrow.style.position = 'absolute';
                    arrow.style.right = '0';
                    arrow.style.top = '0';
                    arrow.style.fontSize = '9px';
                    arrow.style.fontWeight = 'bold';
                    arrow.style.color = isImprovement ? '#28a745' : '#dc3545';
                    arrow.title = `Previous: ${prev}`;

                    // Ensure the label container handles this absolute child
                    // We need relative positioning on the parent (descEl) 
                    // and overflow visible so it doesn't get clipped if it goes outside (though right:0 is inside)
                    (descEl as HTMLElement).style.position = 'relative';
                    (descEl as HTMLElement).style.display = 'inline-block'; // Ensure it wraps content if possible, or respects width
                    (descEl as HTMLElement).style.overflow = 'visible';

                    // Append INSIDE the label element so it uses that coordinate system
                    descEl.appendChild(arrow);
                }

            }
        }
    });

    // Attach History Tooltip to Player Name
    const nameLink = box.querySelector<HTMLAnchorElement>('a[href*="/player/PID/"], a[href*="/player/ID_player/"]');
    if (nameLink && !nameLink.dataset.historyAttached) {
        nameLink.dataset.historyAttached = 'true';
        nameLink.addEventListener('mouseenter', (e) => {
            showHistoryTooltip(e.pageX, e.pageY, playerId, nameLink);
        });
        nameLink.addEventListener('mouseleave', () => {
            import('./tooltip').then(m => m.scheduleHide());
        });
    }

    attachTooltipEventsToSkills(box, playerId);
}

/**
 * Attaches tooltip event listeners.
 * @param {HTMLElement} box 
 * @param {number} playerId 
 */
function attachTooltipEventsToSkills(box: HTMLElement, playerId: number): void {
    // We attach to anything with data-skill-name (values and labels)
    const targets = box.querySelectorAll<HTMLElement>('[data-skill-name]');

    targets.forEach(val => {
        if (!val.dataset.skillName) return;

        val.addEventListener('mouseenter', (e) => {
            // Show tooltip
            // const rect = val.getBoundingClientRect();
            // Pass pageX/Y or calculated? Tooltip expects pageX/Y
            showTooltip(e.pageX, e.pageY, playerId, val.dataset.skillName!);
        });



        val.addEventListener('mouseleave', () => {
            scheduleHide();
        });

        // Click to open Zoom Modal directly - ONLY if marked as clickable
        // The user wants to avoid overwriting native functionality on the label.
        if (val.dataset.clickable === 'true') {
            val.style.cursor = 'pointer';
            val.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent bubbling if needed
                e.preventDefault();  // Prevent default link action if any
                openZoomChart(playerId, val.dataset.skillName!);
            });
        }
    });
}
