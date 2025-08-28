// baaCard.js

/**
 * Parses a date string for sorting purposes.
 * This function handles various date formats found in Bank of America statements.
 * @param {string} dateString - The raw date string from the statement.
 * @returns {Date} A Date object for consistent sorting.
 */
function parseDate(dateString) {
  // Try to parse common formats
  // Format: MM/DD/YY or MM/DD/YYYY
  const mdYMatch = dateString.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (mdYMatch) {
    const [, month, day, year] = mdYMatch;
    // Handle 2-digit year (assume 20xx for now)
    const fullYear = year.length === 2 ? `20${year}` : year;
    return new Date(`${month}/${day}/${fullYear}`);
  }

  // Fallback to a generic date for consistent sorting if no specific format matches
  // This helps ensure items that couldn't be parsed specifically still get a sortable value
  return new Date(dateString);
}


/**
 * Cleans and extracts transaction data from raw text, specifically for Bank of America statements.
 * It identifies transaction sections (deposits, withdrawals, service fees) and parses individual lines.
 * @param {string} text - The raw text extracted from the PDF.
 * @returns {Array<Object>} An array of transaction objects.
 */
function cleanAndParseTransactions(text) {
    const transactions = [];

    // Define patterns for each section
    // The (?=\nTotal...) ensures the section ends correctly, without consuming the total line itself.
    const depositSectionPattern = /Deposits and other credits\s*\n(.*?)(?=\nTotal deposits and other credits|\nWithdrawals and other debits)/gs;
    const withdrawalSectionPattern = /Withdrawals and other debits\s*\n(.*?)(?=\nTotal withdrawals and other debits|\nService fees|\nDaily ledger balances)/gs;
    const serviceFeesSectionPattern = /Service fees\s*\n(.*?)(?=\nTotal service fees|\nDaily ledger balances)/gs;


    // Helper to extract lines for a given section
    const extractSectionLines = (sectionMatch, isDebit) => {
        if (sectionMatch && sectionMatch[1]) { // Ensure sectionMatch and its captured group exist
            const sectionText = sectionMatch[1];
            // Split by newline and process each line
            const lines = sectionText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            for (const line of lines) {
                const transaction = parseTransactionLine(line, isDebit);
                if (transaction) {
                    transactions.push(transaction);
                }
            }
        }
    };

    // Extract deposits
    const depositMatch = text.match(depositSectionPattern);
    if (depositMatch) {
      extractSectionLines(depositMatch, false); // Pass false for isDebit
    }

    // Extract withdrawals
    const withdrawalMatch = text.match(withdrawalSectionPattern);
    if (withdrawalMatch) {
      extractSectionLines(withdrawalMatch, true); // Pass true for isDebit
    }

    // Extract service fees
    const serviceFeeMatch = text.match(serviceFeesSectionPattern);
    if (serviceFeeMatch) {
      extractSectionLines(serviceFeeMatch, true); // Pass true for isDebit
    }
    
    // Fallback for general transaction pattern if sections are not clearly defined or missed.
    // This pattern looks for "MM/DD/YY" or "MM/DD/YYYY" followed by description and then an amount.
    // Updated amount pattern to include optional '+' sign and allow for spaces or commas as thousands separators.
    const generalTransactionPattern = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+([\s\S]*?)\s+([-+]?\$?\d{1,3}(?:[,\s]?\d{3})*\.\d{2})/g;
    let match;
    while ((match = generalTransactionPattern.exec(text)) !== null) {
        const date = match[1];
        const description = match[2].trim().replace(/\s+/g, ' '); // Clean description
        let amount = match[3].replace('$', '').replace(/[\s,]/g, ''); // Remove spaces and commas from amount

        const isDebit = amount.startsWith('-');
        if (!isDebit && !amount.startsWith('+')) {
            amount = '+' + amount; // Ensure credit amounts have a leading plus for consistency
        }
        
        // Check for duplicates before adding, as section-based parsing might have already caught it
        const isDuplicate = transactions.some(t => t.date === date && t.description === description && t.amount === amount);
        if (!isDuplicate) {
            transactions.push({ date, description, amount });
        }
    }

    return transactions;
}

/**
 * Parses a single transaction line to extract date, description, and amount.
 * @param {string} line - A single line of text potentially containing transaction info.
 * @param {boolean} defaultIsDebit - Whether to default to debit if the sign is ambiguous.
 * @returns {Object|null} A transaction object or null if parsing fails.
 */
function parseTransactionLine(line, defaultIsDebit) {
    // Regex to match date (MM/DD/YY or MM/DD/YYYY) at the beginning
    const datePattern = /(\d{1,2}\/\d{1,2}\/\d{2,4})/;
    const dateMatch = line.match(datePattern);

    if (!dateMatch) return null; // Must have a date

    const date = dateMatch[1];
    let restOfLine = line.substring(dateMatch[0].length).trim();

    // Regex to match amount at the end, with optional negative/positive sign, commas, and dollar sign
    // Updated to include optional '+' sign and allow for spaces or commas as thousands separators.
    const amountPattern = /([-+]?\$?\d{1,3}(?:[,\s]?\d{3})*\.\d{2})$/;
    const amountMatch = restOfLine.match(amountPattern);

    if (!amountMatch) return null; // Must have an amount

    let amount = amountMatch[1].replace('$', '').replace(/[\s,]/g, ''); // Remove spaces and commas from amount
    let description = restOfLine.substring(0, restOfLine.length - amountMatch[0].length).trim();

    // Clean up extra spaces in the description
    description = description.replace(/\s+/g, ' ');

    // Determine debit/credit based on the sign
    const isDebit = amount.startsWith('-');
    if (!isDebit && defaultIsDebit) {
        amount = '-' + amount; // Force negative for withdrawal/fee if not already
    } else if (!isDebit && !amount.startsWith('+')) {
        amount = '+' + amount; // Ensure credit amounts have a leading plus
    }

    return { date, description, amount };
}


/**
 * Extracts text from a PDF file using PDF.js.
 * @param {File} file - The PDF file object.
 * @returns {Promise<string>} A promise that resolves with the extracted text.
 */
async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Join items by string, adding a space if necessary for readability
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }
    return fullText;
}

// Expose the PDF processing function to window.bankUtils
window.bankUtils = window.bankUtils || {};
window.bankUtils.processPDFFile = async function(file) {
    try {
        const rawText = await extractTextFromPDF(file);
        const transactions = cleanAndParseTransactions(rawText);
        // The main.js expects a single string of combined text to then call parseLines.
        // We need to format the extracted transactions into a string that parseLines can handle.
        // Each transaction will be on a new line, mimicking pasted text.
        return transactions.map(t => `${t.date} ${t.description} ${t.amount}`).join('\n');
    } catch (error) {
        console.error('Error in window.bankUtils.processPDFFile for BAA:', error);
        throw new Error('Failed to process Bank of America PDF: ' + error.message);
    }
};

/**
 * Helper to convert numeric month to abbreviated month name.
 * @param {string} monthNum - The numeric month (e.g., "01" for January).
 * @returns {string} Abbreviated month name (e.g., "Jan").
 */
function getMonthAbbreviation(monthNum) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(monthNum, 10) - 1];
}


/**
 * Parses lines of text (from manual input or PDF extraction) into structured transaction objects.
 * This function is adapted for Bank of America, using only positive/negative amounts for debit/credit.
 * It does NOT use keywords or categories as per the user's instructions.
 * @param {string} text - The input text containing transaction lines.
 * @param {string} yearInput - Optional year to append to dates for full date context.
 * @returns {Array<Object>} An array of processed transaction items.
 */
function parseLines(text, yearInput) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);

  return lines.map(line => {
    // Regex to extract date, description, and amount based on the format: "MM/DD/YY or YYYY Description Amount"
    // Updated amount pattern to include optional '+' sign and allow for spaces or commas as thousands separators.
    const transactionPattern = /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+([\s\S]*?)\s*([-+]?\$?\d{1,3}(?:[,\s]?\d{3})*\.\d{2})$/;
    const match = line.match(transactionPattern);

    if (!match) {
        console.warn('Skipping unmatchable line:', line);
        return null; // Skip lines that don't match the expected pattern
    }

    let [, date, description, amount] = match;

    // Clean and normalize data
    date = date.trim();
    description = description.trim().replace(/\s+/g, ' '); // Replace multiple spaces with single
    amount = amount.replace('$', '').replace(/[\s,]/g, '').trim(); // Remove spaces and commas from amount before processing

    // --- Date Formatting (mm/dd/yy or mm/dd/yyyy to Mon DD YYYY) ---
    let formattedDate = '';
    const dateParts = date.split('/');
    if (dateParts.length === 3) {
        let month = dateParts[0];
        let day = dateParts[1];
        let year = dateParts[2];

        // Ensure year is 4 digits
        if (year.length === 2) {
            year = `20${year}`;
        }

        // Use yearInput if provided and applicable
        if (yearInput && yearInput.length === 4) {
            year = yearInput;
        }
        
        formattedDate = `${getMonthAbbreviation(month)} ${day.padStart(2, '0')} ${year}`;
    } else {
        // Fallback to original date if format is unexpected for transformation
        formattedDate = date;
    }
    // --- End Date Formatting ---

    // Determine debit/credit based on amount sign
    const isDebit = amount.startsWith('-');
    // Remove '+' or '-' signs for display in DR/CR columns
    const cleanAmount = amount.replace(/[-+]/, ''); 

    const debit = isDebit ? cleanAmount : '';
    const credit = !isDebit ? cleanAmount : '';

    return {
      rawDate: formattedDate, // Use formatted date for display
      parsedDate: parseDate(date), // Keep original date string for sorting
      row: [formattedDate, description, '', debit, credit, ''] // No category for BAA
    };
  }).filter(Boolean); // Filter out any null returns from unmatchable lines
}


/**
 * Main function to process data and render the table for Bank of America statements.
 * This function will be called by main.js.
 */
function processData() {
  const yearInput = document.getElementById('yearInput').value.trim();
  const input = document.getElementById('inputText').value.trim();
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = ''; // Clear previous output

  const allItems = parseLines(input, yearInput);

  // Sort all items by parsed date
  allItems.sort((a, b) => a.parsedDate - b.parsedDate);

  const headers = ['Date', 'Description', 'ACC', 'DR', 'CR', 'Balance']; // Adjusted headers
  const table = document.createElement('table');

  // Create and append the header row with column names
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  const rows = []; // Array to store processed row data

  // Populate the table with transaction rows
  allItems.forEach(({ row }) => {
    rows.push(row);
    const tr = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(rows); // Store rows in dataset for external use (e.g., saving)

  // Ensure toolbar is visible and interactive features are setup after table generation
  document.getElementById('toolbar').classList.add('show');
  if (typeof window.bankUtils.setupCellSelection === 'function') {
    window.bankUtils.setupCellSelection(table);
  }
  if (typeof window.bankUtils.setupTableContextMenu === 'function') {
    window.bankUtils.setupTableContextMenu(table);
  }
  if (typeof window.bankUtils.setupCellDragAndDrop === 'function') {
    window.bankUtils.setupCellDragAndDrop(table);
  }
  if (typeof window.bankUtils.setupColumnResizing === 'function') {
    window.bankUtils.setupColumnResizing(table);
  }
  // Save the state of the table for undo/redo functionality
  if (typeof saveState === 'function') { // saveState is defined in main.js
    saveState();
  }
}

// Export processData globally for main.js to call
window.processData = processData;
