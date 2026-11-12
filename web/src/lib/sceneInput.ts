import type { Outcome, Role, Status } from './vaultSimulator';

export type SceneRoleFocus = Role | null;

export interface SceneInputState {
  status: Status;
  outcome: Outcome;
  progress: number;
  pointerX: number;
  pointerY: number;
  roleFocus: SceneRoleFocus;
  sealH: 0 | 1 | null;
  sealR: 0 | 1 | null;
  lidOpen: number | null;
  hasInteracted: boolean;
  dragYaw: number;
  dragPitch: number;
  resetTrigger: number;
}

export const sceneInput: SceneInputState = {
  status: 'Idle',
  outcome: 'None',
  progress: 0,
  pointerX: 0,
  pointerY: 0,
  roleFocus: null,
  sealH: null,
  sealR: null,
  lidOpen: null,
  hasInteracted: false,
  dragYaw: 0,
  dragPitch: 0,
  resetTrigger: 0,
};

export interface DerivedStrongboxPose {
  sealH: 0 | 1;
  sealR: 0 | 1;
  lidOpen: number;
  ringFill: number;
  ringExtended: boolean;
  clampLocked: boolean;
  dialSpeed: number;
  dialAlert: boolean;
  orbitSpeed: number;
  orbitTilt: number;
  coinHActive: boolean;
  coinRActive: boolean;
  envelopeOpen: number;
  gleamIntensity: number;
}

export function deriveStrongboxPose(state: SceneInputState = sceneInput): DerivedStrongboxPose {
  const { status, outcome, roleFocus } = state;

  const defaultSealH: 0 | 1 =
    status === 'Pending' || status === 'Challenged' || status === 'Finalized' ? 1 : 0;
  const defaultSealR: 0 | 1 =
    status === 'Challenged' ||
    outcome === 'Busted' ||
    outcome === 'SpiteBackfired'
      ? 1
      : 0;

  let defaultLidOpen = 0;
  if (status === 'Finalized') {
    defaultLidOpen = outcome === 'SpiteBackfired' ? 1 : 0.82;
  }

  const sealH: 0 | 1 = state.sealH !== null ? state.sealH : defaultSealH;
  const sealR: 0 | 1 = state.sealR !== null ? state.sealR : defaultSealR;
  const lidOpen =
    state.lidOpen !== null
      ? Math.max(0, Math.min(1, state.lidOpen))
      : defaultLidOpen;

  const ringFill =
    status === 'Idle'
      ? 0.15
      : status === 'Pending'
        ? 0.58
        : status === 'Challenged'
          ? 0.92
          : 1;

  const ringExtended = status === 'Challenged' || outcome === 'SpiteBackfired';
  const clampLocked = status === 'Challenged' || outcome === 'Busted';
  const dialSpeed =
    status === 'Idle'
      ? 0.35
      : status === 'Pending'
        ? 2.2
        : status === 'Challenged'
          ? 3.1
          : 0;
  const dialAlert = status === 'Pending' || status === 'Challenged';

  const orbitSpeed =
    status === 'Idle'
      ? 0.42
      : status === 'Pending'
        ? 1.45
        : status === 'Challenged'
          ? 2.35
          : 0.28;

  const orbitTilt =
    status === 'Challenged'
      ? 0.52
      : status === 'Pending'
        ? 0.42
        : 0.34;

  const coinHActive = sealH === 1 || roleFocus === 'heir';
  const coinRActive = sealR === 1 || roleFocus === 'rival';

  const envelopeOpen =
    status === 'Finalized'
      ? outcome === 'SpiteBackfired'
        ? 1
        : 0.9
      : lidOpen > 0.15
        ? lidOpen
        : 0;

  const gleamIntensity =
    status === 'Finalized'
      ? outcome === 'SpiteBackfired'
        ? 1
        : 0.88
      : lidOpen > 0.35
        ? lidOpen
        : 0;

  return {
    sealH,
    sealR,
    lidOpen,
    ringFill,
    ringExtended,
    clampLocked,
    dialSpeed,
    dialAlert,
    orbitSpeed,
    orbitTilt,
    coinHActive,
    coinRActive,
    envelopeOpen,
    gleamIntensity,
  };
}

export function syncSceneFromVault(
  status: Status,
  outcome: Outcome,
  overrides?: Partial<Pick<SceneInputState, 'roleFocus' | 'sealH' | 'sealR' | 'lidOpen'>>,
): void {
  sceneInput.status = status;
  sceneInput.outcome = outcome;
  if (overrides) {
    if (overrides.roleFocus !== undefined) sceneInput.roleFocus = overrides.roleFocus;
    if (overrides.sealH !== undefined) sceneInput.sealH = overrides.sealH;
    if (overrides.sealR !== undefined) sceneInput.sealR = overrides.sealR;
    if (overrides.lidOpen !== undefined) sceneInput.lidOpen = overrides.lidOpen;
  }
}

export function resetSceneRotation(): void {
  sceneInput.dragYaw = 0;
  sceneInput.dragPitch = 0;
  sceneInput.resetTrigger += 1;
}

export function nudgeSceneRotation(deltaYaw: number, deltaPitch = 0): void {
  sceneInput.dragYaw += deltaYaw;
  sceneInput.dragPitch = Math.max(-0.6, Math.min(0.6, sceneInput.dragPitch + deltaPitch));
  sceneInput.hasInteracted = true;
}

const DEFAULT_ANCHOR_IDS = ['portal-scene', 'hero-scene', 'mechanism-scene', 'divider-scene', 'cockpit-scene'] as const;

let cachedPlacement: {
  x: number;
  y: number;
  size: number;
  distance: number;
  visible: boolean;
  anchorId: string | null;
} | null = null;
let lastPlacementTime = 0;

function computeScenePlacement(): {
  x: number;
  y: number;
  size: number;
  distance: number;
  visible: boolean;
  anchorId: string | null;
} {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // When the opening portal is mounted, always lock the 3D strongbox to #portal-scene
  // so it never competes with #hero-scene or other underlying page sections.
  const portalNode = document.getElementById('portal-scene');
  if (portalNode) {
    const rect = portalNode.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        size: Math.min(rect.width, rect.height),
        distance: 0,
        visible: true,
        anchorId: 'portal-scene',
      };
    }
  }

  const customNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-scene-anchor]'));
  const defaultNodes = DEFAULT_ANCHOR_IDS.map(id => document.getElementById(id)).filter(
    (el): el is HTMLElement => el !== null,
  );
  const candidates = customNodes.length > 0 ? customNodes : defaultNodes;

  let closest: {
    x: number;
    y: number;
    size: number;
    distance: number;
    anchorId: string | null;
  } | null = null;

  for (const element of candidates) {
    const rect = element.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= height || rect.width <= 0 || rect.height <= 0) continue;
    const distance = Math.abs(rect.top + rect.height / 2 - height / 2);
    if (!closest || distance < closest.distance) {
      closest = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        size: Math.min(rect.width, rect.height),
        distance,
        anchorId: element.id || element.getAttribute('data-scene-anchor') || null,
      };
    }
  }

  return closest
    ? { ...closest, visible: true }
    : { x: width * 0.75, y: height * 0.5, size: 0, distance: Infinity, visible: false, anchorId: null };
}

export function scenePlacement() {
  const now = performance.now();
  if (cachedPlacement && now - lastPlacementTime < 16) {
    return cachedPlacement;
  }
  lastPlacementTime = now;
  cachedPlacement = computeScenePlacement();
  return cachedPlacement;
}

export function isPointInsideSceneAnchor(clientX: number, clientY: number): boolean {
  const place = scenePlacement();
  if (!place.visible || place.size <= 0) return false;
  const half = place.size * 0.58;
  return (
    Math.abs(clientX - place.x) <= half &&
    Math.abs(clientY - place.y) <= half
  );
}
