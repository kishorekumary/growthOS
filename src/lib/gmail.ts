const TOKEN_URL   = 'https://oauth2.googleapis.com/token'
const AUTH_URL     = 'https://accounts.google.com/o/oauth2/v2/auth'
const GMAIL_API    = 'https://gmail.googleapis.com/gmail/v1/users/me'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

function redirectUri() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://growthos.app'
  return `${appUrl}/api/integrations/gmail/callback`
}

export function getGmailAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:              process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:            redirectUri(),
    response_type:           'code',
    scope:                   'https://www.googleapis.com/auth/gmail.readonly',
    access_type:             'offline',
    prompt:                  'consent',
    include_granted_scopes:  'true',
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string): Promise<{ refresh_token?: string; access_token: string }> {
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  redirectUri(),
      grant_type:    'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Gmail token exchange failed: ${await res.text()}`)
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:    'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Gmail token refresh failed: ${await res.text()}`)
  const data = await res.json()
  return data.access_token
}

export async function getGmailProfile(accessToken: string): Promise<string | null> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) return null
  const data = await res.json()
  return data.email ?? null
}

export async function searchAxisAlerts(accessToken: string, sinceEpochSeconds: number): Promise<string[]> {
  const q = `from:alerts@axis.bank.in after:${sinceEpochSeconds}`
  const res = await fetch(`${GMAIL_API}/messages?${new URLSearchParams({ q, maxResults: '50' })}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Gmail search failed: ${await res.text()}`)
  const data = await res.json()
  return (data.messages ?? []).map((m: { id: string }) => m.id)
}

function base64UrlDecode(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

interface GmailPayload {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPayload[]
}

function extractPlainText(payload: GmailPayload): string {
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return base64UrlDecode(payload.body.data)
  }
  for (const part of payload.parts ?? []) {
    const text = extractPlainText(part)
    if (text) return text
  }
  return ''
}

export async function fetchMessageBody(accessToken: string, id: string): Promise<string> {
  const res = await fetch(`${GMAIL_API}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Gmail message fetch failed: ${await res.text()}`)
  const data = await res.json()
  return extractPlainText(data.payload ?? {})
}

export interface ParsedAxisAlert {
  type:        'expense' | 'income'
  amount:      number
  txnDate:     string
  description: string
}

export function parseAxisAlert(text: string): ParsedAxisAlert | null {
  const amountMatch = text.match(/Amount\s+(Debited|Credited)[:\s]*\r?\n?\s*INR\s*([\d,]+\.\d{2})/i)
  if (!amountMatch) return null

  const type   = amountMatch[1].toLowerCase() === 'debited' ? 'expense' : 'income'
  const amount = parseFloat(amountMatch[2].replace(/,/g, ''))

  const accountMatch = text.match(/Account Number:[:\s]*\r?\n?\s*(XX\d+)/i)
  const dateMatch     = text.match(/Date\s*&\s*Time:[:\s]*\r?\n?\s*(\d{2})-(\d{2})-(\d{2}),?\s*[\d:]+/i)
  const infoMatch      = text.match(/Transaction Info:[:\s]*\r?\n?\s*(.+)/i)

  let txnDate = new Date().toISOString().slice(0, 10)
  if (dateMatch) {
    const [, dd, mm, yy] = dateMatch
    txnDate = `20${yy}-${mm}-${dd}`
  }

  const parts = []
  if (infoMatch) parts.push(infoMatch[1].trim())
  if (accountMatch) parts.push(`A/c ${accountMatch[1]}`)
  const description = parts.length ? parts.join(' · ') : `Axis Bank ${type === 'expense' ? 'debit' : 'credit'}`

  return { type, amount, txnDate, description }
}
