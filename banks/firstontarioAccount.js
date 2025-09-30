// firstontarioAccount.js - Complete with PDF upload functionality

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// PDF processing function for First Ontario
window.bankUtils.processPDFFile = async function(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    
    let fullText = '';
    
    // Extract text from all pages
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + ' ';
    }
    
    // Parse transactions from text using First Ontario specific logic
    const transactions = parseFirstOntarioTransactions(fullText);
    
    // Convert transactions to text format compatible with the existing parser
    const formattedText = formatTransactionsAsText(transactions);
    
    return formattedText;
  } catch (error) {
    console.error('Error parsing First Ontario PDF:', error);
    throw new Error(`Error processing ${file.name}: ${error.message}`);
  }
};

// Parse First Ontario specific transactions from PDF text
function parseFirstOntarioTransactions(text) {
  const transactions = [];
  
  // Find the account table - First Ontario specific pattern
  const accountRegex = /BUSINESS SPECIALIZED ACCOUNT\s+Account#:\s*\d+\s*(?:No\. of Cheques:\s*\d+)?\s*Owner:.*?(?=If there are any discrepancies|$)/s;
  const accountMatch = text.match(accountRegex);
  
  if (!accountMatch) {
    return transactions;
  }
  
  const accountText = accountMatch[0];
  
  // Extract balance forward
  const balanceForwardRegex = /Balance Forward:\s*([\d,]+\.\d{2})/;
  const balanceForwardMatch = accountText.match(balanceForwardRegex);
  
  if (balanceForwardMatch) {
    transactions.push({
      date: '',
      description: 'Balance Forward:',
      debit: '',
      credit: '',
      balance: balanceForwardMatch[1]
    });
  }
  
  // Extract transactions - First Ontario specific pattern
  const transactionRegex = /(\w{3} \d{1,2})\s+(.*?)\s+([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})/g;
  let match;
  
  while ((match = transactionRegex.exec(accountText)) !== null) {
    const date = match[1];
    const description = match[2].trim();
    const debit = match[3] || '';
    const credit = match[4] || '';
    const balance = match[5];
    
    transactions.push({
      date,
      description,
      debit,
      credit,
      balance
    });
  }
  
  return transactions;
}

// Format transactions as text for the existing parser
function formatTransactionsAsText(transactions) {
  let formattedText = '';
  
  transactions.forEach(transaction => {
    if (transaction.description === 'Balance Forward:') {
      formattedText += `Balance Forward: ${transaction.balance}\n`;
    } else {
      let line = `${transaction.date} ${transaction.description}`;
      
      // Add amounts in the expected format
      if (transaction.debit) {
        line += ` ${transaction.debit}`;
      }
      if (transaction.credit) {
        line += ` ${transaction.credit}`;
      }
      if (transaction.balance) {
        line += ` ${transaction.balance}`;
      }
      
      formattedText += line + '\n';
    }
  });
  
  return formattedText;
}

// Main processing function
function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  if (!input) {
    if (typeof showToast === 'function') {
      showToast("Please insert bank statement data!", "error");
    } else {
      console.error("Please insert bank statement data!");
    }
    return;
  }

  const headers = ['#', 'Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];
  const table = document.createElement('table');

  // Header row with copy buttons
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
  let buffer = [];
  let lastBalance = null;
  let firstTransaction = true;

  // Check for balance forward
  const balanceForwardMatch = input.match(/Balance Forward:\s*([\d,]+\.\d{2})/);
  if (balanceForwardMatch) {
    lastBalance = parseFloat(balanceForwardMatch[1].replace(/,/g, ''));
  }

  // Helper to escape string for use in RegExp
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const full = buffer.join(' ');
    const dateMatch = full.match(/^([A-Za-z]{3} \d{1,2})/);
    // Regex to find all amount-like numbers, including negative ones
    const allAmountMatchesInLine = [...full.matchAll(/(-?\d{1,3}(?:,\d{3})*\.\d{2})/g)];

    if (!dateMatch || allAmountMatchesInLine.length < 1) {
      buffer = [];
      return;
    }

    let date = dateMatch[1];
    if (yearInput) {
      date = `${date} ${yearInput}`;
    }

    let transactionAmountRaw = null;
    let balanceAmountRaw = null;
    let amountValue = 0;
    let balanceValue = null;

    if (allAmountMatchesInLine.length >= 2) {
      // The last two matches are typically the transaction amount and the balance
      transactionAmountRaw = allAmountMatchesInLine[allAmountMatchesInLine.length - 2][0];
      balanceAmountRaw = allAmountMatchesInLine[allAmountMatchesInLine.length - 1][0];

      amountValue = parseFloat(transactionAmountRaw.replace(/,/g, ''));
      balanceValue = parseFloat(balanceAmountRaw.replace(/,/g, ''));

    } else if (allAmountMatchesInLine.length === 1) {
      // If only one numeric value, assume it's the transaction amount, balance is unknown
      transactionAmountRaw = allAmountMatchesInLine[0][0];
      amountValue = parseFloat(transactionAmountRaw.replace(/,/g, ''));
      balanceValue = null; // No explicit balance on this line
    } else {
      // No amounts found, cannot process as a valid transaction
      buffer = [];
      return;
    }

    // Get description by surgically removing only the identified date, amount, and balance strings
    let description = full;

    // Remove balance part using its raw matched string (from the end)
    if (balanceAmountRaw) {
        const lastIndex = description.lastIndexOf(balanceAmountRaw);
        if (lastIndex !== -1) {
            description = description.substring(0, lastIndex) + description.substring(lastIndex + balanceAmountRaw.length);
        }
    }

    // Remove transaction amount part using its raw matched string (from the end of remaining string)
    if (transactionAmountRaw) {
        const lastIndex = description.lastIndexOf(transactionAmountRaw);
        if (lastIndex !== -1) {
            description = description.substring(0, lastIndex) + description.substring(lastIndex + transactionAmountRaw.length);
        }
    }
    
    // Remove date part from the beginning of the description
    if (dateMatch) {
      description = description.replace(dateMatch[0], '').trim();
    }
    // Also remove any potential leading transaction number (e.g., "1 ")
    description = description.replace(/^\d+\s+/, '').trim();

    description = description.replace(/\s+/g, ' ').trim(); // Collapse multiple spaces

    let debit = '', credit = '';
    
    // Handle first transaction if no balance forward
    if (firstTransaction && lastBalance === null && balanceValue !== null) {
      // For the very first transaction, if no initial balance was set,
      // and a balance is provided on the line, assume it's a debit.
      debit = amountValue.toFixed(2);
      lastBalance = balanceValue;
      firstTransaction = false;
    } 
    // Normal balance-based allocation
    else if (balanceValue !== null && lastBalance !== null) {
      if (balanceValue > lastBalance) {
        credit = amountValue.toFixed(2);
      } else {
        debit = amountValue.toFixed(2);
      }
      lastBalance = balanceValue;
    } 
    // Fallback when no new balance provided on the line, but lastBalance is known
    else if (lastBalance !== null) {
      // This part assumes that if a balance is not explicitly provided on the line,
      // the transaction is a debit and we subtract it from the last known balance.
      debit = amountValue.toFixed(2);
      lastBalance -= amountValue;
    } else {
        // If no lastBalance and no balanceValue, we can't determine debit/credit based on balance change.
        // Fallback to a default (e.g., debit) or keyword analysis if needed.
        debit = amountValue.toFixed(2);
    }

    const rowNumber = rows.length + 1;
    const row = [
      rowNumber.toString(),
      date,
      description,
      debit,
      credit,
      balanceValue !== null ? balanceValue.toFixed(2) : (lastBalance !== null ? lastBalance.toFixed(2) : '')
    ];
    rows.push(row);

    const tr = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    table.appendChild(tr);

    buffer = [];
  };

  lines.forEach(line => {
    if (line.startsWith('Balance Forward:')) {
      // The initial balance forward is handled outside the flushBuffer.
      // We skip processing this line as a transaction within the buffer.
      return;
    } else if (/^[A-Za-z]{3} \d{1,2}/.test(line)) { // New transaction starts with a date
      flushBuffer();
      buffer.push(line);
    } else {
      buffer.push(line); // Add to current transaction's buffer
    }
  });

  flushBuffer(); // Process any remaining lines in the buffer

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(rows);

  // Show toolbar and save state
  document.getElementById('toolbar').classList.add('show');
  
  // Call the function to set up interactivity
  if (typeof createCopyColumnButtons === 'function') {
      createCopyColumnButtons();
  } else {
      console.error("createCopyColumnButtons function not found. Table interactivity may not be set up.");
  }
  
  if (typeof saveState === 'function') {
    saveState(); // Save the initial state after table generation and interactivity setup
  } else {
    console.error("saveState function not found. Undo/Redo may not work.");
  }
  
  // Update transaction counts
  if (typeof updateTransactionCounts === 'function') {
    updateTransactionCounts();
  }
}

window.processData = processData;

// Show status message (helper function)
function showStatus(message, type) {
  if (typeof showToast === 'function') {
    showToast(message, type);
  } else {
    console.log(`${type}: ${message}`);
  }
}