export const soloUser = {
  id: 'solo-ava',
  name: 'Ava Chen',
  role: 'solo',
  streak: 7,
  xp: 1840,
  level: 'Level 4',
  goal: 'Sales calls',
  weakestSkill: 'Objection handling',
};

export const adminUser = {
  id: 'admin-maya',
  name: 'Maya Patel',
  role: 'admin',
  organizationId: 'org-brightpath',
  streak: 3,
  xp: 920,
  level: 'Team Coach',
};

export const employeeUser = {
  id: 'employee-lena',
  name: 'Lena Ortiz',
  role: 'employee',
  organizationId: 'org-brightpath',
  streak: 5,
  xp: 1260,
  level: 'Ready Rep',
  weakestSkill: 'Product accuracy',
};

export const organization = {
  id: 'org-brightpath',
  name: 'BrightPath Sales',
  admins: ['admin-maya'],
  employees: ['employee-lena', 'employee-noah', 'employee-ivy', 'employee-sam'],
  teamAverageScore: 82,
  completionRate: 74,
  activeTrainings: 3,
  weakestTeamSkill: 'Closing with confidence',
};

export const trainingMaterials = [
  {
    id: 'material-launch-faq',
    organizationId: organization.id,
    title: 'Launch FAQ + objection playbook',
    type: 'Product FAQ',
    content:
      'Handle pricing concerns by anchoring on onboarding speed, measurable adoption, and lower support volume.',
    uploadedAt: '2026-05-20',
  },
  {
    id: 'material-support-sop',
    organizationId: organization.id,
    title: 'Support escalation SOP',
    type: 'Support SOP',
    content: 'Acknowledge emotion, confirm the issue, explain next step, and set a clear follow-up window.',
    uploadedAt: '2026-05-18',
  },
];

export const scenarios = [
  {
    id: 'scenario-solo-sales',
    title: 'Calm pricing objection',
    goal: 'Practice a confident sales response',
    difficulty: 'Medium',
    persona: 'Skeptical customer',
    context: 'A prospect likes the product but thinks the subscription feels expensive.',
    openingMessage: 'I like the idea, but this is more than we planned to spend this quarter.',
    successCriteria: ['Acknowledge concern', 'Ask one clarifying question', 'Tie value to business outcome'],
    evaluationSkills: ['Confidence', 'Structure', 'Empathy', 'Objection handling'],
    sourceMaterialId: null,
    estimatedTime: '12 min',
  },
  {
    id: 'scenario-team-launch',
    title: 'New product launch objection drill',
    goal: 'Train reps on the latest product FAQ',
    difficulty: 'Hard',
    persona: 'Busy operations lead',
    context: 'The customer wants proof that the new workflow will not slow down their team.',
    openingMessage: 'This sounds risky. How do I know my team will actually adopt it?',
    successCriteria: ['Use approved product facts', 'Stay calm under pressure', 'Offer a clear next step'],
    evaluationSkills: ['Knowledge accuracy', 'Confidence', 'Structure', 'Policy adherence'],
    sourceMaterialId: 'material-launch-faq',
    estimatedTime: '15 min',
  },
];

export const assignments = [
  {
    id: 'assignment-launch-drill',
    scenarioId: 'scenario-team-launch',
    employeeIds: ['employee-lena', 'employee-noah', 'employee-ivy'],
    assignedBy: 'Maya Patel',
    dueDate: '2026-05-28',
    requiredScore: 80,
    attemptsAllowed: '3 attempts',
    status: 'In progress',
  },
];

export const attempts = [
  {
    id: 'attempt-lena-launch',
    userId: 'employee-lena',
    scenarioId: 'scenario-team-launch',
    score: 86,
    skillScores: {
      Accuracy: 82,
      Confidence: 88,
      Structure: 84,
      Empathy: 91,
    },
    transcript: [
      {
        speaker: 'AI customer',
        text: 'How do I know my team will actually adopt it?',
      },
      {
        speaker: 'Lena',
        text: 'We can start with a small pilot and measure adoption before the full rollout.',
      },
    ],
    feedback: {
      summary: 'Strong calm tone and a practical pilot next step.',
      nextStep: 'Add one specific product proof point before asking for commitment.',
    },
    createdAt: '2026-05-22',
  },
];
