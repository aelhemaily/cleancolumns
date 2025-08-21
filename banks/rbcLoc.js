// rbcLoc.js - Exact merge of both files with original line-combining logic

window.bankUtils = window.bankUtils || {};

function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  // File list container visibility
  const fileListContainer = document.getElementById('fileListContainer');
  if (input) fileListContainer.style.display = 'block';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];

  // Create table with copy buttons
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

  // Parse transactions exactly as in locrbc.html
  const lines = input.split('\n').filter(l => l.trim());
  let transactions = [];
  let currentTransaction = '';
  
  // First combine lines into complete transactions
  lines.forEach(line => {
    line = line.trim();
    // Check if line starts a new transaction (month abbreviation followed by day)
    if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{1,2}\b/i.test(line)) {
      if (currentTransaction) {
        transactions.push(currentTransaction.trim());
      }
      currentTransaction = line;
    } else {
      currentTransaction += ' ' + line;
    }
  });
  if (currentTransaction) transactions.push(currentTransaction.trim());

  // Filter out transactions containing "Interest Payment" before processing
  const filteredTransactions = transactions.filter(transaction => 
    !/Interest Payment/i.test(transaction)
  );

  // Process each combined transaction
  filteredTransactions.forEach(transaction => {
    // Skip balance summary lines
    if (/(Opening|Closing) Principal Balance|Balance Forward/i.test(transaction)) {
      return;
    }

    // Extract dates (could be one or two dates)
    const dateMatches = [...transaction.matchAll(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{1,2}\b/ig)];
    let dates = dateMatches.map(m => m[0]);
    
    // Apply year if provided
    if (yearInput) {
      dates = dates.map(date => `${date} ${yearInput}`);
    }
    const formattedDate = dates.join(' ');

    // Extract all amounts
    const amountMatches = [...transaction.matchAll(/-?\$?\d{1,3}(?:,\d{3})*\.\d{2}/g)];
    const amounts = amountMatches.map(m => m[0]);
    
    // Skip transactions without valid amounts
    if (amounts.length < 1) return;
    
    // Get description by removing dates and amounts
    let description = transaction;
    dateMatches.forEach(match => {
      description = description.replace(match[0], '');
    });
    amountMatches.forEach(amount => {
      description = description.replace(amount[0], '');
    });
    description = description.replace(/\s+/g, ' ').trim();

    // Determine transaction type and balance
    let debit = '';
    let credit = '';
    let balance = amounts[amounts.length - 1].replace(/[^\d.-]/g, '');
    
    if (amounts.length >= 2) {
      const txAmount = amounts[amounts.length - 2];
      if (txAmount.includes('-')) {
        credit = txAmount.replace(/[^\d.]/g, '');
      } else {
        debit = txAmount.replace(/[^\d.]/g, '');
      }
    }

    rows.push([
      formattedDate,
      description,
      debit,
      credit,
      balance
    ]);
  });

  // Add rows to table
  rows.forEach(row => {
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
  
  if (typeof window.updateTableCursor === 'function') {
    window.updateTableCursor();
  }
}

// PDF processing from locrbc.html - kept exactly the same
window.bankUtils.processPDFFile = async function(file) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async function(event) {
      const arrayBuffer = event.target.result;
      try {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let allText = [];
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const text = textContent.items.map(item => item.str).join(' ');
          allText.push(text);
        }
        
        const fullText = allText.join('\n');
        const transactions = parseTransactions(fullText);
        resolve(transactions.join('\n'));
      } catch (error) {
        console.error("Error parsing PDF:", error);
        reject(new Error("Failed to parse PDF file. " + error.message));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

function parseTransactions(text) {
  // Extract transactions section
  const transactionHeader = text.match(/(Your\s+Account\s+Activity|Transactions?[\s\S]*?Balance)/i);
  let transactionSection = '';
  
  if (transactionHeader) {
    const startIndex = text.indexOf(transactionHeader[0]);
    transactionSection = text.substr(startIndex);
    
    const closingBalanceMatch = transactionSection.match(/Closing\s+Principal\s+Balance/i);
    if (closingBalanceMatch) {
      const closingIndex = transactionSection.indexOf(closingBalanceMatch[0]);
      transactionSection = transactionSection.substr(0, closingIndex);
    }
  } else {
    transactionSection = text;
  }

  // Extract transactions
  const transactionRegex = /((?:[JSFMASONJD][a-z]{2}\s+\d{1,2}\s+)?(?:[JSFMFMASONJD][a-z]{2}\s+\d{1,2}\s+)?(?!(?:Opening|Closing)\b)[^\d$]*)(-\$[\d,]+\.\d{2}|\$[\d,]+\.\d{2})?\s+\$[\d,]+\.\d{2}/gi;
  let match;
  const transactionsFound = [];
  
  transactionSection = transactionSection.replace(/Transaction\s*Date.*?Balance/gi, '');
  
  while ((match = transactionRegex.exec(transactionSection)) !== null) {
    let transactionLine = match[0].trim();
    transactionLine = transactionLine.replace(/\s+/g, ' ');
    
    if (transactionLine.includes("Opening Principal Balance") || 
        transactionLine.includes("Closing Principal Balance") ||
        /Interest Payment/i.test(transactionLine)) { // Add rule for "Interest Payment"
      continue;
    }
    
    transactionsFound.push(transactionLine);
  }
  
  return transactionsFound;
}

window.processData = processData;
