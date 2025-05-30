function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').map(line => line.trim()).filter(Boolean);
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const table = document.createElement('table');

  // --- Copy Buttons Row ---
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

  // --- Header Row ---
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  let currentDate = '';
  const transactions = [];
  let tempLines = [];
  const validMonths = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

  lines.forEach((line) => {
    const dateMatch = line.match(/^([A-Za-z]{3})\s+\d{1,2}/);
    const isValidDateLine = dateMatch && validMonths.includes(dateMatch[1].toLowerCase());
    const isBalanceLine = line.toLowerCase().includes('opening balance') ||
                          line.toLowerCase().includes('balance forward') ||
                          line.toLowerCase().includes('closing balance');

    // If it's a balance line, filter it out but use its date for subsequent transactions if available
    if (isBalanceLine) {
      if (tempLines.length > 0) {
        // If there are accumulated non-balance lines, push them with the current date
        transactions.push({ date: currentDate, lines: [...tempLines] });
        tempLines = []; // Clear tempLines
      }
      if (isValidDateLine) {
        // Update currentDate with the date from the balance line
        // This date will apply to subsequent dateless transactions
        currentDate = dateMatch[0];
        if (yearInput) currentDate += ` ${yearInput}`;
      }
      return; // Skip this balance line entirely; do not add it to transactions
    }

    // Now handle regular transaction lines
    if (isValidDateLine) {
      if (tempLines.length > 0) {
        transactions.push({ date: currentDate, lines: [...tempLines] });
        tempLines = [];
      }
      currentDate = dateMatch[0];
      if (yearInput) currentDate += ` ${yearInput}`;
      const restOfLine = line.replace(dateMatch[0], '').trim();
      if (restOfLine) tempLines.push(restOfLine);
    } else {
      tempLines.push(line);
    }

    // This condition is for multi-line transactions where the last line contains two amounts (transaction and balance)
    const amountMatch = line.match(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g);
    if (amountMatch && amountMatch.length === 2) {
      transactions.push({ date: currentDate, lines: [...tempLines] });
      tempLines = [];
    }
  });

  // After the loop, push any remaining tempLines
  if (tempLines.length > 0) {
    transactions.push({ date: currentDate, lines: [...tempLines] });
  }

  const rows = [];
  let previousBalance = null;

  transactions.forEach(entry => {
    const { date, lines } = entry;
    const fullText = lines.join(' ').trim();
    // The balance lines are already filtered out earlier, so no need for 'isOpeningBalance' or 'isClosingBalance' checks here.

    const allAmounts = [...fullText.matchAll(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g)].map(m => parseFloat(m[0].replace(/,/g, '')));
    if (allAmounts.length < 1) return;

    const amount = allAmounts[0];
    const balance = allAmounts.length > 1 ? allAmounts[1] : null;
    const descText = fullText.replace(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g, '').trim();

    let debit = '', credit = '';

    if (balance !== null && previousBalance !== null) {
      const delta = balance - previousBalance;
      if (Math.abs(delta - amount) < 0.01) {
        credit = amount.toFixed(2);
      } else if (Math.abs(delta + amount) < 0.01) {
        debit = amount.toFixed(2);
      } else {
        // Fallback to direction (less reliable if delta doesn't match amount)
        if (delta < 0) debit = amount.toFixed(2);
        else credit = amount.toFixed(2);
      }
    } else if (window.bankUtils?.keywords) {
      const isCredit = window.bankUtils.keywords.credit.some(kw =>
        descText.toLowerCase().includes(kw.toLowerCase())
      );
      if (isCredit) credit = amount.toFixed(2);
      else debit = amount.toFixed(2);
    } else {
      debit = amount.toFixed(2); // Ultimate fallback
    }

    previousBalance = balance !== null ? balance : previousBalance;

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