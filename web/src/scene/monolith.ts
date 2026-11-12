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
  envelopeBase: 0xeae1cc,
  envelopeCream: 0xfff8e8,
  goldGleam: 0xf5d061,
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

function createEnvelopePocketShape(width: number, height: number): THREE.Shape {
  const shape = new THREE.Shape();
  const halfW = width / 2;
  const halfH = height / 2;
  shape.moveTo(-halfW, -halfH);
  shape.lineTo(halfW, -halfH);
  shape.lineTo(halfW, halfH * 0.65);
  shape.lineTo(0, -halfH * 0.12);
  shape.lineTo(-halfW, halfH * 0.65);
  shape.closePath();
  return shape;
}

function createEnvelopeFlapShape(width: number, flapDrop: number): THREE.Shape {
  const shape = new THREE.Shape();
  const halfW = width / 2;
  shape.moveTo(-halfW, 0);
  shape.lineTo(halfW, 0);
  shape.lineTo(0, -flapDrop);
  shape.closePath();
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
      opacity: 0.94,
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
  strongboxGroup.position.y = -0.22;
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
  // 5. INCLINED ORBIT TRACK + TWO ORBITING SEAL COINS (Koin Segel H & Koin Segel R)
  // ============================================================================
  const orbitSystemGroup = new THREE.Group();
  orbitSystemGroup.position.set(0, 0.02, 0);
  orbitSystemGroup.rotation.set(1.18, 0, -0.24);
  strongboxGroup.add(orbitSystemGroup);

  const ORBIT_RADIUS = 1.94;
  const orbitTrackGeo = trackGeo(new THREE.TorusGeometry(ORBIT_RADIUS, 0.022, 8, 52));
  const orbitTrackMat = createFlatBandMaterial(PALETTE.ironDark);
  const orbitTrackMesh = new THREE.Mesh(orbitTrackGeo, orbitTrackMat);
  addInkOutline(orbitTrackMesh, orbitTrackGeo, 28);
  orbitSystemGroup.add(orbitTrackMesh);

  const orbitInnerTrackGeo = trackGeo(new THREE.TorusGeometry(ORBIT_RADIUS - 0.14, 0.011, 6, 40));
  const orbitInnerTrackMat = createFlatBandMaterial(PALETTE.bodyTrim);
  const orbitInnerTrackMesh = new THREE.Mesh(orbitInnerTrackGeo, orbitInnerTrackMat);
  orbitSystemGroup.add(orbitInnerTrackMesh);

  const orbitSpinnerGroup = new THREE.Group();
  orbitSystemGroup.add(orbitSpinnerGroup);

  function createOrbitingSealCoin(color: number, kind: 'owner' | 'heir' | 'rival') {
    const coinAnchor = new THREE.Group();
    const coinSpin = new THREE.Group();
    coinAnchor.add(coinSpin);

    const coinDiscGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.09, 20));
    coinDiscGeo.rotateX(Math.PI / 2);
    const coinDiscMat = createFlatBandMaterial(color, color, 0.08);
    const coinDiscMesh = new THREE.Mesh(coinDiscGeo, coinDiscMat);
    addInkOutline(coinDiscMesh, coinDiscGeo, 18);
    coinSpin.add(coinDiscMesh);

    const coinRimGeo = trackGeo(new THREE.TorusGeometry(0.24, 0.022, 8, 18));
    const coinRimMat = createFlatBandMaterial(PALETTE.ironDark);
    const frontRim = new THREE.Mesh(coinRimGeo, coinRimMat);
    frontRim.position.z = 0.048;
    const backRim = new THREE.Mesh(coinRimGeo, coinRimMat);
    backRim.position.z = -0.048;
    coinSpin.add(frontRim, backRim);

    const glyphMat = createFlatBandMaterial(kind === 'heir' ? PALETTE.ink : PALETTE.paper);
    if (kind === 'heir') {
      const vBarGeo = trackGeo(new THREE.BoxGeometry(0.055, 0.22, 0.12));
      const hBarGeo = trackGeo(new THREE.BoxGeometry(0.16, 0.055, 0.12));
      const leftV = new THREE.Mesh(vBarGeo, glyphMat);
      leftV.position.set(-0.065, 0, 0);
      const rightV = new THREE.Mesh(vBarGeo, glyphMat);
      rightV.position.set(0.065, 0, 0);
      const midH = new THREE.Mesh(hBarGeo, glyphMat);
      midH.position.set(0, 0, 0);
      coinSpin.add(leftV, rightV, midH);
    } else if (kind === 'rival') {
      const stemGeo = trackGeo(new THREE.BoxGeometry(0.055, 0.22, 0.12));
      const bowlGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.1, 0.12));
      const legGeo = trackGeo(new THREE.BoxGeometry(0.055, 0.13, 0.12));
      const stem = new THREE.Mesh(stemGeo, glyphMat);
      stem.position.set(-0.055, 0, 0);
      const bowl = new THREE.Mesh(bowlGeo, glyphMat);
      bowl.position.set(0.015, 0.055, 0);
      const leg = new THREE.Mesh(legGeo, glyphMat);
      leg.position.set(0.045, -0.055, 0);
      leg.rotation.z = -0.45;
      coinSpin.add(stem, bowl, leg);
    } else {
      // Owner coin: clock-ring + heartbeat hands
      const ringGeo = trackGeo(new THREE.TorusGeometry(0.11, 0.025, 8, 16));
      const ringMeshF = new THREE.Mesh(ringGeo, glyphMat);
      ringMeshF.position.z = 0.05;
      const ringMeshB = new THREE.Mesh(ringGeo, glyphMat);
      ringMeshB.position.z = -0.05;
      const handVGeo = trackGeo(new THREE.BoxGeometry(0.038, 0.11, 0.12));
      const handHGeo = trackGeo(new THREE.BoxGeometry(0.09, 0.038, 0.12));
      const handV = new THREE.Mesh(handVGeo, glyphMat);
      handV.position.set(0, 0.03, 0);
      const handH = new THREE.Mesh(handHGeo, glyphMat);
      handH.position.set(0.025, 0, 0);
      coinSpin.add(ringMeshF, ringMeshB, handV, handH);
    }

    return { coinAnchor, coinSpin, coinDiscMat };
  }

  const coinH = createOrbitingSealCoin(PALETTE.heirMustard, 'heir');
  coinH.coinAnchor.position.set(ORBIT_RADIUS, 0, 0);
  coinH.coinAnchor.rotation.x = -Math.PI / 2;
  orbitSpinnerGroup.add(coinH.coinAnchor);

  const coinR = createOrbitingSealCoin(PALETTE.rivalRed, 'rival');
  coinR.coinAnchor.position.set(
    Math.cos((Math.PI * 2) / 3) * ORBIT_RADIUS,
    Math.sin((Math.PI * 2) / 3) * ORBIT_RADIUS,
    0,
  );
  coinR.coinAnchor.rotation.x = -Math.PI / 2;
  orbitSpinnerGroup.add(coinR.coinAnchor);

  const coinO = createOrbitingSealCoin(PALETTE.ownerBlue, 'owner');
  coinO.coinAnchor.position.set(
    Math.cos((Math.PI * 4) / 3) * ORBIT_RADIUS,
    Math.sin((Math.PI * 4) / 3) * ORBIT_RADIUS,
    0,
  );
  coinO.coinAnchor.rotation.x = -Math.PI / 2;
  orbitSpinnerGroup.add(coinO.coinAnchor);

  // ============================================================================
  // 6. FLOATING DEED ENVELOPE + GOLD GLEAM (Amplop Akta Melayang + Kilau Emas)
  // ============================================================================
  const envelopeGroup = new THREE.Group();
  envelopeGroup.position.set(0, 1.56, 0.06);
  strongboxGroup.add(envelopeGroup);

  // Envelope base body (#EAE1CC with #16130D 2px-style ink border)
  const envBodyShape = createRoundedRectShape(1.48, 0.92, 0.06);
  const envBodyGeo = trackGeo(
    new THREE.ExtrudeGeometry(envBodyShape, {
      depth: 0.07,
      bevelEnabled: false,
      steps: 1,
    }),
  );
  envBodyGeo.translate(0, 0, -0.035);
  const envBodyMat = createFlatBandMaterial(PALETTE.envelopeBase);
  const envBodyMesh = new THREE.Mesh(envBodyGeo, envBodyMat);
  addInkOutline(envBodyMesh, envBodyGeo, 15);
  envelopeGroup.add(envBodyMesh);

  // Inner Deed Parchment Card (#FFF8E8) that slides up when envelope opens
  const envCardGroup = new THREE.Group();
  envCardGroup.position.set(0, 0.02, 0.005);
  envelopeGroup.add(envCardGroup);

  const envCardGeo = trackGeo(new THREE.BoxGeometry(1.26, 0.76, 0.032));
  const envCardMat = createFlatBandMaterial(PALETTE.envelopeCream);
  const envCardMesh = new THREE.Mesh(envCardGeo, envCardMat);
  addInkOutline(envCardMesh, envCardGeo, 15);
  envCardGroup.add(envCardMesh);

  // Two ink ledger lines on the inner parchment card
  const ruleLineGeo = trackGeo(new THREE.BoxGeometry(0.84, 0.03, 0.038));
  const ruleLineMat = createFlatBandMaterial(PALETTE.ink);
  const ruleLineTop = new THREE.Mesh(ruleLineGeo, ruleLineMat);
  ruleLineTop.position.set(0, 0.18, 0);
  const ruleLineBot = new THREE.Mesh(ruleLineGeo, ruleLineMat);
  ruleLineBot.position.set(0, 0.05, 0);
  envCardGroup.add(ruleLineTop, ruleLineBot);

  // Front V-fold pocket (#FFF8E8 with #16130D ink outline)
  const pocketShape = createEnvelopePocketShape(1.44, 0.88);
  const pocketGeo = trackGeo(
    new THREE.ExtrudeGeometry(pocketShape, {
      depth: 0.026,
      bevelEnabled: false,
      steps: 1,
    }),
  );
  pocketGeo.translate(0, 0, 0.025);
  const pocketMat = createFlatBandMaterial(PALETTE.envelopeCream);
  const pocketMesh = new THREE.Mesh(pocketGeo, pocketMat);
  addInkOutline(pocketMesh, pocketGeo, 12);
  envelopeGroup.add(pocketMesh);

  // Top Hinged Envelope Flap (rotates open on Finalized)
  const flapPivot = new THREE.Group();
  flapPivot.position.set(0, 0.45, 0.042);
  envelopeGroup.add(flapPivot);

  const flapShape = createEnvelopeFlapShape(1.44, 0.52);
  const flapGeo = trackGeo(
    new THREE.ExtrudeGeometry(flapShape, {
      depth: 0.024,
      bevelEnabled: false,
      steps: 1,
    }),
  );
  const flapMat = createFlatBandMaterial(PALETTE.envelopeBase);
  const flapMesh = new THREE.Mesh(flapGeo, flapMat);
  addInkOutline(flapMesh, flapGeo, 12);
  flapPivot.add(flapMesh);

  // Wax Seal on the tip of the envelope flap
  const flapSealGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.15, 0.045, 16));
  flapSealGeo.rotateX(Math.PI / 2);
  const flapSealMat = createFlatBandMaterial(PALETTE.ownerBlue, PALETTE.ownerBlue, 0.1);
  const flapSealMesh = new THREE.Mesh(flapSealGeo, flapSealMat);
  flapSealMesh.position.set(0, -0.44, 0.026);
  addInkOutline(flapSealMesh, flapSealGeo, 18);
  flapPivot.add(flapSealMesh);

  // Gold Gleam / Inheritance Crest (#F5D061) emerging when Finalized
  const gleamGroup = new THREE.Group();
  gleamGroup.position.set(0, 0.25, 0.04);
  gleamGroup.scale.setScalar(0.001);
  envelopeGroup.add(gleamGroup);

  const gleamCoreGeo = trackGeo(new THREE.OctahedronGeometry(0.24, 0));
  const gleamMat = createFlatBandMaterial(PALETTE.goldGleam, PALETTE.goldGleam, 0.34);
  const gleamCoreMesh = new THREE.Mesh(gleamCoreGeo, gleamMat);
  addInkOutline(gleamCoreMesh, gleamCoreGeo, 12);
  gleamGroup.add(gleamCoreMesh);

  const gleamHaloGeo = trackGeo(new THREE.TorusGeometry(0.39, 0.024, 8, 28));
  const gleamHaloMesh = new THREE.Mesh(gleamHaloGeo, gleamMat);
  addInkOutline(gleamHaloMesh, gleamHaloGeo, 24);
  gleamGroup.add(gleamHaloMesh);

  const gleamRaysGroup = new THREE.Group();
  gleamGroup.add(gleamRaysGroup);

  const rayGeo = trackGeo(new THREE.OctahedronGeometry(0.075, 0));
  rayGeo.scale(0.65, 2.1, 0.65);
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI / 2) * i + Math.PI / 4;
    const rayMesh = new THREE.Mesh(rayGeo, gleamMat);
    rayMesh.position.set(Math.cos(angle) * 0.48, Math.sin(angle) * 0.48, 0);
    rayMesh.rotation.z = angle - Math.PI / 2;
    addInkOutline(rayMesh, rayGeo, 12);
    gleamRaysGroup.add(rayMesh);
  }

  // ============================================================================
  // 7. POSE ANIMATION STATE & DRAG-TO-ROTATE INTERACTION
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
    orbitSpeed: 0.42,
    orbitTilt: 0.34,
    coinHScale: 1,
    coinRScale: 1,
    coinHRadiusOffset: 0,
    coinRRadiusOffset: 0,
    envelopeFlapAngle: 0,
    envelopeCardLift: 0,
    gleamScale: 0.001,
    gleamLift: 0,
  };

  const intro = { scale: 0.86 };
  gsap.to(intro, { scale: 1, duration: 0.9, ease: 'expo.out' });

  let previousSignature = '';
  let previousOutcome = 'None';
  let lastResetTrigger = sceneInput.resetTrigger;
  let shakeStart = -10;
  let lastSeconds = 0;
  let smoothedScrollYaw = 0;
  let smoothedParallaxYaw = 0;
  let smoothedParallaxPitch = 0;

  // Peripheral side-arc transition state (routes 3D strongbox along screen margins so it never covers center text)
  let lastAnchorId: string | null = null;
  let arcT = 1;
  let arcStartX = 0;
  let arcStartY = 0;
  let arcWaypointX = 0;
  let arcStartTime = 0;
  const ARC_DURATION = 0.65;

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

    // Prevent accidental text selection when starting a 3D model rotation drag
    if (event.cancelable) {
      event.preventDefault();
    }
    window.getSelection()?.removeAllRanges();
    document.body.classList.add('is-scene-dragging');

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
        document.body.classList.remove('is-scene-dragging');
        return;
      }
      if (Math.abs(totalDx) > 6 && Math.abs(totalDx) > Math.abs(totalDy)) {
        dragMode = 'dragging';
      } else {
        return;
      }
    }

    if (dragMode !== 'dragging') return;

    // Keep text selection cleared while rotating 3D models across sections
    window.getSelection()?.removeAllRanges();

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
      document.body.classList.remove('is-scene-dragging');
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

  window.addEventListener('pointerdown', onPointerDown, { passive: false });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerEnd, { passive: true });
  window.addEventListener('pointercancel', onPointerEnd, { passive: true });
  window.addEventListener('keydown', onKeyDown);

  let width = 0;
  let height = 0;
  let lidAutoCloseTimer: number | null = null;
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
    const isScrubbingLid = sceneInput.lidOpen !== null;
    const lidSig = isScrubbingLid ? 'scrub' : derived.lidOpen.toFixed(1);
    const sig = `${sceneInput.status}:${sceneInput.outcome}:${derived.sealH}:${derived.sealR}:${lidSig}:${sceneInput.roleFocus ?? ''}`;

    if (sig !== previousSignature) {
      previousSignature = sig;

      if (lidAutoCloseTimer !== null) {
        window.clearTimeout(lidAutoCloseTimer);
        lidAutoCloseTimer = null;
      }

      gsap.to(pose, {
        lidAngle: isScrubbingLid ? pose.lidAngle : -derived.lidOpen * 1.16,
        deedLift: isScrubbingLid ? pose.deedLift : derived.lidOpen * 0.46,
        sealHDepth: derived.sealH ? 0.74 : 0.84,
        sealHRot: derived.sealH ? Math.PI * 0.5 : 0,
        sealRDepth: derived.sealR ? 0.74 : 0.84,
        sealRRot: derived.sealR ? -Math.PI * 0.5 : 0,
        clampScale: derived.clampLocked ? 1 : 0.001,
        ringPrimaryScale: derived.ringFill,
        ringExtScale: derived.ringExtended ? 1 : 0.001,
        dialSpeed: derived.dialSpeed,
        orbitSpeed: derived.orbitSpeed,
        orbitTilt: derived.orbitTilt,
        coinHScale: derived.coinHActive ? 1.16 : 1,
        coinRScale: derived.coinRActive ? 1.18 : 1,
        envelopeFlapAngle: isScrubbingLid ? pose.envelopeFlapAngle : -derived.envelopeOpen * Math.PI * 0.86,
        envelopeCardLift: isScrubbingLid ? pose.envelopeCardLift : derived.envelopeOpen * 0.24,
        gleamScale: isScrubbingLid ? pose.gleamScale : (derived.gleamIntensity > 0.01 ? derived.gleamIntensity : 0.001),
        gleamLift: isScrubbingLid ? pose.gleamLift : derived.gleamIntensity * 0.44,
        duration: 0.55,
        ease: 'power2.out',
        overwrite: 'auto',
      });

      // Auto-close strongbox lid and deed after 5 seconds ONLY for discrete finalized state (not during scroll scrub!)
      if (!isScrubbingLid && derived.lidOpen > 0.05) {
        lidAutoCloseTimer = window.setTimeout(() => {
          gsap.to(pose, {
            lidAngle: 0,
            deedLift: 0,
            envelopeFlapAngle: 0,
            envelopeCardLift: 0,
            gleamScale: 0.001,
            gleamLift: 0,
            duration: 0.85,
            ease: 'power2.inOut',
          });
          lidAutoCloseTimer = null;
        }, 5000);
      }

      // Dial & Envelope Wax Seal color emphasis
      const dialColor =
        sceneInput.status === 'Finalized'
          ? PALETTE.finalGreen
          : derived.dialAlert
            ? PALETTE.rivalRed
            : PALETTE.ownerBlue;
      dialPlateMat.color.setHex(dialColor);
      needleMat.color.setHex(dialColor);

      const flapSealColor =
        sceneInput.status === 'Finalized'
          ? PALETTE.finalGreen
          : sceneInput.status === 'Challenged' || sceneInput.outcome === 'Busted'
            ? PALETTE.rivalRed
            : sceneInput.status === 'Pending'
              ? PALETTE.heirMustard
              : PALETTE.ownerBlue;
      flapSealMat.color.setHex(flapSealColor);
      flapSealMat.emissive.setHex(flapSealColor);

      // Role focus & active seal highlight on strongbox & orbiting coins
      const heirEmissive = sceneInput.roleFocus === 'heir' || derived.sealH ? 0.2 : 0.05;
      const rivalEmissive = sceneInput.roleFocus === 'rival' || derived.sealR ? 0.22 : 0.05;
      sealH.discMat.emissiveIntensity = heirEmissive;
      coinH.coinDiscMat.emissiveIntensity = heirEmissive;
      sealR.discMat.emissiveIntensity = rivalEmissive;
      coinR.coinDiscMat.emissiveIntensity = rivalEmissive;
      dialPlateMat.emissiveIntensity = sceneInput.roleFocus === 'owner' ? 0.22 : 0.06;

      if (sceneInput.status === 'Challenged') {
        shakeStart = seconds - 0.15;
      }
    }

    // When lid is scrubbed directly via scroll, lerp smoothly at 60fps for zero-jitter continuous motion
    if (isScrubbingLid) {
      const targetLidAngle = -derived.lidOpen * 1.16;
      const targetDeedLift = derived.lidOpen * 0.46;
      const targetEnvelopeFlap = -derived.envelopeOpen * Math.PI * 0.86;
      const targetEnvelopeCard = derived.envelopeOpen * 0.24;
      const targetGleamScale = derived.gleamIntensity > 0.01 ? derived.gleamIntensity : 0.001;
      const targetGleamLift = derived.gleamIntensity * 0.44;

      pose.lidAngle = THREE.MathUtils.lerp(pose.lidAngle, targetLidAngle, 0.2);
      pose.deedLift = THREE.MathUtils.lerp(pose.deedLift, targetDeedLift, 0.2);
      pose.envelopeFlapAngle = THREE.MathUtils.lerp(pose.envelopeFlapAngle, targetEnvelopeFlap, 0.2);
      pose.envelopeCardLift = THREE.MathUtils.lerp(pose.envelopeCardLift, targetEnvelopeCard, 0.2);
      pose.gleamScale = THREE.MathUtils.lerp(pose.gleamScale, targetGleamScale, 0.2);
      pose.gleamLift = THREE.MathUtils.lerp(pose.gleamLift, targetGleamLift, 0.2);
    }

    if (sceneInput.outcome !== previousOutcome) {
      previousOutcome = sceneInput.outcome;

      if (previousOutcome === 'FalseAlarm') {
        // Lid bounces shut, Seal H pops loose, and Koin H recoils outward
        gsap.fromTo(
          pose,
          { boxBounceY: 0.14, lidAngle: -0.22, coinHRadiusOffset: 0.36 },
          { boxBounceY: 0, lidAngle: 0, coinHRadiusOffset: 0, duration: 0.65, ease: 'expo.inOut' },
        );
      } else if (previousOutcome === 'Busted') {
        // Lid bounces + 0.3s camera shake + Seal R clamp flash + Koin R surges
        shakeStart = seconds;
        gsap.fromTo(
          pose,
          { boxBounceY: -0.12, clampScale: 1, coinRScale: 1.34, coinRRadiusOffset: -0.22 },
          { boxBounceY: 0, clampScale: 1, coinRScale: 1.18, coinRRadiusOffset: 0, duration: 0.65, ease: 'expo.inOut' },
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
    const scale = ((place.size / Math.max(1, height)) * viewHeight) / 4.55;
    const targetX = (place.x / Math.max(1, width) - 0.5) * viewHeight * camera.aspect;
    const targetY = (0.5 - place.y / Math.max(1, height)) * viewHeight + pose.boxBounceY;

    // Detect section anchor transition and route through peripheral side arc (avoids center text!)
    if (place.anchorId && place.anchorId !== lastAnchorId) {
      if (lastAnchorId !== null) {
        arcStartX = root.position.x;
        arcStartY = root.position.y;
        arcStartTime = seconds;
        arcT = 0;
        const sideMargin = viewHeight * camera.aspect * 0.44;
        if (targetX < -0.2) {
          // Destination is on the left (e.g. Cockpit, Mechanism): swoop wide via the left side
          arcWaypointX = -sideMargin;
        } else if (targetX > 0.2) {
          // Destination is on the right (e.g. Hero): swoop wide via the right side
          arcWaypointX = sideMargin;
        } else {
          // Destination is center: approach from the side currently occupied
          arcWaypointX = root.position.x >= 0 ? sideMargin : -sideMargin;
        }
      }
      lastAnchorId = place.anchorId;
    }

    if (arcT < 1) {
      arcT = Math.min(1, (seconds - arcStartTime) / ARC_DURATION);
      // Smooth cubic ease in-out
      const ease = arcT < 0.5 ? 4 * arcT * arcT * arcT : 1 - Math.pow(-2 * arcT + 2, 3) / 2;
      const oneMinusE = 1 - ease;

      // Quadratic Bezier curve for X that swoops along the outer side edge:
      // B(t) = (1-t)^2 * P0 + 2*(1-t)*t * P1 + t^2 * P2
      const curvedX =
        oneMinusE * oneMinusE * arcStartX +
        2 * oneMinusE * ease * arcWaypointX +
        ease * ease * targetX;
      const curvedY = THREE.MathUtils.lerp(arcStartY, targetY, ease);

      root.position.x = curvedX;
      root.position.y = curvedY;
    } else {
      root.position.x = THREE.MathUtils.lerp(root.position.x, targetX, 0.16);
      root.position.y = THREE.MathUtils.lerp(root.position.y, targetY, 0.16);
    }
    root.scale.setScalar(scale * intro.scale);

    // Rotation combines base isometric angle + smoothed scroll progress + smoothed pointer parallax + user drag
    const targetScrollYaw = Math.max(0, Math.min(1, sceneInput.progress)) * 0.55;
    smoothedScrollYaw = THREE.MathUtils.lerp(smoothedScrollYaw, targetScrollYaw, 0.14);

    const targetParallaxYaw = Math.max(-0.08, Math.min(0.08, sceneInput.pointerX * 0.16));
    const targetParallaxPitch = Math.max(-0.08, Math.min(0.08, sceneInput.pointerY * 0.12));
    smoothedParallaxYaw = THREE.MathUtils.lerp(smoothedParallaxYaw, targetParallaxYaw, 0.1);
    smoothedParallaxPitch = THREE.MathUtils.lerp(smoothedParallaxPitch, targetParallaxPitch, 0.1);

    root.rotation.y = -0.38 + smoothedScrollYaw + smoothedParallaxYaw + sceneInput.dragYaw;
    root.rotation.x = Math.max(
      -0.6,
      Math.min(0.6, 0.26 + smoothedParallaxPitch + sceneInput.dragPitch),
    );

    // Apply animated pose to strongbox mechanisms
    lidPivot.rotation.x = pose.lidAngle;
    deedGroup.position.y = 0.42 + pose.deedLift;
    deedWaxMesh.rotation.y += delta * 0.9;

    sealH.group.position.z = pose.sealHDepth;
    if (pose.sealHDepth > 0.79) {
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

    // Apply Orbiting Seal Coins (Koin O, Koin H & Koin R) along the inclined Torus trajectory
    orbitSystemGroup.rotation.z = -0.22 - (pose.orbitTilt - 0.34) * 0.6;
    orbitSpinnerGroup.rotation.z += delta * pose.orbitSpeed;

    coinH.coinAnchor.position.set(ORBIT_RADIUS + pose.coinHRadiusOffset, 0, 0);
    coinH.coinAnchor.scale.setScalar(pose.coinHScale);
    coinH.coinSpin.rotation.y += delta * (0.9 + pose.orbitSpeed * 0.45);

    const rRadius = ORBIT_RADIUS + pose.coinRRadiusOffset;
    coinR.coinAnchor.position.set(
      Math.cos((Math.PI * 2) / 3) * rRadius,
      Math.sin((Math.PI * 2) / 3) * rRadius,
      0,
    );
    coinR.coinAnchor.scale.setScalar(pose.coinRScale);
    coinR.coinSpin.rotation.y -= delta * (0.9 + pose.orbitSpeed * 0.45);

    coinO.coinAnchor.position.set(
      Math.cos((Math.PI * 4) / 3) * ORBIT_RADIUS,
      Math.sin((Math.PI * 4) / 3) * ORBIT_RADIUS,
      0,
    );
    coinO.coinAnchor.scale.setScalar(sceneInput.roleFocus === 'owner' ? 1.18 : 1.04);
    coinO.coinSpin.rotation.y += delta * (0.85 + pose.orbitSpeed * 0.4);

    // Apply Floating Deed Envelope (Amplop Akta) + Gold Gleam (#F5D061)
    const hoverWave = Math.sin(seconds * 2.1) * 0.055;
    envelopeGroup.position.y = 1.54 + pose.deedLift * 0.35 + hoverWave;
    envelopeGroup.rotation.z = Math.sin(seconds * 1.4) * 0.035;

    flapPivot.rotation.x = pose.envelopeFlapAngle;
    envCardGroup.position.y = 0.02 + pose.envelopeCardLift;

    gleamGroup.position.y = 0.28 + pose.gleamLift;
    gleamGroup.scale.setScalar(Math.max(0.001, pose.gleamScale));
    if (pose.gleamScale > 0.05) {
      gleamCoreMesh.rotation.y += delta * 1.6;
      gleamRaysGroup.rotation.z -= delta * 0.85;
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
      if (lidAutoCloseTimer !== null) {
        window.clearTimeout(lidAutoCloseTimer);
        lidAutoCloseTimer = null;
      }
      gsap.killTweensOf([pose, intro]);
      gradientMap.dispose();
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      renderer.dispose();
    },
  };
}
