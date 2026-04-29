import { type NextRequest } from 'next/server'

// Twilio fetches this URL when the call connects to get the voice script (TwiML).
// The cron route passes the task summary as a query param.
export async function POST(req: NextRequest) {
  const taskMsg = req.nextUrl.searchParams.get('msg')
    ?? 'Time to check your tasks and stay on track!'

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-IN">${escapeXml(taskMsg)}</Say>
  <Pause length="1"/>
  <Say voice="alice" language="en-IN">Open your Growth O S app to see your full task list. Have a productive day!</Say>
</Response>`

  return new Response(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })
}

function escapeXml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
