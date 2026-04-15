import { getPlayerHistory } from '../core/repository';
import { fetchTodayInfo } from '../core/api';
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

interface HistoryEntryWithSkills {
    skills: Skills;
}

function selectComparisonEntries<T extends HistoryEntryWithSkills>(history: T[], usePreviousWeek: boolean): { targetCurrent: T | null, targetPrevious: T | null } {
    if (history.length === 0) {
        return { targetCurrent: null, targetPrevious: null };
    }

    if (usePreviousWeek) {
        // Pre-training period: show last completed jump (X-1 vs X-2).
        if (history.length >= 2) {
            return {
                targetCurrent: history[history.length - 2],
                targetPrevious: history.length >= 3 ? history[history.length - 3] : null
            };
        }
        return { targetCurrent: history[history.length - 1], targetPrevious: null };
    }

    // Post-training period: show current jump (X vs X-1).
    return {
        targetCurrent: history[history.length - 1],
        targetPrevious: history.length >= 2 ? history[history.length - 2] : null
    };
}

/**
 * Processes the Squad View (Cards layout) to inject analytics.
 * @param {HTMLElement} container 
 */
export async function processSquadTable(container: HTMLElement): Promise<void> {
    // console.log('Processing Squad View...');

    // Find all player cards
    const playerBoxes = container.querySelectorAll('.player-box, .player-box--sm');
    // console.log(`[Sokker++] Found ${playerBoxes.length} player boxes.`);

    // Get current time info to decide which weeks to compare
    let todayInfo;
    try {
        todayInfo = await fetchTodayInfo();
    } catch (e) {
        console.error('[Sokker++] Failed to fetch today info, defaulting to standard comparison', e);
    }

    // Rule: If day < 5 (Sun-Thu), training hasn't happened for the current week yet.
    // So currentData (Week X) is identical to Week X-1. 
    // We should show the change from the PREVIOUS training: Week X-1 vs Week X-2.
    const usePreviousWeek = todayInfo && todayInfo.day < 5;
    // console.log(`[Sokker++] Day: ${todayInfo?.day}, Using previous week for comparison: ${usePreviousWeek}`);

    for (const box of playerBoxes) {
        const playerId = extractPlayerId(box as HTMLElement);
        if (!playerId) {
            console.warn('[Sokker++] Could not extract player ID from box', box);
            continue;
        }

        // Fetch history
        const historyData = await getPlayerHistory(playerId);
        const history = historyData?.history || [];

        if (history.length === 0) continue;

        const { targetCurrent, targetPrevious } = selectComparisonEntries(history, !!usePreviousWeek);

        if (targetCurrent && targetCurrent.skills) {
            // Highlight changes and attach tooltips
            // Note: We are passing targetCurrent.skills as "current" and targetPrevious.skills as "previous"
            // This determines the ARROWS. 
            // The actual displayed text (values) in the HTML is whatever Sokker rendered (current week).
            processPlayerSkills(box as HTMLElement, playerId, targetCurrent.skills, targetPrevious?.skills);
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

    // Attach History Tooltip to Player Name. Guard by DOM presence (not a
    // dataset flag) so that if Sokker re-renders the link we re-insert the
    // icon; and attach the icon as the LAST child of the link so it always
    // renders inline with the name regardless of Sokker's squad layout.
    const nameLink = box.querySelector<HTMLAnchorElement>('a[href*="/player/PID/"], a[href*="/player/ID_player/"]');
    if (nameLink && !nameLink.querySelector('.sokker-plus-history-icon')) {
        const icon = createHistoryIcon();
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            showHistoryTooltip(e.pageX, e.pageY, playerId, icon, { pinned: true });
        });
        nameLink.appendChild(icon);
        console.log('[Sokker++] history icon attached (squad) for player', playerId);
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
        if (val.dataset.sokkerPlusEventsBound === 'true') return;
        val.dataset.sokkerPlusEventsBound = 'true';

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

/**
 * Processes the Player Detail Page.
 * @param {HTMLElement} container
 */
export async function processPlayerPage(container: HTMLElement): Promise<void> {
    console.log('[Sokker++] processPlayerPage start', { container });

    const pid = extractPlayerIdFromUrl();
    if (!pid) {
        console.warn('[Sokker++] Could not extract player ID from URL');
        return;
    }
    console.log('[Sokker++] processPlayerPage pid=', pid);

    // console.log(`[Sokker++] Processing player page for ${pid}`);

    let todayInfo;
    try {
        todayInfo = await fetchTodayInfo();
    } catch (e) {
        console.error('[Sokker++] Failed to fetch today info on player page, defaulting to standard comparison', e);
    }

    const usePreviousWeek = !!todayInfo && todayInfo.day < 5;

    const historyData = await getPlayerHistory(pid);
    const history = historyData?.history || [];
    const { targetCurrent, targetPrevious } = selectComparisonEntries(history, usePreviousWeek);

    // Process skills in the table-skills
    const skillTable = container.querySelector('.table-skills');
    if (skillTable) {
        processPlayerPageTable(skillTable as HTMLElement, pid, targetCurrent?.skills, targetPrevious?.skills);
    }

    // Attach History Tooltip to Player Name Headers
    // 1. Panel Header (Primary) - be specific to avoid matching other icons (like briefcase)
    const panelNameLink = container.querySelector<HTMLElement>('.h5.title-block-1 a[href*="player/PID/"]');
    console.log('[Sokker++] panelNameLink lookup', { found: !!panelNameLink });
    // 2. Navbar Brand (Secondary/Fallback) - note: might be outside container if container is inner
    // If container is .l-main__inner, navbar might be outside. 
    // But let's try document.querySelector for navbar as fallback if not found in container?
    // Actually, let's stick to container first.

    const attachHistory = (el: HTMLElement) => {
        // Guard by presence in the DOM so re-renders trigger re-attach.
        if (el.querySelector('.sokker-plus-history-icon')) return;
        const icon = createHistoryIcon();
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            showHistoryTooltip(e.pageX, e.pageY, pid, icon, { pinned: true });
        });
        el.appendChild(icon);
        console.log('[Sokker++] history icon attached (player page)');
    };

    if (panelNameLink) attachHistory(panelNameLink);

    // Also try global navbar if not found in container (since container might be just the inner content)
    const navNameLabel = document.querySelector<HTMLElement>('.navbar-brand');
    if (navNameLabel) attachHistory(navNameLabel);
}

function extractPlayerIdFromUrl(): number | null {
    const match = window.location.href.match(/\/player\/(?:PID|ID_player)\/(\d+)/);
    if (match) return parseInt(match[1], 10);
    return null;
}

/**
 * Processes skills in the player page table.
 */
function processPlayerPageTable(table: HTMLElement, playerId: number, currentSkills?: Skills, previousSkills?: Skills | null): void {
    const cells = table.querySelectorAll('td');

    cells.forEach(td => {
        // Skill Name is usually the text content of the TD, ignoring the strong/span
        // Structure: <td><strong class="">Level <span class="skillNameNumber">[N]</span></strong> Skill Name</td>

        // Extract Skill Name from text nodes
        const clone = td.cloneNode(true) as HTMLElement;
        // Clean up clone to extract text
        const strong = clone.querySelector('strong, .strong');
        if (strong) strong.remove();

        let skillLabel = '';
        const link = clone.querySelector('a');
        if (link) {
            skillLabel = link.textContent?.trim() || '';
        } else {
            skillLabel = clone.textContent?.trim() || '';
        }

        // console.log(`[Sokker++] Extracted label: "${skillLabel}"`);
        const skillKey = mapSkillLabelToKey(skillLabel);

        if (!skillKey) return;

        // The value element is inside the strong tag
        const valEl = td.querySelector('.skillNameNumber') as HTMLElement;
        // The text description "Level" is inside strong but outside span
        // Support both <strong> tag and <span class="strong">
        const levelDescEl = td.querySelector('strong, .strong') as HTMLElement;

        // Tag elements for tooltips
        td.dataset.skillName = skillKey;
        if (valEl) valEl.dataset.skillName = skillKey;
        if (levelDescEl) levelDescEl.dataset.skillName = skillKey;

        // Make clickable
        td.style.cursor = 'pointer';
        td.addEventListener('click', (e) => {
            // Avoid double trigger if clicking inner elements
            if (e.target !== valEl && e.target !== levelDescEl) {
                openZoomChart(playerId, skillKey);
            }
        });

        if (valEl) {
            valEl.dataset.clickable = 'true';
            valEl.style.cursor = 'pointer';
            valEl.addEventListener('click', (e) => {
                e.stopPropagation();
                openZoomChart(playerId, skillKey);
            });
        }

        if (levelDescEl) {
            levelDescEl.dataset.clickable = 'true';
            levelDescEl.style.cursor = 'pointer';
            levelDescEl.addEventListener('click', (e) => {
                e.stopPropagation();
                openZoomChart(playerId, skillKey);
            });
        }

        // Highlight changes
        if (currentSkills && previousSkills) {
            const curr = currentSkills[skillKey] as number;
            const prev = previousSkills[skillKey] as number;

            if (curr !== undefined && prev !== undefined && curr !== prev) {
                const isImprovement = curr > prev;

                // Colorize value
                if (valEl) {
                    valEl.style.color = isImprovement ? '#28a745' : '#dc3545';
                    valEl.style.fontWeight = 'bold';
                    valEl.title = `Previous: ${prev}`;
                }

                // Add arrow
                const arrow = document.createElement('span');
                arrow.className = 'skill-arrow';
                arrow.innerText = isImprovement ? '▲' : '▼';
                arrow.style.color = isImprovement ? '#28a745' : '#dc3545';
                arrow.style.marginLeft = '5px';
                arrow.title = `Previous: ${prev}`;

                // TARGETED PLACEMENT
                const existing = td.querySelectorAll('.skill-arrow');
                existing.forEach(el => el.remove());

                // Find the link again in the real TD (not clone)
                const realLink = td.querySelector('a');

                if (realLink) {
                    // console.log(`[Sokker++] Inserting arrow after link for ${skillKey}`);
                    realLink.insertAdjacentElement('afterend', arrow);
                } else {
                    // console.log(`[Sokker++] Appending arrow to TD for ${skillKey}`);
                    td.appendChild(arrow);
                }
            }
        }

        // Hover events for tooltip are attached via class selector on container usually,
        // but here we can attach directly
        td.addEventListener('mouseenter', (e) => showTooltip(e.pageX, e.pageY, playerId, skillKey));
        td.addEventListener('mouseleave', () => scheduleHide());
    });
}

/**
 * Injects a global stylesheet for the history-icon badge once per document.
 * We use !important to defeat Sokker's own CSS (which otherwise hides or
 * collapses the injected <span>).
 */
function ensureHistoryIconStyles(): void {
    const STYLE_ID = 'sokker-plus-icon-styles';
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        .sokker-plus-history-icon {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin-left: 6px !important;
            width: 16px !important;
            height: 16px !important;
            min-width: 16px !important;
            border-radius: 50% !important;
            background-color: #007bff !important;
            color: #fff !important;
            font-size: 12px !important;
            font-weight: bold !important;
            line-height: 1 !important;
            cursor: pointer !important;
            user-select: none !important;
            vertical-align: middle !important;
            text-decoration: none !important;
            box-shadow: 0 1px 2px rgba(0,0,0,0.25) !important;
            z-index: 1 !important;
        }
        .sokker-plus-history-icon:hover {
            background-color: #0056b3 !important;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Creates a small "+" badge intended to be inserted as a child of a player
 * name link. Clicking it opens the pinned history tooltip.
 *
 * Uses BOTH a CSS class (with !important) AND inline styles via setProperty
 * to be defensive against Sokker's own CSS and any case where the injected
 * stylesheet might not apply.
 */
function createHistoryIcon(): HTMLElement {
    ensureHistoryIconStyles();
    const icon = document.createElement('span');
    icon.className = 'sokker-plus-history-icon';
    icon.textContent = '+';
    icon.title = 'Open skill history';
    const imp = (name: string, value: string) => icon.style.setProperty(name, value, 'important');
    imp('display', 'inline-flex');
    imp('align-items', 'center');
    imp('justify-content', 'center');
    imp('margin-left', '6px');
    imp('width', '16px');
    imp('height', '16px');
    imp('min-width', '16px');
    imp('border-radius', '50%');
    imp('background-color', '#007bff');
    imp('color', '#fff');
    imp('font-size', '12px');
    imp('font-weight', 'bold');
    imp('line-height', '1');
    imp('cursor', 'pointer');
    imp('user-select', 'none');
    imp('vertical-align', 'middle');
    imp('text-decoration', 'none');
    imp('box-shadow', '0 1px 2px rgba(0,0,0,0.25)');
    return icon;
}
