// Web Audio cues for the breathing exercise. Each phase sounds different so
// it can be followed eyes-closed:
//   inhale — a tone gliding UP with a brightening breath of air, swelling in
//   exhale — the mirror: gliding DOWN, the air darkening as it fades out
//   hold   — no movement: one soft bell, then a faint tick each second
// Everything routes through one master gain so mute is instant.

const VOLUME = 0.9

export interface BreathSound {
  inhale(seconds: number): void
  exhale(seconds: number): void
  hold(): void
  tick(): void
  finish(): void
  setMuted(muted: boolean): void
  close(): void
}

// Must be called from a user gesture (the Begin tap) so browsers allow audio.
export function createBreathSound(muted: boolean): BreathSound | null {
  let ctx: AudioContext
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  } catch {
    return null
  }
  const master = ctx.createGain()
  master.gain.value = muted ? 0 : VOLUME
  master.connect(ctx.destination)

  // Two seconds of pink-ish noise, looped, for the "air" of a breath.
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = noise.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04
    data[i] = last * 3.5
  }

  // A breath: a soft chord gliding between two pitches plus filtered air
  // whose brightness follows the glide. Fades in fast and out at the end so
  // consecutive phases don't click.
  function breath(seconds: number, fromHz: number, toHz: number, airFrom: number, airTo: number, peak: number) {
    const t0  = ctx.currentTime
    const end = t0 + seconds
    const env = ctx.createGain()
    env.connect(master)
    env.gain.setValueAtTime(0.0001, t0)
    env.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.6, seconds / 3))
    env.gain.setValueAtTime(peak, Math.max(t0 + 0.6, end - 0.5))
    env.gain.exponentialRampToValueAtTime(0.0001, end)

    for (const [ratio, type, level] of [[1, 'sine', 0.55], [1.5, 'triangle', 0.18], [2.004, 'sine', 0.12]] as const) {
      const osc = ctx.createOscillator()
      const g   = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(fromHz * ratio, t0)
      osc.frequency.exponentialRampToValueAtTime(toHz * ratio, end)
      g.gain.value = level
      osc.connect(g).connect(env)
      osc.start(t0)
      osc.stop(end + 0.05)
    }

    const air    = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const airG   = ctx.createGain()
    air.buffer = noise
    air.loop   = true
    filter.type = 'bandpass'
    filter.Q.value = 0.8
    filter.frequency.setValueAtTime(airFrom, t0)
    filter.frequency.exponentialRampToValueAtTime(airTo, end)
    airG.gain.value = 0.35
    air.connect(filter).connect(airG).connect(env)
    air.start(t0)
    air.stop(end + 0.05)
  }

  // A struck bell: fundamental plus an inharmonic partial, quick decay.
  function bell(hz: number, at = 0, level = 0.22, decay = 1.6) {
    const t0 = ctx.currentTime + at
    for (const [ratio, gain] of [[1, level], [2.76, level * 0.35], [5.4, level * 0.12]] as const) {
      const osc = ctx.createOscillator()
      const g   = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = hz * ratio
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay / ratio)
      osc.connect(g).connect(master)
      osc.start(t0)
      osc.stop(t0 + decay + 0.05)
    }
  }

  return {
    inhale: seconds => breath(seconds, 196, 330, 350, 2200, 0.16),   // G3 → E4, air opening up
    exhale: seconds => breath(seconds, 330, 165, 2200, 260, 0.14),   // E4 → E3, air settling
    hold:   () => bell(880),
    tick:   () => bell(1760, 0, 0.035, 0.25),
    finish: () => { bell(523.25, 0); bell(659.25, 0.35); bell(783.99, 0.7, 0.22, 2.4) },
    setMuted(m) {
      master.gain.setTargetAtTime(m ? 0 : VOLUME, ctx.currentTime, 0.05)
    },
    close() {
      // Let a finishing chime ring out before releasing the device.
      setTimeout(() => { ctx.close().catch(() => {}) }, 3000)
    },
  }
}
