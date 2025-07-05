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

  const dateRegex = /^[A-Za-z]{3} \d{1,2} [A-Za-z]{3} \d{1,2}/;
  const seen = new Set();
  let buffer = []; // Stores multi-line transactions

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const fullLine = buffer.join(' ');
    const match = fullLine.match(dateRegex);
    if (!match) {
      buffer = [];
      return;
    }

    // Extract the two dates
    let [fullDateString, date1Part, date2Part] = match[0].match(/([A-Za-z]{3} \d{1,2})\s+([A-Za-z]{3} \d{1,2})/);

    // Append year if provided
    let formattedDate = '';
    if (yearInput) {
      formattedDate = `${date1Part} ${yearInput} ${date2Part} ${yearInput}`;
    } else {
      formattedDate = `${date1Part} ${date2Part}`;
    }

    const rest = fullLine.replace(dateRegex, '').trim();
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
    if (line.match(dateRegex)) {
      flushBuffer(); // Process previous transaction
      buffer.push(line);
    } else {
      buffer.push(line); // Append to current transaction
    }
  });

  flushBuffer(); // Process last transaction

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(rows);
}

window.processData = processData;
