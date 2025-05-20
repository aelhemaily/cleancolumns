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

  if (transactions.length === 0) {
    // Show red warning message
    warning = document.createElement('div');
    warning.id = 'parseWarning';
    warning.textContent = '⚠️ Unexpected data format, please reload page!';
    outputDiv.appendChild(warning);
    return;
  }

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

    const row = [startDate + (endDate !== startDate ? ' ' + endDate : ''), description, debit, credit, ''];
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
}

function parseBmoLocStatement(inputText, yearInput) {
  const lines = inputText.split('\n').map(l => l.trim()).filter(Boolean);
  const transactions = [];
  const buffer = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const fullLine = buffer.join(' ');
    const linePattern = /^\d+\s+([A-Za-z]{3,4}\.?\s*\d{1,2})\s+([A-Za-z]{3,4}\.?\s*\d{1,2})\s+(.+)$/;
    const match = fullLine.match(linePattern);
    if (!match) {
      buffer.length = 0;
      return;
    }

    let [, startDateRaw, endDateRaw, rest] = match;

    // Normalize dates (add year if provided)
    function normalizeDate(dateStr) {
      dateStr = dateStr.replace('.', '');
      return yearInput ? `${dateStr} ${yearInput}` : dateStr;
    }

    const startDate = normalizeDate(startDateRaw);
    const endDate = normalizeDate(endDateRaw);

    let amountMatch = rest.match(/([\d,]+\.\d{2})(CR)?$/i);
    if (!amountMatch) {
      buffer.length = 0;
      return;
    }

    let amountStr = amountMatch[1].replace(/,/g, '');
    let amount = parseFloat(amountStr);
    let isCredit = !!amountMatch[2];

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
    if (/^\d+\s+[A-Za-z]{3,4}\.?\s*\d{1,2}\s+[A-Za-z]{3,4}\.?\s*\d{1,2}/.test(line)) {
      flushBuffer();
      buffer.push(line);
    } else {
      buffer.push(line);
    }
  }

  flushBuffer();
  return transactions;
}

// Export the processData function globally for the main script to use
window.processData = processData;
