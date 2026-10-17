// Fired on window whenever the signed-in user's points balance may have
// changed (earning, un-checking, redeeming, buying). The header points chip
// and the reward-unlock watcher listen and re-read the balance — so places
// that change points only need to call this, not know who's listening.
export const POINTS_CHANGED_EVENT = 'growthos:points-changed'

export function notifyPointsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(POINTS_CHANGED_EVENT))
}
