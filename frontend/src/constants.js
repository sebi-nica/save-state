export const STATUSES = ['Playing', 'Backlog', 'Completed', 'Dropped']

// Only these statuses can carry a rating/review (enforced by the backend too).
export const RATEABLE = ['Playing', 'Completed', 'Dropped']

// Moving a game into one of these means the user finished with it: a good moment to rate it.
export const FINISHED = ['Completed', 'Dropped']

export const STATUS_STYLES = {
  Playing: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  Backlog: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  Completed: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
  Dropped: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
}
