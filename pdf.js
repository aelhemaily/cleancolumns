// pdf.js - Complete content for the new file

// IMPORTANT: This line imports the pdfjsLib object from the CDN
import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs';

// Now pdfjsLib is available to use
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';

export async function extractTextFromPdf(pdfBytes) {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items.map(item => item.str).join(' ');
      
      fullText += `--- PAGE ${i} ---\n\n${pageText}\n\n`;
    }

    return fullText.trim();
  } catch (error) {
    console.error('Error in pdf.js extractTextFromPdf:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}