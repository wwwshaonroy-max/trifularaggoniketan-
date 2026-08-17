import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Captures a DOM element and generates a high-quality, printable A4-sized PDF file.
 */
export async function generatePdfFromElement(elementId: string, filename: string = 'document.pdf'): Promise<void> {
  if (typeof window === 'undefined') return;

  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with ID "${elementId}" was not found.`);
  }

  // Preserve original inline style attributes
  const originalStyle = element.getAttribute('style') || '';

  // Temporarily adjust style parameters for layout rendering in PDF canvas
  element.setAttribute(
    'style',
    originalStyle + '; display: block !important; position: relative !important; width: 800px !important; color: #000 !important; background: #fff !important;'
  );

  try {
    const canvas = await html2canvas(element, {
      scale: 2, // High DPI rendering
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    // Standard A4 dimensions in points: 595.28 pt x 841.89 pt
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    const imgWidth = 595.28;
    const pageHeight = 841.89;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // Output first page
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Output overflow sections to subsequent pages
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } finally {
    // Restore original styles
    element.setAttribute('style', originalStyle);
  }
}
