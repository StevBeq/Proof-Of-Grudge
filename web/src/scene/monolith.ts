import * as THREE from 'three';
import { gsap } from 'gsap';
import { sceneInput, scenePlacement } from '../lib/sceneInput';

export function createMonolith(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x1a222b, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 100); camera.position.z = 10;
  const object = new THREE.Group(); object.rotation.set(.54, -.38, -.12); scene.add(object);
  scene.add(new THREE.HemisphereLight(0xe8edf2, 0x111820, 3));
  const key = new THREE.DirectionalLight(0xffffff, 4); key.position.set(-3, 6, 8); scene.add(key);
  const fill = new THREE.DirectionalLight(0x9aa7b4, 1.5); fill.position.set(5, -3, 2); scene.add(fill);
  const colors = [0xbfd7ea, 0xe3a72f, 0x8db63c];
  const materials: THREE.Material[] = []; const geometries: THREE.BufferGeometry[] = [];
  function hex(radius: number, reverse = false) {
    const points = Array.from({ length: 6 }, (_, i) => {
      const a = Math.PI / 3 * i + Math.PI / 6;
      return new THREE.Vector2(Math.cos(a) * radius, Math.sin(a) * radius);
    });
    return reverse ? points.reverse() : points;
  }
  const rings = [1.9, 1.43, .98].map((radius, i) => {
    const shape = new THREE.Shape(hex(radius)); shape.holes.push(new THREE.Path(hex(radius - .23, true)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .22, bevelEnabled: true, bevelSize: .035, bevelThickness: .035, bevelSegments: 2, steps: 1 });
    geometry.translate(0, 0, -.11); geometries.push(geometry);
    const material = new THREE.MeshStandardMaterial({ color: 0x232d38, metalness: .6, roughness: .35 }); materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    const edges = new THREE.EdgesGeometry(geometry, 25); geometries.push(edges);
    const lineMaterial = new THREE.LineBasicMaterial({ color: colors[i], transparent: true, opacity: .5 }); materials.push(lineMaterial);
    mesh.add(new THREE.LineSegments(edges, lineMaterial)); mesh.position.z = i * .12;
    object.add(mesh); return { mesh, lineMaterial };
  });
  const coreMaterial = new THREE.MeshStandardMaterial({ color: 0x34414e, metalness: .6, roughness: .35 }); materials.push(coreMaterial);
  const coreGeometry = new THREE.BoxGeometry(.43, .85, .42); geometries.push(coreGeometry);
  const halves = [-1, 1].map(side => { const m = new THREE.Mesh(coreGeometry, coreMaterial); m.position.set(side * .23, 0, .35); object.add(m); return m; });
  const gemGeometry = new THREE.OctahedronGeometry(.26); geometries.push(gemGeometry);
  const gemMaterial = new THREE.MeshStandardMaterial({ color: 0xe8edf2, metalness: .7, roughness: .2 }); materials.push(gemMaterial);
  const gem = new THREE.Mesh(gemGeometry, gemMaterial); gem.position.z = .38; gem.scale.setScalar(0); object.add(gem);
  const pose = { spread: 0, clamp: 1, gem: 0, speed: .04, flash: 0 };
  const intro = { assembled: 0 };
  gsap.to(intro, { assembled: 1, duration: 1.4, ease: 'expo.out' });
  let previousState = ''; let previousOutcome = 'None'; let last = 0; let shakeStart = -10;
  let width = 0; let height = 0;
  const resize = () => {
    width = window.innerWidth; height = window.innerHeight;
    camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
  };
  resize(); window.addEventListener('resize', resize);
  function frame(seconds: number) {
    const delta = last ? Math.min(seconds - last, .05) : 0; last = seconds;
    const place = scenePlacement(); if (!place.visible) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';
    if (previousState !== sceneInput.status) {
      previousState = sceneInput.status;
      const finalized = previousState === 'Finalized';
      gsap.to(pose, { spread: finalized ? .48 : 0, clamp: previousState === 'Challenged' ? .96 : 1,
        gem: finalized ? 1 : 0, speed: previousState === 'Pending' ? .22 : .04, duration: .6, ease: 'expo.inOut', overwrite: 'auto' });
      rings.forEach((ring, i) => gsap.to(ring.lineMaterial, {
        opacity: (i === 1 && previousState === 'Pending') || (i === 2 && previousState === 'Challenged') ? 1 : .5, duration: .6,
      }));
    }
    if (previousOutcome !== sceneInput.outcome) {
      previousOutcome = sceneInput.outcome;
      if (previousOutcome === 'Busted') shakeStart = seconds;
      if (previousOutcome === 'Busted' || previousOutcome === 'SpiteBackfired') {
        const ring = rings[previousOutcome === 'Busted' ? 2 : 1];
        gsap.fromTo(ring.lineMaterial, { opacity: 1 }, { opacity: .5, duration: .6, overwrite: true });
      }
      if (previousOutcome === 'FalseAlarm') gsap.to(rings[1].lineMaterial, { opacity: .35, duration: .6, overwrite: true });
    }
    const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 10;
    const scale = place.size / height * viewHeight / 4.8;
    const x = (place.x / width - .5) * viewHeight * camera.aspect;
    const y = (.5 - place.y / height) * viewHeight;
    object.position.x = THREE.MathUtils.lerp(object.position.x, x, .15);
    object.position.y = THREE.MathUtils.lerp(object.position.y, y, .15);
    object.scale.setScalar(scale);
    object.rotation.y = -.38 + sceneInput.progress * .55 + sceneInput.pointerX * .08;
    object.rotation.x = .54 + sceneInput.pointerY * .05;
    rings.forEach((ring, i) => {
      ring.mesh.rotation.z += delta * pose.speed * (i === 1 ? 1 : -.35);
      ring.mesh.position.z = i * .12 + (1 - intro.assembled) * (i - 1) * 2;
    });
    rings[0].mesh.scale.setScalar(pose.clamp);
    halves.forEach((half, i) => { half.position.x = (i === 0 ? -1 : 1) * (.23 + pose.spread); });
    gem.scale.setScalar(pose.gem);
    const shake = seconds - shakeStart < .3 ? Math.sin((seconds - shakeStart) * 90) * .025 : 0;
    camera.position.x = shake;
    renderer.render(scene, camera);
  }
  return {
    frame,
    dispose() {
      window.removeEventListener('resize', resize);
      gsap.killTweensOf([pose, intro, ...rings.map(r => r.lineMaterial)]);
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); renderer.dispose();
    },
  };
}
