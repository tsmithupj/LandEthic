/**
 * Short clips shown while LandEthic builds a plan ("Quick tips while you wait").
 *
 * HOW TO ADD YOUR OWN VIDEOS
 * 1. Vertical (9:16) MP4s work best, 15–45 seconds each, under ~8 MB.
 *    Put the file in `public/videos/` — e.g. public/videos/show-on-map.mp4
 *    and list it below as:  { kind: 'video', src: '/videos/show-on-map.mp4', ... }
 * 2. Or use a YouTube Short you've already posted:
 *    { kind: 'youtube', youtubeId: 'abc123XYZ', seconds: 30, ... }
 *    (the ID is the part after /shorts/ in the link). `seconds` tells the
 *    player when to move on to the next clip.
 * Clips play in this order. Tip cards (kind: 'tip') need no video at all —
 * keep a few so there is always something to show.
 */

export type WaitClip =
  | { kind: 'video'; id: string; title: string; caption: string; src: string; poster?: string }
  | { kind: 'youtube'; id: string; title: string; caption: string; youtubeId: string; seconds?: number }
  | { kind: 'tip'; id: string; title: string; caption: string; icon: TipIcon; eyebrow?: string };

export type TipIcon = 'pin' | 'check' | 'refresh' | 'chat' | 'camera' | 'leaf' | 'compass';

export const WAIT_CLIPS: WaitClip[] = [
  {
    kind: 'tip',
    id: 'show-on-map',
    eyebrow: 'Your dashboard',
    icon: 'pin',
    title: 'See every spot on your map',
    caption: 'Each property insight has a "Show on map" button. Tap it and the exact area is outlined on your satellite map.',
  },
  {
    kind: 'tip',
    id: 'open-task',
    eyebrow: 'Your action plan',
    icon: 'check',
    title: 'Open a task for the full how-to',
    caption: 'Every task says what to do, why it matters, and where to do it. The work area is outlined in orange on the map.',
  },
  {
    kind: 'tip',
    id: 'already-done',
    eyebrow: 'Paid plans',
    icon: 'refresh',
    title: 'Already done it? Swap it.',
    caption: 'Tap "Already done — suggest something else" on any task and we will write a fresh one for your land.',
  },
  {
    kind: 'tip',
    id: 'ask',
    eyebrow: 'Stuck on a task?',
    icon: 'chat',
    title: 'Ask about any task',
    caption: 'Open a task and tap "Ask a question about this task." Ask what to buy, when to start, or how to do it with the tools you have.',
  },
  {
    kind: 'tip',
    id: 'species-id',
    eyebrow: 'Field guide',
    icon: 'camera',
    title: 'Snap it, name it',
    caption: 'Photograph any plant, bird, or bug on your land with Species ID. Every find is saved to your field log.',
  },
  {
    kind: 'tip',
    id: 'land-health',
    eyebrow: 'Land health score',
    icon: 'leaf',
    title: 'Watch your land improve',
    caption: 'Your 0–100 land health score shows how your whole property is doing — soil, plants, water, and wildlife together.',
  },
  {
    kind: 'tip',
    id: 'refresh',
    eyebrow: 'Goals changed?',
    icon: 'compass',
    title: 'Rebuild your plan anytime',
    caption: 'Edit your goals on the dashboard and tap "Save & rebuild plan", or tap "Refresh plan" for a fresh take on the same goals.',
  },
];

/** How long a tip card stays up before moving on. */
export const TIP_SECONDS = 8;
