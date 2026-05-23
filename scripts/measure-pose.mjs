import fs from 'node:fs/promises';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

globalThis.ProgressEvent ||= class ProgressEvent extends Event {};
globalThis.self ||= globalThis;

const POSE_PATH = new URL('../mono-chaise-pose-2026-05-22T08-15-45-619Z.json', import.meta.url);
const MODEL_PATH = new URL('../ordinary.glb', import.meta.url);

const REST_POSE_ADJUSTMENTS = {
  Neck_024: { x: 3, y: 0, z: 0 },
  Head_025: { x: 8, y: 0, z: 0 },
};

function createChaiseGeometry() {
  const shape = new THREE.Shape();

  shape.moveTo(-3.48, -0.86);
  shape.lineTo(3.22, -0.86);
  shape.quadraticCurveTo(3.52, -0.86, 3.52, -0.56);
  shape.lineTo(3.52, -0.14);
  shape.quadraticCurveTo(3.48, 0.08, 3.26, 0.12);
  shape.lineTo(2.52, 0.24);
  shape.quadraticCurveTo(1.82, 0.36, 1.18, 0.36);
  shape.lineTo(0.42, 0.26);
  shape.quadraticCurveTo(-0.24, 0.16, -0.78, -0.02);
  shape.quadraticCurveTo(-1.2, -0.12, -1.48, 0.12);
  shape.lineTo(-2.04, 0.68);
  shape.quadraticCurveTo(-2.42, 1.04, -2.7, 1.5);
  shape.lineTo(-2.92, 1.86);
  shape.quadraticCurveTo(-3.04, 2.04, -3.26, 2.04);
  shape.lineTo(-3.52, 2.04);
  shape.quadraticCurveTo(-3.72, 2.04, -3.72, 1.82);
  shape.lineTo(-3.72, -0.58);
  shape.quadraticCurveTo(-3.72, -0.86, -3.48, -0.86);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 2.32,
    bevelEnabled: true,
    bevelSize: 0.08,
    bevelThickness: 0.08,
    bevelSegments: 1,
    curveSegments: 8,
    steps: 1,
  });

  geometry.center();
  geometry.computeVertexNormals();

  return geometry;
}

async function loadGLB(url) {
  const loader = new GLTFLoader();
  const buffer = await fs.readFile(url);

  return new Promise((resolve, reject) => {
    loader.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '', resolve, reject);
  });
}

function centerScene(scene) {
  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());

  scene.position.sub(center);
}

function applyPose(scene, boneRotations, restPoseAdjustments) {
  scene.traverse((object) => {
    if (!object.isBone) {
      return;
    }

    const restAdjustment = restPoseAdjustments[object.name];
    const userRotation = boneRotations[object.name];

    if (restAdjustment) {
      object.rotation.x += THREE.MathUtils.degToRad(restAdjustment.x);
      object.rotation.y += THREE.MathUtils.degToRad(restAdjustment.y);
      object.rotation.z += THREE.MathUtils.degToRad(restAdjustment.z);
    }

    if (userRotation) {
      object.rotation.x += THREE.MathUtils.degToRad(userRotation.x);
      object.rotation.y += THREE.MathUtils.degToRad(userRotation.y);
      object.rotation.z += THREE.MathUtils.degToRad(userRotation.z);
    }
  });
}

function collectModelPoints(scene) {
  const points = [];
  const localVertex = new THREE.Vector3();

  scene.updateWorldMatrix(true, true);

  scene.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes?.position) {
      return;
    }

    const position = object.geometry.attributes.position;

    for (let index = 0; index < position.count; index += 1) {
      localVertex.fromBufferAttribute(position, index);
      points.push(localVertex.applyMatrix4(object.matrixWorld).clone());
    }
  });

  return points;
}

function percentile(sortedValues, percent) {
  if (!sortedValues.length) {
    return null;
  }

  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.floor(sortedValues.length * percent)));

  return sortedValues[index];
}

const pose = JSON.parse(await fs.readFile(POSE_PATH, 'utf8'));
const gltf = await loadGLB(MODEL_PATH);
const modelScene = gltf.scene;
const modelTransform = pose.modelTransform;
const chaiseTransform = pose.chaiseTransform;
const restPoseAdjustments = { ...REST_POSE_ADJUSTMENTS, ...pose.restPoseAdjustments };

centerScene(modelScene);
applyPose(modelScene, pose.boneRotations || {}, restPoseAdjustments);

const sceneRoot = new THREE.Group();
sceneRoot.rotation.set(0, -0.45, 0);
sceneRoot.position.set(0, 0.12, 0);

const chaiseGroup = new THREE.Group();
chaiseGroup.position.set(chaiseTransform.x, chaiseTransform.y, chaiseTransform.z);
chaiseGroup.rotation.set(0, THREE.MathUtils.degToRad(chaiseTransform.rotationY), 0);
chaiseGroup.scale.set(chaiseTransform.length, chaiseTransform.height, chaiseTransform.depth);

const chaiseMesh = new THREE.Mesh(createChaiseGeometry(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
chaiseGroup.add(chaiseMesh);
sceneRoot.add(chaiseGroup);

const modelGroup = new THREE.Group();
modelGroup.position.set(modelTransform.x, modelTransform.y, modelTransform.z);
modelGroup.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
modelGroup.scale.setScalar(modelTransform.scale);
modelGroup.add(modelScene);
sceneRoot.add(modelGroup);
sceneRoot.updateWorldMatrix(true, true);

const chairBox = new THREE.Box3().setFromObject(chaiseMesh);
const modelBox = new THREE.Box3().setFromObject(modelScene);

const raycaster = new THREE.Raycaster();
const down = new THREE.Vector3(0, -1, 0);
const above = new THREE.Vector3();
raycaster.set(new THREE.Vector3(0, 10, 0), down);
const debugCenterHit = raycaster.intersectObject(chaiseMesh, false)[0]?.point.toArray() || null;

function measure(transform) {
  modelGroup.position.set(transform.x, transform.y, transform.z);
  sceneRoot.updateWorldMatrix(true, true);

  const measuredModelBox = new THREE.Box3().setFromObject(modelScene);
  const points = collectModelPoints(modelScene);
  const pointBox = new THREE.Box3().setFromPoints(points);
  const rawGaps = [];
  const nearGaps = [];
  const misses = [];
  let pointsInsideChairBoxXZ = 0;

  for (const point of points) {
    if (
      point.x >= chairBox.min.x &&
      point.x <= chairBox.max.x &&
      point.z >= chairBox.min.z &&
      point.z <= chairBox.max.z
    ) {
      pointsInsideChairBoxXZ += 1;
    }

    above.set(point.x, point.y + 10, point.z);
    raycaster.set(above, down);

    const [hit] = raycaster.intersectObject(chaiseMesh, false);
    if (!hit) {
      misses.push(point);
      continue;
    }

    const gap = point.y - hit.point.y;
    rawGaps.push(gap);

    if (gap > -0.5 && gap < 2.5) {
      nearGaps.push(gap);
    }
  }

  rawGaps.sort((a, b) => a - b);
  nearGaps.sort((a, b) => a - b);

  const positiveGaps = rawGaps.filter((gap) => gap >= 0);
  const negativeGaps = rawGaps.filter((gap) => gap < 0);
  const contactGap = percentile(positiveGaps, 0.01) ?? rawGaps.at(-1) ?? 0;
  const targetClearance = 0.015;

  return {
    totalModelVertices: points.length,
    pointsInsideChairBoxXZ,
    rawChairHits: rawGaps.length,
    nearChairHits: nearGaps.length,
    missedChairRays: misses.length,
    modelBox: {
      min: measuredModelBox.min.toArray(),
      max: measuredModelBox.max.toArray(),
    },
    pointBox: {
      min: pointBox.min.toArray(),
      max: pointBox.max.toArray(),
    },
    minGap: rawGaps[0],
    maxGap: rawGaps.at(-1),
    nearMinGap: nearGaps[0],
    nearMaxGap: nearGaps.at(-1),
    positiveContactGapP01: percentile(positiveGaps, 0.01),
    positiveContactGapP05: percentile(positiveGaps, 0.05),
    medianGap: percentile(rawGaps, 0.5),
    negativePenetratingSamples: negativeGaps.length,
    suggestedY: transform.y - contactGap + targetClearance,
    suggestedDeltaY: -contactGap + targetClearance,
  };
}

const initialMeasure = measure(modelTransform);
console.log(JSON.stringify({
  currentModelTransform: modelTransform,
  currentMeasure: initialMeasure,
  debugCenterHit,
  chairBox: {
    min: chairBox.min.toArray(),
      max: chairBox.max.toArray(),
  },
  suggestedModelTransform: {
    ...modelTransform,
    y: initialMeasure.suggestedY,
  },
}, null, 2));
