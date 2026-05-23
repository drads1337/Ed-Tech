/** Поза человека — без изменений; лежанка — из mono-chaise-chair-config-2026-05-22T13-40-07-453Z. */
export const CHAISE_POSE = {
  name: 'chaise',
  schemaVersion: 2,
  selectedBoneName: 'Base_01',
  modelTransform: {
    x: 2.6,
    y: -2.75,
    z: 0.21,
    scale: 2.73,
  },
  chaiseTransform: {
    x: 0.43,
    y: 0,
    z: 0,
    length: 0.88,
    height: 0.98,
    depth: 1,
    rotationY: 0,
  },
  chaiseShape: [
    { id: 'back-bottom', label: 'Низ спинки', x: -3.7, y: -0.58 },
    { id: 'back-top', label: 'Верх спинки', x: -3.52, y: 1.77 },
    { id: 'head-hump', label: 'Верхний бугорок', x: -2.74, y: 1.7 },
    { id: 'shoulder-scoop', label: 'Переход спинки', x: -2.04, y: 0.68 },
    { id: 'seat-valley', label: 'Посадочная впадина', x: -0.98, y: 0.15 },
    { id: 'seat-rise', label: 'Средний бугорок', x: 0.3, y: 0.41 },
    { id: 'leg-rest-hump', label: 'Бугорок под ноги', x: 1.99, y: -0.21 },
    { id: 'front-lip', label: 'Передний край', x: 3.11, y: -0.92 },
    { id: 'front-bottom', label: 'Низ переда', x: -1.37, y: -0.56 },
    { id: 'base-bottom', label: 'Нижняя линия', x: -3.72, y: -0.86 },
  ],
  boneRotations: {
    Base_01: { x: -8, y: 0, z: 176 },
    Pelvis_02: { x: -1, y: 0, z: 0 },
    Torso_03: { x: 18, y: 8, z: 0 },
    Chest_04: { x: 7, y: 0, z: 0 },
    ClavicleL_05: { x: -10, y: 0, z: 0 },
    ShoulderL_06: { x: -1, y: 0, z: 0 },
    ForearmL_07: { x: -8, y: -13, z: 15 },
    Neck_024: { x: 20, y: 0, z: 0 },
    HipL_059: { x: -3, y: 6, z: -3 },
    ThighL_060: { x: 11, y: -1, z: 0 },
    CalfL_061: { x: -2, y: 0, z: 0 },
    ToesL_063: { x: 5, y: 0, z: 0 },
    IK_wrist_ctrlL_069: { x: 30, y: 25, z: -101 },
    IK_foot_ctrlL_071: { x: -121, y: 0, z: 0 },
    IK_knee_ctrlR_076: { x: -206, y: 0, z: 0 },
    HipR_064: { x: -11, y: 0, z: 0 },
  },
  restPoseAdjustments: {
    Neck_024: { x: 3, y: 0, z: 0 },
    Head_025: { x: 8, y: 0, z: 0 },
  },
};

export const CHAISE_POSE_REVISION =
  '2026-05-22T13:40:07.453Z|2026-05-22T09:00:56.651Z|2026-05-22T08:15:45.619Z|{"x":2.6,"y":-2.75,"z":0.21,"scale":2.73}|{"x":0.43,"y":0,"z":0,"length":0.88,"height":0.98,"depth":1,"rotationY":0}|chaise-shape-v2|{"Base_01":{"x":-8,"y":0,"z":176},"Pelvis_02":{"x":-1,"y":0,"z":0},"Torso_03":{"x":18,"y":8,"z":0},"Chest_04":{"x":7,"y":0,"z":0},"ClavicleL_05":{"x":-10,"y":0,"z":0},"ShoulderL_06":{"x":-1,"y":0,"z":0},"ForearmL_07":{"x":-8,"y":-13,"z":15},"Neck_024":{"x":20,"y":0,"z":0},"HipL_059":{"x":-3,"y":6,"z":-3},"ThighL_060":{"x":11,"y":-1,"z":0},"CalfL_061":{"x":-2,"y":0,"z":0},"ToesL_063":{"x":5,"y":0,"z":0},"IK_wrist_ctrlL_069":{"x":30,"y":25,"z":-101},"IK_foot_ctrlL_071":{"x":-121,"y":0,"z":0},"IK_knee_ctrlR_076":{"x":-206,"y":0,"z":0},"HipR_064":{"x":-11,"y":0,"z":0}}|{"Neck_024":{"x":3,"y":0,"z":0},"Head_025":{"x":8,"y":0,"z":0}}';

/** Поза «Стоя» — bearded.glb из standing-pose-config-2026-05-22T15-12-03-356Z. */
export const STANDING_POSE = {
  name: 'standing',
  schemaVersion: 3,
  selectedBoneName: 'mixamorigLeftUpLeg_58',
  modelTransform: {
    x: -3.21,
    y: 3.1,
    z: -0.84,
    scale: 0.35,
  },
  boneRotations: {
    GLTF_created_0_rootJoint: { x: 1, y: 0, z: 0 },
    mixamorigHips_64: { x: 88, y: -225, z: 0 },
    mixamorigSpine_53: { x: -13, y: 0, z: 0 },
    mixamorigHead_1: { x: 6, y: 0, z: 0 },
    mixamorigLeftUpLeg_58: { x: 20, y: 0, z: 0 },
    mixamorigLeftLeg_57: { x: 33, y: 0, z: 0 },
    mixamorigRightUpLeg_63: { x: -3, y: 0, z: 0 },
    mixamorigRightLeg_62: { x: -8, y: 0, z: 0 },
  },
  restPoseAdjustments: {},
};

export const STANDING_POSE_REVISION =
  '2026-05-22T15:12:03.356Z|{"x":-3.21,"y":3.1,"z":-0.84,"scale":0.35}|{"GLTF_created_0_rootJoint":{"x":1,"y":0,"z":0},"mixamorigHips_64":{"x":88,"y":-225,"z":0},"mixamorigSpine_53":{"x":-13,"y":0,"z":0},"mixamorigHead_1":{"x":6,"y":0,"z":0},"mixamorigLeftUpLeg_58":{"x":20,"y":0,"z":0},"mixamorigLeftLeg_57":{"x":33,"y":0,"z":0},"mixamorigRightUpLeg_63":{"x":-3,"y":0,"z":0},"mixamorigRightLeg_62":{"x":-8,"y":0,"z":0}}';

/** Поза для table.glb — из desk-pose-config-2026-05-22T16-07-06-809Z. */
export const DESK_POSE = {
  name: 'desk',
  schemaVersion: 3,
  selectedBoneName: 'ForearmL_49',
  modelTransform: {
    x: -1,
    y: -0.8,
    z: 0,
    scale: 0.38,
  },
  deskTransform: {
    x: 0,
    y: 0,
    z: 0,
    width: 1.25,
    height: 1,
    depth: 1.22,
    rotationY: 0,
  },
  boneRotations: {
    base_9: { x: -32, y: 0, z: 0 },
    Torso1_82: { x: 3, y: 0, z: 0 },
    Torso2_71: { x: 2, y: 0, z: 0 },
    Neck_33: { x: 12, y: 0, z: 0 },
    ShoulderL_50: { x: -15, y: 0, z: 18 },
    ForearmL_49: { x: -48, y: -13, z: 0 },
    ShoulderR_68: { x: -10, y: 0, z: -14 },
    ForearmR_67: { x: -38, y: 0, z: 0 },
    ThighL_75: { x: 0, y: 0, z: 0 },
    ThighR_80: { x: 0, y: 0, z: 0 },
    ClavicleL_51: { x: 16, y: 0, z: 0 },
    Head_31: { x: -48, y: -9, z: 0 },
    brow2R_22: { x: 0, y: 0, z: 0 },
  },
  restPoseAdjustments: {
    Neck_33: { x: 3, y: 0, z: 0 },
    Head_31: { x: 8, y: 0, z: 0 },
  },
};

export const DESK_POSE_REVISION =
  '2026-05-23T00:00:00.000Z|{"x":-1,"y":-0.8,"z":0,"scale":0.38}|{"x":0,"y":0,"z":0,"width":1.25,"height":1,"depth":1.22,"rotationY":0}|{"base_9":{"x":-32,"y":0,"z":0},"Torso1_82":{"x":3,"y":0,"z":0},"Torso2_71":{"x":2,"y":0,"z":0},"Neck_33":{"x":12,"y":0,"z":0},"ShoulderL_50":{"x":-15,"y":0,"z":18},"ForearmL_49":{"x":-48,"y":-13,"z":0},"ShoulderR_68":{"x":-10,"y":0,"z":-14},"ForearmR_67":{"x":-38,"y":0,"z":0},"ThighL_75":{"x":0,"y":0,"z":0},"ThighR_80":{"x":0,"y":0,"z":0},"ClavicleL_51":{"x":16,"y":0,"z":0},"Head_31":{"x":-48,"y":-9,"z":0},"brow2R_22":{"x":0,"y":0,"z":0}}|{"Neck_33":{"x":3,"y":0,"z":0},"Head_31":{"x":8,"y":0,"z":0}}';

export const CASE_POSES = {
  chaise: CHAISE_POSE,
  standing: STANDING_POSE,
  desk: DESK_POSE,
};

export function getPoseForCase(caseId) {
  switch (caseId) {
    case 'standing':
      return STANDING_POSE;
    case 'desk':
      return DESK_POSE;
    case 'chaise':
    default:
      return CHAISE_POSE;
  }
}
