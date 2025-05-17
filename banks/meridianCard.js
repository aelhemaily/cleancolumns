function parseLines(text) {
  if (!text) return [];
  
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const transactions = [];
  let currentTransaction = null;

  lines.forEach(line => {
    // Check if line starts with a date pattern (e.g., "30-Apr-2023")
    const dateMatch = line.match(/^(\d{2}-[A-Za-z]{3}-\d{4})/);
    
    if (dateMatch) {
      // If we have a current transaction being built, push it before starting new one
      if (currentTransaction) {
        transactions.push(currentTransaction);
      }
      
      // Extract amounts (balance forward has different format)
      const isBalanceForward = line.includes('Balance Forward');
      const amountMatch = line.match(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g);
      const amounts = amountMatch ? amountMatch.map(m => m.replace(/,/g, '')) : [];
      
      // Start new transaction
      currentTransaction = {
        rawDate: dateMatch[1],
        descriptionParts: [line.replace(dateMatch[1], '').replace(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g, '').trim()],
        amount: isBalanceForward ? null : (amounts.length > 0 ? amounts[0] : null),
        balance: amounts.length > 0 ? amounts[isBalanceForward ? 0 : 1] : null,
        isBalanceForward: isBalanceForward
      };
    } else if (currentTransaction) {
      // Add to description for multi-line transactions
      currentTransaction.descriptionParts.push(line.replace(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g, '').trim());
    }
  });

  // Push the last transaction if it exists
  if (currentTransaction) {
    transactions.push(currentTransaction);
  }

  return transactions.map(t => {
    // Skip if no amount and not balance forward
    if (!t.amount && !t.isBalanceForward) return null;
    
    let date = t.rawDate; // Meridian dates are already complete
    
    const isDebit = t.amount && t.amount.startsWith('-');
    const cleanAmount = t.amount ? t.amount.replace(/-/g, '') : '';
    const description = t.descriptionParts.filter(p => p).join(' ').replace(/\s+/g, ' ').trim();

    return {
      rawDate: t.rawDate,
      parsedDate: parseDate(t.rawDate),
      row: [
        date,
        description,
        isDebit ? cleanAmount : '', // Debit amount (negative)
        isDebit ? '' : (t.isBalanceForward ? '' : cleanAmount), // Credit amount (positive, empty for balance forward)
        t.balance || '' // Balance
      ]
    };
  }).filter(Boolean);
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
  
  // Header row with CIBC-style copy buttons
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