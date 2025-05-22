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

  // Date pattern safeguard
  const isNewTransaction = (line) => {
    const datePattern = /^[A-Za-z]{3} \d{1,2}(?!\d)/;
    const validMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const match = line.match(datePattern);
    if (!match) return false;
    const [month, day] = match[0].split(' ');
    return validMonths.includes(month) && !isNaN(day) && parseInt(day) >= 1 && parseInt(day) <= 31;
  };

  // Merge lines into full transactions
  const transactions = [];
  let current = '';
  lines.forEach(line => {
    if (isNewTransaction(line)) {
      if (current) transactions.push(current.trim());
      current = line;
    } else {
      current += ' ' + line;
    }
  });
  if (current) transactions.push(current.trim());

  let previousBalance = null;

  transactions.forEach(line => {
    const dateMatch = line.match(/^[A-Za-z]{3} \d{1,2}/);
    let date = dateMatch ? dateMatch[0] : '';
    if (yearInput && /^[A-Za-z]{3} \d{1,2}/.test(date)) {
      date += ` ${yearInput}`;
    }

    const rest = line.replace(dateMatch ? dateMatch[0] : '', '').trim();
    const amounts = [...rest.matchAll(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g)].map(m => m[0].replace(/,/g, ''));
    let amount = '', balance = '', debit = '', credit = '';

    const desc = rest.replace(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g, '').trim();

    if (amounts.length === 1) {
      balance = amounts[0];
      previousBalance = parseFloat(balance);
      if (/opening balance/i.test(desc)) return; // Skip Opening balance row
    } else if (amounts.length >= 2) {
      amount = parseFloat(amounts[amounts.length - 2]);
      balance = parseFloat(amounts[amounts.length - 1]);

      if (/closing totals/i.test(desc)) {
        previousBalance = balance;
        return; // Skip Closing totals row
      }

      if (previousBalance !== null) {
        const delta = +(balance - previousBalance).toFixed(2);
        if (Math.abs(delta - amount) < 0.01) {
          credit = amount.toFixed(2);
        } else if (Math.abs(delta + amount) < 0.01) {
          debit = amount.toFixed(2);
        } else {
          debit = amount.toFixed(2);
        }
      } else {
        debit = amount.toFixed(2);
      }

      const row = [date, desc, debit, credit, balance.toFixed(2)];
      rows.push(row);
      previousBalance = balance;
    }
  });

  // Render rows
  rows.forEach(row => {
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

// Export globally
window.processData = processData;
