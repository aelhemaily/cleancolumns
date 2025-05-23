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
  let lastBalance = null; // This will correctly track the balance across transactions

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const full = buffer.join(' ');
    const dateMatch = full.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
    // Get all amount matches, including those in description, to find their positions
    const allAmountMatches = [...full.matchAll(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g)];
    const amounts = allAmountMatches.map(m => m[0].replace(/,/g, ''));

    // --- START: Balance Line Handling ---
    const balanceKeywords = ['opening balance', 'balance forward', 'closing balance'];
    const isBalanceLine = balanceKeywords.some(keyword => full.toLowerCase().includes(keyword));

    if (isBalanceLine) {
      if (amounts.length > 0) { // Ensure there's an amount to update balance
          lastBalance = parseFloat(amounts[amounts.length - 1]); // Update lastBalance with the balance amount
      }
      buffer = []; // Clear buffer for next transaction
      return; // Skip adding this balance line to the table
    }
    // --- END: Balance Line Handling ---

    if (!dateMatch || amounts.length < 2) {
      buffer = [];
      return;
    }

    let date = dateMatch[1];
    if (yearInput) {
      const parts = date.split('/');
      date = `${parts[0]}/${parts[1]}/${yearInput}`;
    }

    // The actual transaction amount and balance are the last two amounts found
    const amount = parseFloat(amounts[amounts.length - 2]);
    const balance = parseFloat(amounts[amounts.length - 1]);

    // Construct description by removing only the date and the *last two* amounts
    let description = full;
    // Remove the balance amount first
    description = description.replace(allAmountMatches[allAmountMatches.length - 1][0], '');
    // Then remove the transaction amount
    description = description.replace(allAmountMatches[allAmountMatches.length - 2][0], '');
    // Finally, remove the date
    description = description.replace(dateMatch[0], '');

    description = description.replace(/\s+/g, ' ').trim(); // Normalize spaces

    let debit = '', credit = '';
    if (lastBalance !== null) {
      if (balance < lastBalance) { // If new balance is less than old, it's a debit
        debit = amount.toFixed(2);
      } else { // If new balance is more than old, it's a credit
        credit = amount.toFixed(2);
      }
    } else {
      // If no prior balance was established, default to debit (or infer based on amount sign if possible)
      debit = amount.toFixed(2);
    }

    lastBalance = balance; // Update lastBalance for the next iteration

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
    if (/^\d{2}\/\d{2}\/\d{4}/.test(line)) { // Check if line starts with a date (DD/MM/YYYY)
      flushBuffer(); // Process the accumulated lines before starting a new buffer
      buffer.push(line); // Start new buffer with this line
    } else {
      buffer.push(line); // Add to current buffer
    }
  });

  flushBuffer(); // Final flush to process any remaining data in the buffer

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(rows);
}

window.processData = processData;
