// Server-side Slack notifier — posts to the operations webhook. Best-effort:
// never throws, so a Slack hiccup can't fail the action that triggered it.
export async function sendOpsSlack(text: string): Promise<boolean> {
  const webhookUrl = process.env.SLACK_OPERATIONS_WEBHOOK_URL
  if (!webhookUrl) return false
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    return res.ok
  } catch {
    return false
  }
}
