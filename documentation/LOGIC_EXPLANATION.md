# Sokker++ Technical Logic Documentation

This document describes the core logic behind the Sokker++ extension, specifically focusing on **Data Synchronization**, **Chart Rendering**, and **Skill Improvement Detection**.

## 1. Data Synchronization Logic (`src/core/sync.ts`)

The synchronization process (`syncData`) ensures that the local database maintains an up-to-date player history without overwhelming the Sokker API.

### **Workflow:**
1.  **Initialization**: The localized IndexedDB is initialized.
2.  **Week Fetching**:
    -   **Current Week**: The extension fetches the current week number from `/api/current`.
    -   **Last Synced Week**: It retrieves the last successfully synced week from local storage.
3.  **Baseline Refresh**:
    -   If the `Last Synced Week` is less than the current week, the system forces a re-fetch of that specific week.
    -   *Purpose*: This captures any late-week training updates (typically Thursday/Friday events) that might have occurred after the last sync of the previous week.
4.  **Gap Filling Strategy**:
    -   The system calculates the range of missing weeks, up to a maximum lookback of **25 weeks**.
    -   It iterates sequentially from the past towards the present.
    -   **Current Week**: Always fetched to ensure real-time data accuracy.
    -   **Historical Weeks**: Only fetched if they are strictly missing from the local database.
5.  **Persistence**: Validated data is committed to `IndexedDB` via `saveWeekData`.

## 2. Chart Rendering Logic (`src/content/tooltip.ts`)

Charts are rendered by processing raw player history into normalized data points suitable for visualization.

### **Data Preparation (`prepareChartData`):**
1.  **Heuristic Filtering**:
    -   **Static Form Check**: If a player's `form` skill has remained identical for >3 weeks, the history is flagged as a "naive backfill" (simulated history) and truncated to only the latest entry to avoid misleading flat lines.
2.  **Week Adjustment (Training Cycle Alignment)**:
    -   Sokker training updates typically occur late in the week (Thursday/Friday).
    -   **Logic**:
        -   **Post-Update (Thu-Fri)**: If the data point's day is Thursday (4) or Friday (5), the week number is preserved.
        -   **Pre-Update (Sat-Wed)**: If the data point falls on Saturday through Wednesday, the week number is **decremented by 1**.
        -   *Reason*: Data collected early in the week represents the state *before* the current week's training, effectively belonging to the previous week's cycle.
3.  **Deduplication**:
    -   If multiple entries map to the same adjusted week, the entry with the **latest timestamp** is retained as the definitive record.
4.  **Anomaly Detection**:
    -   The system detects if a "historical" week entry has a timestamp within 24 hours of the current time. This indicates a sync error where current data was incorrectly saved as history; such points are discarded.
5.  **Visual Optimization (Flatline Removal)**:
    -   For stable skills (excluding volatile ones like Form, Stamina, Teamwork, Tactical Discipline), long sequences of identical values are trimmed to reduce visual noise, preserving only the inflection points (changes).

## 3. Skill Improvement (Pop) Detection (`src/content/ui.ts`)

The visual indicators (green ▲ / red ▼) on the Player and Squad pages represent detected changes in skill levels week-over-week.

### **Comparison Logic: Strict Week Matching**
The extension employs a **Strict Week Matching** strategy. This approach is superior to simple array indexing (e.g., comparing `last` vs `last-1`) because it remains robust against missing data, skipped weeks, or sync gaps.

1.  **Target Week Determination**:
    The "Target Week" is the specific week we expect to see training results for, based on the current day of the week.
    -   **Pre-Training (Sunday - Thursday / Day < 5)**:
        -   Training for the current week has **not** yet occurred.
        -   **Target Week** = `Current Week - 1`.
        -   *Goal*: Display changes from the *previous* training cycle (e.g., the update that happened last Friday).
    -   **Post-Training (Friday - Saturday / Day >= 5)**:
        -   Training for the current week **has** occurred.
        -   **Target Week** = `Current Week`.
        -   *Goal*: Display fresh results from the current training cycle.

2.  **Strict Lookup**:
    -   The system queries the player's history for **exactly** `Target Week` and `Target Week - 1`.
    -   **Condition**: Indicators are **ONLY** displayed if **BOTH** specific weeks exist in the history.
    -   *Robustness*:
        -   If a user visits a team page that hasn't been synced for the current week (e.g., missing Week 1179), and today is Sunday (Target = 1178), the system correctly identifies and compares Week 1178 vs Week 1177.
        -   It effectively ignores missing "future" or "current" data if it's not relevant to the target comparison, preventing erroneous arrows.

### **Display Logic (DOM Manipulation)**
-   **English Interface**: The indicator is appended **inside** the skill's `<a>` tag (e.g., `<a>Stamina ▲</a>`). This ensures the arrow is clickable and style-consistent with the link.
-   **Spanish Interface**: The indicator is appended to the parent table cell (`td`), positioned immediately after the text node.

### **Source of Truth Alignment**
This logic is architected to align with the **Official Plus Indicators** (native bold/colored text).

-   **Plus Users**: Sokker natively highlights changed skills with specific CSS classes (e.g., `text-success`). Our **Strict Week Matching** calculates the mathematically equivalent change by comparing the authoritative historic weeks.
-   **Non-Plus Users**: Users without "Plus" status do not receive these native visual cues. Our logic provides the same "Plus-like" experience by performing the exact same data-driven calculation on their history.
-   **Consistency**: By relying on the **Data Key (Week Number)** rather than the **DOM State (CSS Classes)**, the extension ensures consistent, accurate behavior across all user types (Plus/Non-Plus) and languages.
