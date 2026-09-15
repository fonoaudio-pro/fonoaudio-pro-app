// Convierte tools en formato Gemini a formato OpenAI/Groq
// Gemini enum values: "STRING", "NUMBER", "INTEGER", "BOOLEAN", "ARRAY", "OBJECT"
// OpenAI expects: "string", "number", "integer", "boolean", "array", "object"

function normalizeType(type: any): string {
  if (typeof type === 'string') {
    const lower = type.toLowerCase();
    const valid = ['string', 'number', 'integer', 'boolean', 'array', 'object'];
    if (valid.includes(lower)) return lower;
    // Mapeo de valores enum Gemini (STRING, NUMBER, etc.)
    const map: Record<string, string> = {
      'string': 'string', 'number': 'number', 'integer': 'integer',
      'boolean': 'boolean', 'array': 'array', 'object': 'object',
    };
    return map[lower] || 'string';
  }
  if (typeof type === 'number') {
    const numMap: Record<number, string> = {
      0: 'string', 1: 'number', 2: 'integer', 3: 'boolean', 4: 'array', 5: 'object'
    };
    return numMap[type] || 'object';
  }
  return 'string';
}

function convertParameters(params: any): any {
  if (!params) return { type: 'object', properties: {} };

  const converted: any = {};
  converted.type = normalizeType(params.type);

  if (params.properties) {
    converted.properties = {};
    for (const [key, value] of Object.entries(params.properties)) {
      const prop = value as any;
      const convertedProp: any = {};
      convertedProp.type = normalizeType(prop.type);

      if (prop.description) convertedProp.description = prop.description;
      if (prop.enum) convertedProp.enum = prop.enum;

      if (prop.items) {
        convertedProp.items = convertParameters(prop.items);
      }

      converted.properties[key] = convertedProp;
    }
  }

  if (params.required) {
    converted.required = params.required;
  }

  return converted;
}

export function convertToOpenAITools(geminiTools: any[]) {
  const openaiTools: any[] = [];

  for (const wrapper of geminiTools) {
    if (wrapper.functionDeclarations) {
      for (const fd of wrapper.functionDeclarations) {
        openaiTools.push({
          type: 'function',
          function: {
            name: fd.name,
            description: fd.description || '',
            parameters: convertParameters(fd.parameters || { type: 'object', properties: {} }),
          },
        });
      }
    }
  }

  return openaiTools;
}
