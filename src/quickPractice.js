import { scenarios } from './data/mockData.js';

export const QUICK_PRACTICE_DAILY_LIMIT = 3;
export const QUICK_CASE_IDS = ['chaise', 'standing', 'desk'];

const todayKey = () => new Date().toISOString().slice(0, 10);

const OPENING_LINES = [
  'Здравствуйте. У меня к вам непростой вопрос — можно пару минут?',
  'Добрый день. Мне нужна ваша помощь, ситуация немного срочная.',
  'Извините, что отвлекаю. Подскажите, с чего лучше начать?',
  'Мне неудобно это говорить, но мне важно понять, что делать дальше.',
];

const SITUATION_TEMPLATES = [
  { title: 'Недовольный клиент', skill: 'Деэскалация', persona: 'Раздражённый собеседник', patientType: 'angry', caseId: 'standing' },
  { title: 'Тревожный пациент', skill: 'Эмпатия', persona: 'Взволнованный клиент', patientType: 'sad', caseId: 'chaise' },
  { title: 'Срочный звонок', skill: 'Стрессоустойчивость', persona: 'Спешащий абонент', patientType: 'neutral', caseId: 'desk' },
  { title: 'Сложный вопрос', skill: 'Уточнение фактов', persona: 'Настороженный собеседник', patientType: 'neutral', caseId: 'desk' },
  { title: 'Конфликт ожиданий', skill: 'Переговоры', persona: 'Настойчивый клиент', patientType: 'angry', caseId: 'standing' },
  { title: 'Первичный контакт', skill: 'Установление контакта', persona: 'Нейтральный собеседник', patientType: 'neutral', caseId: 'chaise' },
];

function getIndustryName(industryId, getIndustry) {
  return getIndustry(industryId)?.name || 'практика';
}

export function getQuickPracticeUsage(progress) {
  const today = todayKey();
  if (progress.quickPracticeDate !== today) {
    return { used: 0, remaining: QUICK_PRACTICE_DAILY_LIMIT, date: today };
  }
  const used = Math.min(QUICK_PRACTICE_DAILY_LIMIT, Number(progress.quickPracticeUsed) || 0);
  return { used, remaining: QUICK_PRACTICE_DAILY_LIMIT - used, date: today };
}

export function pickQuickCaseId(seedScenario) {
  if (seedScenario?.quickCaseId && QUICK_CASE_IDS.includes(seedScenario.quickCaseId)) {
    return seedScenario.quickCaseId;
  }

  const byType = {
    angry: 'standing',
    sad: 'chaise',
    neutral: 'desk',
  };

  return byType[seedScenario?.patientType] || QUICK_CASE_IDS[Math.floor(Math.random() * QUICK_CASE_IDS.length)];
}

function isScenarioOpen(scenario, index, progress) {
  const previousScenario = scenarios[index - 1];
  return index <= 1 || !previousScenario || Boolean(progress.completed[previousScenario.id]);
}

export function buildQuickScenario(progress, getIndustry) {
  const openScenarios = scenarios.filter((scenario, index) => isScenarioOpen(scenario, index, progress));
  const seed = openScenarios[Math.floor(Math.random() * openScenarios.length)] || scenarios[0];
  const template = SITUATION_TEMPLATES[Math.floor(Math.random() * SITUATION_TEMPLATES.length)];
  const industryName = getIndustryName(progress.primaryIndustry, getIndustry);
  const opening = OPENING_LINES[Math.floor(Math.random() * OPENING_LINES.length)];
  const caseId = template.caseId || pickQuickCaseId(seed);

  return {
    id: `quick_${Date.now()}`,
    industry: progress.primaryIndustry || seed.industry,
    skill: template.skill || seed.skill,
    title: `${template.title} · ${industryName}`,
    goal: progress.goal || seed.goal || 'Отработка коммуникации',
    difficulty: Math.max(1, Math.min(3, (seed.difficulty || 2) + (Math.random() > 0.6 ? 1 : 0) - (Math.random() > 0.7 ? 1 : 0))),
    durationMin: 4,
    xpReward: 18,
    coinReward: 6,
    aiPersona: template.persona,
    patientType: template.patientType,
    quickCaseId: caseId,
    isQuickPractice: true,
    isAiGenerated: true,
    script: [
      { role: 'ai', text: opening, delay: 1100 },
      {
        role: 'user',
        expected: seed.script?.[1]?.expected?.slice(0, 2) || ['понимаю', 'спокойно'],
        hint: 'Признайте ситуацию и задайте уточняющий вопрос.',
        quickReplies: seed.script?.[1]?.quickReplies || [
          'Понимаю, давайте разберёмся по шагам.',
          'Расскажите, что произошло?',
        ],
      },
      { role: 'ai', text: seed.script?.[0]?.text || 'Мне важно, чтобы вы меня услышали.', delay: 1400 },
    ],
    feedback: {
      good: ['Быстрая практика: удержали контакт', `Отрасль: ${industryName}`],
      improve: ['Попробуйте больше уточняющих вопросов'],
    },
  };
}

export function consumeQuickPractice(progress) {
  const { remaining, date } = getQuickPracticeUsage(progress);
  if (remaining <= 0) {
    return null;
  }

  const used = progress.quickPracticeDate === date ? (Number(progress.quickPracticeUsed) || 0) + 1 : 1;
  return {
    quickPracticeDate: date,
    quickPracticeUsed: used,
  };
}
