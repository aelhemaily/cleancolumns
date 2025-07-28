// wallmartCard.js - Integrated PDF processing and Walmart Card statement parsing

// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

// Set up PDF.js worker source
// This line must be present to allow PDF.js to function
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

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

// --- PDF Parsing Logic (Adapted from wallmartparser.html) ---

/**
 * Parses transactions from Walmart Mastercard PDF text.
 * This function extracts transaction details based on specific regex patterns.
 * @param {string[]} allLines - All extracted lines from the PDF.
 * @returns {string[]} - Array of formatted transaction strings.
 */
function parseWalmartTransactions(allLines) {
    let allTransactions = [];

    // Regex to capture transaction details
    // It looks for lines starting with an optional item number, then two dates, activity description, and amount.
    // Group 1: Transaction Date (e.g., "Oct 09")
    // Group 2: Posting Date (e.g., "Oct 10")
    // Group 3: Activity Description (e.g., "PAYMENT - THANK YOU") - uses [\s\S]+? to cross newlines
    // Group 4: Amount (e.g., "$20.00" or "$480.00") - captures numerical part, removes '$' and commas later
    // Group 5: Optional trailing negative sign (e.g., "\n-")
    const transactionRegex = /(?:^\s*\d+[\s\n]+)?([A-Za-z]{3}[\s\n]+\d{1,2})[\s\n]+([A-Za-z]{3}[\s\n]+\d{1,2})[\s\n]+([\s\S]+?)[\s\n]+([-\$]?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)([\s\n]*[-])?[\s\n]*$/gm;
    let textItems = allLines.join('\n'); // Join all lines to apply regex across newlines
    let match;

    while ((match = transactionRegex.exec(textItems)) !== null) {
        // Ensure the match is not part of the "CALCULATING YOUR BALANCE" or "PAYMENT INFORMATION" sections
        // These exclusions prevent parsing summary lines as transactions.
        if (!match[0].includes("Minimum Payment") &&
            !match[0].includes("Previous balance") &&
            !match[0].includes("Past due") &&
            !match[0].includes("Payment due date") &&
            !match[0].includes("New purchases & debits") &&
            !match[0].includes("Credit limit") &&
            !match[0].includes("Cash advances / balance transfers") &&
            !match[0].includes("Available credit") &&
            !match[0].includes("Fees") &&
            !match[0].includes("Interest") &&
            !match[0].includes("Available cash limit") &&
            !match[0].includes("Total New Charges") &&
            !match[0].includes("Total new balance") &&
            !match[0].includes("Annual Interest Rates") &&
            !match[0].includes("Account Balance") &&
            !match[0].includes("Cash Advances") &&
            !match[0].includes("ITEM NO") && // Exclude table headers
            !match[0].includes("TRANS DATE") && // Exclude table headers
            !match[0].includes("POSTING DATE") && // Exclude table headers
            !match[0].includes("ACTIVITY DESCRIPTION") && // Exclude table headers
            !match[0].includes("AMOUNT") && // Exclude table headers
            !match[0].includes("E ANYIM-EHUMADU") && // Exclude account holder header lines
            !match[0].includes("PRINCE EHUMADU") && // Exclude account holder header lines
            !match[0].includes("*************") // Exclude account number lines
        ) {
            const transDate = match[1].trim().replace(/\s+/g, ' '); // Normalize spaces in date
            const postDate = match[2].trim().replace(/\s+/g, ' '); // Normalize spaces in date
            const description = match[3].trim().replace(/\s+/g, ' '); // Normalize spaces in description
            let amountValue = match[4]; // Keep original amount string for sign check
            const trailingNegativeMatch = match[5]; // This will be the '\n-' part if present

            // Determine if the amount is negative based on leading '-' or trailing '\n-'
            let isNegative = amountValue.startsWith('-');
            if (!isNegative && trailingNegativeMatch && trailingNegativeMatch.includes('-')) {
                isNegative = true;
            }

            // Remove '$', commas, and any leading/trailing hyphens from the amount value for clean number
            amountValue = amountValue.replace(/[\$,-]/g, '');

            // Re-add the dollar sign and apply the negative sign if necessary
            const finalAmount = isNegative ? `-$${amountValue}` : `$${amountValue}`;

            allTransactions.push(`${transDate} ${postDate} ${description} ${finalAmount}`);
        }
    }
    return allTransactions;
}


// --- Main PDF File Processing Function (part of window.bankUtils) ---
// This function will be called by main.js when a PDF file is uploaded
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

    let allLines = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Extract text items and join them to form a continuous text for the page
      const pageText = textContent.items.map(item => item.str).join('\n');
      allLines.push(pageText); // Add the full page text as one entry for later processing
    }

    // Join all page texts into a single string for parsing
    const combinedText = allLines.join('\n');

    // Parse transactions using the Walmart-specific logic
    let parsedTransactions = parseWalmartTransactions([combinedText]); // Pass as array of one string for consistency

    if (parsedTransactions.length > 0) {
      // Add numbering to the transactions
      let numberedTransactions = [];
      let transactionCounter = 0;

      parsedTransactions.forEach(line => {
          transactionCounter++;
          numberedTransactions.push(`${transactionCounter} ${line}`);
      });
      showMessage('PDF processed successfully!', 'success');
      return numberedTransactions.join('\n');
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


// --- Main Data Processing Function (Existing wallmartCard.js logic) ---
function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').filter(l => l.trim());
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];
  const table = document.createElement('table');

  // Copy buttons row
  const copyRow = document.createElement('tr');
  headers.forEach((_, index) => {
    const th = document.createElement('th');
    const div = document.createElement('div');
    div.className = 'copy-col';
    const btn = document.createElement('button');
    btn.textContent = 'Copy';
    btn.className = 'copy-btn';
    btn.onclick = () => window.bankUtils.copyColumn(index);
    div.appendChild(btn);
    th.appendChild(div);
    copyRow.appendChild(th);
  });
  table.appendChild(copyRow);

  // Header row
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  // Regex to match a line that starts with an optional number, followed by two date patterns
  // This regex will also be used to extract the initial date parts for transaction lines
  const transactionStartRegex = /^(?:\d+\s+)?([A-Za-z]{3} \d{1,2})\s+([A-Za-z]{3} \d{1,2})/;
  const seen = new Set();
  let buffer = []; // Stores the parts of a multi-line transaction

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const fullLine = buffer.join(' ').trim();
    // Re-validate the full buffered line against the transaction start regex
    // to ensure it begins with a valid transaction pattern.
    const match = fullLine.match(transactionStartRegex);

    if (!match) {
      buffer = []; // Discard buffer if it doesn't form a valid transaction
      return;
    }

    // Extract the two dates. match[1] is the first date, match[2] is the second date
    let date1Part = match[1];
    let date2Part = match[2];

    // Append year if provided
    let formattedDate = '';
    if (yearInput) {
      formattedDate = `${date1Part} ${yearInput} ${date2Part} ${yearInput}`;
    } else {
      formattedDate = `${date1Part} ${date2Part}`;
    }

    // Get the rest of the line after the dates (and optional leading number)
    const rest = fullLine.replace(transactionStartRegex, '').trim();
    const amountMatch = rest.match(/-?\$[\d,]+\.\d{2}/);
    let debit = '', credit = '', balance = '';

    if (amountMatch) {
      const rawAmount = amountMatch[0];
      const amountVal = parseFloat(rawAmount.replace(/[^0-9.-]/g, ''));
      if (rawAmount.startsWith('-')) {
        credit = Math.abs(amountVal).toFixed(2);
      } else {
        debit = amountVal.toFixed(2);
      }
    }

    const desc = rest.replace(/-?\$[\d,]+\.\d{2}/, '').trim();

    // Check for duplicates
    const signature = `${desc.toLowerCase()}|${debit || credit}`;
    const isDuplicate = seen.has(signature);
    if (!isDuplicate) seen.add(signature);

    const row = [formattedDate, desc, debit, credit, balance];
    const tr = document.createElement('tr');
    if (isDuplicate) tr.style.backgroundColor = '#ffcccc';

    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });

    table.appendChild(tr);
    rows.push(row);
    buffer = [];
  };

  lines.forEach(line => {
    // A line is considered the start of a new transaction ONLY if it matches transactionStartRegex.
    // If it matches, we flush the previous buffer and start a new one.
    if (line.match(transactionStartRegex)) {
      flushBuffer(); // Process any transaction currently in the buffer
      buffer.push(line); // Start a new transaction with this line
    }
    // Lines that do NOT match transactionStartRegex are considered noise and are skipped.
    // This explicitly prevents "noise" lines from being added to the buffer at all.
  });

  flushBuffer(); // Process the very last transaction in the buffer, if any

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
