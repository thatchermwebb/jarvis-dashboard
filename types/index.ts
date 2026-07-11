export type ClientStage =
  | 'onboarding'
  | 'free_trial'
  | 'free_trial_pending'
  | 'trial_ending_soon'
  | 'trial_concluded'
  | 'active_client'
  | 'overdue'
  | 'payment_issue'
  | 'paused'
  | 'churn_risk'
  | 'churned'
  | 'free_trial_lost'
  | 'won_back'

export type ClientSentiment =
  | 'happy'
  | 'neutral'
  | 'confused'
  | 'concerned'
  | 'frustrated'
  | 'angry'
  | 'ghosting'
  | 'close_ready'

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical'

export type PaymentStatus = 'current' | 'failed' | 'pending' | 'discounted'

export type AdStatus = 'live' | 'off' | 'rejected' | 'limited_learning'

export type LogType = 'call' | 'text' | 'voicemail' | 'meeting' | 'note' | 'email'

export type LogOutcome =
  | 'answered'
  | 'voicemail'
  | 'texted'
  | 'no_answer'
  | 'meeting_booked'

export type TaskType =
  | 'build_ads'
  | 'upload_creatives'
  | 'fix_ai'
  | 'fix_crm'
  | 'check_leads'
  | 'change_location'
  | 'pause_campaign'
  | 'launch_campaign'
  | 'add_hooks'
  | 'check_rejected_ad'
  | 'add_drive_assets'
  | 'verify_calendar'
  | 'check_payment'

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low'

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'blocked'

export interface Affiliate {
  id: string
  name: string
  initials: string
  created_at: string
}

export interface Client {
  id: string
  created_at: string
  updated_at: string
  signed_at?: string

  // Core
  name: string
  business_name?: string
  owner_name?: string
  phone?: string
  email?: string
  market_location?: string
  timezone?: string
  stage: ClientStage
  assigned_owner?: string
  assigned_va?: string
  assigned_closer?: string
  monthly_retainer?: number
  payment_frequency?: string
  payment_status?: PaymentStatus
  deal_notes?: string
  advertised_package?: string
  affiliate_id?: string
  affiliate?: Affiliate

  // Trial
  trial_start?: string
  trial_end?: string
  trial_health_score?: number
  close_probability?: number
  close_call_booked?: boolean
  trial_outcome?: string
  trial_lost_reason?: string

  // Communication
  last_contact_date?: string
  last_contact_method?: string
  last_call_outcome?: string
  last_call_summary?: string
  last_client_sentiment?: ClientSentiment
  next_followup_date?: string
  followup_reason?: string
  suggested_message?: string
  promises_made?: string
  objections?: string
  client_concerns?: string

  // Ads
  ad_status?: AdStatus
  new_ads?: boolean
  campaign_link?: string
  ad_account_link?: string
  budget?: number
  spend?: number
  leads?: number
  cpl?: number
  bookings?: number
  cost_per_booking?: number
  best_ad?: string
  worst_ad?: string
  creative_status?: string
  location_targeting?: string
  last_ad_change?: string
  next_ad_action?: string

  // AI/CRM
  ghl_location_link?: string
  ai_status?: string
  avg_ai_response_time?: string
  phone_numbers_collected?: number
  vehicle_info_collected?: boolean
  area_collected?: boolean
  conversations_needing_human?: number
  missed_conversations?: number
  booking_rate?: number
  crm_issue?: boolean

  // Risk
  churn_risk_score?: number
  risk_reason?: string
  save_action?: string
  thatcher_needed?: boolean
  va_needed?: boolean
  trepp_needed?: boolean
  payment_issue?: boolean
  urgency_level?: UrgencyLevel

  // AI situation summary (cached)
  ai_situation_summary?: string | null
  ai_summary_updated_at?: string | null

  // Links
  slack_thread?: string
  google_drive_folder?: string

  // Computed (not in DB)
  priority_score?: number
  trial_days_left?: number
}

export interface JarvisMemory {
  id: string
  created_at: string
  user_id: string
  content: string
  category: 'preference' | 'fact' | 'client' | 'instruction'
  client_id?: string | null
  active: boolean
}

export interface CommunicationLog {
  id: string
  client_id: string
  created_at: string
  log_type?: LogType
  outcome?: LogOutcome
  summary?: string
  sentiment?: ClientSentiment
  promises_made?: string
  objections?: string
  next_step?: string
  followup_date?: string
  created_by?: string
  ad_creative?: string
  trial_notes?: string
}

export interface Task {
  id: string
  client_id?: string | null
  created_at: string
  updated_at: string
  title?: string
  task_type?: TaskType
  priority?: TaskPriority
  assigned_va?: string
  assigned_to?: string
  due_date?: string
  due_time?: string
  status?: TaskStatus
  slack_sent?: boolean
  notes?: string
  asset_links?: string
  client?: Pick<Client, 'id' | 'name' | 'stage'> | null
}

export interface TimelineEvent {
  id: string
  client_id: string
  created_at: string
  event_type?: string
  description?: string
  created_by?: string
  metadata?: Record<string, unknown>
}

export interface CloseBrief {
  id: string
  client_id: string
  created_at: string
  trial_dates?: string
  results_summary?: string
  client_mood?: string
  main_pain?: string
  best_closing_angle?: string
  potential_objection?: string
  recommended_offer?: string
  diego_notes?: string
  generated_content?: {
    brief?: string
    client_text?: string
    objection_notes?: string
    call_script?: string
  }
}

export type AdProductionStatus = 'not_started' | 'in_progress' | 'review' | 'done'
export type AdProductionPriority = 'low' | 'med' | 'high' | 'urgent'

export interface AdProduction {
  id: string
  created_at: string
  client_id: string
  ad_name: string
  due_date?: string
  status: AdProductionStatus
  assigned_to?: string
  priority: AdProductionPriority
  notes?: string
  format?: string
  slack_sent?: boolean
  slack_sent_at?: string
  client?: Pick<Client, 'id' | 'name' | 'business_name'>
}

export interface GHLAppointment {
  id: string
  title: string
  startTime: string
  endTime: string
  status: string
  calendarId?: string
  locationId?: string
  contactId?: string
  assignedUserId?: string
  notes?: string
  contact?: { name?: string; email?: string; phone?: string }
}

export type PaymentEntryStatus = 'pending' | 'paid' | 'paid_late' | 'overdue' | 'waived' | 'voided'
export type PaymentSource = 'stripe' | 'zelle' | 'other'
export type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly' | 'one_time'
export type PaymentType =
  | 'retainer_monthly'
  | 'retainer_biweekly'
  | 'retainer_weekly'
  | 'deposit'
  | 'remaining_balance'
  | 'one_time'
  | 'partial_payment'

export interface Payment {
  id: string
  created_at: string
  updated_at: string
  client_id: string
  schedule_id?: string
  payment_type: PaymentType
  description?: string
  amount: number
  due_date: string
  paid_date?: string
  status: PaymentEntryStatus
  source?: PaymentSource
  notes?: string
  client?: Pick<Client, 'id' | 'name' | 'business_name'>
}

export interface PaymentSchedule {
  id: string
  created_at: string
  client_id: string
  label?: string
  payment_type: PaymentType
  amount: number
  frequency: PaymentFrequency
  start_date: string
  end_date?: string
  active: boolean
  notes?: string
  client?: Pick<Client, 'id' | 'name' | 'business_name'>
}

export interface DashboardStats {
  active_clients: number
  free_trials: number
  trials_ending_today: number
  trials_ending_this_week: number
  payment_issues: number
  at_risk_clients: number
  close_ready_trials: number
  thatcher_needed: number
  va_tasks_open: number
  tasks_due_today: number
  tasks_overdue: number
  overdue_followups: number
  monthly_recurring_revenue: number
  weekly_recurring_revenue: number
}
