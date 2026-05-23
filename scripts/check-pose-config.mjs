import fs from 'node:fs/promises';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CASE_POSES } from '../src/casePoses.js';

globalThis.ProgressEvent ||= class ProgressEvent extends Event {};
globalThis.self ||= globalThis;

const originalWarn = console.warn;
const originalError = console.error;
function ignoreTextureWarning(...args) {
  if (String(args[0] || '').startsWith("THREE.GLTFLoader: Couldn't load texture")) {
    return true;
  }
  return false;
}
console.warn = (...args) => {
  if (ignoreTextureWarning(...args)) {
    return;
  }
  originalWarn(...args);
};
console.error = (...args) => {
  if (ignoreTextureWarning(...args)) {
    return;
  }
  originalError(...args);
};

const [, , configPath] = process.argv;

const BUILTIN_CHECKS = [
  { label: 'chaise', pose: CASE_POSES.chaise, modelFileName: 'ordinary.glb' },
  { label: 'standing', pose: CASE_POSES.standing, modelFileName: 'bearded.glb' },
  { label: 'sitting', pose: CASE_POSES.sitting, modelFileName: 'note.glb' },
  { label: 'desk', pose: CASE_POSES.desk, modelFileName: 'table.glb' },
];

function fail(message, details = []) {
  console.error(`Pose config check failed: ${message}`);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exitCode = 1;
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

async function loadGLB(url) {
  const loader = new GLTFLoader();
  const buffer = await fs.readFile(url);

  return new Promise((resolve, reject) => {
    loader.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '', resolve, reject);
  });
}

function collectBoneNames(scene) {
  const names = [];

  scene.traverse((object) => {
    if (object.isBone) {
      names.push(object.name);
    }
  });

  return names;
}

function validateTransform(name, transform, requiredKeys) {
  if (!transform || typeof transform !== 'object') {
    return [`${name} is missing.`];
  }

  return requiredKeys
    .filter((key) => !isFiniteNumber(transform[key]))
    .map((key) => `${name}.${key} must be a number.`);
}

function validateRotation(name, rotation) {
  if (!rotation || typeof rotation !== 'object') {
    return [`${name} must be an object.`];
  }

  return ['x', 'y', 'z'].filter((key) => !isFiniteNumber(rotation[key])).map((key) => `${name}.${key} must be a number.`);
}

async function validatePose(label, pose, modelFileName) {
  const modelPath = new URL(`../${modelFileName}`, import.meta.url);
  const gltf = await loadGLB(modelPath);
  const modelBoneNames = collectBoneNames(gltf.scene);
  const modelBoneNameSet = new Set(modelBoneNames);
  const errors = [...validateTransform('modelTransform', pose.modelTransform, ['x', 'y', 'z', 'scale'])];

  if (pose.chaiseTransform) {
    errors.push(
      ...validateTransform('chaiseTransform', pose.chaiseTransform, ['x', 'y', 'z', 'length', 'height', 'depth', 'rotationY']),
    );
  }

  if (pose.deskTransform) {
    errors.push(...validateTransform('deskTransform', pose.deskTransform, ['x', 'y', 'z', 'width', 'height', 'depth', 'rotationY']));
  }

  if (!pose.boneRotations || typeof pose.boneRotations !== 'object') {
    errors.push('boneRotations is missing.');
  } else {
    for (const [boneName, rotation] of Object.entries(pose.boneRotations)) {
      if (!modelBoneNameSet.has(boneName)) {
        errors.push(`boneRotations.${boneName} is not present in ${modelFileName}.`);
      }
      errors.push(...validateRotation(`boneRotations.${boneName}`, rotation));
    }
  }

  if (errors.length) {
    fail(label, errors);
    return false;
  }

  console.log(`Pose config OK: ${label}`);
  console.log(`Model: ${modelFileName}`);
  console.log(`Model bones: ${modelBoneNames.length}`);
  console.log(`Changed bones: ${Object.keys(pose.boneRotations || {}).length}`);
  return true;
}

if (configPath) {
  const rawConfig = await fs.readFile(configPath, 'utf8');
  const pose = JSON.parse(rawConfig);
  const modelFileName =
    pose.caseId === 'standing' ||
    pose.scene === 'standing' ||
    pose.model?.fileName === 'bearded.glb'
      ? 'bearded.glb'
      : pose.caseId === 'sitting' ||
          pose.scene === 'sitting' ||
          pose.model?.fileName === 'note.glb'
        ? 'note.glb'
        : pose.caseId === 'desk' ||
          pose.scene === 'desk' ||
          pose.model?.fileName === 'table.glb'
        ? 'table.glb'
        : 'ordinary.glb';
  await validatePose(configPath, pose, modelFileName);
} else {
  for (const check of BUILTIN_CHECKS) {
    await validatePose(check.label, check.pose, check.modelFileName);
  }
}
