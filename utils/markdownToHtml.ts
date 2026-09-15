/**
 * Simple markdown to HTML converter for clinical content.
 * Converts markdown headers, lists, bold, italic, and paragraphs to HTML.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  
  // If already contains HTML tags, return as-is
  if (/<[a-z][\s\S]*>/i.test(markdown)) return markdown;
  
  let html = markdown;
  
  // Remove emojis for professional appearance
  html = html.replace(/[\u{1F600}-\u{1F64F}]/gu, '');
  html = html.replace(/[\u{1F300}-\u{1F5FF}]/gu, '');
  html = html.replace(/[\u{1F680}-\u{1F6FF}]/gu, '');
  html = html.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '');
  html = html.replace(/[\u{2600}-\u{26FF}]/gu, '');
  html = html.replace(/[\u{2700}-\u{27BF}]/gu, '');
  html = html.replace(/[\u{FE00}-\u{FE0F}]/gu, '');
  html = html.replace(/[\u{200D}]/gu, '');
  html = html.replace(/[\u{20E3}]/gu, '');
  html = html.replace(/[\u{E0020}-\u{E007F}]/gu, '');
  
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
  
  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  
  // Paragraphs - wrap lines that aren't already wrapped in HTML tags
  const lines = html.split('\n');
  const processed: string[] = [];
  let inList = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      processed.push('');
      continue;
    }
    if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<li') || trimmed.startsWith('</')) {
      processed.push(line);
      inList = trimmed.startsWith('<ul') || trimmed.startsWith('<li');
    } else if (inList && trimmed.startsWith('<li')) {
      processed.push(line);
    } else {
      inList = false;
      processed.push(`<p>${trimmed}</p>`);
    }
  }
  
  return processed.join('\n');
}
