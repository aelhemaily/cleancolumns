function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  // Remove existing warning if any
  let warning = document.getElementById('parseWarning');
  if (warning) {
    warning.remove();
  }

  const transactions = parseBmoLocStatement(input, yearInput);
  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];

  const table = document.createElement('table');
  const headerRow = document.createElement('tr');

  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });

  table.appendChild(headerRow);

  transactions.forEach(tx => {
    const { startDate, endDate, description, amount, type } = tx;
    let debit = '', credit = '';

    if (type === 'credit') {
      credit = amount.toFixed(2);
    } else if (type === 'debit') {
      debit = amount.toFixed(2);
    }

    // Format the date column to include both dates, with year if provided
    // IMPORTANT: Now, if endDate exists, it will always be appended with a space.
    const dateColumn = startDate + (endDate ? ' ' + endDate : '');
    const row = [dateColumn, description, debit, credit, ''];
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

  // Ensure toolbar and save state are updated after processing
  document.getElementById('toolbar').classList.add('show');
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

function parseBmoLocStatement(inputText, yearInput) {
  const lines = inputText.split('\n').map(l => l.trim()).filter(Boolean);
  const transactions = [];
  const buffer = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const fullLine = buffer.join(' ');
    // Updated linePattern to correctly capture both dates and the rest of the line
    // It now expects a number, then two date patterns, then the rest of the description/amount
    const linePattern = /^\d+\s+([A-Za-z]{3,4}\.?\s*\d{1,2})\s+([A-Za-z]{3,4}\.?\s*\d{1,2})\s+(.+)$/;
    const match = fullLine.match(linePattern);

    if (!match) {
      buffer.length = 0;
      return;
    }

    let [, startDateRaw, endDateRaw, rest] = match;

    // Normalize dates: append year only if yearInput is provided
    function normalizeDate(dateStr) {
      dateStr = dateStr.replace('.', ''); // Remove period if present
      return yearInput ? `${dateStr} ${yearInput}` : dateStr;
    }

    const startDate = normalizeDate(startDateRaw);
    const endDate = normalizeDate(endDateRaw);

    // Amount pattern at the end of the 'rest' string, optionally followed by 'CR'
    let amountMatch = rest.match(/([\d,]+\.\d{2})(CR)?$/i);
    if (!amountMatch) {
      buffer.length = 0;
      return;
    }

    let amountStr = amountMatch[1].replace(/,/g, '');
    let amount = parseFloat(amountStr);
    let isCredit = !!amountMatch[2];

    // Description is everything before the matched amount part
    let description = rest.slice(0, rest.length - amountMatch[0].length).trim();

    transactions.push({
      startDate,
      endDate,
      description,
      amount,
      type: isCredit ? 'credit' : 'debit'
    });

    buffer.length = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // This regex checks if a line starts with a number, then a month and day, then another month and day
    // This indicates the start of a new transaction line in your provided format.
    if (/^\d+\s+[A-Za-z]{3,4}\.?\s*\d{1,2}\s+[A-Za-z]{3,4}\.?\s*\d{1,2}/.test(line)) {
      flushBuffer(); // Flush previous transaction if any
      buffer.push(line); // Start new buffer with this line
    } else {
      // If it's not a new transaction line, it's part of the current transaction's description
      buffer.push(line);
    }
  }

  flushBuffer(); // Final flush to process any remaining data in the buffer
  return transactions;
}

// Export the processData function globally for the main script to use
window.processData = processData;
