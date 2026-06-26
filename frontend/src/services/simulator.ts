import type { Message } from '../store/types'

export function generateSimReply(
  modelId: string,
  topic: string,
  history: Message[],
  round: number
): string {
  const prevAi = [...history].reverse().find(
    m => m.role === 'assistant' && !!m.content && !m.thinking
  )
  let lastSpeaker = ''
  let lastPoint = ''
  if (prevAi) {
    lastSpeaker = prevAi.modelName || '前述模型'
    lastPoint = prevAi.content.replace(/\s+/g, '').slice(0, 60)
  }
  const prevNotes = lastSpeaker ? `刚才${lastSpeaker}提到「${lastPoint}」` : ''

  const templates: Record<string, string[]> = {
    deepseek: [
      `从逻辑层面来分析"${topic}"，关键在于厘清核心概念和因果链条。${prevNotes ? `回应${prevNotes}，` : ''}我发现一个被忽视的分析维度——任何复杂问题都需要先拆解为可验证的子命题。比如这里的核心矛盾其实是"效率最优"与"风险可控"之间的张力，而非常见的二选一问题。`,
      `让我用反证法来推进讨论。${prevNotes ? `承接${prevNotes}，` : ''}假设"${topic}"的常见立场成立，那我们会推导出一些明显矛盾的结论。这说明要么前提有问题，要么推理链有断点。我倾向于认为，真正的问题定义比我们以为的要窄得多，需要重新框定。`,
      `我想从逻辑自洽性的角度补充一点。${prevNotes ? `针对${prevNotes}，` : ''}"${topic}"的核心并非表面看来的那样简单。如果我们仔细审视前提条件，会发现一个隐含假设值得质疑——我们是否在不自觉地把"相关性"当成了"因果性"？这可能是讨论陷入僵局的根源。`
    ],
    kimi: [
      `等等，让我换个完全不同的角度来看！${prevNotes ? `虽然${prevNotes}，但` : ''}如果我们把"${topic}"的前提反过来想呢？很多时候最创新的方案恰恰来自对问题本身的重新定义。与其解决这个"问题"，不如想想——这个问题本身是不是一个过时框架下的产物？`,
      `灵感来了！如果我们把"${topic}"放到一个更大的时间尺度上看呢？${prevNotes ? `回应${prevNotes}，` : ''}短期看这是挑战，长期看这可能是演化的催化剂。关键不是阻止变化，而是设计让变化朝有利方向进行的反馈机制。`,
      `我有个大胆的想法！"${topic}"也许不该被当作需要"解决"的问题，而是一个值得"拥抱"的张力。${prevNotes ? `综合${prevNotes}，` : ''}历史上很多突破性创新，恰恰是在打破"非此即彼"的二元框架后诞生的。为什么不试试"既要又要"的整合路径？`
    ],
    glm: [
      `关于"${topic}"，从多学科交叉的视角来看，这个问题在认知科学、复杂系统理论和行为经济学中都有深入的研究。${prevNotes ? `结合${prevNotes}，` : ''}我认为需要区分"表象问题"和"根因问题"——解决表象只能治标。有趣的是，不同学科对类似问题给出了殊途同归的答案。`,
      `让我提供一个历史参照系。${prevNotes ? `对照${prevNotes}，` : ''}"${topic}"并非孤例——19世纪的工业化争议、20世纪的人口论辩论，都呈现出相似的结构。从这些历史案例的结局中，我们可以提取出几个关键变量，用来预判当前问题的走向。`,
      `从知识图谱的角度梳理一下"${topic}"涉及的核心概念网络。${prevNotes ? `补充${prevNotes}，` : ''}我发现几个关键变量之间的关联模式，在生态学中叫"稳态转换"，在经济学中叫"阈值效应"，本质上是同一类系统动力学现象。这意味着其他领域的成熟理论可以迁移过来。`
    ],
    qwen: [
      `从落地实施的角度看"${topic}"，最关键的是：如何把抽象理念转化为可执行的方案。${prevNotes ? `结合${prevNotes}，` : ''}我建议聚焦三个维度：可行性、成本效益和风险控制。与其追求完美方案，不如先设计一个MVP——最小可行方案，快速验证核心假设。`,
      `讨论越来越深入了，但我想把话题拉回到实践层面。${prevNotes ? `${prevNotes}提到的观点很到位，` : ''}任何方案如果在现实约束下不能落地，都是纸上谈兵。让我提出一个分阶段实施路径：第一步低成本验证，第二步小规模试点，第三步根据反馈迭代扩展。每一步都有明确的退出标准。`,
      `我来做个务实的风险盘点。${prevNotes ? `承接${prevNotes}，` : ''}实施"${topic}"相关方案时，最大的三个风险是：利益相关方对齐、资源错配和时机窗口。我的建议是：先找到最小利益共识点，从这里开始构建信任和势能，而不是试图一步到位。`
    ]
  }

  const pool = templates[modelId] || templates.deepseek
  return pool[(round - 1) % pool.length]
}
