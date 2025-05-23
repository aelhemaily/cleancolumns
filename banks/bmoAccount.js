function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').filter(l => l.trim());
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];

  const table = document.createElement('table');

  // Copy buttons row (always render for consistency)
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

  // Header row (always render for consistency)
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
    // Append year if provided and date format is Month Day
    if (yearInput && /^[A-Za-z]{3} \d{1,2}$/.test(date)) {
      date += ` ${yearInput}`;
    }

    // Get the part of the line after the date
    const contentAfterDate = line.replace(dateMatch ? dateMatch[0] : '', '').trim();

    // Regex to find all amount-like numbers
    const amountPattern = /-?\d{1,3}(?:,\d{3})*\.\d{2}/g;
    const allAmountMatches = [...contentAfterDate.matchAll(amountPattern)];

    let desc = '';
    let amount = '';
    let balance = '';
    let debit = '';
    let credit = '';

    if (allAmountMatches.length >= 2) {
      // The last two matches are typically the transaction amount and the balance
      const balanceMatch = allAmountMatches[allAmountMatches.length - 1];
      const transactionAmountMatch = allAmountMatches[allAmountMatches.length - 2];

      balance = parseFloat(balanceMatch[0].replace(/,/g, ''));
      amount = parseFloat(transactionAmountMatch[0].replace(/,/g, ''));

      // The description is the part of the string before the second-to-last amount match
      desc = contentAfterDate.substring(0, transactionAmountMatch.index).trim();

    } else if (allAmountMatches.length === 1) {
      // This case handles lines with only a balance (e.g., "Opening Balance")
      balance = parseFloat(allAmountMatches[0][0].replace(/,/g, ''));
      desc = contentAfterDate.substring(0, allAmountMatches[0].index).trim();

      if (/opening balance|closing totals/i.test(desc)) {
        previousBalance = balance; // Always update previous balance for these rows
        return; // Skip these rows from the output table
      }
    } else {
      // No amounts found, skip this line as it's not a valid transaction for our table
      return;
    }

    // Determine debit/credit based on balance change
    if (previousBalance !== null) {
      const delta = +(balance - previousBalance).toFixed(2);
      if (Math.abs(delta - amount) < 0.01) {
        credit = amount.toFixed(2);
      } else if (Math.abs(delta + amount) < 0.01) {
        debit = amount.toFixed(2);
      } else {
        // If delta doesn't match +/- amount, assume it's a debit for consistency
        debit = amount.toFixed(2);
      }
    } else {
      // If no previous balance, assume the first transaction amount is a debit
      debit = amount.toFixed(2);
    }

    const row = [date, desc, debit, credit, balance.toFixed(2)];
    rows.push(row);
    previousBalance = balance;
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

  // Ensure toolbar and save state are updated after processing
  document.getElementById('toolbar').classList.add('show');
  // These functions are assumed to be globally available via window.bankUtils or directly
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
