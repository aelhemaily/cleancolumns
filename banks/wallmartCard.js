function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').filter(l => l.trim());
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

  // Regex to match a line that starts with an optional number, followed by two date patterns
  // This regex will also be used to extract the initial date parts for transaction lines
  const transactionStartRegex = /^(?:\d+\s+)?([A-Za-z]{3} \d{1,2})\s+([A-Za-z]{3} \d{1,2})/;
  const seen = new Set();
  let buffer = []; // Stores the parts of a multi-line transaction

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const fullLine = buffer.join(' ').trim();
    // Re-validate the full buffered line against the transaction start regex
    // to ensure it begins with a valid transaction pattern.
    const match = fullLine.match(transactionStartRegex);

    if (!match) {
      buffer = []; // Discard buffer if it doesn't form a valid transaction
      return;
    }

    // Extract the two dates. match[1] is the first date, match[2] is the second date
    let date1Part = match[1];
    let date2Part = match[2];

    // Append year if provided
    let formattedDate = '';
    if (yearInput) {
      formattedDate = `${date1Part} ${yearInput} ${date2Part} ${yearInput}`;
    } else {
      formattedDate = `${date1Part} ${date2Part}`;
    }

    // Get the rest of the line after the dates (and optional leading number)
    const rest = fullLine.replace(transactionStartRegex, '').trim();
    const amountMatch = rest.match(/-?\$[\d,]+\.\d{2}/);
    let debit = '', credit = '', balance = '';

    if (amountMatch) {
      const rawAmount = amountMatch[0];
      const amountVal = parseFloat(rawAmount.replace(/[^0-9.-]/g, ''));
      if (rawAmount.startsWith('-')) {
        credit = Math.abs(amountVal).toFixed(2);
      } else {
        debit = amountVal.toFixed(2);
      }
    }

    const desc = rest.replace(/-?\$[\d,]+\.\d{2}/, '').trim();

    // Check for duplicates
    const signature = `${desc.toLowerCase()}|${debit || credit}`;
    const isDuplicate = seen.has(signature);
    if (!isDuplicate) seen.add(signature);

    const row = [formattedDate, desc, debit, credit, balance];
    const tr = document.createElement('tr');
    if (isDuplicate) tr.style.backgroundColor = '#ffcccc';

    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });

    table.appendChild(tr);
    rows.push(row);
    buffer = [];
  };

  lines.forEach(line => {
    // A line is considered the start of a new transaction ONLY if it matches transactionStartRegex.
    // If it matches, we flush the previous buffer and start a new one.
    if (line.match(transactionStartRegex)) {
      flushBuffer(); // Process any transaction currently in the buffer
      buffer.push(line); // Start a new transaction with this line
    }
    // Lines that do NOT match transactionStartRegex are considered noise and are skipped.
    // This explicitly prevents "noise" lines from being added to the buffer at all.
  });

  flushBuffer(); // Process the very last transaction in the buffer, if any

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(rows);
}

window.processData = processData;