// baaCard.js - Bank of America Account/Card statement parsing

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

// --- PDF Parsing Logic based on parser.html ---
function parseTransactions(text) {
    // Step 1: Clean up the text by removing junk data (adapted from parser.html)
    let cleanedText = text.replace(/(\d{2}\/\d{2}\/\d{2})\s+(\1)/g, '$1');
    cleanedText = cleanedText.replace(/Page \d+ of \d+/g, '');
    cleanedText = cleanedText.replace(/This page intentionally left blank/g, '');
    cleanedText = cleanedText.replace(/Note your Ending Balance already reflects the subtraction of Service Fees./g, '');
    cleanedText = cleanedText.replace(/Daily ledger balances.*?AMZ MENTORS LLC ! Account #.*?/gs, '');  
    cleanedText = cleanedText.replace(/AMZ MENTORS LLC ! Account #.*? - continued Date Description Amount/g, '');
    cleanedText = cleanedText.replace(/AMZ MENTORS LLC ! Account #.*?/g, '');  
    cleanedText = cleanedText.replace(/Total deposits and other credits.*?\s+\$\d{1,3}(?:,\d{3})*\.\d{2}/g, ''); 
    cleanedText = cleanedText.replace(/Withdrawals and other debits(?:\s+Date\s+Description\s+Amount)?/g, '');
    
    // New rule to handle all "Total" lines at the end of transaction sections
    cleanedText = cleanedText.replace(/Total (service fees|withdrawals and other debits|deposits and other credits).*?-?\$\d{1,3}(?:,\d{3})*\.\d{2}/g, '');
    
    cleanedText = cleanedText.replace(/Based on the activity on your business accounts.*?has not been met/g, '');
    cleanedText = cleanedText.replace(/External transfer fee - Next Day - \s*\d{2}\/\d{2}\/\d{4}/g, 'External transfer fee - Next Day');
    cleanedText = cleanedText.replace(/External transfer fee - 3 Day - \s*\d{2}\/\d{2}\/\d{4}/g, 'External transfer fee - 3 Day');
    cleanedText = cleanedText.replace(/For information on Small Business products.*?businessfeesataglance./g, '');
    cleanedText = cleanedText.replace(/continued on the next page/g, '');
    
    // Remove the "Daily ledger balances" section and all following content
    cleanedText = cleanedText.replace(/Daily ledger balances.*?$/gs, '');

    // NEW RULE: Remove the "Subtotal for card account" section and all following content
    cleanedText = cleanedText.replace(/Subtotal for card account #.*?$/gs, '');
    
    // Step 2: Extract transactions.
    const transactions = [];

    // NUCLEAR RULE: Specifically look for the "Monthly Fee Business Adv Fundamentals" transaction and extract it.
    // This is a direct match and will be prioritized.
    const monthlyFeeRegex = /(\d{2}\/\d{2}\/\d{2})\s+Monthly Fee Business Adv Fundamentals\s+(-?\d{1,3}(?:,\d{3})*\.\d{2})/;
    const monthlyFeeMatch = monthlyFeeRegex.exec(text);
    if (monthlyFeeMatch) {
        transactions.push(`${monthlyFeeMatch[1]} Monthly Fee Business Adv Fundamentals\n${monthlyFeeMatch[2]}`);
        // Remove this transaction from the text to avoid double-counting
        cleanedText = cleanedText.replace(monthlyFeeMatch[0], '');
    }

    // Regex to find a date, then capture everything until the next date or end of string.
    const transactionBlockRegex = new RegExp('(\\d{2}\\/\\d{2}\\/\\d{2})\\s(.+?)(?=\\d{2}\\/\\d{2}\\/\\d{2}|$)', 'gs');
    let match;

    while ((match = transactionBlockRegex.exec(cleanedText)) !== null) {
        const date = match[1];
        const blockContent = match[2];

        // Find the last number with a potential negative sign in the block
        const amountRegex = new RegExp('(-?\\$?[\\d,]+\\.\\d{2})', 'g');
        let amountMatch;
        let lastAmount = null;

        while ((amountMatch = amountRegex.exec(blockContent)) !== null) {
            lastAmount = amountMatch[0];
        }

        if (lastAmount) {
            // Remove the amount from the description and clean up extra whitespace
            const description = blockContent.substring(0, blockContent.lastIndexOf(lastAmount)).trim();
            transactions.push(`${date} ${description.replace(/\s+/g, ' ')}\n${lastAmount}`);
        } else {
            // If no amount is found, add the entire block as a transaction with a note
            transactions.push(`${date} ${blockContent.trim()}\n[Amount not found]`);
        }
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
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    // Extract text from each page - exactly like parser.html
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map(item => item.str).join(' ');
    }

    const transactions = parseTransactions(fullText);
    
    if (transactions.length > 0) {
      showMessage('Parsing complete. ' + transactions.length + ' transactions found.', 'success');
      // FIX #2a: Join with a single newline for a more compact list.
      // This makes the input text cleaner for a single PDF.
      return transactions.join('\n');
    } else {
      showMessage('No transactions were found. Please check the PDF format.', 'error');
      return '';
    }

  } catch (error) {
    console.error('Error processing PDF:', error);
    showMessage(`An error occurred while processing the PDF: ${error.message}`, 'error');
    return '';
  }
};

// --- Main Data Processing Function ---
function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
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

  // FIX #2b: Split input using a regex that looks for a newline followed by a date.
  // This correctly separates transactions even with single line breaks,
  // and still allows you to use blank lines to separate content from different files.
  const blocks = input.split(/\n(?=\d{2}\/\d{2}\/\d{2})/).filter(block => block.trim());
  const transactions = [];

  blocks.forEach(block => {
    const lines = block.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length >= 2) {
      const lastLine = lines[lines.length - 1];
      const amountMatch = lastLine.match(/^(-?\$?[\d,]+\.\d{2})$/);
      
      if (amountMatch) {
        const amount = amountMatch[1];
        const dateDescLine = lines.slice(0, -1).join(' ');
        
        // Extract date from the beginning
        const dateMatch = dateDescLine.match(/^(\d{2}\/\d{2}\/\d{2})\s+(.+)/);
        
        if (dateMatch) {
          const date = dateMatch[1];
          const description = dateMatch[2];
          
          // Convert amount to number and determine debit/credit
          let numAmount = parseFloat(amount.replace(/[\$,]/g, ''));
          let debit = '';
          let credit = '';
          
          // Based on your requirement: credit is positive, debit is negative
          // So negative amounts in the statement become debits, positive become credits
          if (numAmount < 0) {
            debit = Math.abs(numAmount).toFixed(2);
          } else {
            credit = numAmount.toFixed(2);
          }

          // Format date with year if provided
          let formattedDate = date;
          if (yearInput && /^\d{2}\/\d{2}\/\d{2}$/.test(date)) {
            const parts = date.split('/');
            formattedDate = `${parts[0]}/${parts[1]}/${yearInput}`;
          }

          transactions.push({
            date: formattedDate,
            description: description,
            debit: debit,
            credit: credit
          });
        }
      }
    }
  });

  // Process collected transactions and add to table
  transactions.forEach(tx => {
    // FIX #1: Removed the duplicate date `tx.date + ' ' + tx.date`
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

  // Update UI elements from main.js
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
}

// Export processData globally so main.js can call it
window.processData = processData;
