import { GoogleGenerativeAI } from '@google/generative-ai';

const MAX_TEXT_LENGTH = 480;
const MAX_GUIDANCE_ITEMS = 5;
const AI_CONTENT_VERSION = 1;
const FORBIDDEN_CLAIMS = /\b(cures?|cured|guaranteed|clinically proven|dermatologist[- ]approved|pregnancy safe|(?:treat|treats|treating)\s+(?:acne|pigmentation|eczema|rosacea|melasma|disease|infection))\b/i;
const CONCENTRATION_PATTERN = /\b\d+(?:\.\d+)?\s?%/g;

const readString = (value, field, maxLength = 180) => {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new Error(`AI product content has an invalid ${field}.`);
  }
  if (FORBIDDEN_CLAIMS.test(value)) {
    throw new Error(`AI product content contains an unsupported medical or efficacy claim in ${field}.`);
  }
  return value.trim();
};

const readStringList = (value, field) => {
  if (!Array.isArray(value) || value.length > MAX_GUIDANCE_ITEMS) {
    throw new Error(`AI product content has an invalid ${field} list.`);
  }
  return value.map((item, index) => readString(item, `${field}[${index}]`));
};

const validateProductInput = (product) => {
  const name = readString(product.name, 'product name', 160);
  const brand = readString(product.brand, 'brand', 100);
  const category = readString(product.category, 'category', 80);
  const ingredients = (product.ingredients || [])
    .map((ingredient) => ({
      name: typeof ingredient === 'string' ? ingredient.trim() : ingredient?.name?.trim(),
      concentration:
        typeof ingredient === 'string' ? '' : ingredient?.concentration?.trim() || '',
    }))
    .filter((ingredient) => ingredient.name);

  if (ingredients.length > 40) throw new Error('Product contains too many ingredients to generate guidance.');

  return {
    name,
    brand,
    category,
    description: typeof product.description === 'string' ? product.description.slice(0, 1200) : '',
    ingredients,
    targetConcerns: Array.isArray(product.targetConcerns) ? product.targetConcerns.slice(0, 10) : [],
    suitableSkinTypes: Array.isArray(product.suitableSkinTypes)
      ? product.suitableSkinTypes.slice(0, 10)
      : [],
    benefits: Array.isArray(product.benefits) ? product.benefits.slice(0, 10) : [],
    verifiedInstructions: Array.isArray(product.usageInstructions)
      ? product.usageInstructions.slice(0, 10)
      : [],
    verifiedPrecautions: Array.isArray(product.precautions) ? product.precautions.slice(0, 10) : [],
  };
};

const parseJsonResponse = (text) => {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
};

export const validateGeneratedContent = (response, product, modelName) => {
  const input = validateProductInput(product);
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('AI product content must be a JSON object.');
  }

  const description = readString(response.description, 'description', MAX_TEXT_LENGTH);
  const targetConcerns = readStringList(response.targetConcerns, 'targetConcerns');
  const suitableSkinTypes = readStringList(response.suitableSkinTypes, 'suitableSkinTypes');
  const benefits = readStringList(response.benefits, 'benefits');
  const instructions = readStringList(response.instructions, 'instructions');
  const timeOfUse = readString(response.timeOfUse, 'timeOfUse', 100);
  const precautions = readStringList(response.precautions, 'precautions');
  const ingredientNames = new Set(input.ingredients.map((ingredient) => ingredient.name.toLowerCase()));

  if (!['Morning', 'Evening', 'Morning and evening', 'Any time', 'Follow the product label for timing'].includes(timeOfUse)) {
    throw new Error('AI product content has an unsupported timeOfUse value.');
  }

  if (!Array.isArray(response.ingredientFunctions) || response.ingredientFunctions.length > 12) {
    throw new Error('AI product content has an invalid ingredientFunctions list.');
  }
  const ingredientFunctions = response.ingredientFunctions.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`AI product content has an invalid ingredientFunctions[${index}].`);
    }
    const name = readString(item.name, `ingredientFunctions[${index}].name`, 100);
    if (!ingredientNames.has(name.toLowerCase())) {
      throw new Error(`AI product content introduced an unknown ingredient: ${name}.`);
    }
    return {
      name,
      function: readString(item.function, `ingredientFunctions[${index}].function`, 180),
    };
  });

  const sourceText = JSON.stringify(input);
  const verifiedConcentrations = new Set(
    [...sourceText.matchAll(CONCENTRATION_PATTERN)].map((match) => match[0].replace(/\s/g, '').toLowerCase())
  );
  const generatedText = JSON.stringify({
    description,
    targetConcerns,
    suitableSkinTypes,
    benefits,
    instructions,
    timeOfUse,
    precautions,
    ingredientFunctions,
  });
  for (const match of generatedText.matchAll(CONCENTRATION_PATTERN)) {
    if (!verifiedConcentrations.has(match[0].replace(/\s/g, '').toLowerCase())) {
      throw new Error(`AI product content introduced an unverified concentration: ${match[0]}.`);
    }
  }

  if (!targetConcerns.length || !suitableSkinTypes.length || !benefits.length || !instructions.length || !precautions.length) {
    throw new Error('AI product content is incomplete.');
  }

  return {
    version: AI_CONTENT_VERSION,
    contentSource: 'ai-generated-guidance',
    generatedAt: new Date(),
    model: modelName,
    description,
    skinGoals: { targetConcerns, suitableSkinTypes, benefits },
    howToUse: { instructions, timeOfUse, precautions },
    ingredientFunctions,
  };
};

export const hasCompleteAiProductContent = (content) =>
  content?.version === AI_CONTENT_VERSION &&
  content?.contentSource === 'ai-generated-guidance' &&
  Boolean(content.description?.trim()) &&
  Boolean(content.skinGoals?.targetConcerns?.length) &&
  Boolean(content.skinGoals?.suitableSkinTypes?.length) &&
  Boolean(content.skinGoals?.benefits?.length) &&
  Boolean(content.howToUse?.instructions?.length) &&
  Boolean(content.howToUse?.precautions?.length);

export const generateAiProductContent = async (product) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured; AI product content was not generated.');
  }

  const input = validateProductInput(product);
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel(
    {
      model: modelName,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    },
    { timeout: 45000 }
  );
  const prompt = `
Write concise, product-specific SUPPLEMENTARY skincare guidance for the supplied product record.
All output is AI-generated general information, not manufacturer directions or medical advice.
Use only the supplied name, brand, category, description, verified ingredient names/concentrations, skin goals, and manufacturer instructions/warnings as your factual basis.
Do not invent ingredients, percentages, product claims, evidence, manufacturer directions, allergies, pregnancy safety, or guaranteed results. Do not claim to cure or treat a medical condition.
Use the supplied manufacturer instructions and warnings as context and never contradict or replace them. If no timing is supportable, return "Follow the product label for timing". Suggested use must be clearly general guidance. Include a patch-test caution and avoid automatically recommending combinations with strong actives.
Only return ingredientFunctions for supplied ingredient names and describe general cosmetic ingredient roles, not product efficacy.
Return only valid JSON with exactly these fields:
{"description":"string","targetConcerns":["string"],"suitableSkinTypes":["string"],"benefits":["string"],"instructions":["string"],"timeOfUse":"Morning|Evening|Morning and evening|Any time|Follow the product label for timing","precautions":["string"],"ingredientFunctions":[{"name":"exact supplied ingredient name","function":"general cosmetic role"}]}
Use short, specific entries. If skin-type suitability cannot reasonably be inferred from the supplied product context, use ["Not specified from available product information"] rather than guessing. Do not make up product-specific outcomes.
Product data:
${JSON.stringify(input)}
`.trim();

  const result = await model.generateContent(prompt, { timeout: 45000 });
  const response = parseJsonResponse(result.response.text());
  return validateGeneratedContent(response, input, modelName);
};
