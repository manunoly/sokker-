# Sokker++ Logic Explanation

This document describes the core logic behind the Sokker++ extension, specifically focusing on Data Synchronization, Chart Rendering, and Skill Improvement detection.

## 1. Data Synchronization Logic (`src/core/sync.ts`)

The synchronization process (`syncData`) ensures that the local database has up-to-date player history without overwhelming the Sokker API.

### **Workflow:**
1.  **Initialization**: The database is initialized.
2.  **Fetch Weeks**: The extension fetches the **Current Week** (from `/api/current`) and the **Last Synced Week** (from local storage).
3.  **Baseline Refresh**:
    -   If the `Last Synced Week` is older than the current week, it re-fetches data for that specific week. This ensures that any late-week training updates (e.g., typically Thursday/Friday) are captured for the previous week before moving forward.
4.  **Gap Filling**:
    -   The system calculates a range of weeks to sync, looking back up to **25 weeks**.
    -   It iterates from the past to the present.
    -   **Current Week**: Always fetched to capture real-time changes.
    -   **Past Weeks**: Only fetched if they are missing from the local database.
5.  **Storage**: Valid data is saved to `IndexedDB` via `saveWeekData`.

## 2. Chart Rendering Logic (`src/content/tooltip.ts`)

Charts are rendered by processing the raw player history into clean data points.

### **Data Preparation (`prepareChartData`):**
1.  **Filtering**:
    -   **Static Form Check**: If a player's `form` skill has been identical for >3 weeks, the history is considered "fake" (naive backfill) and is truncated to just the latest entry.
2.  **Week Adjustment**:
    -   Sokker training typically updates data late in the week (Thursday/Friday).
    -   **Logic**:
        -   If the data point's day is **Thursday (4)** or **Friday (5)**, the week is kept as is.
        -   If the day is **Saturday-Wednesday**, the week number is **decremented by 1**.
        -   *Reason*: Data collected early in the week usually represents the *previous* week's training state.
3.  **Deduplication**:
    -   If multiple entries exist for the same adjusted week, the one with the **latest date** is kept.
4.  **Bad Backfill Detection**:
    -   The system detects if a "historical" week entry has a timestamp very close (within 24h) to the current time. This indicates a sync error where current data was saved as history, and such points are discarded.
5.  **Flatline Removal**:
    -   For non-fluctuating skills (everything except Form, Stamina, Teamwork, Tactical Discipline), long sequences of identical values are trimmed to clean up the chart, keeping only the change points.

## 3. Skill Improvement (Pop) Logic (`src/content/ui.ts`)

The visual indicators (green ▲ / red ▼) on the Player and Squad pages show changes in skill levels.

### **Comparison Logic:**
The extension compares a "Current" value against a "Previous" value. The selection of these values depends on the **Current Day of the Week**.

-   **Pre-Training (Sunday - Thursday / Day < 5)**:
    -   Training for the *current* week hasn't happened yet.
    -   Comparing `Week X` vs `Week X-1` would result in **0 change**.
    -   **Action**: The system compares `Week X-1` vs `Week X-2`.
    -   *Result*: You see the arrows from the **previous training** (e.g., last Friday) held over until the new training occurs.

-   **Post-Training (Friday - Saturday / Day >= 5)**:
    -   Training has occurred.
    -   **Action**: The system compares `Week X` (Current) vs `Week X-1`.
    -   *Result*: You see the fresh results of this week's training.

### **Display Logic:**
-   **English Interface**: The arrow is appended **inside** the skill link tag (e.g., `<a>Stamina ▲</a>`) to ensure it flows with the text.
-   **Spanish Interface**: The arrow is appended to the table cell (`td`), positioned after the text.
