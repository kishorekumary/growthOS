// Unlike a layout, a template remounts on every navigation, so each page
// (or its loading skeleton) fades up as it arrives. No fill-mode: the
// transform is dropped once the animation ends, so `fixed` elements inside
// pages aren't left positioned against this wrapper.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in motion-reduce:animate-none">{children}</div>
}
