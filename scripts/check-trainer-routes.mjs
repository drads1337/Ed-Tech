import fs from 'node:fs/promises';

const TRAINER_APP = 'src/CommTrainerApp.jsx';

function fail(message) {
  console.error(`Trainer routes check failed: ${message}`);
  process.exit(1);
}

const source = await fs.readFile(TRAINER_APP, 'utf8');

if (!source.includes('export const TRAINER_ROUTE_PATHS')) {
  fail('missing TRAINER_ROUTE_PATHS in CommTrainerApp.jsx');
}

if (!source.includes('function TrainerMainRoutes')) {
  fail('missing TrainerMainRoutes in CommTrainerApp.jsx');
}

if (/<main className="trainer-main">\s*<Routes>/s.test(source)) {
  fail(
    'do not nest <Routes> inside trainer-main — React Router v7 descendant matching can render an empty main when CommTrainerExperience is mounted under /home/*',
  );
}

const trainerMainBlock = source.match(
  /function TrainerMainRoutes\([\s\S]*?\n\}\n\nexport function CommTrainerExperience/,
);
if (!trainerMainBlock) {
  fail('could not read TrainerMainRoutes block');
}

const routeBlock = trainerMainBlock[0];
const requiredChecks = [
  'TRAINER_ROUTE_PATHS.home',
  'TRAINER_ROUTE_PATHS.plan',
  'TRAINER_ROUTE_PATHS.library',
  'TRAINER_ROUTE_PATHS.scenario',
  'TRAINER_ROUTE_PATHS.profile',
];

for (const token of requiredChecks) {
  if (!routeBlock.includes(token)) {
    fail(`TrainerMainRoutes must handle ${token}`);
  }
}

const pathConstantBlock = source.match(/export const TRAINER_ROUTE_PATHS = \{([\s\S]*?)\};/);
if (!pathConstantBlock) {
  fail('could not read TRAINER_ROUTE_PATHS');
}

const pathKeys = [...pathConstantBlock[1].matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1]);
for (const key of pathKeys) {
  if (!routeBlock.includes(`TRAINER_ROUTE_PATHS.${key}`)) {
    fail(`TrainerMainRoutes must reference TRAINER_ROUTE_PATHS.${key}`);
  }
}

console.log('Trainer routes check passed.');
