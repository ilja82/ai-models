import {ModelEfforts} from './ai-model.model';

export const AI_MODEL_EFFORTS: Record<string, ModelEfforts> = {
  'claude-haiku-4.5': {
    effort: 'reasoning',
    levels: [
      {
        effort: 'non-reasoning',
        overallIntelligence: 15.4,
        tokensPerRun: null,
        tokensPerSecond: 84,
        inputProcessingTime: 0.5,
        thinkingTime: 0.0,
        outputTime: 6.0
      },
      {
        effort: 'reasoning',
        overallIntelligence: 16.9,
        tokensPerRun: 581,
        tokensPerSecond: 94,
        inputProcessingTime: 19.5,
        thinkingTime: 0.0,
        outputTime: 5.3
      },
    ],
  },
  'claude-opus-4.6': {
    effort: 'max',
    levels: [
      {
        effort: 'high',
        overallIntelligence: 26.4,
        tokensPerRun: null,
        tokensPerSecond: 39,
        inputProcessingTime: 2.2,
        thinkingTime: 0.0,
        outputTime: 12.8
      },
      {
        effort: 'max',
        overallIntelligence: 31.9,
        tokensPerRun: null,
        tokensPerSecond: 45,
        inputProcessingTime: 16.4,
        thinkingTime: 0.0,
        outputTime: 11.1
      },
    ],
  },
  'claude-opus-4.7': {
    effort: 'max',
    levels: [
      {
        effort: 'high',
        overallIntelligence: 30.9,
        tokensPerRun: null,
        tokensPerSecond: 50,
        inputProcessingTime: 1.3,
        thinkingTime: 0.0,
        outputTime: 10.1
      },
      {
        effort: 'max',
        overallIntelligence: 40.7,
        tokensPerRun: null,
        tokensPerSecond: 54,
        inputProcessingTime: 22.7,
        thinkingTime: 0.0,
        outputTime: 9.2
      },
    ],
  },
  'claude-opus-4.8': {
    effort: 'max',
    levels: [
      {
        effort: 'max',
        overallIntelligence: 41.8,
        tokensPerRun: 3_312,
        tokensPerSecond: 63,
        inputProcessingTime: 29.2,
        thinkingTime: 0.0,
        outputTime: 7.9
      },
    ],
  },
  'claude-sonnet-4.6': {
    effort: 'max',
    levels: [
      {
        effort: 'non-reasoning',
        overallIntelligence: 24.7,
        tokensPerRun: null,
        tokensPerSecond: 47,
        inputProcessingTime: 1.0,
        thinkingTime: 0.0,
        outputTime: 10.6
      },
      {
        effort: 'low',
        overallIntelligence: 23.3,
        tokensPerRun: null,
        tokensPerSecond: 46,
        inputProcessingTime: 1.1,
        thinkingTime: 0.0,
        outputTime: 10.9
      },
      {
        effort: 'max',
        overallIntelligence: 30.1,
        tokensPerRun: 3_317,
        tokensPerSecond: 56,
        inputProcessingTime: 64.0,
        thinkingTime: 0.0,
        outputTime: 8.9
      },
    ],
  },
  'glm-4.7-flash': {
    effort: 'reasoning',
    levels: [
      {
        effort: 'non-reasoning',
        overallIntelligence: 10.6,
        tokensPerRun: null,
        tokensPerSecond: 99,
        inputProcessingTime: 1.7,
        thinkingTime: 0.0,
        outputTime: 5.0
      },
      {
        effort: 'reasoning',
        overallIntelligence: 14.9,
        tokensPerRun: null,
        tokensPerSecond: 85,
        inputProcessingTime: 1.2,
        thinkingTime: 23.5,
        outputTime: 5.9
      },
    ],
  },
  'glm-4.7-flash-local': {
    effort: 'reasoning',
    levels: [
      {
        effort: 'non-reasoning',
        overallIntelligence: 8.6,
        tokensPerRun: null,
        tokensPerSecond: 99,
        inputProcessingTime: 1.7,
        thinkingTime: 0.0,
        outputTime: 5.0
      },
      {
        effort: 'reasoning',
        overallIntelligence: 12.9,
        tokensPerRun: null,
        tokensPerSecond: 85,
        inputProcessingTime: 1.2,
        thinkingTime: 23.5,
        outputTime: 5.9
      },
    ],
  },
  'glm-5': {
    effort: 'reasoning',
    levels: [
      {
        effort: 'non-reasoning',
        overallIntelligence: 21.8,
        tokensPerRun: null,
        tokensPerSecond: 68,
        inputProcessingTime: 1.9,
        thinkingTime: 0.0,
        outputTime: 7.3
      },
      {
        effort: 'reasoning',
        overallIntelligence: 27.9,
        tokensPerRun: null,
        tokensPerSecond: 68,
        inputProcessingTime: 1.7,
        thinkingTime: 45.7,
        outputTime: 7.4
      },
    ],
  },
  'gpt-oss-120B': {
    effort: 'high',
    levels: [
      {
        effort: 'low',
        overallIntelligence: 10.2,
        tokensPerRun: null,
        tokensPerSecond: 263,
        inputProcessingTime: 0.8,
        thinkingTime: 7.6,
        outputTime: 1.9
      },
      {
        effort: 'high',
        overallIntelligence: 11.6,
        tokensPerRun: 566,
        tokensPerSecond: 208,
        inputProcessingTime: 0.8,
        thinkingTime: 9.6,
        outputTime: 2.4
      },
    ],
  },
  'gpt-oss-120B-local': {
    effort: 'high',
    levels: [
      {
        effort: 'low',
        overallIntelligence: 8.2,
        tokensPerRun: null,
        tokensPerSecond: 263,
        inputProcessingTime: 0.8,
        thinkingTime: 7.6,
        outputTime: 1.9
      },
      {
        effort: 'high',
        overallIntelligence: 9.6,
        tokensPerRun: 566,
        tokensPerSecond: 208,
        inputProcessingTime: 0.8,
        thinkingTime: 9.6,
        outputTime: 2.4
      },
    ],
  },
  'gpt-oss-20B': {
    effort: 'high',
    levels: [
      {
        effort: 'low',
        overallIntelligence: 10.0,
        tokensPerRun: null,
        tokensPerSecond: 175,
        inputProcessingTime: 0.9,
        thinkingTime: 11.4,
        outputTime: 2.9
      },
      {
        effort: 'high',
        overallIntelligence: 9.0,
        tokensPerRun: 339,
        tokensPerSecond: 152,
        inputProcessingTime: 0.8,
        thinkingTime: 13.2,
        outputTime: 3.3
      },
    ],
  },
  'gpt-oss-20B-local': {
    effort: 'high',
    levels: [
      {
        effort: 'low',
        overallIntelligence: 8.0,
        tokensPerRun: null,
        tokensPerSecond: 175,
        inputProcessingTime: 0.9,
        thinkingTime: 11.4,
        outputTime: 2.9
      },
      {
        effort: 'high',
        overallIntelligence: 7.0,
        tokensPerRun: 339,
        tokensPerSecond: 152,
        inputProcessingTime: 0.8,
        thinkingTime: 13.2,
        outputTime: 3.3
      },
    ],
  },
  'kimi-k2.5': {
    effort: 'reasoning',
    levels: [
      {
        effort: 'non-reasoning',
        overallIntelligence: 19.4,
        tokensPerRun: null,
        tokensPerSecond: 52,
        inputProcessingTime: 2.4,
        thinkingTime: 0.0,
        outputTime: 9.6
      },
      {
        effort: 'reasoning',
        overallIntelligence: 23.5,
        tokensPerRun: null,
        tokensPerSecond: 68,
        inputProcessingTime: 1.8,
        thinkingTime: 43.4,
        outputTime: 7.3
      },
    ],
  },
  'minimax-m2.1': {
    effort: 'reasoning',
    levels: [
      {
        effort: 'reasoning',
        overallIntelligence: 20.9,
        tokensPerRun: null,
        tokensPerSecond: 68,
        inputProcessingTime: 1.6,
        thinkingTime: 29.6,
        outputTime: 7.4
      },
    ],
  },
  'minimax-m2.5': {
    effort: 'reasoning',
    levels: [
      {
        effort: 'reasoning',
        overallIntelligence: 22.8,
        tokensPerRun: null,
        tokensPerSecond: 65,
        inputProcessingTime: 1.7,
        thinkingTime: 30.6,
        outputTime: 7.6
      },
    ],
  },
  'qwen3-235B': {
    effort: 'reasoning',
    levels: [
      {
        effort: 'non-reasoning',
        overallIntelligence: 8.3,
        tokensPerRun: null,
        tokensPerSecond: null,
        inputProcessingTime: null,
        thinkingTime: null,
        outputTime: null
      },
      {
        effort: 'reasoning',
        overallIntelligence: 9.5,
        tokensPerRun: null,
        tokensPerSecond: null,
        inputProcessingTime: null,
        thinkingTime: null,
        outputTime: null
      },
    ],
  },
  'qwen3-coder-30B': {
    effort: 'non-reasoning',
    levels: [
      {
        effort: 'non-reasoning',
        overallIntelligence: 9.6,
        tokensPerRun: null,
        tokensPerSecond: 244,
        inputProcessingTime: 1.1,
        thinkingTime: 0.0,
        outputTime: 2.1
      },
    ],
  },
  'qwen3-coder-30B-local': {
    effort: 'non-reasoning',
    levels: [
      {
        effort: 'non-reasoning',
        overallIntelligence: 7.6,
        tokensPerRun: null,
        tokensPerSecond: 244,
        inputProcessingTime: 1.1,
        thinkingTime: 0.0,
        outputTime: 2.1
      },
    ],
  },
  'qwen3.5-27B-local': {
    effort: 'reasoning',
    levels: [
      {
        effort: 'non-reasoning',
        overallIntelligence: 17.4,
        tokensPerRun: null,
        tokensPerSecond: 81,
        inputProcessingTime: 5.5,
        thinkingTime: 0.0,
        outputTime: 6.1
      },
      {
        effort: 'reasoning',
        overallIntelligence: 20.9,
        tokensPerRun: null,
        tokensPerSecond: 78,
        inputProcessingTime: 5.5,
        thinkingTime: 25.7,
        outputTime: 6.4
      },
    ],
  },
  'qwen3.5-35B-local': {
    effort: 'reasoning',
    levels: [
      {
        effort: 'non-reasoning',
        overallIntelligence: 13.1,
        tokensPerRun: null,
        tokensPerSecond: 169,
        inputProcessingTime: 2.0,
        thinkingTime: 0.0,
        outputTime: 3.0
      },
      {
        effort: 'reasoning',
        overallIntelligence: 17.3,
        tokensPerRun: null,
        tokensPerSecond: 148,
        inputProcessingTime: 2.0,
        thinkingTime: 13.5,
        outputTime: 3.4
      },
    ],
  },
  'qwen3.5-9B-local': {
    effort: 'reasoning',
    levels: [
      {
        effort: 'non-reasoning',
        overallIntelligence: 11.3,
        tokensPerRun: null,
        tokensPerSecond: 78,
        inputProcessingTime: 0.8,
        thinkingTime: 0.0,
        outputTime: 6.4
      },
      {
        effort: 'reasoning',
        overallIntelligence: 9.2,
        tokensPerRun: 2_332,
        tokensPerSecond: 59,
        inputProcessingTime: 1.9,
        thinkingTime: 34.0,
        outputTime: 8.5
      },
    ],
  },
  'qwen3.6-27B-local': {
    effort: 'reasoning',
    levels: [
      {
        effort: 'non-reasoning',
        overallIntelligence: 17.8,
        tokensPerRun: null,
        tokensPerSecond: 58,
        inputProcessingTime: 3.6,
        thinkingTime: 0.0,
        outputTime: 8.6
      },
      {
        effort: 'reasoning',
        overallIntelligence: 19.4,
        tokensPerRun: 1_086,
        tokensPerSecond: 58,
        inputProcessingTime: 3.6,
        thinkingTime: 98.6,
        outputTime: 8.7
      },
    ],
  },
  'qwen3.6-35B-a3B-local': {
    effort: 'reasoning',
    levels: [
      {
        effort: 'non-reasoning',
        overallIntelligence: 13.2,
        tokensPerRun: null,
        tokensPerSecond: 156,
        inputProcessingTime: 2.0,
        thinkingTime: 0.0,
        outputTime: 3.2
      },
      {
        effort: 'reasoning',
        overallIntelligence: 16.2,
        tokensPerRun: 1_585,
        tokensPerSecond: 136,
        inputProcessingTime: 2.0,
        thinkingTime: 39.5,
        outputTime: 3.7
      },
    ],
  },
};
