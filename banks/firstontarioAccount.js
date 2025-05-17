function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  if (!input) {
    showToast("Please insert bank statement data!", "error");
    return;
  }

  const headers = ['#', 'Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];
  const table = document.createElement('table');

  // Header row with copy buttons
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    
    if (header !== '#') {
      const button = document.createElement('button');
      button.className = 'copy-btn';
      button.innerHTML = '<i class="fa-solid fa-copy"></i>';
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        window.bankUtils.copyColumn(headers.indexOf(header));
      });
      th.insertBefore(button, th.firstChild);
    }
    
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
  let buffer = [];
  let lastBalance = null;
  let firstTransaction = true;

  // Check for balance forward
  const balanceForwardMatch = input.match(/Balance Forward:\s*([\d,]+\.\d{2})/);
  if (balanceForwardMatch) {
    lastBalance = parseFloat(balanceForwardMatch[1].replace(/,/g, ''));
  }

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const full = buffer.join(' ');
    const dateMatch = full.match(/^([A-Za-z]{3} \d{1,2})/);
    const amounts = [...full.matchAll(/(\d{1,3}(?:,\d{3})*\.\d{2})/g)].map(m => m[0].replace(/,/g, ''));

    if (!dateMatch || amounts.length < 1) {
      buffer = [];
      return;
    }

    let date = dateMatch[1];
    if (yearInput) {
      date = `${date} ${yearInput}`;
    }

    const amount = parseFloat(amounts[0]);
    const balance = amounts.length > 1 ? parseFloat(amounts[1]) : null;

    let description = full
      .replace(dateMatch[0], '')
      .replace(/(\d{1,3}(?:,\d{3})*\.\d{2})/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    let debit = '', credit = '';
    
    // Handle first transaction if no balance forward
    if (firstTransaction && lastBalance === null && balance !== null) {
      debit = amount.toFixed(2);
      lastBalance = balance;
      firstTransaction = false;
    } 
    // Normal balance-based allocation
    else if (balance !== null && lastBalance !== null) {
      if (balance > lastBalance) {
        credit = amount.toFixed(2);
      } else {
        debit = amount.toFixed(2);
      }
      lastBalance = balance;
    } 
    // Fallback when no new balance provided
    else if (lastBalance !== null) {
      debit = amount.toFixed(2);
      lastBalance -= amount;
    }

    const rowNumber = rows.length + 1;
    const row = [
      rowNumber.toString(),
      date,
      description,
      debit,
      credit,
      balance !== null ? balance.toFixed(2) : lastBalance.toFixed(2)
    ];
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
    if (line.startsWith('Balance Forward:')) {
      return;
    } else if (/^[A-Za-z]{3} \d{1,2}/.test(line)) {
      flushBuffer();
      buffer.push(line);
    } else {
      buffer.push(line);
    }
  });

  flushBuffer();

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(rows);

  // Show toolbar and save state
  document.getElementById('toolbar').classList.add('show');
  saveState();
}

window.processData = processData;