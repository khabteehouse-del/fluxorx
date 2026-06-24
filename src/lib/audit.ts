import { SupabaseClient } from '@supabase/supabase-js'

export type AuditAction =
  | 'upload'
  | 'validation'
  | 'ai_question'
  | 'automation_approved'
  | 'automation_dismissed'
  | 'email_sent'
  | 'dashboard_viewed'
  | 'mapping_approved'
  | 'demo_data_loaded'
  | 'whatsapp_preview'

export async function auditLog(
  supabase: SupabaseClient,
  action: AuditAction,
  opts: {
    entity?: string
    entityId?: string
    metadata?: Record<string, unknown>
  } = {}
) {
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .single()

    if (!prof?.organization_id) return

    await supabase.from('audit_logs').insert({
      organization_id: prof.organization_id,
      profile_id: prof.id,
      action,
      entity: opts.entity ?? null,
      entity_id: opts.entityId ?? null,
      metadata: opts.metadata ?? {},
    })
  } catch {
    // Audit logging is best-effort, never block the main action
  }
}
