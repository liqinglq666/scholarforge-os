import type { SectionType, TaskType, TerminologyLock } from '@/lib/types';

export interface ResearchExample {
  id: string;
  discipline: string;
  title: string;
  taskType: TaskType;
  sectionType: SectionType;
  projectName: string;
  targetJournal: string;
  sourceText: string;
  terminologyLocks: TerminologyLock[];
  focus: string;
  suggestion: string;
}

const PRIMARY_EXAMPLE_IDS: Record<TaskType, string> = {
  translate: 'materials-translate',
  polish: 'materials-polish',
  precheck: 'materials-precheck',
};

export const RESEARCH_EXAMPLES: ResearchExample[] = [
  {
    id: 'materials-translate',
    discipline: '材料与工程',
    title: '结果段：中译英并保护数值',
    taskType: 'translate',
    sectionType: 'results',
    projectName: '水泥基材料孔结构研究 · 结果段中译英',
    targetJournal: 'Construction and Building Materials',
    sourceText: '养护28 d后，试样总孔隙率由18.6%下降至14.2%，抗压强度由42.5 MPa提高至51.3 MPa。上述结果表明，外加剂可能促进了孔结构致密化，但现有数据不足以证明有害孔隙已被完全消除。',
    terminologyLocks: [
      { id: 'materials-translate-term-1', source: '孔结构', preferred: 'pore structure' },
      { id: 'materials-translate-term-2', source: '抗压强度', preferred: 'compressive strength' },
    ],
    focus: '完整保留28 d、18.6%、14.2%、42.5 MPa和51.3 MPa，并维持“可能促进”与“不足以证明”的证据边界。',
    suggestion: '使用可核对的学术英文表达，不补充原文没有的机理、统计显著性或因果结论。',
  },
  {
    id: 'materials-polish',
    discipline: '材料与工程',
    title: '结果段：保守润色表达',
    taskType: 'polish',
    sectionType: 'results',
    projectName: '水泥基材料孔结构研究 · 结果段保守润色',
    targetJournal: 'Construction and Building Materials',
    sourceText: 'The results can well prove that the pore structure became much denser after 28 d of curing. The total porosity decreased from 18.6% to 14.2%, and the compressive strength increased from 42.5 MPa to 51.3 MPa. Therefore, the additive completely eliminated the harmful pores in the matrix.',
    terminologyLocks: [
      { id: 'materials-polish-term-1', source: 'pore structure', preferred: 'pore structure' },
      { id: 'materials-polish-term-2', source: 'compressive strength', preferred: 'compressive strength' },
    ],
    focus: '改善语法、句法和学术语气，同时保持数值、单位和证据强度。',
    suggestion: '把“prove”改为更审慎的“indicate”，并避免使用“completely eliminated”等绝对表述。',
  },
  {
    id: 'materials-precheck',
    discipline: '材料与工程',
    title: '结果段：投稿前证据检查',
    taskType: 'precheck',
    sectionType: 'results',
    projectName: '水泥基材料孔结构研究 · 结果段投稿前检查',
    targetJournal: 'Construction and Building Materials',
    sourceText: 'After 28 d of curing, the total porosity decreased from 18.6% to 14.2%, while the compressive strength increased from 42.5 MPa to 51.3 MPa. These results prove that the additive permanently removed all harmful pores and will improve the long-term durability of every cement-based material. No independent durability test was conducted in this study.',
    terminologyLocks: [
      { id: 'materials-precheck-term-1', source: 'total porosity', preferred: 'total porosity' },
      { id: 'materials-precheck-term-2', source: 'compressive strength', preferred: 'compressive strength' },
    ],
    focus: '检查绝对结论、未经验证的长期耐久性主张、外推范围以及结果与试验设计是否一致。',
    suggestion: '保留已报告数值，但将结论限制到当前试样和已执行的测试范围。',
  },
  {
    id: 'biomed-precheck',
    discipline: '生命医学',
    title: '讨论段：相关性不等于因果',
    taskType: 'precheck',
    sectionType: 'discussion',
    projectName: '睡眠时长与焦虑症状研究 · Discussion',
    targetJournal: 'BMC Public Health',
    sourceText: 'Participants who slept less than 6 h had higher anxiety scores than those who slept 7–8 h (mean difference, 3.2 points; 95% CI, 1.4–5.0). These findings demonstrate that short sleep causes anxiety among university students. Because the study was cross-sectional, temporal ordering could not be established.',
    terminologyLocks: [
      { id: 'biomed-term-1', source: 'cross-sectional', preferred: 'cross-sectional' },
    ],
    focus: '检查研究设计与因果措辞是否一致。',
    suggestion: '将“causes”改为“was associated with”，并把横断面研究限制放在结论附近。',
  },
  {
    id: 'cs-polish',
    discipline: '计算机与人工智能',
    title: '方法段：提升可复现性',
    taskType: 'polish',
    sectionType: 'methods',
    projectName: '医学影像分类模型 · Methods',
    targetJournal: 'IEEE Journal of Biomedical and Health Informatics',
    sourceText: 'We randomly divided the dataset and trained the model many times to obtain a stable result. The proposed network was implemented by PyTorch and the learning rate was set as 0.001. We used data augmentation to improve the generalization ability, and the best model was selected according to the test set performance.',
    terminologyLocks: [
      { id: 'cs-term-1', source: 'PyTorch', preferred: 'PyTorch' },
      { id: 'cs-term-2', source: 'learning rate', preferred: 'learning rate' },
    ],
    focus: '检查数据划分、模型选择和实验描述是否足够明确。',
    suggestion: '指出“many times”“randomly divided”过于模糊，并提醒不能用测试集选择最佳模型。',
  },
  {
    id: 'social-precheck',
    discipline: '社会科学',
    title: '调查研究：限制外推范围',
    taskType: 'precheck',
    sectionType: 'discussion',
    projectName: '研究生学术压力调查 · Discussion',
    targetJournal: 'Studies in Higher Education',
    sourceText: 'A total of 428 valid questionnaires were collected from three universities in eastern China, with a response rate of 61.4%. The results show that supervisor support significantly predicts academic persistence. Therefore, improving supervisor support will increase the persistence of all graduate students in China.',
    terminologyLocks: [
      { id: 'social-term-1', source: 'supervisor support', preferred: 'supervisor support' },
      { id: 'social-term-2', source: 'academic persistence', preferred: 'academic persistence' },
    ],
    focus: '检查样本范围、预测关系和全国性外推。',
    suggestion: '将结论限定到当前样本与研究设计，避免从三所高校直接推广到全部研究生。',
  },
  {
    id: 'environment-translate',
    discipline: '环境与生态',
    title: '中译英：保留数值和证据边界',
    taskType: 'translate',
    sectionType: 'abstract',
    projectName: '城市河流微塑料研究 · Abstract',
    targetJournal: 'Science of the Total Environment',
    sourceText: '本研究调查了某城市三条河流表层水中微塑料的丰度和组成。共采集36个样品，微塑料丰度范围为1.8–6.4 items/L。纤维是最主要的形态，占检出颗粒的62.3%。结果表明，人口密度较高的采样点通常具有更高的微塑料丰度，但本研究不能据此确认具体污染来源。',
    terminologyLocks: [
      { id: 'environment-term-1', source: '微塑料', preferred: 'microplastics' },
      { id: 'environment-term-2', source: '丰度', preferred: 'abundance' },
    ],
    focus: '检查范围值、单位、百分数和“不确认来源”的谨慎表达。',
    suggestion: '使用“was generally higher”而不是因果性措辞，并完整保留36、1.8–6.4 items/L和62.3%。',
  },
  {
    id: 'education-translate',
    discipline: '教育与心理',
    title: '中译英：方法描述与量表术语',
    taskType: 'translate',
    sectionType: 'methods',
    projectName: '研究生写作自我效能研究 · Methods',
    targetJournal: 'Higher Education Research & Development',
    sourceText: '本研究采用混合研究方法考察研究生学术写作自我效能的变化。量化阶段共有214名硕士研究生完成前测和后测问卷，质性阶段从中选取18名参与者进行半结构式访谈。问卷内部一致性系数Cronbach’s α为0.89。访谈资料由两名研究者独立编码，并通过讨论解决分歧。',
    terminologyLocks: [
      { id: 'education-term-1', source: '学术写作自我效能', preferred: 'academic writing self-efficacy' },
      { id: 'education-term-2', source: '半结构式访谈', preferred: 'semi-structured interviews' },
    ],
    focus: '检查样本数量、研究阶段、信度指标和编码流程。',
    suggestion: '保持 mixed-methods、Cronbach’s α 和 semi-structured interviews 的规范表达，不补充原文没有的抽样细节。',
  },
];

export function findResearchExample(id: string | null | undefined) {
  return id ? RESEARCH_EXAMPLES.find((example) => example.id === id) || null : null;
}

export function findResearchExampleForSource(sourceText: string) {
  const normalizedSource = sourceText.trim();
  if (!normalizedSource) return null;
  return RESEARCH_EXAMPLES.find((example) => example.sourceText.trim() === normalizedSource) || null;
}

export function getPrimaryResearchExample(taskType: TaskType) {
  return findResearchExample(PRIMARY_EXAMPLE_IDS[taskType]);
}
