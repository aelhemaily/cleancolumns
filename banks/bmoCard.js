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
  const transactions = [];
  const datePattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}/i;
  const amountPattern = /^\d{1,3}(,\d{3})*\.\d{2}$/;
  const fullLinePattern = /^((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2})\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2})\s+(.*?)\s+([\d,]+\.\d{2})(\s+CR)?$/i;

  let buffer = [];
  const currentYear = yearInput || new Date().getFullYear();

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const full = buffer.join(' ');
    const fullMatch = fullLinePattern.exec(full);
    if (fullMatch) {
      const [, date1, date2, desc, amountRaw, crTag] = fullMatch;
      const amount = parseFloat(amountRaw.replace(/,/g, ''));
      const type = crTag ? 'credit' : 'debit';

      transactions.push({
        startDate: `${date1} ${currentYear}`,
        endDate: `${date2} ${currentYear}`,
        description: desc.trim(),
        amount,
        type
      });
      buffer = [];
      return;
    }

    const dateMatch = buffer[0]?.match(datePattern);
    if (!dateMatch) {
      buffer = [];
      return;
    }

    let startDate = `${dateMatch[0]} ${currentYear}`;
    let endDate = '';
    let description = '';
    let amount = null;
    let type = 'debit';

    for (let i = 1; i < buffer.length; i++) {
      const line = buffer[i];

      if (amountPattern.test(line)) {
        amount = parseFloat(line.replace(/,/g, ''));
      } else if (line.toUpperCase() === 'CR') {
        type = 'credit';
      } else {
        description += (description ? ' ' : '') + line;
      }
    }

    if (amount !== null) {
      transactions.push({ startDate, endDate, description: description.trim(), amount, type });
    }

    buffer = [];
  };

  lines.forEach(line => {
    if (datePattern.test(line) || fullLinePattern.test(line)) {
      flushBuffer();
    }
    buffer.push(line);
  });

  flushBuffer(); // Final flush

  transactions.forEach(tx => {
    const { startDate, endDate, description, amount, type } = tx;
    let debit = '', credit = '';
    if (type === 'credit') {
      credit = amount.toFixed(2);
    } else {
      debit = amount.toFixed(2);
    }
    const row = [startDate + (endDate ? ' to ' + endDate : ''), description, debit, credit, ''];
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

window.processData = processData;
