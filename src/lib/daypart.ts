// Part of the day, used to tint the app's background glow (globals.css,
// :root[data-daypart=…]): warm in the morning, sky in the afternoon, rose in
// the evening, and the default indigo at night.

export type Daypart = 'morning' | 'afternoon' | 'evening' | 'night'

export function daypartOf(hour: number): Daypart {
  if (hour < 5 || hour >= 21) return 'night'
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

export function applyDaypart(date = new Date()) {
  document.documentElement.dataset.daypart = daypartOf(date.getHours())
}

// Inlined into <head> so the tint is right on first paint. Keep in sync
// with daypartOf — it can't import it.
export const DAYPART_INIT_SCRIPT = `(function(){try{
var h=new Date().getHours();
document.documentElement.dataset.daypart=h<5||h>=21?'night':h<12?'morning':h<17?'afternoon':'evening';
}catch(e){}})();`
