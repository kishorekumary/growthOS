// Builds one transcript from a SpeechRecognition result list.
//
// With continuous recognition, Chrome on Android (and the Android WebView)
// doesn't send each phrase once: it re-sends finals it already sent, and
// often sends each new final as the whole utterance so far ("buy",
// "buy milk", "buy milk today"). Appending every final then repeats the
// words two or three times. So the transcript is rebuilt from the full
// result list on every event, and a final that repeats or extends what we
// already have replaces it instead of being appended.
export function mergeFinalTranscripts(finals: string[]): string {
  let out = ''
  for (const raw of finals) {
    const t = raw.trim().replace(/\s+/g, ' ')
    if (!t) continue
    const a = out.toLowerCase()
    const b = t.toLowerCase()
    if (!out || b.startsWith(a)) out = t        // first, or cumulative: replace
    else if (a.endsWith(b) || a.includes(b)) continue  // already have it
    else out = `${out} ${t}`                  // genuinely new phrase
  }
  return out
}

// For dictation that appends into an editable field: given what this
// recognition session already contributed (`said`) and the newly merged
// transcript, returns only the new words to append ('' if nothing new).
export function newSpeechText(said: string, merged: string): string {
  if (!merged) return ''
  if (merged.toLowerCase().startsWith(said.toLowerCase())) return merged.slice(said.length).trim()
  return merged.toLowerCase().includes(said.toLowerCase()) ? '' : merged
}
