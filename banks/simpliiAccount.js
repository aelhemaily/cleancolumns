// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';

// PDF processing function for Simplii
window.bankUtils.processPDFFile = async function(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    
    let allText = '';
    
    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      allText += pageText + ' ';
    }
    
    // Parse transactions from the text
    const transactions = parsePDFTransactions(allText);
    
    // Format transactions for input text
    return formatTransactionsForInput(transactions);
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw new Error(`Error processing ${file.name}: ${error.message}`);
  }
};

function parsePDFTransactions(text) {
  const transactions = [];
  
  // Split by potential transaction lines
  const lines = text.split(/(?=\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b)/);
  
  for (const line of lines) {
    // Match transaction pattern: date, description, optional amount out, optional amount in, balance
    const match = line.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(.+?)\s+([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})/);
    
    if (match) {
      const month = match[1];
      const day = match[2];
      const description = match[3].trim();
      const amountOut = match[4] || '';
      const amountIn = match[5] || '';
      const balance = match[6];
      
      transactions.push({
        date: `${month} ${day}`,
        description,
        amountOut,
        amountIn,
        balance
      });
    }
  }
  
  return transactions;
}

function formatTransactionsForInput(transactions) {
  let outputText = '';
  
  for (const transaction of transactions) {
    // Format: Date Description AmountOut AmountIn Balance
    // If there's an amount out, include it; if there's an amount in, include it
    let line = `${transaction.date} ${transaction.description}`;
    
    if (transaction.amountOut) {
      line += ` ${transaction.amountOut}`;
    }
    
    if (transaction.amountIn) {
      line += ` ${transaction.amountIn}`;
    }
    
    line += ` ${transaction.balance}`;
    
    outputText += line + '\n';
  }
  
  return outputText;
}

function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').filter(l => l.trim());
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];

  const table = document.createElement('table');

  // Copy buttons row (always render for consistency)
  const copyRow = document.createElement('tr');
  headers.forEach((_, index) => {
    const th = document.createElement('th');
    const div = document.createElement('div');
    div.className = 'copy-col';

    const btn = document.createElement('button');
    btn.textContent = `Copy`;
    btn.className = 'copy-btn';
    btn.onclick = () => window.bankUtils.copyColumn(index);

    div.appendChild(btn);
    th.appendChild(div);
    copyRow.appendChild(th);
  });
  table.appendChild(copyRow);

  // Header row (always render for consistency)
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  // Date pattern safeguard
  const isNewTransaction = (line) => {
    const datePattern = /^[A-Za-z]{3} \d{1,2}(?!\d)/;
    const validMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const match = line.match(datePattern);
    if (!match) return false;
    const [month, day] = match[0].split(' ');
    return validMonths.includes(month) && !isNaN(day) && parseInt(day) >= 1 && parseInt(day) <= 31;
  };

  // Merge lines into full transactions, accounting for multiline descriptions
  const transactions = [];
  let currentTransactionLines = [];
  lines.forEach(line => {
    // Skip the header line if present
    if (line.toLowerCase().includes('date transaction funds out funds in balance')) {
      return;
    }
    if (isNewTransaction(line)) {
      if (currentTransactionLines.length > 0) {
        transactions.push(currentTransactionLines.join(' ').trim());
      }
      currentTransactionLines = [line];
    } else {
      // If it's not a new transaction, it's either a continuation of the description
      // or a "BALANCE FORWARD" line that doesn't start with a date.
      // We will handle "BALANCE FORWARD" parsing within the loop below.
      currentTransactionLines.push(line);
    }
  });
  if (currentTransactionLines.length > 0) {
    transactions.push(currentTransactionLines.join(' ').trim());
  }

  let previousBalance = null;

  transactions.forEach(fullLine => {
    if (fullLine.toLowerCase().includes('balance forward')) {
      const balanceMatch = fullLine.match(/\d{1,3}(?:,\d{3})*\.\d{2}/);
      if (balanceMatch) {
        previousBalance = parseFloat(balanceMatch[0].replace(/,/g, ''));
      }
      return; // Do not add "BALANCE FORWARD" to the table
    }
    
    // Check for "Opening Balance" or "Closing Totals" without a leading date
    if ((fullLine.toLowerCase().includes('opening balance') || fullLine.toLowerCase().includes('closing totals')) && !isNewTransaction(fullLine)) {
        const balanceMatch = fullLine.match(/\d{1,3}(?:,\d{3})*\.\d{2}/);
        if (balanceMatch) {
            previousBalance = parseFloat(balanceMatch[0].replace(/,/g, ''));
        }
        return; // Skip these rows from the output table
    }

    const dateMatch = fullLine.match(/^[A-Za-z]{3} \d{1,2}/);
    let date = dateMatch ? dateMatch[0] : '';

    // Append year if provided and date format is Month Day
    if (yearInput && /^[A-Za-z]{3} \d{1,2}$/.test(date)) {
      date += ` ${yearInput}`;
    }

    // Get the part of the line after the date (if date exists)
    const contentAfterDate = dateMatch ? fullLine.replace(dateMatch[0], '').trim() : fullLine.trim();

    // Regex to find amounts (e.g., 100.00, 7,847.73)
    const amountPattern = /\b\d{1,3}(?:,\d{3})*\.\d{2}\b/g; // Use \b for word boundary
    const allAmountMatches = [...contentAfterDate.matchAll(amountPattern)];

    let desc = '';
    let transactionAmount = null; // Will store the single transaction amount
    let balance = '';
    let debit = '';
    let credit = '';

    if (allAmountMatches.length >= 2) {
      // The last match is the balance, the second to last is the transaction amount
      balance = parseFloat(allAmountMatches[allAmountMatches.length - 1][0].replace(/,/g, ''));
      transactionAmount = parseFloat(allAmountMatches[allAmountMatches.length - 2][0].replace(/,/g, ''));
      
      // The description is everything between the date and the second-to-last amount
      desc = contentAfterDate.substring(0, allAmountMatches[allAmountMatches.length - 2].index).trim();

    } else if (allAmountMatches.length === 1) {
      // This might be a transaction where only one amount is present (e.g., "ABM DEPOSIT 450.00 7481.48")
      // or a line with a balance that we've already handled (Opening/Closing Balance).
      // We prioritize the balance logic above. If we are here, it means it's a date-led line
      // with only one amount, which implies it's the balance. This case isn't a typical transaction.
      // So, if there's only one amount and it's a date-led line, it's likely malformed or an edge case
      // we don't want to process as a regular transaction.
      return; 
    } else {
        // No amounts found, skip this line as it's not a valid transaction for our table
        return;
    }

    // Determine debit/credit based on balance change
    if (transactionAmount !== null && previousBalance !== null) {
      const delta = +(balance - previousBalance).toFixed(2);
      if (Math.abs(delta - transactionAmount) < 0.01) {
        credit = transactionAmount.toFixed(2);
      } else if (Math.abs(delta + transactionAmount) < 0.01) {
        debit = transactionAmount.toFixed(2);
      } else {
        // If delta doesn't match +/- transactionAmount, it's an ambiguous case.
        // For Simplii data, if funds in/out are not explicit, assume funds out unless context suggests otherwise.
        // Given the example, if a single amount is present and it's not a balance, it's typically an outflow.
        // However, with the balance tracking, the delta should ideally resolve this.
        // If still ambiguous, we'll try to guess based on the delta.
         if (delta < 0) { // Balance decreased, likely a debit
             debit = transactionAmount.toFixed(2);
         } else if (delta > 0) { // Balance increased, likely a credit
             credit = transactionAmount.toFixed(2);
         } else { // No change, shouldn't happen with a transaction amount
             debit = transactionAmount.toFixed(2); // Default to debit for safety
         }
      }
    } else if (transactionAmount !== null && previousBalance === null) {
        // If no previous balance, assume the first transaction amount is a debit, unless it's a deposit (e.g. ABM DEPOSIT)
        if (desc.toLowerCase().includes('deposit')) {
            credit = transactionAmount.toFixed(2);
        } else {
            debit = transactionAmount.toFixed(2);
        }
    }


    const row = [date, desc, debit, credit, balance.toFixed(2)];
    rows.push(row);
    previousBalance = balance;
  });

  // Render rows
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

  // Ensure toolbar and save state are updated after processing
  document.getElementById('toolbar').classList.add('show');
  // These functions are assumed to be globally available via window.bankUtils or directly
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
}

// Export globally
window.processData = processData;