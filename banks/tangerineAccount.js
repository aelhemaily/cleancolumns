// tangerineAccount.js - Integrated PDF processing and Tangerine Account statement parsing

// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

// Set up PDF.js worker source
// This line must be present to allow PDF.js to function
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// --- UI Utility Functions (Copied from pars.html / bmoCard.js for direct use) ---
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

// --- PDF Parsing Logic (Adapted from tangerine.html) ---

/**
 * Extracts raw text content from a PDF file, preserving line breaks and order.
 * @param {File} file - The PDF file to process.
 * @returns {Promise<string>} - A promise that resolves with the full text content of the PDF.
 */
async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Extract text with positioning to better preserve structure
        const textItems = textContent.items.map(item => ({
            text: item.str,
            x: item.transform[4],
            y: item.transform[5]
        }));
        
        // Sort by y-coordinate (top to bottom) then x-coordinate (left to right)
        textItems.sort((a, b) => {
            if (Math.abs(a.y - b.y) < 2) { // Same line
                return a.x - b.x;
            }
            return b.y - a.y; // Top to bottom (PDF coordinates are inverted)
        });
        
        // Group items by line (similar y-coordinates)
        const lines = [];
        let currentLine = [];
        let currentY = null;
        
        for (const item of textItems) {
            if (currentY === null || Math.abs(item.y - currentY) < 2) {
                currentLine.push(item.text);
                currentY = item.y;
            } else {
                if (currentLine.length > 0) {
                    lines.push(currentLine.join(' '));
                }
                currentLine = [item.text];
                currentY = item.y;
            }
        }
        
        if (currentLine.length > 0) {
            lines.push(currentLine.join(' '));
        }
        
        fullText += lines.join('\n') + '\n';
    }
    return fullText;
}

/**
 * Parses transaction lines from the extracted PDF text.
 * @param {string} text - The raw text extracted from the PDF.
 * @returns {Array<Object>} - An array of parsed transaction objects.
 */
function parseTransactionsFromText(text) {
    const transactions = [];
    
    // Remove noise text patterns
    text = text.replace(/Up to \$100 of each cheque.*?Page \d+ of \d+/g, '');
    text = text.replace(/Nobody likes mistakes.*?Page \d+ of \d+/g, '');
    text = text.replace(/Page \d+ of \d+/g, '');
    text = text.replace(/www\.tangerine\.ca/g, '');
    text = text.replace(/Client #: \d+/g, '');
    text = text.replace(/Your Orange Key is \w+/g, '');
    text = text.replace(/Account Registration: Ms Laura D'Ariano/g, '');
    text = text.replace(/Interest Earned Year To Date.*?Current Interest Rate/g, '');
    text = text.replace(/The Details - Tangerine Chequing Account - \d+/g, '');
    text = text.replace(/Account\(s\) at a Glance/g, '');
    text = text.replace(/Tangerine Chequing statement/g, '');
    text = text.replace(/Laura D'Ariano.*?N0M 2J0/g, '');
    
    // Split into potential transaction lines
    const lines = text.split(/\n/);
    
    for (let line of lines) {
        line = line.trim();
        
        // Skip empty lines or lines with only numbers/symbols
        if (!line || line.length < 10) continue;
        
        // Skip header lines
        if (line.includes('Balance($)') || line.includes('Transaction Date') || 
            line.includes('Account Number') || line.includes('Account Type') ||
            line.includes('$0.00') && line.includes('0.00%')) continue;
        
        // Try to parse transaction line
        const transaction = parseSingleTransactionLine(line);
        if (transaction) {
            transactions.push(transaction);
        }
    }
    
    return transactions;
}

/**
 * Parses a single line of text into a transaction object.
 * @param {string} line - The line of text representing a transaction.
 * @returns {Object|null} - A transaction object or null if parsing fails.
 */
function parseSingleTransactionLine(line) {
    // Remove extra whitespace
    line = line.replace(/\s+/g, ' ').trim();
    
    // Skip noise lines
    if (line.includes('Up to $100') || line.includes('Nobody likes mistakes') ||
        line.includes('call us at') || line.includes('Page') || 
        line.includes('www.tangerine.ca') || line.includes('Client #') ||
        line.includes('Your Orange Key') || line.includes('Account Registration') ||
        line.includes('Interest Earned') || line.includes('Current Interest Rate') ||
        line.includes('The Details') || line.includes('Tangerine Chequing statement') ||
        line.includes('Miller Drive') || line.includes('Lucan ON') ||
        line.includes('Account(s) at a Glance') || line.includes('Account Number') ||
        line.includes('Account Type') || line.includes('Balance($)') ||
        line.includes('Transaction Description') || line.includes('Transaction Date') ||
        line.includes('Amount($)')) {
        return null;
    }
    
    // Pattern: DD MMM YYYY Description Amount Balance
    // Example: "01 Jan 2023 Opening Balance 0.00 1,272.86"
    // Example: "10 Jan 2023 Overdraft Fee 5.00 (1,045.36)"
    const transactionRegex = /^(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(.*?)\s+([\d,]+\.\d{2})\s+(\(?[\d,]+\.\d{2}\)?)$/;
    const match = line.match(transactionRegex);

    if (!match) {
        return null;
    }
    
    const [, date, description, amountRaw, balanceRaw] = match;

    // Handle negative balances in parentheses
    let balance = balanceRaw;
    if (balance.startsWith('(') && balance.endsWith(')')) {
        balance = `-${balance.slice(1, -1)}`; // Convert (X.XX) to -X.XX
    }
    
    // Amount is already in the correct format (e.g., 5.00)
    let amount = amountRaw;
    
    // Validate amount and balance are numbers
    const amountNum = parseFloat(amount.replace(/,/g, ''));
    const balanceNum = parseFloat(balance.replace(/,/g, ''));
    
    if (isNaN(amountNum) || isNaN(balanceNum)) {
        return null;
    }
    
    // Clean up description
    const cleanedDescription = description.replace(/\s+/g, ' ').trim();
    
    // Skip if description is empty or too short
    if (!cleanedDescription || cleanedDescription.length < 3) return null;
    
    return {
        date: date,
        description: cleanedDescription,
        amount: amount, // Keep as string for display
        balance: balance // Keep as string for display
    };
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
    const fullText = await extractTextFromPDF(file);
    const parsedTransactions = parseTransactionsFromText(fullText);

    if (parsedTransactions.length > 0) {
      // Sort transactions by date (already handled by parseTransactionsFromText if needed)
      // For Tangerine, the PDF extraction and parsing should maintain order
      
      // Format parsed transactions into a single string for inputText
      const formattedText = parsedTransactions.map(tx => 
        `${tx.date} ${tx.description} ${tx.amount} ${tx.balance}`
      ).join('\n');

      showMessage('PDF processed successfully!', 'success');
      return formattedText;
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


// --- Main Data Processing Function (Existing tangerineAccount.js logic) ---
// This function processes the text content (either manually entered or from PDF)
// and populates the HTML table.
function processTangerineData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').filter(Boolean);
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const table = document.createElement('table');
  const copyRow = document.createElement('tr');
  const headerRow = document.createElement('tr');
  const rows = [];

  // Create table headers
  headers.forEach((header, index) => {
    const thCopy = document.createElement('th');
    const div = document.createElement('div');
    div.className = 'copy-col';
    const btn = document.createElement('button');
    btn.textContent = '📋';
    btn.className = 'copy-btn';
    btn.onclick = () => window.bankUtils.copyColumn(index);
    div.appendChild(btn);
    thCopy.appendChild(div);
    copyRow.appendChild(thCopy);

    const thHeader = document.createElement('th');
    thHeader.textContent = header;
    thHeader.classList.add('sortable-header'); // Add class for sortable headers
    thHeader.dataset.columnIndex = index; // Store column index for sorting
    headerRow.appendChild(thHeader);
  });

  table.appendChild(copyRow);
  table.appendChild(headerRow);

  let lastBalance = null; // Stores the balance from the *previous* valid transaction line
  let processedLines = []; // Store parsed transactions to iterate for balance calculation

  // First pass: Parse all lines and store valid transactions and balance updates
  lines.forEach(line => {
    if (!line.trim()) return;

    const parsedTransaction = parseSingleTransactionLine(line);

    if (parsedTransaction) {
        processedLines.push(parsedTransaction);
    } else {
        // Handle opening/closing balance lines that are not standard transactions
        const isBalanceTransaction = /(opening balance|balance forward|closing balance)/i.test(line.toLowerCase());
        if (isBalanceTransaction) {
            const balanceMatch = line.match(/(?:\(([\d,]+\.\d{2})\)|([\d,]+\.\d{2}))$/);
            if (balanceMatch) {
                const balanceStr = balanceMatch[1] ? `-${balanceMatch[1]}` : balanceMatch[2];
                const balanceValue = parseFloat(balanceStr.replace(/,/g, ''));
                // Store this as a special entry to update lastBalance
                processedLines.push({ type: 'balanceUpdate', balance: balanceValue });
            }
        }
    }
  });

  // Second pass: Process stored lines to determine debit/credit and build table rows
  processedLines.forEach(item => {
    if (item.type === 'balanceUpdate') {
      lastBalance = item.balance;
      return; // Do not add balance update lines to the table
    }

    const date = item.date;
    const description = item.description;
    const amountStr = item.amount.replace(/,/g, ''); // Raw amount from line
    const balanceStr = item.balance.replace(/,/g, ''); // Raw balance from line

    // Convert balance string to number, handling parentheses for negative
    const currentBalanceValue = parseFloat(balanceStr.replace(/[()]/g, '')) * (balanceStr.includes('(') ? -1 : 1);
    const amountValue = parseFloat(amountStr);

    let debit = '';
    let credit = '';

    if (lastBalance !== null) {
      // Calculate the change in balance
      const balanceChange = currentBalanceValue - lastBalance;

      // Determine if it's a debit or credit based on balance change
      if (Math.abs(balanceChange - amountValue) < 0.001) { // Check if amount matches a debit
          debit = amountValue.toFixed(2);
      } else if (Math.abs(balanceChange + amountValue) < 0.001) { // Check if amount matches a credit (unlikely for Tangerine's format, but for completeness)
          credit = amountValue.toFixed(2);
      } else if (balanceChange < 0) { // If balance decreased, it's a debit
          debit = amountValue.toFixed(2);
      } else if (balanceChange > 0) { // If balance increased, it's a credit
          credit = amountValue.toFixed(2);
      } else { // No change in balance, or amount is 0 (e.g., Interest Rate Change)
          debit = '0.00';
          credit = '0.00';
      }
    } else {
        // Fallback if lastBalance is not yet set (e.g., first transaction after opening balance)
        // In Tangerine's format, the amount is usually positive for both debits and credits
        // We'll assume it's a debit if the balance decreased, or credit if it increased,
        // or use description keywords as a last resort if balance change is zero.
        if (currentBalanceValue < parseFloat(balanceStr.replace(/[()]/g, '')) * (balanceStr.includes('(') ? -1 : 1)) { // Simplified check
            debit = amountValue.toFixed(2);
        } else {
            credit = amountValue.toFixed(2);
        }
    }
    
    // Update lastBalance for the next iteration
    lastBalance = currentBalanceValue;

    rows.push([date, description, debit, credit, item.balance]); // Use item.balance for the display column

    const tr = document.createElement('tr');
    rows[rows.length - 1].forEach(cell => { // Get the last added row
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(rows);

  // Helper function to determine if a transaction is likely a debit (kept for potential fallback, though balance logic is primary)
  function isLikelyDebit(description) {
    const debitKeywords = [
      'withdrawal', 'fee', 'nsf', 'payment', 'pymt', 'overdraft',
      'hydro', 'credit card', 'enbridge', 'eft', 'to\\b', 'transfer to',
      'bill payment', 'purchase', 'atm'
    ];
    const descLower = description.toLowerCase();
    return debitKeywords.some(kw => {
      const regex = new RegExp(`\\b${kw}\\b`);
      return regex.test(descLower);
    });
  }

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

window.processData = processTangerineData;
