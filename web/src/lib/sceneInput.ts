import type { Outcome, Status } from './vaultSimulator';
export const sceneInput: { status: Status; outcome: Outcome; progress: number; pointerX: number; pointerY: number } = {
  status: 'Idle', outcome: 'None', progress: 0, pointerX: 0, pointerY: 0,
};
export function scenePlacement() {
  const width = window.innerWidth; const height = window.innerHeight;
  const targets = ['hero-scene', 'mechanism-scene', 'cockpit-scene'];
  let closest: { x: number; y: number; size: number; distance: number } | null = null;
  for (const id of targets) {
    const element = document.getElementById(id); if (!element) continue;
    const rect = element.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= height) continue;
    const distance = Math.abs(rect.top + rect.height / 2 - height / 2);
    if (!closest || distance < closest.distance) closest = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size: Math.min(rect.width, rect.height), distance };
  }
  return closest ? { ...closest, visible: true } : { x: width * .75, y: height * .5, size: 0, visible: false };
}
