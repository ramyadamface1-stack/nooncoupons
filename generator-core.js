// Compatibility facade. All generation policy now lives in generator-core-v2.js.
// External Gemini/Grok/Groq providers were intentionally removed from runtime code.
export {
  GENERATOR_DEFAULTS,
  readState,
  providerReadiness,
  pickTopic,
  auditGenerated,
  generateArticle,
  publishGenerated
} from './generator-core-v2.js';
