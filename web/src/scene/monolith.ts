import * as THREE from 'three';
import { gsap } from 'gsap';
import {
  deriveStrongboxPose,
  isPointInsideSceneAnchor,
  sceneInput,
  scenePlacement,
} from '../lib/sceneInput';

const PALETTE = {
  paper: 0xf2ebdd,
  ink: 0x16130d,
  bodyMain: 0xe6decb,
  bodyTrim: 0xd2c5ae,
  ironDark: 0x262019,
  ownerBlue: 0x1e4fd8,
  heirMustard: 0xe8b412,
  rivalRed: 0xd7261e,
  finalGreen: 0x1f7a4c,
} as const;

function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);

  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function createHardShadeGradient(): THREE.DataTexture {
  // Two-band hard shade (cel-band) inspired by PHIN PHIN flat-fill + single hard shade band
  const data = new Uint8Array([
    168, 168, 168, 255,
    168, 168, 168, 255,
    255, 255, 255, 255,
    255, 255, 255, 255,
  ]);
  const texture = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function createMonolith(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(PALETTE.paper, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.15, 10.2);

  const root = new THREE.Group();
  root.rotation.set(0.28, -0.42, 0);
  scene.add(root);

  // Lighting: 1 HemisphereLight + 1 DirectionalLight key + 1 fill (clean on warm paper or dark ground)
  const hemiLight = new THREE.HemisphereLight(PALETTE.paper, PALETTE.ironDark, 2.5);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfffcf5, 3.1);
  keyLight.position.set(-4, 6.5, 8);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(PALETTE.bodyTrim, 1.3);
  fillLight.position.set(5, -3, 3.5);
  scene.add(fillLight);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const gradientMap = createHardShadeGradient();

  function trackGeo<T extends THREE.BufferGeometry>(geo: T): T {
    geometries.push(geo);
    return geo;
  }

  function trackMat<T extends THREE.Material>(mat: T): T {
    materials.push(mat);
    return mat;
  }

  function createFlatBandMaterial(color: number, emissive = 0x000000, emissiveIntensity = 0) {
    return trackMat(
      new THREE.MeshToonMaterial({
        color,
        gradientMap,
        emissive,
        emissiveIntensity,
      }),
    );
  }

  const inkLineMaterial = trackMat(
    new THREE.LineBasicMaterial({
      color: PALETTE.ink,
      transparent: true,
      opacity: 0.92,
    }),
  );

  function addInkOutline(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    thresholdAngle = 22,
    customMaterial?: THREE.LineBasicMaterial,
  ) {
    const edges = trackGeo(new THREE.EdgesGeometry(geometry, thresholdAngle));
    const lines = new THREE.LineSegments(edges, customMaterial ?? inkLineMaterial);
    parent.add(lines);
    return lines;
  }

  // ============================================================================
  // 1. STRONGBOX BODY (Brankas Arsip Utama)
  // ============================================================================
  const strongboxGroup = new THREE.Group();
  root.add(strongboxGroup);

  const bodyShape = createRoundedRectShape(2.36, 1.42, 0.18);
  const bodyGeo = trackGeo(
    new THREE.ExtrudeGeometry(bodyShape, {
      depth: 1.38,
      bevelEnabled: true,
      bevelSize: 0.04,
      bevelThickness: 0.04,
      bevelSegments: 2,
      steps: 1,
    }),
  );
  bodyGeo.translate(0, -0.14, -0.69);

  const bodyMat = createFlatBandMaterial(PALETTE.bodyMain);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  addInkOutline(bodyMesh, bodyGeo, 20);
  strongboxGroup.add(bodyMesh);

  // Dark recessed front ledger panel
  const frontPanelShape = createRoundedRectShape(1.98, 1.02, 0.1);
  const frontPanelGeo = trackGeo(
    new THREE.ExtrudeGeometry(frontPanelShape, {
      depth: 0.06,
      bevelEnabled: false,
      steps: 1,
    }),
  );
  frontPanelGeo.translate(0, -0.14, 0.71);
  const frontPanelMat = createFlatBandMaterial(PALETTE.bodyTrim);
  const frontPanelMesh = new THREE.Mesh(frontPanelGeo, frontPanelMat);
  addInkOutline(frontPanelMesh, frontPanelGeo, 15);
  strongboxGroup.add(frontPanelMesh);

  // Interior dark vault well (visible when lid opens)
  const wellGeo = trackGeo(new THREE.BoxGeometry(1.96, 0.24, 1.02));
  const wellMat = createFlatBandMaterial(PALETTE.ironDark);
  const wellMesh = new THREE.Mesh(wellGeo, wellMat);
  wellMesh.position.set(0, 0.52, 0);
  addInkOutline(wellMesh, wellGeo);
  strongboxGroup.add(wellMesh);

  // Heir Inheritance Deed / Sepolia Core inside the vault (rises when Finalized)
  const deedGroup = new THREE.Group();
  deedGroup.position.set(0, 0.42, 0);
  strongboxGroup.add(deedGroup);

  const deedFolioGeo = trackGeo(new THREE.BoxGeometry(1.18, 0.56, 0.14));
  const deedFolioMat = createFlatBandMaterial(PALETTE.paper);
  const deedFolioMesh = new THREE.Mesh(deedFolioGeo, deedFolioMat);
  addInkOutline(deedFolioMesh, deedFolioGeo);
  deedGroup.add(deedFolioMesh);

  const deedWaxGeo = trackGeo(new THREE.OctahedronGeometry(0.22, 0));
  const deedWaxMat = createFlatBandMaterial(PALETTE.heirMustard, PALETTE.heirMustard, 0.15);
  const deedWaxMesh = new THREE.Mesh(deedWaxGeo, deedWaxMat);
  deedWaxMesh.position.set(0, 0.12, 0.12);
  addInkOutline(deedWaxMesh, deedWaxGeo, 10);
  deedGroup.add(deedWaxMesh);

  // Four archive feet at the bottom
  const footGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.14, 0.32));
  const footMat = createFlatBandMaterial(PALETTE.ironDark);
  for (const fx of [-0.88, 0.88]) {
    for (const fz of [-0.46, 0.46]) {
      const foot = new THREE.Mesh(footGeo, footMat);
      foot.position.set(fx, -0.92, fz);
      addInkOutline(foot, footGeo);
      strongboxGroup.add(foot);
    }
  }

  // ============================================================================
  // 2. HINGED LID & DEADLINE RING (Tutup Berengsel + Ring Tenggat)
  // ============================================================================
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.61, -0.68);
  strongboxGroup.add(lidPivot);

  const lidShape = createRoundedRectShape(2.42, 1.44, 0.18);
  const lidGeo = trackGeo(
    new THREE.ExtrudeGeometry(lidShape, {
      depth: 0.26,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.035,
      bevelSegments: 2,
      steps: 1,
    }),
  );
  lidGeo.rotateX(Math.PI / 2);
  lidGeo.translate(0, 0.26, 0.68);

  const lidMat = createFlatBandMaterial(PALETTE.bodyMain);
  const lidMesh = new THREE.Mesh(lidGeo, lidMat);
  addInkOutline(lidMesh, lidGeo, 20);
  lidPivot.add(lidMesh);

  // Top archive handle (Owner Blue accent)
  const handleBarGeo = trackGeo(new THREE.BoxGeometry(0.76, 0.09, 0.14));
  const handleMat = createFlatBandMaterial(PALETTE.ownerBlue);
  const handleBar = new THREE.Mesh(handleBarGeo, handleMat);
  handleBar.position.set(0, 0.36, 0.68);
  addInkOutline(handleBar, handleBarGeo);
  lidPivot.add(handleBar);

  // Front clasp lip on lid
  const claspGeo = trackGeo(new THREE.BoxGeometry(0.52, 0.22, 0.1));
  const claspMat = createFlatBandMaterial(PALETTE.ironDark);
  const claspMesh = new THREE.Mesh(claspGeo, claspMat);
  claspMesh.position.set(0, 0.06, 1.41);
  addInkOutline(claspMesh, claspGeo);
  lidPivot.add(claspMesh);

  // Engraved Deadline Ring around the lid perimeter
  const ringGroup = new THREE.Group();
  ringGroup.position.set(0, 0.28, 0.68);
  ringGroup.rotation.x = Math.PI / 2;
  lidPivot.add(ringGroup);

  const ringBaseGeo = trackGeo(new THREE.TorusGeometry(0.68, 0.032, 8, 36));
  const ringBaseMat = createFlatBandMaterial(PALETTE.ironDark);
  const ringBaseMesh = new THREE.Mesh(ringBaseGeo, ringBaseMat);
  ringGroup.add(ringBaseMesh);

  // Primary deadline arc (Heir Mustard)
  const ringPrimaryGeo = trackGeo(new THREE.TorusGeometry(0.68, 0.052, 10, 32, Math.PI * 1.25));
  const ringPrimaryMat = createFlatBandMaterial(PALETTE.heirMustard, PALETTE.heirMustard, 0.1);
  const ringPrimaryMesh = new THREE.Mesh(ringPrimaryGeo, ringPrimaryMat);
  ringPrimaryMesh.rotation.z = -Math.PI * 0.62;
  addInkOutline(ringPrimaryMesh, ringPrimaryGeo, 25);
  ringGroup.add(ringPrimaryMesh);

  // Challenge extension arc (Rival Red — extends deadline once)
  const ringExtGeo = trackGeo(new THREE.TorusGeometry(0.68, 0.058, 10, 20, Math.PI * 0.68));
  const ringExtMat = createFlatBandMaterial(PALETTE.rivalRed, PALETTE.rivalRed, 0.12);
  const ringExtMesh = new THREE.Mesh(ringExtGeo, ringExtMat);
  ringExtMesh.rotation.z = Math.PI * 0.65;
  addInkOutline(ringExtMesh, ringExtGeo, 25);
  ringGroup.add(ringExtMesh);

  // ============================================================================
  // 3. TWO FRONT SEALS: SEAL H (Heir) & SEAL R (Rival) + RIVAL CLAMP
  // ============================================================================
  function createSealGroup(color: number, isHeir: boolean) {
    const group = new THREE.Group();

    const discGeo = trackGeo(new THREE.CylinderGeometry(0.39, 0.42, 0.16, 18));
    discGeo.rotateX(Math.PI / 2);
    const discMat = createFlatBandMaterial(color, color, 0.06);
    const discMesh = new THREE.Mesh(discGeo, discMat);
    addInkOutline(discMesh, discGeo, 18);
    group.add(discMesh);

    const rimGeo = trackGeo(new THREE.TorusGeometry(0.31, 0.03, 8, 18));
    const rimMat = createFlatBandMaterial(PALETTE.ironDark);
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.z = 0.08;
    group.add(rimMesh);

    // Geometric mechanical key-bars (H shape vs R-slash shape without text fonts)
    const barMat = createFlatBandMaterial(PALETTE.ink);
    if (isHeir) {
      const pillarGeo = trackGeo(new THREE.BoxGeometry(0.065, 0.28, 0.06));
      const bridgeGeo = trackGeo(new THREE.BoxGeometry(0.2, 0.065, 0.06));
      const leftBar = new THREE.Mesh(pillarGeo, barMat);
      leftBar.position.set(-0.08, 0, 0.09);
      const rightBar = new THREE.Mesh(pillarGeo, barMat);
      rightBar.position.set(0.08, 0, 0.09);
      const midBar = new THREE.Mesh(bridgeGeo, barMat);
      midBar.position.set(0, 0, 0.09);
      group.add(leftBar, rightBar, midBar);
    } else {
      const stemGeo = trackGeo(new THREE.BoxGeometry(0.065, 0.28, 0.06));
      const loopGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.13, 0.06));
      const legGeo = trackGeo(new THREE.BoxGeometry(0.065, 0.16, 0.06));
      const stem = new THREE.Mesh(stemGeo, barMat);
      stem.position.set(-0.07, 0, 0.09);
      const loop = new THREE.Mesh(loopGeo, barMat);
      loop.position.set(0.02, 0.07, 0.09);
      const leg = new THREE.Mesh(legGeo, barMat);
      leg.position.set(0.06, -0.07, 0.09);
      leg.rotation.z = -0.45;
      group.add(stem, loop, leg);
    }

    return { group, discMat };
  }

  const sealH = createSealGroup(PALETTE.heirMustard, true);
  sealH.group.position.set(-0.52, -0.14, 0.84);
  strongboxGroup.add(sealH.group);

  const sealR = createSealGroup(PALETTE.rivalRed, false);
  sealR.group.position.set(0.52, -0.14, 0.84);
  strongboxGroup.add(sealR.group);

  // Rival Challenge Clamp Arm (locks across from Seal R to Seal H during Challenged/Busted)
  const clampGroup = new THREE.Group();
  clampGroup.position.set(0.52, -0.14, 0.78);
  strongboxGroup.add(clampGroup);

  const clampBarGeo = trackGeo(new THREE.BoxGeometry(1.08, 0.16, 0.08));
  clampBarGeo.translate(-0.54, 0, 0);
  const clampBarMat = createFlatBandMaterial(PALETTE.rivalRed, PALETTE.rivalRed, 0.08);
  const clampBarMesh = new THREE.Mesh(clampBarGeo, clampBarMat);
  addInkOutline(clampBarMesh, clampBarGeo);
  clampGroup.add(clampBarMesh);
  clampGroup.scale.x = 0.001;

  // ============================================================================
  // 4. OWNER HEARTBEAT DIAL (Dial Detak Jantung di Sisi Kiri)
  // ============================================================================
  const dialGroup = new THREE.Group();
  dialGroup.position.set(-1.24, -0.08, 0.05);
  dialGroup.rotation.y = -Math.PI / 2;
  strongboxGroup.add(dialGroup);

  const dialPlateGeo = trackGeo(new THREE.CylinderGeometry(0.42, 0.44, 0.12, 20));
  dialPlateGeo.rotateX(Math.PI / 2);
  const dialPlateMat = createFlatBandMaterial(PALETTE.ownerBlue, PALETTE.ownerBlue, 0.08);
  const dialPlateMesh = new THREE.Mesh(dialPlateGeo, dialPlateMat);
  addInkOutline(dialPlateMesh, dialPlateGeo, 18);
  dialGroup.add(dialPlateMesh);

  const dialFaceGeo = trackGeo(new THREE.CylinderGeometry(0.33, 0.33, 0.13, 20));
  dialFaceGeo.rotateX(Math.PI / 2);
  const dialFaceMat = createFlatBandMaterial(PALETTE.paper);
  const dialFaceMesh = new THREE.Mesh(dialFaceGeo, dialFaceMat);
  dialGroup.add(dialFaceMesh);

  // 8 tick marks around the heartbeat dial
  const tickGeo = trackGeo(new THREE.BoxGeometry(0.035, 0.08, 0.03));
  const tickMat = createFlatBandMaterial(PALETTE.ink);
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i;
    const tick = new THREE.Mesh(tickGeo, tickMat);
    tick.position.set(Math.sin(angle) * 0.25, Math.cos(angle) * 0.25, 0.075);
    tick.rotation.z = -angle;
    dialGroup.add(tick);
  }

  // Rotating heartbeat needle
  const needlePivot = new THREE.Group();
  needlePivot.position.set(0, 0, 0.085);
  dialGroup.add(needlePivot);

  const needleGeo = trackGeo(new THREE.BoxGeometry(0.055, 0.24, 0.04));
  needleGeo.translate(0, 0.09, 0);
  const needleMat = createFlatBandMaterial(PALETTE.ownerBlue);
  const needleMesh = new THREE.Mesh(needleGeo, needleMat);
  addInkOutline(needleMesh, needleGeo);
  needlePivot.add(needleMesh);

  // ============================================================================
  // 5. POSE ANIMATION STATE & DRAG-TO-ROTATE INTERACTION
  // ============================================================================
  const pose = {
    lidAngle: 0,
    deedLift: 0,
    sealHDepth: 0.84,
    sealHRot: 0,
    sealRDepth: 0.84,
    sealRRot: 0,
    clampScale: 0.001,
    ringPrimaryScale: 0.2,
    ringExtScale: 0.001,
    dialSpeed: 0.35,
    boxBounceY: 0,
  };

  const intro = { scale: 0.86 };
  gsap.to(intro, { scale: 1, duration: 0.9, ease: 'expo.out' });

  let previousSignature = '';
  let previousOutcome = 'None';
  let lastResetTrigger = sceneInput.resetTrigger;
  let shakeStart = -10;
  let lastSeconds = 0;

  // Drag-to-rotate state with inertia and mobile vertical-scroll protection
  let dragMode: 'idle' | 'pending' | 'dragging' | 'scrolling' = 'idle';
  let activePointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let lastDragX = 0;
  let lastDragY = 0;
  let velocityYaw = 0;
  let velocityPitch = 0;

  function isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest('button, a, input, select, textarea, label, [role="button"], [data-no-scene-drag]'),
    );
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    if (isInteractiveTarget(event.target)) return;
    if (!isPointInsideSceneAnchor(event.clientX, event.clientY)) return;

    activePointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    lastDragX = event.clientX;
    lastDragY = event.clientY;
    velocityYaw = 0;
    velocityPitch = 0;
    dragMode = event.pointerType === 'touch' ? 'pending' : 'dragging';
  };

  const onPointerMove = (event: PointerEvent) => {
    if (activePointerId === null || event.pointerId !== activePointerId) return;

    const totalDx = event.clientX - startX;
    const totalDy = event.clientY - startY;

    if (dragMode === 'pending') {
      // Mobile Touch Safety: If vertical movement is dominant, release to native vertical page scroll!
      if (Math.abs(totalDy) > Math.abs(totalDx) && Math.abs(totalDy) > 6) {
        dragMode = 'scrolling';
        activePointerId = null;
        return;
      }
      if (Math.abs(totalDx) > 6 && Math.abs(totalDx) > Math.abs(totalDy)) {
        dragMode = 'dragging';
      } else {
        return;
      }
    }

    if (dragMode !== 'dragging') return;

    const dx = event.clientX - lastDragX;
    const dy = event.clientY - lastDragY;
    lastDragX = event.clientX;
    lastDragY = event.clientY;

    const deltaYaw = dx * 0.0085;
    const deltaPitch = dy * 0.0055;

    sceneInput.dragYaw += deltaYaw;
    sceneInput.dragPitch = Math.max(-0.6, Math.min(0.6, sceneInput.dragPitch + deltaPitch));
    velocityYaw = deltaYaw;
    velocityPitch = deltaPitch;

    if (!sceneInput.hasInteracted && (Math.abs(totalDx) > 4 || Math.abs(totalDy) > 4)) {
      sceneInput.hasInteracted = true;
    }
  };

  const onPointerEnd = (event: PointerEvent) => {
    if (activePointerId !== null && event.pointerId === activePointerId) {
      activePointerId = null;
      dragMode = 'idle';
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isInteractiveTarget(event.target)) return;
    if (event.key === 'ArrowLeft') {
      sceneInput.dragYaw -= 0.18;
      sceneInput.hasInteracted = true;
    } else if (event.key === 'ArrowRight') {
      sceneInput.dragYaw += 0.18;
      sceneInput.hasInteracted = true;
    } else if (event.key === 'ArrowUp') {
      sceneInput.dragPitch = Math.max(-0.6, sceneInput.dragPitch - 0.12);
      sceneInput.hasInteracted = true;
    } else if (event.key === 'ArrowDown') {
      sceneInput.dragPitch = Math.min(0.6, sceneInput.dragPitch + 0.12);
      sceneInput.hasInteracted = true;
    }
  };

  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerEnd, { passive: true });
  window.addEventListener('pointercancel', onPointerEnd, { passive: true });
  window.addEventListener('keydown', onKeyDown);

  let width = 0;
  let height = 0;
  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  resize();
  window.addEventListener('resize', resize);

  function applyStateTransition(seconds: number) {
    const derived = deriveStrongboxPose(sceneInput);
    const sig = `${sceneInput.status}:${sceneInput.outcome}:${derived.sealH}:${derived.sealR}:${derived.lidOpen}:${sceneInput.roleFocus ?? ''}`;

    if (sig !== previousSignature) {
      previousSignature = sig;

      gsap.to(pose, {
        lidAngle: -derived.lidOpen * 1.16,
        deedLift: derived.lidOpen * 0.46,
        sealHDepth: derived.sealH ? 0.74 : 0.84,
        sealHRot: derived.sealH ? Math.PI * 0.5 : 0,
        sealRDepth: derived.sealR ? 0.74 : 0.84,
        sealRRot: derived.sealR ? -Math.PI * 0.5 : 0,
        clampScale: derived.clampLocked ? 1 : 0.001,
        ringPrimaryScale: derived.ringFill,
        ringExtScale: derived.ringExtended ? 1 : 0.001,
        dialSpeed: derived.dialSpeed,
        duration: 0.6,
        ease: 'expo.inOut',
        overwrite: 'auto',
      });

      // Dial & Seal color emphasis
      const dialColor =
        sceneInput.status === 'Finalized'
          ? PALETTE.finalGreen
          : derived.dialAlert
            ? PALETTE.rivalRed
            : PALETTE.ownerBlue;
      dialPlateMat.color.setHex(dialColor);
      needleMat.color.setHex(dialColor);

      // Role focus highlight
      sealH.discMat.emissiveIntensity =
        sceneInput.roleFocus === 'heir' || derived.sealH ? 0.18 : 0.05;
      sealR.discMat.emissiveIntensity =
        sceneInput.roleFocus === 'rival' || derived.sealR ? 0.2 : 0.05;
      dialPlateMat.emissiveIntensity =
        sceneInput.roleFocus === 'owner' ? 0.22 : 0.06;

      if (sceneInput.status === 'Challenged') {
        shakeStart = seconds - 0.15;
      }
    }

    if (sceneInput.outcome !== previousOutcome) {
      previousOutcome = sceneInput.outcome;

      if (previousOutcome === 'FalseAlarm') {
        // Lid bounces shut and Seal H pops loose
        gsap.fromTo(
          pose,
          { boxBounceY: 0.14, lidAngle: -0.22 },
          { boxBounceY: 0, lidAngle: 0, duration: 0.6, ease: 'expo.inOut' },
        );
      } else if (previousOutcome === 'Busted') {
        // Lid bounces + 0.3s camera shake + Seal R clamp flash
        shakeStart = seconds;
        gsap.fromTo(
          pose,
          { boxBounceY: -0.12, clampScale: 1 },
          { boxBounceY: 0, clampScale: 1, duration: 0.6, ease: 'expo.inOut' },
        );
      }
    }

    if (sceneInput.resetTrigger !== lastResetTrigger) {
      lastResetTrigger = sceneInput.resetTrigger;
      velocityYaw = 0;
      velocityPitch = 0;
    }
  }

  function frame(seconds: number) {
    const delta = lastSeconds ? Math.min(seconds - lastSeconds, 0.05) : 0;
    lastSeconds = seconds;

    const place = scenePlacement();
    if (!place.visible) {
      canvas.style.visibility = 'hidden';
      return;
    }
    canvas.style.visibility = 'visible';

    applyStateTransition(seconds);

    // Inertia & subtle idle rotation when not actively dragging
    if (dragMode !== 'dragging') {
      sceneInput.dragYaw += velocityYaw;
      sceneInput.dragPitch = Math.max(-0.6, Math.min(0.6, sceneInput.dragPitch + velocityPitch));
      velocityYaw *= 0.92;
      velocityPitch *= 0.92;
      if (Math.abs(velocityYaw) < 0.0001) velocityYaw = 0;
      if (Math.abs(velocityPitch) < 0.0001) velocityPitch = 0;

      // Gentle idle spin
      sceneInput.dragYaw += delta * 0.09;
    }

    // Screen-to-world placement matching active section anchor
    const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 10.2;
    const scale = ((place.size / Math.max(1, height)) * viewHeight) / 3.9;
    const targetX = (place.x / Math.max(1, width) - 0.5) * viewHeight * camera.aspect;
    const targetY = (0.5 - place.y / Math.max(1, height)) * viewHeight + pose.boxBounceY;

    root.position.x = THREE.MathUtils.lerp(root.position.x, targetX, 0.16);
    root.position.y = THREE.MathUtils.lerp(root.position.y, targetY, 0.16);
    root.scale.setScalar(scale * intro.scale);

    // Rotation combines base isometric angle + scroll progress (<= 0.55 rad) + pointer parallax (<= 0.08 rad) + user drag
    const scrollYaw = Math.max(0, Math.min(1, sceneInput.progress)) * 0.55;
    const parallaxYaw = Math.max(-0.08, Math.min(0.08, sceneInput.pointerX * 0.16));
    const parallaxPitch = Math.max(-0.08, Math.min(0.08, sceneInput.pointerY * 0.12));

    root.rotation.y = -0.38 + scrollYaw + parallaxYaw + sceneInput.dragYaw;
    root.rotation.x = Math.max(
      -0.6,
      Math.min(0.6, 0.26 + parallaxPitch + sceneInput.dragPitch),
    );

    // Apply animated pose to strongbox mechanisms
    lidPivot.rotation.x = pose.lidAngle;
    deedGroup.position.y = 0.42 + pose.deedLift;
    deedWaxMesh.rotation.y += delta * 0.9;

    sealH.group.position.z = pose.sealHDepth;
    if (pose.sealHDepth > 0.79) {
      // Unlocked seal rotates freely and gently
      sealH.group.rotation.z += delta * 0.28;
    } else {
      sealH.group.rotation.z = pose.sealHRot;
    }

    sealR.group.position.z = pose.sealRDepth;
    if (pose.sealRDepth > 0.79) {
      sealR.group.rotation.z -= delta * 0.24;
    } else {
      sealR.group.rotation.z = pose.sealRRot;
    }

    clampGroup.scale.x = Math.max(0.001, pose.clampScale);
    ringPrimaryMesh.scale.setScalar(Math.max(0.001, pose.ringPrimaryScale));
    ringExtMesh.scale.setScalar(Math.max(0.001, pose.ringExtScale));

    if (pose.dialSpeed > 0) {
      needlePivot.rotation.z -= delta * pose.dialSpeed;
    } else {
      needlePivot.rotation.z = 0;
    }

    // 0.3s Camera shake on Busted / Challenged impact
    const shakeElapsed = seconds - shakeStart;
    const shakeOffset =
      shakeElapsed >= 0 && shakeElapsed < 0.3
        ? Math.sin(shakeElapsed * 95) * 0.045 * (1 - shakeElapsed / 0.3)
        : 0;
    camera.position.x = shakeOffset;

    renderer.render(scene, camera);
  }

  return {
    frame,
    dispose() {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      window.removeEventListener('keydown', onKeyDown);
      gsap.killTweensOf([pose, intro]);
      gradientMap.dispose();
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      renderer.dispose();
    },
  };
}
