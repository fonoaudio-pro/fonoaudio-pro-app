import jsPDF from 'jspdf';

interface ShareMaterialInput {
  title: string;
  imageUrl?: string;
  description?: string;
  clinicalArea?: string;
  tags?: string[];
}

// Fetch image as blob - handles private bucket URLs
async function fetchImageBlob(imageUrl: string): Promise<Blob> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error('Error descargando imagen');
  return response.blob();
}

// Fetch image as data URL - for canvas/print operations
async function fetchImageDataUrl(imageUrl: string): Promise<string> {
  const blob = await fetchImageBlob(imageUrl);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ============================================
// DOWNLOAD PNG
// ============================================
export async function downloadPng(input: ShareMaterialInput): Promise<void> {
  if (!input.imageUrl) throw new Error('No hay imagen para descargar');
  const blob = await fetchImageBlob(input.imageUrl);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${input.title.replace(/[^a-zA-Z0-9áéíóúñ]/g, '_')}_${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================
// PRINT - Formatted, not raw window.print()
// ============================================
export async function printMaterial(input: ShareMaterialInput): Promise<void> {
  if (!input.imageUrl) throw new Error('No hay imagen para imprimir');
  const dataUrl = await fetchImageDataUrl(input.imageUrl);

  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) throw new Error('No se pudo abrir ventana de impresión');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${input.title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20mm;
          color: #1e293b;
        }
        .header {
          text-align: center;
          margin-bottom: 8mm;
          width: 100%;
        }
        .header h1 {
          font-size: 18pt;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 2mm;
        }
        .header .meta {
          font-size: 9pt;
          color: #64748b;
        }
        .header .meta span {
          margin: 0 8px;
        }
        .image-container {
          max-width: 100%;
          margin-bottom: 8mm;
        }
        .image-container img {
          max-width: 100%;
          max-height: 180mm;
          object-fit: contain;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
        }
        .footer {
          width: 100%;
          border-top: 1px solid #e2e8f0;
          padding-top: 4mm;
          font-size: 8pt;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
        }
        @media print {
          body { padding: 15mm; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${input.title}</h1>
        <div class="meta">
          ${input.clinicalArea ? `<span>Área: ${input.clinicalArea}</span>` : ''}
          ${input.tags?.length ? `<span>Etiquetas: ${input.tags.join(', ')}</span>` : ''}
          <span>Fecha: ${new Date().toLocaleDateString('es-AR')}</span>
        </div>
      </div>
      <div class="image-container">
        <img src="${dataUrl}" alt="${input.title}" />
      </div>
      ${input.description ? `<div style="font-size:10pt;color:#475569;margin-bottom:8mm;text-align:center;max-width:80%">${input.description}</div>` : ''}
      <div class="footer">
        <span>Material Terapéutico</span>
        <span>${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();

  // Wait for images to load before printing
  await new Promise<void>((resolve) => {
    const checkLoaded = () => {
      const img = printWindow.document.querySelector('img');
      if (img?.complete) {
        resolve();
      } else {
        setTimeout(checkLoaded, 100);
      }
    };
    checkLoaded();
  });

  printWindow.print();
}

// ============================================
// PDF - Image + title + minimal metadata
// ============================================
export async function downloadPdf(input: ShareMaterialInput): Promise<void> {
  const dataUrl = await fetchImageDataUrl(input.imageUrl);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Header bar
  pdf.setFillColor(99, 102, 241);
  pdf.rect(0, 0, pageWidth, 25, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text(input.title, margin, 16);

  // Metadata
  let yPos = 32;
  pdf.setTextColor(100, 116, 139);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);

  const meta: string[] = [];
  if (input.clinicalArea) meta.push(`Área: ${input.clinicalArea}`);
  if (input.tags?.length) meta.push(`Etiquetas: ${input.tags.join(', ')}`);
  meta.push(`Fecha: ${new Date().toLocaleDateString('es-AR')}`);

  pdf.text(meta.join('  |  '), margin, yPos);
  yPos += 8;

  // Image
  try {
    const imgProps = pdf.getImageProperties(dataUrl);
    const imgRatio = imgProps.height / imgProps.width;
    let imgWidth = contentWidth;
    let imgHeight = contentWidth * imgRatio;

    // Limit height to available space
    const maxHeight = pageHeight - yPos - margin - 20;
    if (imgHeight > maxHeight) {
      imgHeight = maxHeight;
      imgWidth = maxHeight / imgRatio;
    }

    const imgX = margin + (contentWidth - imgWidth) / 2;
    pdf.addImage(dataUrl, 'PNG', imgX, yPos, imgWidth, imgHeight);
    yPos += imgHeight + 6;
  } catch (e) {
    pdf.setTextColor(200, 50, 50);
    pdf.text('[Error cargando imagen]', margin, yPos + 10);
    yPos += 16;
  }

  // Footer
  const footerY = pageHeight - 12;
  pdf.setDrawColor(226, 232, 240);
  pdf.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  pdf.setTextColor(148, 163, 184);
  pdf.setFontSize(8);
  pdf.text('Material Terapéutico', margin, footerY);
  pdf.text(new Date().toLocaleDateString('es-AR'), pageWidth - margin, footerY, { align: 'right' });

  const fileName = `${input.title.replace(/[^a-zA-Z0-9áéíóúñ]/g, '_')}_${Date.now()}.pdf`;
  pdf.save(fileName);
}

// ============================================
// WHATSAPP
// ============================================
export function shareWhatsApp(input: ShareMaterialInput): void {
  const text = encodeURIComponent(
    `Material terapéutico: *${input.title}*` +
    (input.clinicalArea ? `\nÁrea: ${input.clinicalArea}` : '') +
    ``
  );
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

// ============================================
// GMAIL / MAILTO
// ============================================
export function shareEmail(input: ShareMaterialInput): void {
  const subject = encodeURIComponent(`Material terapéutico: ${input.title}`);
  const body = encodeURIComponent(
    `Te comparto el material terapéutico: ${input.title}` +
    (input.clinicalArea ? `\nÁrea: ${input.clinicalArea}` : '') +
    (input.tags?.length ? `\nEtiquetas: ${input.tags.join(', ')}` : '') +
    ``
  );
  window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
}

// ============================================
// WEB SHARE API - with fallback
// ============================================
export async function shareNative(input: ShareMaterialInput): Promise<boolean> {
  if (!navigator.share) {
    shareEmail(input);
    return false;
  }

  try {
    const blob = await fetchImageBlob(input.imageUrl);
    const file = new File([blob], `${input.title}.png`, { type: 'image/png' });

    const shareData: ShareData = {
      title: input.title,
      text: `Material terapéutico: ${input.title}` +
        (input.clinicalArea ? ` | Área: ${input.clinicalArea}` : ''),
    };

    // Only add files if the API supports it
    if (navigator.canShare?.({ files: [file] })) {
      shareData.files = [file];
    }

    await navigator.share(shareData);
    return true;
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      shareEmail(input);
    }
    return false;
  }
}
