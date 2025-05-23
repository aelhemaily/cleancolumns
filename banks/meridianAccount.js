function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').map(line => line.trim()).filter(Boolean);
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const table = document.createElement('table');

  const copyRow = document.createElement('tr');
  const headerRow = document.createElement('tr');

  headers.forEach((header, index) => {
    const thCopy = document.createElement('th');
    const div = document.createElement('div');
    div.className = 'copy-col';
    const btn = document.createElement('button');
    btn.textContent = '📋';
    btn.className = 'copy-btn';
    btn.onclick = () => window.bankUtils.copyColumn(index);
    div.appendChild(btn);
    thCopy.appendChild(div);
    copyRow.appendChild(thCopy);

    const thHeader = document.createElement('th');
    thHeader.textContent = header;
    headerRow.appendChild(thHeader);
  });

  table.appendChild(copyRow);
  table.appendChild(headerRow);

  const dateRegex = /^(\d{2}-[A-Za-z]{3})(?:-\d{4})?/;
  const amountRegex = /-?\d{1,3}(?:,\d{3})*\.\d{2}/;
  const transactions = [];
  let currentDate = '';
  let currentLines = [];

  function pushTransaction() {
    if (currentLines.length === 0) return;
    transactions.push({ date: currentDate, lines: [...currentLines] });
    currentLines = [];
  }

  lines.forEach((line) => {
    const isBalanceLine = /opening balance|balance forward|closing balance/i.test(line);
    const isDateLine = dateRegex.test(line);
    const hasAmount = amountRegex.test(line);

    if (isBalanceLine) {
      pushTransaction();
      if (isDateLine) {
        const baseDate = line.match(dateRegex)[1];
        currentDate = yearInput ? `${baseDate}-${yearInput}` : line.match(dateRegex)[0];
      }
      return;
    }

    if (isDateLine) {
      pushTransaction();
      const baseDate = line.match(dateRegex)[1];
      currentDate = yearInput ? `${baseDate}-${yearInput}` : line.match(dateRegex)[0];
      const rest = line.replace(dateRegex, '').trim();
      if (rest) currentLines.push(rest);
    } else if (hasAmount) {
      pushTransaction();
      currentLines.push(line);
    } else {
      currentLines.push(line);
    }
  });

  pushTransaction();

  const rows = [];

  transactions.forEach(({ date, lines }) => {
    const fullText = lines.join(' ').trim();
    const isCashCoinFee = /Cash & Coin Fee/i.test(fullText);
    const amounts = [...fullText.matchAll(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g)].map(m => parseFloat(m[0].replace(/,/g, '')));
    
    if (amounts.length < 1) return;

    // Special handling for Cash & Coin Fee with only one amount
    if (isCashCoinFee && amounts.length === 1) {
      const row = [date, fullText.replace(amountRegex, '').trim(), '', '', amounts[0].toFixed(2)];
      rows.push(row);
      
      const tr = document.createElement('tr');
      row.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      });
      table.appendChild(tr);
      return;
    }

    const amount = amounts[0];
    const balance = amounts.length > 1 ? amounts[1] : null;
    const descText = fullText.replace(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g, '').trim();

    let debit = '', credit = '';
    if (amount < 0) {
      debit = (-amount).toFixed(2);
    } else {
      credit = amount.toFixed(2);
    }

    const row = [date, descText, debit, credit, balance !== null ? balance.toFixed(2) : ''];
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