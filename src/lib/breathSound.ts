// Web Audio cues for the breathing exercise. Each phase sounds different so
// it can be followed eyes-closed:
//   inhale — a bright, steady chord that slowly swells in, like a wave arriving
//   exhale — a lower, warmer chord that slowly fades out, like a wave receding
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

  // A breath is a wave, not a siren: a soft chord at a FIXED pitch whose
  // volume swells and recedes, with gentle air under it. Gliding the pitch
  // sounded like an engine revving. `shape` maps 0→1 through the phase to
  // 0→1 loudness, and starts and ends at 0 so phases never click.
  function breath(seconds: number, chord: number[], shape: (x: number) => number, airFrom: number, airTo: number, peak: number) {
    const t0  = ctx.currentTime
    const end = t0 + seconds
    const curve = new Float32Array(64)
    for (let i = 0; i < curve.length; i++) curve[i] = peak * shape(i / (curve.length - 1))
    const env = ctx.createGain()
    env.gain.value = 0
    env.gain.setValueCurveAtTime(curve, t0, seconds)
    env.connect(master)

    // Pure sines through a low-pass: warm and round, nothing buzzy.
    const soften = ctx.createBiquadFilter()
    soften.type = 'lowpass'
    soften.frequency.value = 1400
    soften.connect(env)
    chord.forEach((hz, i) => {
      const osc = ctx.createOscillator()
      const g   = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = hz
      g.gain.value = 0.5 / (i + 1)   // upper notes quieter
      osc.connect(g).connect(soften)
      osc.start(t0)
      osc.stop(end + 0.05)
    })

    // Soft "shh" of air, opening a little on inhale and closing on exhale.
    const air    = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const airG   = ctx.createGain()
    air.buffer = noise
    air.loop   = true
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(airFrom, t0)
    filter.frequency.linearRampToValueAtTime(airTo, end)
    airG.gain.value = 0.22
    air.connect(filter).connect(airG).connect(env)
    air.start(t0)
    air.stop(end + 0.05)
  }

  const smooth = (x: number) => x * x * (3 - 2 * x)
  // Inhale: slowly fills, fullest near the top, then a soft release.
  const swellIn  = (x: number) => x < 0.85 ? smooth(x / 0.85) : smooth((1 - x) / 0.15)
  // Exhale: arrives gently, then a long fade to silence.
  const swellOut = (x: number) => x < 0.12 ? smooth(x / 0.12) : smooth((1 - x) / 0.88)

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
    // Inhale: brighter G major (G3 D4 B4), swelling in.
    inhale: seconds => breath(seconds, [196, 293.66, 493.88], swellIn, 350, 900, 0.2),
    // Exhale: lower, warmer C major (C3 G3 E4), fading out.
    exhale: seconds => breath(seconds, [130.81, 196, 329.63], swellOut, 900, 250, 0.2),
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
