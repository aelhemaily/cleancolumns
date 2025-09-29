/**
 * Processes the text from the inputText area to generate an HTML table.
 * This function is called by main.js after PDF text has been extracted.
 */
function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').filter(l => l.trim());
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const table = document.createElement('table');

  // Create the header row for the table
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  const dateRegex = /^[A-Za-z]{3} \d{1,2} [A-Za-z]{3} \d{1,2}/;
  const seen = new Set();
  let buffer = []; // A buffer to hold multi-line transaction descriptions

  /**
   * Processes the content of the buffer to create a table row.
   */
  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const fullLine = buffer.join(' ');
    const match = fullLine.match(dateRegex);
    if (!match) {
      buffer = [];
      return;
    }

    // Extract the transaction date (the first of the two dates)
    let [date1Part] = match[0].match(/([A-Za-z]{3} \d{1,2})/);

    // Append the year if the user provided one
    let formattedDate = yearInput ? `${date1Part} ${yearInput}` : date1Part;
    
    const rest = fullLine.replace(dateRegex, '').trim();
    const amountMatch = rest.match(/-?\$[\d,]+\.\d{2}/);
    let debit = '', credit = '', balance = ''; // Balance is always empty for this statement type

    if (amountMatch) {
      const rawAmount = amountMatch[0];
      const amountVal = parseFloat(rawAmount.replace(/[^0-9.-]/g, ''));
      if (rawAmount.startsWith('-')) {
        credit = Math.abs(amountVal).toFixed(2);
      } else {
        debit = amountVal.toFixed(2);
      }
    }

    const desc = rest.replace(/-?\$[\d,]+\.\d{2}.*/, '').trim();

    // Check for duplicate transactions to highlight them
    const signature = `${desc.toLowerCase()}|${debit || credit}`;
    const isDuplicate = seen.has(signature);
    if (!isDuplicate) seen.add(signature);

    const rowData = [formattedDate, desc, debit, credit, balance];
    const tr = document.createElement('tr');
    if (isDuplicate) tr.style.backgroundColor = 'rgba(255, 0, 0, 0.2)'; // Highlight duplicate rows

    rowData.forEach(cellText => {
      const td = document.createElement('td');
      td.textContent = cellText;
      tr.appendChild(td);
    });

    table.appendChild(tr);
    buffer = []; // Clear the buffer for the next transaction
  };

  lines.forEach(line => {
    // A new transaction line starts with the date pattern
    if (line.match(dateRegex)) {
      flushBuffer(); // Process the previous transaction in the buffer
      buffer.push(line);
    } else {
      // This line is a continuation of the previous one (e.g., foreign currency info)
      buffer.push(line);
    }
  });

  flushBuffer(); // Process the very last transaction in the buffer

  outputDiv.appendChild(table);
}

// Make the processData function globally available so main.js can call it
window.processData = processData;

// --- PDF Parsing Logic (from cardtd.html) ---

/**
 * Cleans up transaction descriptions by removing common artifacts from PDF text extraction.
 * @param {string} description The raw description.
 * @returns {string} The cleaned description.
 */
function cleanDescription(description) {
    return description
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/The yourNewBalanceinfull.*$/i, '')
        .replace(/NETAMOUNTOFMONTHLY.*$/i, '')
        .replace(/ACTIVITY.*$/i, '')
        .replace(/AMOUNT\s*\(S\)\s*\$.*$/i, '')
        .replace(/^\s*-\s*/, '')
        .trim();
}

/**
 * A fallback function to extract transactions if the primary method fails.
 * @param {string} text The full text content from the PDF.
 * @returns {string[]} An array of formatted transaction strings.
 */
function extractTransactionsFallback(text) {
    const transactions = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Regex to find lines that look like transactions
        const match = line.match(/^([A-Z]{3}\s+\d{1,2})\s+([A-Z]{3}\s+\d{1,2})\s+(.*?)(-?\$[\d,]+\.\d{2})/);
        
        if (match) {
            const transactionDate = match[1];
            const postingDate = match[2];
            let description = cleanDescription(match[3].trim());
            const amount = match[4];
            
            // Skip lines that are likely headers or footers
            if (description.length < 3 || description.toUpperCase().includes('BALANCE') || description.toUpperCase().includes('STATEMENT')) {
                continue;
            }
            
            let foreignInfo = '';
            if (i + 1 < lines.length && lines[i + 1].includes('FOREIGN CURRENCY')) {
                foreignInfo = ' ' + lines[i + 1].trim();
                i++; // Skip the next line as it's part of this transaction
            }
            
            transactions.push(`${transactionDate} ${postingDate} ${description}${foreignInfo} ${amount}`);
        }
    }
    return transactions;
}

/**
 * Extracts transaction details from the raw text of a TD Card PDF statement.
 * This version iterates through all lines to avoid issues with multi-page statements.
 * @param {string} text The full text content extracted from the PDF.
 * @returns {string[]} An array of formatted transaction strings.
 */
function extractTransactions(text) {
    const lines = text.replace(/\r\n/g, '\n').split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Check if a transaction header exists anywhere in the document.
    const hasHeader = lines.some(line => line.includes('TRANSACTION') && line.includes('DATE') && line.includes('ACTIVITY DESCRIPTION'));

    if (!hasHeader) {
        // If no header, the format is unexpected, so use the more general fallback.
        return extractTransactionsFallback(text);
    }

    const transactions = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        // Regex to find lines that start with the transaction date pattern.
        // This version is more robust to handle optional quotes and commas from PDF extraction.
        const match = line.match(/^"?([A-Z]{3}\s+\d{1,2})"?\s*,?\s*"?([A-Z]{3}\s+\d{1,2})"?\s*,?\s*"?(.*?)"?\s*,?\s*"?(-?\$[\d,]+\.\d{2})(.*)$/);

        if (match) {
            const transactionDate = match[1];
            const postingDate = match[2];
            let description = cleanDescription(match[3].trim());
            const amount = match[4];

            // Add sanity checks to avoid parsing non-transaction data (like headers/footers) that might match the pattern
            if (description.length < 2 || 
                description.toUpperCase().includes('BALANCE') || 
                description.toUpperCase().includes('STATEMENT') ||
                description.toUpperCase().includes('ACTIVITY DESCRIPTION') ||
                description.toUpperCase().includes('PREVIOUS STATEMENT')) {
                i++;
                continue;
            }

            // Look ahead for continuation lines (e.g., foreign currency info) that belong to the current transaction
            let extraInfo = '';
            let nextIndex = i + 1;
            while (nextIndex < lines.length) {
                const nextLine = lines[nextIndex];
                // Stop if the next line looks like a new transaction
                if (nextLine.match(/^"?([A-Z]{3}\s+\d{1,2})"?\s*,?\s*"?([A-Z]{3}\s+\d{1,2})"?/)) break;
                // Also stop if it looks like a footer section
                if (nextLine.includes('NET AMOUNT') || nextLine.includes('TOTAL NEW BALANCE')) break;
                
                // If it's none of the above, it's likely a continuation line. Append it to the description.
                extraInfo += ' ' + nextLine.trim();
                i++; // Consume this line as it's part of the current transaction
                nextIndex++;
            }
            
            // Combine the main description with any extra info (like foreign currency)
            const fullDescription = description + extraInfo;
            transactions.push(`${transactionDate} ${postingDate} ${fullDescription} ${amount}`);
        }
        
        i++;
    }

    // As a final safety check, if the primary method found nothing, try the fallback
    if (transactions.length === 0) {
        return extractTransactionsFallback(text);
    }
    
    return transactions;
}

/**
 * Overrides the default PDF processor in main.js with TD Card specific logic.
 * This is called by main.js when a PDF is uploaded.
 * @param {File} file The PDF file to parse.
 * @returns {Promise<string>} A promise that resolves with the extracted text.
 */
window.bankUtils.processPDFFile = async function(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(event) {
            try {
                if (typeof pdfjsLib === 'undefined') {
                    return reject(new Error('pdf.js library is not loaded.'));
                }
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js`;

                const typedArray = new Uint8Array(event.target.result);
                const pdf = await pdfjsLib.getDocument(typedArray).promise;
                
                let fullText = '';
                
                // Extract text from all pages of the PDF
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    
                    // Group text items into lines based on their Y-coordinate
                    const lines = new Map();
                    for (const item of textContent.items) {
                        // Round the y-coordinate to group items on the same visual line
                        const y = Math.round(item.transform[5]);
                        if (!lines.has(y)) {
                            lines.set(y, []);
                        }
                        lines.get(y).push({ str: item.str, x: item.transform[4] });
                    }

                    // Sort lines by Y-coordinate (top to bottom), and items within lines by X-coordinate (left to right)
                    const sortedLines = [...lines.entries()].sort((a, b) => b[0] - a[0]);

                    let pageText = '';
                    for (const [, items] of sortedLines) {
                        items.sort((a, b) => a.x - b.x);
                        pageText += items.map(item => item.str).join(' ') + '\n';
                    }

                    fullText += pageText;
                }
                
                const transactions = extractTransactions(fullText);
                resolve(transactions.join('\n')); // Return the processed text to main.js

            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};