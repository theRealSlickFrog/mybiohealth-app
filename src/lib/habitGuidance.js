// Guidance narrative for the micro-habit picker ("Guidance" box in the Adjust
// Micro-habits popup).
//
// Returns a short string to show the member, or null when there is nothing to
// say. The wizard renders the box only for a non-null return, so an empty or
// not-yet-wired state shows nothing at all rather than a placeholder.
//
// Deliberately its own module with no React and no fetch in it: wiring this to
// an AI endpoint later means changing this file only, and the wizard keeps
// calling it the same way. The arguments are the shapes the wizard already has
// in hand at the point it asks.
//
//   priorities  [{ n, name, anchor, marker, target, code }]  active priorities
//   picks       [{ code, name, moves, frequency }]           current selection,
//                                                            the same shape the
//                                                            wizard hands back
//
// Returns: string | null
//
// Not wired to a model yet — returns null so the box stays hidden.
export function getHabitGuidance(priorities, picks) {
  return null;
}
