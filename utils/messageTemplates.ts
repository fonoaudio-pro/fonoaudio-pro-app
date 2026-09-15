export type DeliveryMethod = 'whatsapp' | 'email' | 'printed' | 'in_person';

export const generateMessage = (patientName: string, guideTitle: string, method: DeliveryMethod): string => {
  switch (method) {
    case 'whatsapp':
      return `¡Hola! 👋 Te comparto la guía de actividades para *${patientName}*: *${guideTitle}*. \n\nPor favor, revísala y cualquier duda me comentas. 😊`;
    case 'email':
      return `Estimados,\n\nAdjunto la guía de apoyo terapéutico para *${patientName}* correspondiente a la sesión de hoy: *${guideTitle}*.\n\nSaludos cordiales.`;
    default:
      return '';
  }
};

export const stripHtml = (html: string): string => {
  // Remove script and style elements
  let stripped = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Remove all other tags
  stripped = stripped.replace(/<[^>]+>/g, '');
  // Replace common HTML entities
  stripped = stripped.replace(/&nbsp;/g, ' ')
                     .replace(/&amp;/g, '&')
                     .replace(/&lt;/g, '<')
                     .replace(/&gt;/g, '>')
                     .replace(/&quot;/g, '"')
                     .replace(/&#39;/g, "'");
  // Replace multiple spaces/newlines with single one for cleaner text
  return stripped.replace(/\s\s+/g, ' ').trim();
};
