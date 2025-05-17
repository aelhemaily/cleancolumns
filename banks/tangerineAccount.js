function processTangerineData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').filter(Boolean);
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const table = document.createElement('table');
  const copyRow = document.createElement('tr');
  const headerRow = document.createElement('tr');
  const rows = [];

  // Create table headers
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

  let lastBalance = null;

  // Process each line
  lines.forEach(line => {
    if (!line.trim()) return;

    // Extract date (format: "01 Nov 2023")
    const dateMatch = line.match(/^(\d{1,2}\s+[A-Za-z]{3})(?:\s+(\d{4}))?/i);
    let date = dateMatch ? dateMatch[1] : '';
    
    // Apply year if provided in input
    if (dateMatch && yearInput) {
      date = `${dateMatch[1]} ${yearInput}`;
    } else if (dateMatch && dateMatch[2]) {
      date = `${dateMatch[1]} ${dateMatch[2]}`;
    }

    // Extract balance (parentheses indicate negative)
    const balanceMatch = line.match(/(?:\(([\d,]+\.\d{2})\)|([\d,]+\.\d{2}))$/);
    let balance = '';
    let balanceValue = null;
    if (balanceMatch) {
      balance = balanceMatch[1] ? `-${balanceMatch[1]}` : balanceMatch[2];
      balance = balance.replace(/,/g, '');
      balanceValue = parseFloat(balance);
    }

    // Extract amount (positive for credits, negative for debits)
    const amountMatch = line.match(/([\d,]+\.\d{2})(?=\s*\(?[\d,]+\.\d{2}\)?)/);
    let amount = amountMatch ? amountMatch[1].replace(/,/g, '') : '0.00';
    const amountValue = parseFloat(amount);

    // Clean description
    let description = line
      .replace(/^\d{1,2}\s+[A-Za-z]{3}(?:\s+\d{4})?/i, '') // Remove date
      .replace(/\([\d,]+\.\d{2}\)|[\d,]+\.\d{2}$/, '') // Remove balance
      .replace(/[\d,]+\.\d{2}(?=\s*\(?[\d,]+\.\d{2}\)?)/, '') // Remove amount
      .trim();

    // Determine debit/credit
    let debit = '';
    let credit = '';

    // SPECIAL RULE: Put all 0.00 transactions in debit (including opening/closing balances)
    if (amountValue === 0 || description.toLowerCase().includes('opening balance') || description.toLowerCase().includes('closing balance')) {
      debit = '0.00';
    } 
    else if (lastBalance !== null && balanceValue !== null) {
      // Calculate the actual transaction impact
      const transactionImpact = balanceValue - lastBalance;
      
      if (transactionImpact < 0) {
        // Money left the account = debit
        debit = Math.abs(transactionImpact).toFixed(2);
      } else if (transactionImpact > 0) {
        // Money entered the account = credit
        credit = transactionImpact.toFixed(2);
      }
    } else {
      // Fallback when we can't compare balances
      if (isLikelyDebit(description)) {
        debit = amount;
      } else {
        credit = amount;
      }
    }

    // Update last balance
    if (balanceValue !== null) {
      lastBalance = balanceValue;
    } else if (lastBalance !== null) {
      // Calculate implied balance
      if (debit) {
        lastBalance -= parseFloat(debit);
      } else if (credit) {
        lastBalance += parseFloat(credit);
      }
      balance = lastBalance.toFixed(2);
      if (lastBalance < 0) {
        balance = `(${Math.abs(lastBalance).toFixed(2)})`;
      }
    }

    // Handle opening/closing balance
    if (description.toLowerCase().includes('opening balance') || description.toLowerCase().includes('closing balance')) {
      if (balance) lastBalance = balanceValue;
      rows.push([date, description, debit, credit, balance.startsWith('-') ? `(${balance.substring(1)})` : balance]);
      return;
    }

    rows.push([date, description, debit, credit, balance.startsWith('-') ? `(${balance.substring(1)})` : balance]);
  });

  // Generate table rows
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

  // Helper function to determine if a transaction is likely a debit
  function isLikelyDebit(description) {
    const debitKeywords = [
      'withdrawal', 'fee', 'nsf', 'payment', 'pymt', 'overdraft',
      'hydro', 'credit', 'vista', 'enbridge', 'eft', 'to\\b'
    ];
    const descLower = description.toLowerCase();
    return debitKeywords.some(kw => {
      const regex = new RegExp(`\\b${kw}\\b`);
      return regex.test(descLower);
    });
  }
}

window.processData = processTangerineData;