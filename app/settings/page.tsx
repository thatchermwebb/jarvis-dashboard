export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="text-xs text-muted-foreground">Configuration and integrations</p>
      </div>

      <div className="space-y-3">
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium mb-3">Environment Setup</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Configure your <code className="bg-secondary px-1 rounded text-xs">.env.local</code> file with:</p>
            <div className="bg-secondary/50 rounded-md p-3 font-mono text-xs space-y-1">
              <div>NEXT_PUBLIC_SUPABASE_URL=your_supabase_url</div>
              <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key</div>
              <div>ANTHROPIC_API_KEY=your_anthropic_key</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium mb-1">Database Setup</h2>
          <p className="text-xs text-muted-foreground mb-3">Run the migration in your Supabase SQL editor:</p>
          <p className="text-xs text-muted-foreground">File: <code className="bg-secondary px-1 rounded text-xs">supabase/migrations/001_initial.sql</code></p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium mb-1">Phase 2 Integrations (Coming)</h2>
          <ul className="text-xs text-muted-foreground space-y-1 mt-2">
            <li>• GoHighLevel API — auto-sync contacts, pipelines, conversations</li>
            <li>• Meta Ads API — pull CPL, spend, leads daily</li>
            <li>• Slack Webhooks — post VA tasks directly to channels</li>
            <li>• Twilio — incoming call popup with instant client card</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
