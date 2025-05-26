function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').map(line => line.trim()).filter(Boolean);
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];
  let currentBalance = null;
  let currentDate = '';

  const table = document.createElement('table');

  // Create table headers
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

  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  // Process transactions
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const isBalanceLine = line.toLowerCase().includes('opening balance') ||
                          line.toLowerCase().includes('balance forward') ||
                          line.toLowerCase().includes('closing balance');

    // Handle balance lines: skip them, but extract and use their date and balance if present
    if (isBalanceLine) {
      const amountMatch = line.match(/(-?\d{1,3}(?:,\d{3})*\.\d{2})/);
      if (amountMatch) {
        currentBalance = parseFloat(amountMatch[0].replace(/,/g, ''));
      }

      // Check for date in balance line (e.g., "Jan 29 Balance forward")
      const dateMatchInBalance = line.match(/(\d{1,2}\s[A-Za-z]{3})/);
      if (dateMatchInBalance) {
          currentDate = dateMatchInBalance[1]; // Set currentDate for subsequent dateless transactions
      }
      i++; // Move to the next line
      continue; // Skip adding this balance line to the output rows
    }

    // Check for date line (e.g. "02 Jan") - This now only handles *non-balance* dated lines
    const dateMatch = line.match(/^(\d{1,2}\s[A-Za-z]{3})\s(.+)/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      const restOfLine = dateMatch[2]; // This is the description part without the date
      processRbcTransaction(currentDate, [restOfLine]); // Pass only the description part
      i++;
      continue;
    }

    // Handle continuation lines (no date) - This now only handles *non-balance* dateless lines
    if (currentDate) {
      processRbcTransaction(currentDate, [line]);
      i++;
      continue;
    }

    i++; // Skip lines we can't process
  }

  function processRbcTransaction(date, initialDescriptionParts) { // Renamed parameter for clarity
    // Start description with the initial parts passed in (which should not contain the date)
    let descriptionParts = [...initialDescriptionParts];
    let amountLineIndex = i;
    let amounts = [];

    // Look ahead to find the amount line
    while (amountLineIndex < lines.length) {
      const currentLine = lines[amountLineIndex];
      const lineAmounts = currentLine.match(/(-?\d{1,3}(?:,\d{3})*\.\d{2})/g) || [];

      // If the current line is a balance line, stop collecting description parts for the current transaction
      // and let the main loop handle the balance line.
      const isCurrentLineBalance = currentLine.toLowerCase().includes('opening balance') ||
                                   currentLine.toLowerCase().includes('balance forward') ||
                                   currentLine.toLowerCase().includes('closing balance');
      if (isCurrentLineBalance && lineAmounts.length === 0) { // If it's a balance line, and no amounts are found within it to process for *this* transaction.
          break;
      }

      if (lineAmounts.length > 0) {
        amounts = lineAmounts.map(a => parseFloat(a.replace(/,/g, '')));

        // Check if this line has non-amount text to include in description
        const nonAmountText = currentLine.replace(/(-?\d{1,3}(?:,\d{3})*\.\d{2})/g, '').trim();
        if (nonAmountText.length > 0) {
          if (amountLineIndex === i && descriptionParts.length === 1 && descriptionParts[0] === '') {
            descriptionParts[0] = nonAmountText;
          } else {
            descriptionParts.push(nonAmountText);
          }
        }
        break;
      }

      // Only push if it's a continuation line that is not the start of the transaction
      if (amountLineIndex > i) {
        descriptionParts.push(currentLine);
      }

      amountLineIndex++;
    }

    if (amounts.length === 0) return;

    const amount = amounts[0];
    const newBalance = amounts.length > 1 ? amounts[1] : null;
    const fullDescription = descriptionParts.filter(Boolean).join(' ').trim();

    let debit = '', credit = '';
    let allocatedByKeywords = false;

    // 1. Primary Method: Keyword Matching (prioritize full matches)
    if (window.bankUtils?.keywords) {
      const lowerCaseDescription = fullDescription.toLowerCase();
      let bestDebitMatch = '';
      let bestCreditMatch = '';

      // Find the most specific debit keyword match
      if (window.bankUtils.keywords.debit) {
        window.bankUtils.keywords.debit.forEach(kw => {
          if (lowerCaseDescription.includes(kw.toLowerCase()) && kw.length > bestDebitMatch.length) {
            bestDebitMatch = kw;
          }
        });
      }

      // Find the most specific credit keyword match
      if (window.bankUtils.keywords.credit) {
        window.bankUtils.keywords.credit.forEach(kw => {
          if (lowerCaseDescription.includes(kw.toLowerCase()) && kw.length > bestCreditMatch.length) {
            bestCreditMatch = kw;
          }
        });
      }

      // Determine allocation based on best match
      if (bestDebitMatch.length > 0 && bestDebitMatch.length >= bestCreditMatch.length) {
        // If there's a debit match and it's as good or better than credit match
        debit = amount.toFixed(2);
        currentBalance = currentBalance !== null ? currentBalance - amount : null;
        allocatedByKeywords = true;
      } else if (bestCreditMatch.length > 0) {
        // If there's a credit match (and it's better than debit, or no debit match)
        credit = amount.toFixed(2);
        currentBalance = currentBalance !== null ? currentBalance + amount : null;
        allocatedByKeywords = true;
      }
    }

    // 2. Secondary Method: Balance Tracking if not allocated by keywords
    if (!allocatedByKeywords && currentBalance !== null && newBalance !== null) {
      const balanceChange = newBalance - currentBalance;

      if (Math.abs(balanceChange - amount) < 0.01) {
        credit = amount.toFixed(2);
        currentBalance = newBalance;
      } else if (Math.abs(balanceChange + amount) < 0.01) {
        debit = amount.toFixed(2);
        currentBalance = newBalance;
      } else if (balanceChange > 0) { // Fallback to direction only if precise match fails
        credit = amount.toFixed(2);
        currentBalance = newBalance;
      } else {
        debit = amount.toFixed(2);
        currentBalance = newBalance;
      }
      allocatedByKeywords = true; // Mark as allocated to prevent default fallback
    }

    // 3. Third Option: Default to Debit if all fails
    if (!allocatedByKeywords) {
      debit = amount.toFixed(2);
      currentBalance = currentBalance !== null ? currentBalance - amount : null;
    }

    rows.push([
      formatDate(date, yearInput),
      fullDescription,
      debit,
      credit,
      newBalance !== null ? formatBalance(newBalance) : (currentBalance !== null ? formatBalance(currentBalance) : '')
    ]);

    if (amountLineIndex > i) {
      i = amountLineIndex; // Skip ahead to the amount line
    }
  }

  // Add rows to table
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

  function formatDate(dateStr, year) {
    const [day, monthAbbr] = dateStr.split(' ');
    const months = {
      JAN: 'Jan', FEB: 'Feb', MAR: 'Mar', APR: 'Apr', MAY: 'May', JUN: 'Jun',
      JUL: 'Jul', AUG: 'Aug', SEP: 'Sep', OCT: 'Oct', NOV: 'Nov', DEC: 'Dec'
    };
    const month = months[monthAbbr.toUpperCase()] || monthAbbr;
    return year ? `${day} ${month} ${year}` : `${day} ${month}`;
  }

  function formatBalance(balance) {
    if (balance === null || isNaN(balance)) return '';
    return balance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}

window.processData = processData;