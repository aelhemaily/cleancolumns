// craHistory.js - CRA History PDF parsing and processing

// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

// Set up PDF.js worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.worker.min.js';

// --- UI Utility Functions ---
function showMessage(message, type = 'info') {
  const messageBox = document.getElementById('messageBox');
  if (messageBox) {
    messageBox.textContent = message;
    messageBox.className = `message-box show bg-${type === 'error' ? 'red' : 'yellow'}-100 border-${type === 'error' ? 'red' : 'yellow'}-400 text-${type === 'error' ? 'red' : 'yellow'}-700`;
  } else {
    console.warn("Message box not found in DOM.");
  }
}

function clearMessage() {
  const messageBox = document.getElementById('messageBox');
  if (messageBox) {
    messageBox.textContent = '';
    messageBox.classList.remove('show');
  } else {
    console.warn("Message box not found in DOM.");
  }
}

// --- PDF Parsing Logic for RBC History ---
function parseRbcHistory(allLines) {
  const transactions = [];

  // Look for transaction patterns in the text
  // Format: Date1 Date2 Description Date3 Amount (CR)
  const transactionPattern = /(\w+ \d{1,2}, \d{4})\s+(\w+ \d{1,2}, \d{4})\s+([\w\s]+)\s+(\w+ \d{1,2}, \d{4})\s+([$\d,.]+)\s*(CR|DR)?/gi;

  // Join all lines into a single string for pattern matching
  const fullText = allLines.join(' ');

  let match;
  while ((match = transactionPattern.exec(fullText)) !== null) {
    const effectiveDate = match[1];
    const periodEnd = match[2];
    const description = match[3].trim();
    const datePosted = match[4];
    const amount = match[5].replace('$', '').replace(/,/g, '');
    const isCredit = match[6] === 'CR';

    // Format the output according to requirements
    // Ignore first two dates, use description, datePosted, and amount with CR indicator
    const formattedLine = `${datePosted} ${description} ${amount}${isCredit ? ' CR' : ''}`;
    transactions.push(formattedLine);
  }

  return transactions;
}

// --- Main PDF File Processing Function ---
window.bankUtils.processPDFFile = async function(file) {
  clearMessage();
  showMessage('Processing PDF... Please wait.', 'info');

  if (!file || file.type !== 'application/pdf') {
    showMessage('Please upload a valid PDF file.', 'error');
    return "";
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer
    }).promise;

    let allLines = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Extract text from each page and add to allLines
      const pageText = textContent.items.map(item => item.str.trim()).filter(Boolean);
      allLines.push(...pageText);
    }

    // Parse using RBC History specific parser
    showMessage('Parsing RBC History transactions from PDF...');
    const parsedTransactions = parseRbcHistory(allLines);

    if (parsedTransactions.length > 0) {
      showMessage('PDF processed successfully!', 'success');
      return parsedTransactions.join('\n');
    } else {
      showMessage('No transactions found or could not parse the document from PDF.', 'error');
      return '';
    }

  } catch (error) {
    console.error('Error processing PDF:', error);
    showMessage(`An error occurred during PDF processing: ${error.message}`, 'error');
    return '';
  }
};

// --- Date Formatting Utility Function ---
function formatDate(dateStr, year) {
  const monthMap = {
    'January': 'Jan',
    'February': 'Feb',
    'March': 'Mar',
    'April': 'Apr',
    'May': 'May',
    'June': 'Jun',
    'July': 'Jul',
    'August': 'Aug',
    'September': 'Sep',
    'October': 'Oct',
    'November': 'Nov',
    'December': 'Dec'
  };

  // Decide which year to use. Prioritize the user-provided year.
  let yearToUse = (year && year.trim().length === 4) ? year.trim() : null;
  
  // If the user didn't provide a year, try to get it from the date string.
  if (!yearToUse) {
    const dateWithYearMatch = dateStr.match(/(\w+)\s+\d{1,2},\s+(\d{4})/);
    if (dateWithYearMatch) {
      yearToUse = dateWithYearMatch[2];
    }
  }

  // Format the date string.
  const parts = dateStr.split(/[\s,]+/);
  const month = parts[0];
  const day = parts[1];
  const abbreviatedMonth = monthMap[month] || (month ? month.substring(0, 3) : '');

  if (abbreviatedMonth && day) {
    return `${abbreviatedMonth} ${day} ${yearToUse || ''}`.trim();
  }

  // Fallback to original string if formatting fails
  return dateStr;
}

// --- Main Data Processing Function ---
function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = ''; // Clear previous output

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

  const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
  const transactions = [];

  // Pattern for RBC History format: Date Description Amount (CR)
  // Corrected pattern to capture the year more reliably
  const rbcHistoryPattern = /^(\w+\s+\d{1,2}(?:,\s+\d{4})?)\s+(.+?)\s+([\d,]+\.\d{2})(?:\s+(CR))?$/i;

  lines.forEach(line => {
    const match = rbcHistoryPattern.exec(line);
    if (match) {
      const [, date, desc, amountRaw, crIndicator] = match;

      // Determine if it's a credit transaction
      const isCreditTransaction = !!crIndicator;

      // Parse the numeric amount, removing commas if present
      const amount = parseFloat(amountRaw.replace(/,/g, '').trim());

      // Assign to debit or credit based on isCreditTransaction
      let debitAmount = '';
      let creditAmount = '';
      if (isCreditTransaction) {
        creditAmount = amount !== null ? amount.toFixed(2) : '';
      } else {
        debitAmount = amount !== null ? amount.toFixed(2) : '';
      }

      // Format date using the new utility function
      const formattedDate = formatDate(date, yearInput);

      transactions.push({
        date: formattedDate,
        description: desc.trim(),
        debit: debitAmount,
        credit: creditAmount
      });
    }
  });

  // Process collected transactions and add to table
  transactions.forEach(tx => {
    const row = [tx.date, tx.description, tx.debit, tx.credit, '']; // Balance not available
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
  table.dataset.rows = JSON.stringify(rows);

  // Update UI elements
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
  if (typeof saveState === 'function') {
    saveState();
  }
  if (typeof createCopyColumnButtons === 'function') {
    createCopyColumnButtons();
  }
  if (typeof checkAndRemoveEmptyBalanceColumn === 'function') {
    checkAndRemoveEmptyBalanceColumn();
  }
  if (typeof updateTableCursor === 'function') {
    updateTableCursor();
  }

  // Update transaction counts
  if (typeof updateTransactionCounts === 'function') {
    updateTransactionCounts();
  }
}

// Export processData globally so main.js can call it
window.processData = processData;
