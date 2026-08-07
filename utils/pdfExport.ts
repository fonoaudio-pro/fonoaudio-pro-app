import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PdfExportOptions {
    title: string;
    patientName: string;
    patientAge?: number;
    patientDiagnosis?: string;
    content: string;
    footer?: string;
    fileName?: string;
    signatureImage?: string | null;
    professionalName?: string;
    professionalTitle?: string;
    professionalLicense?: string;
}

export async function exportReportToPdf(options: PdfExportOptions): Promise<void> {
    const {
        title,
        patientName,
        patientAge,
        patientDiagnosis,
        content,
        footer,
        fileName,
        signatureImage,
        professionalName,
        professionalTitle,
        professionalLicense
    } = options;

    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    // Header
    pdf.setFillColor(99, 102, 241); // indigo-600
    pdf.rect(0, 0, pageWidth, 28, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text(title, margin, 12);

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Paciente: ${patientName}${patientAge ? ` | Edad: ${patientAge} años` : ''}${patientDiagnosis ? ` | Diagnóstico: ${patientDiagnosis}` : ''}`, margin, 19);

    pdf.setFontSize(8);
    pdf.text(`Fecha: ${new Date().toLocaleDateString('es-AR')} | FonoAudio Pro AI`, margin, 25);

    // Create a temporary div with the HTML content
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = `
        width: ${contentWidth}mm;
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        font-size: 13px;
        line-height: 1.6;
        color: #1e293b;
        padding: 10mm;
        background: white;
        box-sizing: border-box;
    `;
    tempDiv.innerHTML = `
        <style>
            h1, h2, h3, h4 { color: #0f172a; font-weight: bold; margin-top: 1.2em; margin-bottom: 0.5em; }
            h1 { font-size: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
            h2 { font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
            h3 { font-size: 14px; }
            p { margin-bottom: 0.8em; text-align: justify; }
            ul, ol { margin-left: 20px; margin-bottom: 0.8em; }
            li { margin-bottom: 0.3em; }
            strong { color: #0f172a; }
            blockquote { border-left: 3px solid #6366f1; padding-left: 10px; color: #475569; margin: 1em 0; }
            table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background: #f1f5f9; color: #0f172a; font-weight: bold; }
        </style>
        ${content}
    `;
    document.body.appendChild(tempDiv);

    try {
        const canvas = await html2canvas(tempDiv, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: tempDiv.scrollWidth,
            windowWidth: tempDiv.scrollWidth,
        });

        document.body.removeChild(tempDiv);

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = contentWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let yPos = 32; // Start below header
        const availableHeight = pageHeight - margin - yPos;

        if (imgHeight <= availableHeight) {
            pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
        } else {
            // Multi-page: slice the image
            let remainingHeight = imgHeight;
            let sourceY = 0;

            while (remainingHeight > 0) {
                const sliceHeight = Math.min(availableHeight, remainingHeight);
                const sourceSliceHeight = (sliceHeight / imgHeight) * canvas.height;

                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = canvas.width;
                sliceCanvas.height = sourceSliceHeight;
                const sliceCtx = sliceCanvas.getContext('2d');
                if (sliceCtx) {
                    sliceCtx.drawImage(
                        canvas,
                        0, sourceY, canvas.width, sourceSliceHeight,
                        0, 0, canvas.width, sourceSliceHeight
                    );
                    const sliceData = sliceCanvas.toDataURL('image/png');
                    pdf.addImage(sliceData, 'PNG', margin, yPos, imgWidth, sliceHeight);
                }

                remainingHeight -= sliceHeight;
                sourceY += sourceSliceHeight;

                if (remainingHeight > 0) {
                    pdf.addPage();
                    yPos = margin;
                }
            }
        }

        // Footer on last page
        const footerY = pageHeight - 10;
        pdf.setDrawColor(226, 232, 240);
        pdf.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
        pdf.setFontSize(7);
        pdf.setTextColor(148, 163, 184);
        pdf.text(
            footer || `Generado por FonoAudio Pro AI | ${new Date().toLocaleDateString('es-AR')}`,
            margin, footerY
        );

        // Signature area
        if (signatureImage) {
            try {
                const sigWidth = 50;
                const sigHeight = 20;
                const sigX = pageWidth - margin - sigWidth;
                const sigY = footerY - 28;
                pdf.addImage(signatureImage, 'PNG', sigX, sigY, sigWidth, sigHeight);
                pdf.setDrawColor(148, 163, 184);
                pdf.line(sigX, sigY + sigHeight + 1, sigX + sigWidth, sigY + sigHeight + 1);
                const nameY = sigY + sigHeight + 5;
                pdf.setTextColor(30, 41, 59);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(7);
                if (professionalName) pdf.text(professionalName, sigX + sigWidth / 2, nameY, { align: 'center' });
                if (professionalTitle) { pdf.setFont('helvetica', 'normal'); pdf.text(professionalTitle, sigX + sigWidth / 2, nameY + 3, { align: 'center' }); }
                if (professionalLicense) pdf.text(professionalLicense, sigX + sigWidth / 2, nameY + 6, { align: 'center' });
            } catch {
                pdf.text('Firma: ____________________________', pageWidth - margin - 60, footerY);
            }
        } else {
            const profLine = professionalName ? `Firma: ${professionalName}` : 'Firma: ____________________________';
            pdf.text(profLine, pageWidth - margin - 60, footerY);
        }

        const safeName = fileName || `${title.replace(/\s+/g, '_')}_${patientName.replace(/\s+/g, '_')}`;
        pdf.save(`${safeName}.pdf`);

    } catch (error) {
        document.body.removeChild(tempDiv);
        throw error;
    }
}

/**
 * Export any DOM element to PDF (for treatment plans, guides, etc.)
 */
export async function exportElementToPdf(
    element: HTMLElement,
    options: { title: string; fileName?: string; patientName?: string }
): Promise<void> {
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    // Header
    pdf.setFillColor(99, 102, 241);
    pdf.rect(0, 0, pageWidth, 20, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(options.title, margin, 10);
    if (options.patientName) {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Paciente: ${options.patientName}`, margin, 16);
    }

    const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let yPos = 24;
    const availableHeight = pdf.internal.pageSize.getHeight() - margin - yPos;

    if (imgHeight <= availableHeight) {
        pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
    } else {
        let remainingHeight = imgHeight;
        let sourceY = 0;

        while (remainingHeight > 0) {
            const sliceHeight = Math.min(availableHeight, remainingHeight);
            const sourceSliceHeight = (sliceHeight / imgHeight) * canvas.height;

            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sourceSliceHeight;
            const sliceCtx = sliceCanvas.getContext('2d');
            if (sliceCtx) {
                sliceCtx.drawImage(canvas, 0, sourceY, canvas.width, sourceSliceHeight, 0, 0, canvas.width, sourceSliceHeight);
                pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, yPos, imgWidth, sliceHeight);
            }

            remainingHeight -= sliceHeight;
            sourceY += sourceSliceHeight;
            if (remainingHeight > 0) {
                pdf.addPage();
                yPos = margin;
            }
        }
    }

    const safeName = options.fileName || options.title.replace(/\s+/g, '_');
    pdf.save(`${safeName}.pdf`);
}
