// nbcCard.js - National Bank Credit Card PDF processing

// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

// Set up PDF.js worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// --- UI Utility Functions ---
function showMessage(message, type = 'info') {
  const messageBox = document.getElementById('messageBox');
  if (messageBox) {
    messageBox.textContent = message;
    messageBox.className = `message-box show bg-${type === 'error' ? 'red' : 'yellow'}-100 border-${type === 'error' ? 'red' : 'yellow'}-400 text-${type === 'error' ? 'red' : 'yellow'}-700`;
  }
}

function clearMessage() {
  const messageBox = document.getElementById('messageBox');
  if (messageBox) {
    messageBox.textContent = '';
    messageBox.classList.remove('show');
  }
}

// --- PDF Parsing Logic ---
window.bankUtils.processPDFFile = async function(file) {
  clearMessage();
  showMessage('Processing PDF... Please wait.', 'info');

  if (!file || file.type !== 'application/pdf') {
    showMessage('Please upload a valid PDF file.', 'error');
    return "";
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const transactions = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const textItems = textContent.items.map(item => item.str);
      const pageText = textItems.join(' ');
      
      console.log(`Page ${i} raw text:`, pageText); // Debug log

      // Extract transactions using the pattern that works: MM DD REFERENCE MM DD DESCRIPTION AMOUNT
      const transactionRegex = /(\d{2})\s+(\d{2})\s+([A-Z0-9]+)\s+(\d{2})\s+(\d{2})\s+([A-Za-z0-9\s*.#/-]+?)\s+([\d,]+\.\d{2})(\s*-)?/g;
      
      let match;
      while ((match = transactionRegex.exec(pageText)) !== null) {
        const transMonth = match[1];
        const transDay = match[2];
        const reference = match[3];
        const postMonth = match[4];
        const postDay = match[5];
        let description = match[6].trim();
        let amount = match[7].replace(/,/g, '');
        const negativeMarker = match[8]; // Capture the optional minus sign
        
        // Skip header lines and summary information
        if (description.includes('INFINOPUS LTD') || 
            description.includes('SUMMARY FOR ACCOUNT') ||
            description.includes('Credit limit') ||
            description.includes('879 COURT BRIAR') ||
            description.match(/^\d+$/)) { // Skip lines that are just numbers
          continue;
        }

        // Add negative sign if present
        if (negativeMarker && negativeMarker.includes('-')) {
          amount = '-' + amount;
        }

        const transactionString = `${transMonth} ${transDay} ${reference} ${postMonth} ${postDay} ${description} ${amount}`;
        console.log("Found transaction:", transactionString);
        transactions.push(transactionString);
      }
    }

    // Remove duplicates while preserving order
    const uniqueTransactions = [...new Set(transactions)];

    if (uniqueTransactions.length > 0) {
      const result = uniqueTransactions.join('\n');
      console.log("Final transactions:", result);
      showMessage(`PDF processed successfully! Found ${uniqueTransactions.length} transactions.`, 'info');
      return result;
    } else {
      showMessage('No transactions found in PDF.', 'error');
      return '';
    }

  } catch (error) {
    console.error('Error processing PDF:', error);
    showMessage(`Error processing PDF: ${error.message}`, 'error');
    return '';
  }
};

// --- Main Data Processing Function ---
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

  // Transaction regex for NBC format: MM DD REFERENCE MM DD DESCRIPTION AMOUNT
  const transactionLineRegex = /^(\d{2})\s+(\d{2})\s+([A-Z0-9]+)\s+(\d{2})\s+(\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})$/;

  const monthMap = {
    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
    '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
  };

  const seen = new Set();

  lines.forEach(line => {
    const match = line.match(transactionLineRegex);

    if (!match) {
      console.warn("Skipping line due to format mismatch:", line);
      return;
    }

    const transMonth = match[1];
    const transDay = match[2];
    const reference = match[3];
    const postMonth = match[4];
    const postDay = match[5];
    const description = match[6].trim();
    const rawAmount = match[7];

    // Format dates
    const formattedTransDate = `${monthMap[transMonth]} ${transDay}`;
    const formattedPostDate = `${monthMap[postMonth]} ${postDay}`;

    let formattedDate = '';
    if (yearInput) {
      formattedDate = `${formattedTransDate} ${yearInput} ${formattedPostDate} ${yearInput}`;
    } else {
      formattedDate = `${formattedTransDate} ${formattedPostDate}`;
    }

    // Process amount - handle negative amounts
    let debit = '', credit = '';
    const amountVal = parseFloat(rawAmount.replace(/,/g, ''));

    if (amountVal < 0) {
      credit = Math.abs(amountVal).toFixed(2); // Negative amount = credit (refund/payment)
    } else {
      debit = amountVal.toFixed(2); // Positive amount = debit (purchase)
    }

    // Check for duplicates
    const signature = `${description.toLowerCase()}|${debit}|${credit}`;
    const isDuplicate = seen.has(signature);
    if (!isDuplicate) seen.add(signature);

    const row = [formattedDate, description, debit, credit, ''];
    const tr = document.createElement('tr');
    if (isDuplicate) tr.style.backgroundColor = '#ffcccc';

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

  // Update UI elements
  const toolbar = document.getElementById('toolbar');
  if (toolbar) {
    toolbar.classList.add('show');
  }
  
  // Safely call utility functions
  if (typeof window.bankUtils.setupCellSelection === 'function') {
    window.bankUtils.setupCellSelection(table);
  }
  if (typeof window.bankUtils.setupTableContextMenu === 'function') {
    window.bankUtils.setupTableContextMenu(table);
  }
  if (typeof saveState === 'function') {
    saveState();
  }
  if (typeof createCopyColumnButtons === 'function') {
    createCopyColumnButtons();
  }

  showMessage(`Processed ${rows.length} transactions successfully!`, 'info');
}

// Export processData globally
window.processData = processData;