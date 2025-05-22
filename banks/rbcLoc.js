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

  const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
  let buffer = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const fullText = buffer.join(' ');
    buffer = [];

    // Skip balance-related transactions
    if (/(Opening Principal Balance|Closing Principal Balance|Balance Forward)/i.test(fullText)) {
      return;
    }

    // Extract dates (could be one or two dates)
    const dateMatches = [...fullText.matchAll(/([A-Za-z]{3}\s\d{2})/g)];
    let dates = dateMatches.map(m => m[1]);
    
    // Apply year if provided
    if (yearInput) {
      dates = dates.map(date => `${date} ${yearInput}`);
    }

    const formattedDate = dates.join(' '); // Space between dates, no dash

    // Extract amounts (transaction amount and balance)
    const amountMatches = [...fullText.matchAll(/-?\$?\d{1,3}(?:,\d{3})*\.\d{2}/g)];
    const amounts = amountMatches.map(m => m[0].replace(/\$/g, '').replace(/,/g, ''));

    if (amounts.length < 2) return; // Skip if we don't have both transaction amount and balance

    const transactionAmount = amounts[0];
    const balanceAmount = amounts[1];

    // Determine debit/credit (positive is debit, negative is credit)
    let debit = '';
    let credit = '';
    if (transactionAmount.startsWith('-')) {
      credit = transactionAmount.replace('-', '');
    } else {
      debit = transactionAmount;
    }

    // Get description by removing dates and amounts
    let description = fullText
      .replace(new RegExp(dateMatches.map(m => m[1]).join('|'), 'g'), '') // Remove original dates without year
      .replace(/-?\$?\d{1,3}(?:,\d{3})*\.\d{2}/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const row = [
      formattedDate,
      description,
      debit,
      credit,
      balanceAmount
    ];

    rows.push(row);

    const tr = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  };

  lines.forEach(line => {
    // Check if line starts with a month abbreviation (e.g., "May")
    if (/^[A-Za-z]{3}\s\d{2}/.test(line)) {
      flushBuffer();
    }
    buffer.push(line);
  });

  flushBuffer(); // Process the last transaction

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(rows);
}

window.processData = processData;