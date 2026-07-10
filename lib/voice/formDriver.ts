// JARVIS → on-screen form control. JARVIS opens the real Log Call dialog and
// visibly types into its fields (fast) instead of updating a side panel.
// Communication is via window CustomEvents so any mounted dialog can respond.

export type DriveLogField =
  | 'log_type' | 'outcome' | 'summary' | 'sentiment'
  | 'promises_made' | 'next_step' | 'followup_date' | 'followup_time'

export interface DriveLogDetail {
  field: DriveLogField | 'client'
  value: string
  /** display label for client selection */
  label?: string
  stage?: string
}

/** Ask the app shell (TopBar) to open its Log Call dialog. */
export function openLogCallForm(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('jarvis:open-log-call'))
}

/** Type/select a value into the open Log Call dialog, visibly. */
export function driveLogField(detail: DriveLogDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<DriveLogDetail>('jarvis:drive-log', { detail }))
}

/** Close the dialog after JARVIS finished (saved or aborted). */
export function closeLogCallForm(saved: boolean): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('jarvis:close-log-call', { detail: { saved } }))
}
