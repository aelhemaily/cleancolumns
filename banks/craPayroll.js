// craPayroll.js - CRA Payroll PDF parsing and processing


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


// --- PDF Parsing Logic for CRA Payroll ---
function parseCraPayroll(allLines) {
  const transactions = [];
  
  // Join all lines into a single string for pattern matching
  const fullText = allLines.join(' ');
  
  // Pattern to find the transaction section
  const sectionPattern = /Payroll\s*\(RP\)\s*transactions/i;
  const sectionMatch = sectionPattern.exec(fullText);
  
  if (!sectionMatch) {
    console.warn("Could not find 'Payroll (RP) transactions' section in PDF");
    return transactions;
  }
  
  // Extract text from the transaction section onward
  const transactionText = fullText.substring(sectionMatch.index);
  
  // Pattern for CRA Payroll format: Date Description Amount CR/DR
  // This pattern matches: Date, Description (with optional "From" or "Rec'd" parts), Amount, and CR/DR indicator
  const transactionPattern = /(\w+\s+\d{1,2},\s+\d{4})\s*([\s\S]*?)(?:\s*Rec'd[\s\S]*?|\s*From[\s\S]*?|)\s*(\$[\d,.]+)\s*(CR|DR)/gi;
  
  let match;
  while ((match = transactionPattern.exec(transactionText)) !== null) {
    const date = match[1];
    const description = match[2].trim();
    const amount = match[3].replace('$', '').replace(/,/g, '');
    const crdr = match[4];
    
    // Clean up description - remove extra spaces and line breaks
    const cleanDescription = description.replace(/\s+/g, ' ').trim();
    
    // Format the output according to requirements
    const formattedLine = `${date} ${cleanDescription} ${amount} ${crdr}`;
    transactions.push(formattedLine);
  }
  
  return transactions;
}


// --- Main PDF File Processing Function ---
window.bankUtils.processPDFFile = async function(file) {
  clearMessage();
  showMessage('Processing CRA Payroll PDF... Please wait.', 'info');

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

    // Parse using CRA Payroll specific parser
    showMessage('Parsing CRA Payroll transactions from PDF...');
    const parsedTransactions = parseCraPayroll(allLines);

    if (parsedTransactions.length > 0) {
      showMessage('PDF processed successfully!', 'success');
      return parsedTransactions.join('\n');
    } else {
      showMessage('No transactions found or could not parse the CRA Payroll document.', 'error');
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

  // Pattern for CRA Payroll format: Date Description Amount CR/DR
  const craPayrollPattern = /^(\w+\s+\d{1,2}(?:,\s+\d{4})?)\s+(.+?)\s+([\d,]+\.\d{2})\s*(CR|DR)$/i;

  lines.forEach(line => {
    const match = craPayrollPattern.exec(line);
    if (match) {
      const [, date, desc, amountRaw, crdrIndicator] = match;

      // Determine if it's a credit transaction
      const isCreditTransaction = crdrIndicator.toUpperCase() === 'CR';

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

      // Format date using the utility function. This is where the user's provided year
      // is used if the date in the text does not already contain one.
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
