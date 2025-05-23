function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim(); // This is available and will now be used if provided
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
  const transactions = [];

  // Regex for the first date format (date on its own line: "Apr. 17")
  const singleDatePattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}$/i;
  // Regex for amount lines (e.g., "11.29")
  const amountPattern = /^\d{1,3}(?:,\d{3})*\.\d{2}$/;
  // Regex for the second date format (two dates on one line with description and amount: "Jun. 9 Jun. 11 SHAWARMA GUYS...")
  const fullLinePattern = /^((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2})\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2})\s+(.*?)\s+([\d,]+\.\d{2})(\s+CR)?$/i;


  let buffer = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const full = buffer.join(' ');
    const fullMatch = fullLinePattern.exec(full);

    if (fullMatch) {
      // Handles the "Jun. 9 Jun. 11 SHAWARMA GUYS LONDON ON 920319988203 9.03" format
      const [, date1, date2, desc, amountRaw, crTag] = fullMatch;
      const amount = parseFloat(amountRaw.replace(/,/g, ''));
      const type = crTag ? 'credit' : 'debit';

      // Append year if yearInput is provided
      const formattedStartDate = yearInput ? `${date1} ${yearInput}` : date1;
      const formattedEndDate = yearInput ? `${date2} ${yearInput}` : date2;

      transactions.push({
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        description: desc.trim(),
        amount,
        type
      });
      buffer = [];
      return;
    }

    // Handles the "Apr. 17 \n Apr. 18 \n Amazon.ca Prime Member amazon.ca/priBC \n 11.29" format
    // Extracting dates from the buffer
    let datesFound = [];
    let descriptionParts = [];
    let amount = null;
    let type = 'debit';

    buffer.forEach(line => {
      if (singleDatePattern.test(line) && datesFound.length < 2) {
        datesFound.push(line);
      } else if (amountPattern.test(line)) {
        amount = parseFloat(line.replace(/,/g, ''));
      } else if (line.toUpperCase() === 'CR') {
        type = 'credit';
      } else {
        descriptionParts.push(line);
      }
    });

    if (datesFound.length > 0 && amount !== null) {
      const startDate = datesFound[0];
      const endDate = datesFound[1] || ''; // Ensure endDate is captured if present

      // Append year if yearInput is provided
      const formattedStartDate = yearInput ? `${startDate} ${yearInput}` : startDate;
      const formattedEndDate = yearInput && endDate ? `${endDate} ${yearInput}` : endDate;

      transactions.push({
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        description: descriptionParts.join(' ').trim(),
        amount,
        type
      });
    }

    buffer = [];
  };

  lines.forEach(line => {
    // If the line matches either date pattern, flush the buffer and start a new transaction
    if (singleDatePattern.test(line) || fullLinePattern.test(line)) {
      flushBuffer();
    }
    buffer.push(line);
  });

  flushBuffer(); // Final flush to process any remaining data in the buffer

  transactions.forEach(tx => {
    const { startDate, endDate, description, amount, type } = tx;
    let debit = '', credit = '';
    if (type === 'credit') {
      credit = amount.toFixed(2);
    } else {
      debit = amount.toFixed(2);
    }
    // Format the date column as "StartDate EndDate" if endDate exists and is different,
    // otherwise just "StartDate".
    const dateColumn = startDate + (endDate && endDate !== startDate ? ' ' + endDate : '');
    const row = [dateColumn, description, debit, credit, '']; // Balance is not available in BMO Card format

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

// Export globally
window.processData = processData;
