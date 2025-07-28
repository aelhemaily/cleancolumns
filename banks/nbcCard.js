// nbcCard.js - Integrated PDF processing and NBC Card statement parsing

// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

// Set up PDF.js worker source
// This line must be present to allow PDF.js to function
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// --- UI Utility Functions (Copied from pars.html for direct use) ---
/**
 * Displays a message in the message box.
 * Assumes a div with id 'messageBox' exists in the HTML.
 * @param {string} message - The message to display.
 * @param {string} type - The type of message (e.g., 'error', 'info').
 */
function showMessage(message, type = 'info') {
  const messageBox = document.getElementById('messageBox');
  if (messageBox) {
    messageBox.textContent = message;
    messageBox.className = `message-box show bg-${type === 'error' ? 'red' : 'yellow'}-100 border-${type === 'error' ? 'red' : 'yellow'}-400 text-${type === 'error' ? 'red' : 'yellow'}-700`;
  } else {
    console.warn("Message box not found in DOM.");
  }
}

/**
 * Clears the message box.
 * Assumes a div with id 'messageBox' exists in the HTML.
 */
function clearMessage() {
  const messageBox = document.getElementById('messageBox');
  if (messageBox) {
    messageBox.textContent = '';
    messageBox.classList.remove('show');
  } else {
    console.warn("Message box not found in DOM.");
  }
}

// --- PDF Parsing Logic (Adapted from parsernbccard.html) ---

/**
 * Processes a PDF file to extract transaction data.
 * @param {File} file - The PDF file to process.
 * @returns {Promise<string>} - A promise that resolves with the extracted text, or an empty string on error.
 */
window.bankUtils.processPDFFile = async function(file) {
  clearMessage(); // Clear any previous messages
  showMessage('Processing PDF... Please wait.', 'info');

  if (!file || file.type !== 'application/pdf') {
    showMessage('Please upload a valid PDF file.', 'error');
    return ""; // Return empty string if not a PDF
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const transactionSet = new Set(); // Use a Set to store unique transactions

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const textItems = textContent.items.map(item => item.str);
      const pageText = textItems.join(' ');

      // Regex to capture transaction patterns from NBC Business Credit Card statements
      // This regex captures:
      // Group 1: Transaction Month (1-2 digits)
      // Group 2: Transaction Day (1-2 digits)
      // Group 3: Reference Code (alphanumeric)
      // Group 4: Posted Month (1-2 digits)
      // Group 5: Posted Day (1-2 digits)
      // Group 6: Description (any characters, including spaces, commas, etc., non-greedy)
      // Group 7: Amount (digits, commas, decimal, optional hyphen at the end)
      const transactionRegex = /(\d{1,2})\s+(\d{1,2})\s+([A-Za-z0-9]+)\s+(\d{1,2})\s+(\d{1,2})\s+([A-Z0-9\s.,'#&-]+?)\s+([\d,]+\.\d{2}-?)/g;
      let match;

      while ((match = transactionRegex.exec(pageText)) !== null) {
        // Extracting captured groups
        const transactionMonth = match[1].padStart(2, '0');
        const transactionDay = match[2].padStart(2, '0');
        const reference = match[3];
        const postedMonth = match[4].padStart(2, '0');
        const postedDay = match[5].padStart(2, '0');
        const description = match[6].trim().replace(/\s+/g, ' '); // Normalize spaces
        const amount = match[7].replace(/,/g, ''); // Keep the hyphen if present

        // Construct the transaction string in the desired format
        const transactionString = `${transactionMonth} ${transactionDay} ${reference} ${postedMonth} ${postedDay} ${description} ${amount}`;
        
        // Add to set to ensure uniqueness
        transactionSet.add(transactionString);
      }
    }

    if (transactionSet.size > 0) {
      showMessage('PDF processed successfully!', 'success');
      return Array.from(transactionSet).join('\n');
    } else {
      showMessage('No transactions found or could not parse the document from PDF.', 'error');
      return ''; // Return empty string if no transactions found
    }

  } catch (error) {
    console.error('Error processing PDF:', error);
    showMessage(`An error occurred during PDF processing: ${error.message}`, 'error');
    return ''; // Return empty string on error
  }
};


// --- Main Data Processing Function (Existing nbcCard.js logic) ---
// This function processes the text content (either manually entered or from PDF)
// and populates the HTML table.
function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').filter(l => l.trim());
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];
  const table = document.createElement('table');

  // Header row
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  // Updated regex to capture both dates, ignoring the reference code, and the rest of the line
  // This regex is specifically for the format output by the PDF parser:
  // MM DD REFERENCE MM DD DESCRIPTION AMOUNT-
  const transactionLineRegex = /^(\d{1,2})\s+(\d{1,2})\s+([A-Za-z0-9]+)\s+(\d{1,2})\s+(\d{1,2})\s+(.*)\s+([\d,]+\.\d{2})(-?)$/;
  // Regex to find an amount, potentially with a trailing minus sign
  const amountRegex = /([\d,]+\.\d{2})(-?)$/; // Changed to end of line to be more specific

  const monthMap = {
    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
    '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
  };

  const seen = new Set();

  lines.forEach(line => {
    const match = line.match(transactionLineRegex);

    if (!match) {
      // If the line doesn't match the expected transaction format, it's noise.
      // This could happen if the PDF parser didn't extract correctly, or if manual input
      // is not in the expected format.
      console.warn("Skipping line due to format mismatch:", line);
      return;
    }

    const firstMonthNum = match[1];
    const firstDayNum = match[2];
    const referenceCode = match[3]; // Captured reference code
    const secondMonthNum = match[4];
    const secondDayNum = match[5];
    let descriptionPart = match[6].trim(); // This contains description
    const rawAmount = match[7]; // The number part of the amount
    const sign = match[8];     // The optional minus sign

    const formattedFirstDate = `${monthMap[firstMonthNum]} ${firstDayNum}`;
    const formattedSecondDate = `${monthMap[secondMonthNum]} ${secondDayNum}`;

    let formattedDate = '';
    if (yearInput) {
      // If year is provided, append it to both dates
      formattedDate = `${formattedFirstDate} ${yearInput} ${formattedSecondDate} ${yearInput}`;
    } else {
      // Otherwise, just use the month and day
      formattedDate = `${formattedFirstDate} ${formattedSecondDate}`;
    }

    let debit = '', credit = '';
    const amountVal = parseFloat(rawAmount.replace(/,/g, '')); // Remove commas for parsing

    if (sign === '-') {
      credit = amountVal.toFixed(2);
    } else {
      debit = amountVal.toFixed(2);
    }
    
    // The description is already extracted as descriptionPart, no need to re-extract from restOfLine
    let description = descriptionPart;

    // Check for duplicates (case-insensitive description and amount)
    const signature = `${description.toLowerCase()}|${debit || credit}`;
    const isDuplicate = seen.has(signature);
    if (!isDuplicate) seen.add(signature);

    const row = [formattedDate, description, debit, credit, '']; // Balance is always empty for now
    const tr = document.createElement('tr');
    if (isDuplicate) tr.style.backgroundColor = '#ffcccc'; // Highlight duplicates

    row.forEach(cellContent => {
      const td = document.createElement('td');
      td.textContent = cellContent;
      tr.appendChild(td);
    });

    table.appendChild(tr);
    rows.push(row);
  });

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(rows);

  // Update UI elements from main.js (assuming they are globally available or imported)
  // These functions are expected to be present in main.js
  if (typeof document.getElementById('toolbar') !== 'undefined') {
    document.getElementById('toolbar').classList.add('show');
  }
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
  if (typeof saveState === 'function') { // saveState is defined in main.js
    saveState();
  }
  if (typeof createCopyColumnButtons === 'function') { // createCopyColumnButtons is defined in main.js
    createCopyColumnButtons();
  }
  if (typeof checkAndRemoveEmptyBalanceColumn === 'function') { // checkAndRemoveEmptyBalanceColumn is defined in main.js
    checkAndRemoveEmptyBalanceColumn();
  }
  if (typeof updateTableCursor === 'function') { // updateTableCursor is defined in main.js
    updateTableCursor();
  }
}

// Export processData globally so main.js can call it
window.processData = processData;
