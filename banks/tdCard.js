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
    btn.textContent = `Copy`;
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

  lines.forEach(line => {
    const match = line.match(dateRegex);
    if (!match) return;

    const [startMonth, startDay, endMonth, endDay] = match[0].split(' ');
    const startDate = `${startMonth} ${startDay} ${yearInput}`;
    const endDate = `${endMonth} ${endDay} ${yearInput}`;
    const date = `${startDate} ${endDate}`;

    const rest = line.replace(dateRegex, '').trim();

    const amountMatch = rest.match(/-?\$[\d,]+\.\d{2}/);
    let debit = '', credit = '', balance = '';

    let amountVal = 0;

    if (amountMatch) {
      const rawAmount = amountMatch[0];
      amountVal = parseFloat(rawAmount.replace(/[^0-9.-]/g, ''));
      if (rawAmount.startsWith('-')) {
        credit = Math.abs(amountVal).toFixed(2);
      } else {
        debit = amountVal.toFixed(2);
      }
    }

    const desc = rest.replace(/-?\$[\d,]+\.\d{2}/, '').trim();
    const row = [date, desc, debit, credit, balance];

    // Create a unique signature for flagging duplicates
    const signature = `${desc.toLowerCase()}|${amountVal.toFixed(2)}`;
    let flagged = false;

    if (seen.has(signature)) {
      flagged = true;
    } else {
      seen.add(signature);
    }

    const tr = document.createElement('tr');
    if (flagged) tr.style.backgroundColor = '#ffcccc'; // light red for flag
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });

    table.appendChild(tr);
    rows.push(row);
  });

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(rows);
}

// Export for use
window.processData = processData;
