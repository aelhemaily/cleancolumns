function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').map(line => line.trim()).filter(Boolean);
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const transactions = []; // Use a temporary array to store parsed transactions for sorting
  const table = document.createElement('table');

  // Copy buttons
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

  let buffer = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const full = buffer.join(' ');
    const match = full.match(/^(\d+)\s+([A-Za-z]{3} \d{1,2})\s+([A-Za-z]{3} \d{1,2})\s+(.*?)\s+([\d,]+\.\d{2}-?)$/);

    if (!match) {
      buffer = [];
      return;
    }

    let [, , date1, date2, description, amountRaw] = match;

    // Store the original date1 for sorting purposes
    const originalDate1 = date1;

    if (yearInput) {
      date1 += ` ${yearInput}`;
      date2 += ` ${yearInput}`;
    }

    const date = `${date1} ${date2}`;
    const amount = amountRaw.replace(/,/g, '').replace('-', '');
    const isCredit = amountRaw.endsWith('-');

    const debit = isCredit ? '' : amount;
    const credit = isCredit ? amount : '';

    // Push an object with the original date for sorting and the row data
    transactions.push({
      sortDate: new Date(`${originalDate1} ${yearInput || new Date().getFullYear()}`), // Use yearInput or current year for sorting
      row: [date, description.trim(), debit, credit, '']
    });

    buffer = [];
  };

  lines.forEach(line => {
    if (/^\d+\s+[A-Za-z]{3} \d{1,2}\s+[A-Za-z]{3} \d{1,2}/.test(line)) {
      flushBuffer();
    }
    buffer.push(line);
  });

  flushBuffer(); // Final flush

  // Sort transactions by date in ascending order
  transactions.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

  // Add sorted rows to table
  transactions.forEach(({ row }) => {
    const tr = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(transactions.map(t => t.row)); // Store only the row data
}

window.processData = processData;
