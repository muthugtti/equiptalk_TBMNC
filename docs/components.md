# Component Library

This document highlights the key UI components used in Equiptalk AI, primarily located in `src/components`.

## Dashboard Components (`src/components/dashboard`)

These components build up the main dashboard view, providing visualizations and summaries.

### `AccountDrawer`
**Path:** `src/components/dashboard/AccountDrawer.tsx`
A slide-out drawer that manages user profile settings, account details, and navigation to user-specific actions.

### `StatsGrid`
**Path:** `src/components/dashboard/StatsGrid.tsx`
Displays high-level metrics (e.g., Total Equipment, Open Incidents, etc.) in a grid layout. Each card typically shows a value, a label, and a trend indicator.

### `RecentIssuesTable`
**Path:** `src/components/dashboard/RecentIssuesTable.tsx`
A tabular view of the most recently reported incidents. It includes columns for:
-   Equipment Name
-   Issue Description
-   Status (with color-coded badges)
-   Priority
-   Date Reported

### `SentimentChart`
**Path:** `src/components/dashboard/SentimentChart.tsx`
A chart component (likely using Recharts) that visualizes AI-analyzed sentiment data over time, helping to gauge user satisfaction or interaction quality.

### `ChatVolumeChart`
**Path:** `src/components/dashboard/ChatVolumeChart.tsx`
Visualizes the volume of interactions or "chats" within the system, useful for tracking usage trends.

## Common UI Patterns

The application uses **Tailwind CSS** for styling. Common patterns include:

-   **Cards:** Used for grouping related content (e.g., in the dashboard).
-   **Badges:** Used for status indicators (Operational, Down, Open, Closed).
-   **Modals/Drawers:** Used for forms and detailed views without leaving the current page context.
