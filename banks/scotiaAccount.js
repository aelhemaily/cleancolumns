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
  let lastBalance = null;

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const full = buffer.join(' ');
    const dateMatch = full.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
    const amounts = [...full.matchAll(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g)].map(m => m[0].replace(/,/g, ''));

    if (!dateMatch || amounts.length < 2) {
      buffer = [];
      return;
    }

    let date = dateMatch[1];
    if (yearInput) {
      const parts = date.split('/');
      date = `${parts[0]}/${parts[1]}/${yearInput}`;
    }

    const amount = parseFloat(amounts[amounts.length - 2]);
    const balance = parseFloat(amounts[amounts.length - 1]);

    let description = full
      .replace(dateMatch[0], '')
      .replace(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    let debit = '', credit = '';
    if (lastBalance !== null) {
      if (balance < lastBalance) {
        debit = amount.toFixed(2);
      } else {
        credit = amount.toFixed(2);
      }
    } else {
      // If no prior balance, default to debit
      debit = amount.toFixed(2);
    }

    lastBalance = balance;

    const row = [date, description, debit, credit, balance.toFixed(2)];
    rows.push(row);

    const tr = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    table.appendChild(tr);

    buffer = [];
  };

  lines.forEach(line => {
    if (/^\d{2}\/\d{2}\/\d{4}/.test(line)) {
      flushBuffer();
      buffer.push(line);
    } else {
      buffer.push(line);
    }
  });

  flushBuffer(); // Final flush

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(rows);
}

window.processData = processData;
