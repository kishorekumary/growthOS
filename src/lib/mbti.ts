export interface QuizQuestion {
  id: number
  dimension: 'EI' | 'NS' | 'TF' | 'JP'
  question: string
  options: [{ label: string; value: string }, { label: string; value: string }]
}

export interface MbtiTypeData {
  name: string
  tagline: string
  strengths: string[]
  growth: string[]
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // E / I
  { id: 0,  dimension: 'EI', question: 'In social settings, you usually feel...', options: [{ label: 'Energized and alive', value: 'E' }, { label: 'Drained and tired', value: 'I' }] },
  { id: 1,  dimension: 'EI', question: 'After a long week, you recharge best by...', options: [{ label: 'Spending time with people', value: 'E' }, { label: 'Having time alone', value: 'I' }] },
  { id: 2,  dimension: 'EI', question: 'You prefer to process your thoughts by...', options: [{ label: 'Talking them through with others', value: 'E' }, { label: 'Reflecting privately first', value: 'I' }] },
  { id: 3,  dimension: 'EI', question: 'In a group conversation, you tend to...', options: [{ label: 'Speak up frequently', value: 'E' }, { label: 'Listen and observe', value: 'I' }] },
  { id: 4,  dimension: 'EI', question: 'You find it easier to...', options: [{ label: 'Meet new people confidently', value: 'E' }, { label: 'Go deep with a few close friends', value: 'I' }] },
  // N / S
  { id: 5,  dimension: 'NS', question: 'When approaching a problem, you focus on...', options: [{ label: 'Patterns and possibilities', value: 'N' }, { label: 'Facts and concrete details', value: 'S' }] },
  { id: 6,  dimension: 'NS', question: 'You prefer working with...', options: [{ label: 'Abstract concepts and ideas', value: 'N' }, { label: 'Concrete, hands-on tasks', value: 'S' }] },
  { id: 7,  dimension: 'NS', question: 'You trust more in...', options: [{ label: 'Gut feelings and intuition', value: 'N' }, { label: 'Direct observation and experience', value: 'S' }] },
  { id: 8,  dimension: 'NS', question: 'You are more drawn to...', options: [{ label: 'Future possibilities', value: 'N' }, { label: 'Present realities', value: 'S' }] },
  { id: 9,  dimension: 'NS', question: 'When reading, you focus more on...', options: [{ label: 'Meaning and implications', value: 'N' }, { label: 'Specific facts and examples', value: 'S' }] },
  // T / F
  { id: 10, dimension: 'TF', question: 'When making decisions, you rely more on...', options: [{ label: 'Logic and objective analysis', value: 'T' }, { label: 'Values and gut feelings', value: 'F' }] },
  { id: 11, dimension: 'TF', question: 'You value more in feedback...', options: [{ label: 'Honesty, even if blunt', value: 'T' }, { label: 'Sensitivity to feelings', value: 'F' }] },
  { id: 12, dimension: 'TF', question: 'In disagreements, you focus on...', options: [{ label: 'What is logically correct', value: 'T' }, { label: 'What feels fair to everyone', value: 'F' }] },
  { id: 13, dimension: 'TF', question: 'You are persuaded more by...', options: [{ label: 'Data and solid evidence', value: 'T' }, { label: 'Personal stories and values', value: 'F' }] },
  { id: 14, dimension: 'TF', question: 'When someone shares a problem, you first...', options: [{ label: 'Analyze and offer solutions', value: 'T' }, { label: 'Empathize and listen', value: 'F' }] },
  // J / P
  { id: 15, dimension: 'JP', question: 'You prefer your schedule to be...', options: [{ label: 'Planned and structured', value: 'J' }, { label: 'Flexible and open', value: 'P' }] },
  { id: 16, dimension: 'JP', question: 'Unfinished tasks make you feel...', options: [{ label: 'Anxious until they\'re done', value: 'J' }, { label: 'Fine — they\'ll get done eventually', value: 'P' }] },
  { id: 17, dimension: 'JP', question: 'You work best with...', options: [{ label: 'Clear deadlines and structure', value: 'J' }, { label: 'Freedom to explore as you go', value: 'P' }] },
  { id: 18, dimension: 'JP', question: 'Before a trip, you...', options: [{ label: 'Plan every detail in advance', value: 'J' }, { label: 'Figure it out when you arrive', value: 'P' }] },
  { id: 19, dimension: 'JP', question: 'You find it more satisfying to...', options: [{ label: 'Finish what you started', value: 'J' }, { label: 'Start exciting new projects', value: 'P' }] },
]

export function computeMbti(answers: Record<number, string>): string {
  const count = (indices: number[], val: string) =>
    indices.filter((i) => answers[i] === val).length
  const ei = count([0, 1, 2, 3, 4], 'E') >= 3 ? 'E' : 'I'
  const ns = count([5, 6, 7, 8, 9], 'N') >= 3 ? 'N' : 'S'
  const tf = count([10, 11, 12, 13, 14], 'T') >= 3 ? 'T' : 'F'
  const jp = count([15, 16, 17, 18, 19], 'J') >= 3 ? 'J' : 'P'
  return `${ei}${ns}${tf}${jp}`
}

export const MBTI_TYPES: Record<string, MbtiTypeData> = {
  INTJ: { name: 'The Architect',    tagline: 'Strategic, independent, and driven by ideas',       strengths: ['Strategic thinking', 'Independence', 'Decisiveness', 'High standards', 'Innovation'],           growth: ['Showing vulnerability', 'Patience with others', 'Accepting imperfection', 'Emotional openness', 'Flexibility'] },
  INTP: { name: 'The Thinker',      tagline: 'Analytical, inventive, and always questioning',     strengths: ['Analytical depth', 'Creativity', 'Open-mindedness', 'Precision', 'Intellectual curiosity'],      growth: ['Follow-through', 'Communicating clearly', 'Emotional expression', 'Meeting deadlines', 'Practicality'] },
  ENTJ: { name: 'The Commander',    tagline: 'Decisive, ambitious, and natural born leaders',     strengths: ['Leadership', 'Confidence', 'Strategic planning', 'Efficiency', 'Charisma'],                      growth: ['Listening to others', 'Patience', 'Emotional sensitivity', 'Delegating control', 'Work-life balance'] },
  ENTP: { name: 'The Debater',      tagline: 'Quick-witted, resourceful, and idea-driven',        strengths: ['Quick thinking', 'Creativity', 'Resourcefulness', 'Confidence', 'Big-picture vision'],           growth: ['Focus and follow-through', 'Sensitivity', 'Consistency', 'Practical planning', 'Finishing projects'] },
  INFJ: { name: 'The Advocate',     tagline: 'Insightful, principled, and deeply compassionate',  strengths: ['Deep empathy', 'Visionary thinking', 'Integrity', 'Creativity', 'Dedication'],                   growth: ['Setting boundaries', 'Self-care', 'Avoiding perfectionism', 'Assertiveness', 'Sharing inner world'] },
  INFP: { name: 'The Mediator',     tagline: 'Empathetic, creative, and guided by values',        strengths: ['Empathy', 'Creativity', 'Open-mindedness', 'Passion', 'Idealism'],                               growth: ['Taking action', 'Handling criticism', 'Practicality', 'Self-discipline', 'Assertiveness'] },
  ENFJ: { name: 'The Protagonist',  tagline: 'Charismatic, inspiring, and deeply caring',         strengths: ['Empathy', 'Communication', 'Leadership', 'Reliability', 'Warmth'],                               growth: ['Saying no', 'Self-prioritization', 'Avoiding over-idealization', 'Handling conflict', 'Detachment'] },
  ENFP: { name: 'The Campaigner',   tagline: 'Enthusiastic, creative, and people-focused',        strengths: ['Enthusiasm', 'Creativity', 'Empathy', 'Communication', 'Adaptability'],                          growth: ['Focus', 'Follow-through', 'Routine', 'Overthinking', 'Practical planning'] },
  ISTJ: { name: 'The Inspector',    tagline: 'Reliable, meticulous, and deeply responsible',      strengths: ['Reliability', 'Thoroughness', 'Loyalty', 'Organization', 'Practicality'],                        growth: ['Adaptability', 'Openness to change', 'Emotional expression', 'Spontaneity', 'Delegation'] },
  ISFJ: { name: 'The Defender',     tagline: 'Warm, dedicated, and quietly hardworking',          strengths: ['Loyalty', 'Supportiveness', 'Attention to detail', 'Patience', 'Reliability'],                   growth: ['Assertiveness', 'Self-advocacy', 'Saying no', 'Handling change', 'Sharing needs'] },
  ESTJ: { name: 'The Executive',    tagline: 'Efficient, organized, and results-driven',          strengths: ['Organization', 'Leadership', 'Dedication', 'Directness', 'Reliability'],                         growth: ['Flexibility', 'Emotional sensitivity', 'Listening', 'Patience with ambiguity', 'Empathy'] },
  ESFJ: { name: 'The Consul',       tagline: 'Supportive, loyal, and community-minded',           strengths: ['Warmth', 'Reliability', 'Loyalty', 'Practical support', 'Social intelligence'],                  growth: ['Handling criticism', 'Independence', 'Avoiding people-pleasing', 'Self-confidence', 'Boundaries'] },
  ISTP: { name: 'The Virtuoso',     tagline: 'Practical, analytical, and hands-on',               strengths: ['Problem-solving', 'Calm under pressure', 'Practicality', 'Adaptability', 'Resourcefulness'],     growth: ['Commitment', 'Emotional communication', 'Long-term planning', 'Social connection', 'Follow-through'] },
  ISFP: { name: 'The Adventurer',   tagline: 'Gentle, artistic, and true to themselves',          strengths: ['Empathy', 'Creativity', 'Flexibility', 'Kindness', 'Authenticity'],                              growth: ['Planning ahead', 'Self-confidence', 'Assertiveness', 'Long-term thinking', 'Handling conflict'] },
  ESTP: { name: 'The Entrepreneur', tagline: 'Bold, direct, and action-oriented',                 strengths: ['Energy', 'Boldness', 'Practicality', 'Perceptiveness', 'Resourcefulness'],                       growth: ['Patience', 'Long-term thinking', 'Emotional sensitivity', 'Focus', 'Following rules'] },
  ESFP: { name: 'The Entertainer',  tagline: 'Spontaneous, energetic, and joyful',                strengths: ['Enthusiasm', 'Warmth', 'Humor', 'Practicality', 'Aesthetic sense'],                              growth: ['Long-term planning', 'Focus', 'Handling criticism', 'Organization', 'Depth of reflection'] },
}
