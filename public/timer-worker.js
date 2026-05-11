// Web Worker — runs off the main thread so it's never throttled by tab visibility
let intervalId = null
let endTimeMs = 0

self.onmessage = function (e) {
  const { type } = e.data

  if (type === 'start') {
    endTimeMs = e.data.endTimeMs
    if (intervalId) clearInterval(intervalId)
    intervalId = setInterval(function () {
      const remaining = Math.max(0, endTimeMs - Date.now())
      self.postMessage({ type: 'tick', remaining })
      if (remaining === 0) {
        clearInterval(intervalId)
        intervalId = null
        self.postMessage({ type: 'done' })
      }
    }, 200)
  } else if (type === 'stop') {
    if (intervalId) clearInterval(intervalId)
    intervalId = null
  }
}
