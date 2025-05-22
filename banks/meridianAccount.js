function parseLines(text) {
  if (!text) return [];
  
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const transactions = [];
  let buffer = [];
  let lastBalance = null;

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const fullText = buffer.join(' ');
    buffer = [];

    // Check if this is a balance transaction we want to exclude
    const isBalanceTransaction = /(opening balance|balance forward|closing balance)/i.test(fullText);
    
    // Extract date (format: "30-Apr-2023")
    const dateMatch = fullText.match(/^(\d{2}-[A-Za-z]{3}-\d{4})/);
    if (!dateMatch) return;

    // Extract amounts
    const amountMatch = fullText.match(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g);
    const amounts = amountMatch ? amountMatch.map(m => m.replace(/,/g, '')) : [];

    // Skip balance transactions but still update lastBalance
    if (isBalanceTransaction) {
      if (amounts.length > 0) {
        lastBalance = parseFloat(amounts[amounts.length - 1]);
      }
      return;
    }

    // Process regular transaction
    const date = dateMatch[1];
    const amount = amounts.length > 1 ? amounts[amounts.length - 2] : null;
    const balance = amounts.length > 0 ? amounts[amounts.length - 1] : null;

    // Get description by removing date and amounts
    let description = fullText
      .replace(dateMatch[0], '')
      .replace(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Determine debit/credit
    let debit = '', credit = '';
    const amountValue = amount ? parseFloat(amount) : 0;
    const balanceValue = balance ? parseFloat(balance) : null;

    if (lastBalance !== null && balanceValue !== null) {
      const difference = balanceValue - lastBalance;
      if (difference < 0) {
        debit = Math.abs(difference).toFixed(2);
      } else {
        credit = difference.toFixed(2);
      }
    } else if (amount) {
      if (amount.startsWith('-')) {
        debit = amount.replace('-', '');
      } else {
        credit = amount;
      }
    }

    // Update last balance
    if (balanceValue !== null) {
      lastBalance = balanceValue;
    }

    transactions.push({
      rawDate: date,
      parsedDate: parseDate(date),
      row: [
        date,
        description,
        debit,
        credit,
        balance || ''
      ]
    });
  };

  lines.forEach(line => {
    if (/^\d{2}-[A-Za-z]{3}-\d{4}/i.test(line)) {
      flushBuffer();
    }
    buffer.push(line);
  });

  flushBuffer(); // Process any remaining buffer

  return transactions;
}

function parseDate(text) {
  // Takes date format like "30-Apr-2023"
  return new Date(text);
}

function processData() {
  const input = document.getElementById('inputText').value.trim();
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';
  
  if (!input) {
    showToast("Please insert bank statement data!", "error");
    return;
  }
  
  // Parse transactions
  const items = parseLines(input);
  
  if (items.length === 0) {
    showToast("No valid transactions found!", "error");
    return;
  }
  
  // Sort by date
  items.sort((a, b) => a.parsedDate - b.parsedDate);
  
  const headers = ['#', 'Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const table = document.createElement('table');
  
  // Header row with copy buttons
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    
    if (header !== '#') {
      const button = document.createElement('button');
      button.className = 'copy-btn';
      button.innerHTML = '<i class="fa-solid fa-copy"></i>';
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const colIndex = headers.indexOf(header);
        window.bankUtils.copyColumn(colIndex);
      });
      th.insertBefore(button, th.firstChild);
    }
    
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);
  
  // Add transactions to table with numbered rows
  items.forEach(({ row }, index) => {
    const tr = document.createElement('tr');
    // Add row number
    const numberCell = document.createElement('td');
    numberCell.textContent = index + 1;
    tr.appendChild(numberCell);
    
    // Add the rest of the cells
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  
  outputDiv.appendChild(table);
  
  // Store raw data for potential export
  table.dataset.rows = JSON.stringify(items.map((item, index) => [
    index + 1, // Row number
    ...item.row // Original row data
  ]));
  
  // Show the toolbar
  document.getElementById('toolbar').classList.add('show');
  saveState();
}

window.processData = processData;