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

  // Define words to highlight
  const highlightWords = ["payment"];

  // Add CSS for highlighting directly in JS
  if (!document.getElementById('highlight-style')) {
    const style = document.createElement('style');
    style.id = 'highlight-style';
    style.textContent = `
      table td.highlight-word {
        background-color: #ffe0e0 !important;
      }
    `;
    document.head.appendChild(style);
  }

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

      // Check for date in balance line
      const dateMatchInBalance = line.match(/(\d{1,2}\/\d{1,2})/);
      if (dateMatchInBalance) {
        currentDate = dateMatchInBalance[1];
      }
      i++;
      continue;
    }

    // Check for date line (e.g. "12/18") - Wells Fargo format
    const dateMatch = line.match(/^(\d{1,2}\/\d{1,2})\s(.+)/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      const restOfLine = dateMatch[2];

      // Look for an amount and an optional balance at the end of the line
      // Matches: (amount) (optional_balance) or (amount_only)
      const amountAndBalanceMatch = restOfLine.match(/(-?\d{1,3}(?:,\d{3})*\.\d{2})\s*(-?\d{1,3}(?:,\d{3})*\.\d{2})?$/);

      if (amountAndBalanceMatch) {
        const amount = parseFloat(amountAndBalanceMatch[1].replace(/,/g, ''));
        const balance = amountAndBalanceMatch[2] ? parseFloat(amountAndBalanceMatch[2].replace(/,/g, '')) : null;
        const description = restOfLine.replace(amountAndBalanceMatch[0], '').trim();

        processWellsFargoTransaction(currentDate, [description], amount, balance);
        i++;
      } else {
        // If no amount on same line, look for amount on next line(s)
        const descriptionParts = [restOfLine];
        let amountLineIndex = i + 1;
        let amount = null;
        let balance = null;

        // Look ahead for amount line
        while (amountLineIndex < lines.length) {
          const nextLine = lines[amountLineIndex];
          // Also look for amount and optional balance on the next line
          const nextLineAmountAndBalanceMatch = nextLine.match(/(-?\d{1,3}(?:,\d{3})*\.\d{2})\s*(-?\d{1,3}(?:,\d{3})*\.\d{2})?$/);

          if (nextLineAmountAndBalanceMatch) {
            amount = parseFloat(nextLineAmountAndBalanceMatch[1].replace(/,/g, ''));
            balance = nextLineAmountAndBalanceMatch[2] ? parseFloat(nextLineAmountAndBalanceMatch[2].replace(/,/g, '')) : null;
            // Check if there's more description before the amount
            const descPart = nextLine.replace(nextLineAmountAndBalanceMatch[0], '').trim();
            if (descPart) descriptionParts.push(descPart);
            break;
          } else {
            // If no amount, add to description
            descriptionParts.push(nextLine);
            amountLineIndex++;
          }
        }

        if (amount !== null) {
          processWellsFargoTransaction(currentDate, descriptionParts, amount, balance);
          i = amountLineIndex + 1;
        } else {
          i++;
        }
      }
      continue;
    }

    // Handle continuation lines (no date) - should have been handled above
    i++;
  }

  function processWellsFargoTransaction(date, descriptionParts, amount, transactionBalance = null) {
    // Combine description parts and clean up
    let fullDescription = descriptionParts
      .filter(part => part.trim() !== '')
      .join(' ')
      .trim();

    let debit = '',
      credit = '';
    let allocatedByKeywords = false;

    // Hardcoded keyword rules for Wells Fargo
    const hardcodedDebitKeywords = [
      "purchase", "fee", "charge", "withdrawal", "zelle to",
      "wire trans", "check", "payment", "recurring payment"
    ];
    const hardcodedCreditKeywords = [
      "deposit", "zelle from", "direct dep", "refund", "credit", "org=", "/org="
    ];

    const overrideDebitKeywords = ["fee", "charge", "payment"];
    const overrideCreditKeywords = ["refund", "interest"];

    const lowerCaseDescription = fullDescription.toLowerCase();

    // Priority 1: Check for override debit keywords (highest priority)
    const isOverrideDebit = overrideDebitKeywords.some(keyword =>
      lowerCaseDescription.includes(keyword));
    if (isOverrideDebit) {
      debit = amount.toFixed(2);
      currentBalance = currentBalance !== null ? currentBalance - amount : null;
      allocatedByKeywords = true;
    } else {
      // Priority 2: If no override debit, check for override credit keywords
      const isOverrideCredit = overrideCreditKeywords.some(keyword =>
        lowerCaseDescription.includes(keyword));
      if (isOverrideCredit) {
        credit = amount.toFixed(2);
        currentBalance = currentBalance !== null ? currentBalance + amount : null;
        allocatedByKeywords = true;
      } else {
        // Priority 3: If no overrides, check other hardcoded debit and credit keywords
        let isHardcodedDebit = hardcodedDebitKeywords.some(keyword =>
          lowerCaseDescription.includes(keyword));
        let isHardcodedCredit = hardcodedCreditKeywords.some(keyword =>
          lowerCaseDescription.includes(keyword));

        if (isHardcodedDebit) {
          debit = amount.toFixed(2);
          currentBalance = currentBalance !== null ? currentBalance - amount : null;
          allocatedByKeywords = true;
        } else if (isHardcodedCredit) {
          credit = amount.toFixed(2);
          currentBalance = currentBalance !== null ? currentBalance + amount : null;
          allocatedByKeywords = true;
        }
      }
    }

    // 2. General Keyword Matching (if not already allocated by hard rules)
    if (!allocatedByKeywords && window.bankUtils?.keywords) {
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
        debit = amount.toFixed(2);
        currentBalance = currentBalance !== null ? currentBalance - amount : null;
        allocatedByKeywords = true;
      } else if (bestCreditMatch.length > 0) {
        credit = amount.toFixed(2);
        currentBalance = currentBalance !== null ? currentBalance + amount : null;
        allocatedByKeywords = true;
      }
    }

    // 3. Default to Debit if all fails
    if (!allocatedByKeywords) {
      debit = amount.toFixed(2);
      currentBalance = currentBalance !== null ? currentBalance - amount : null;
    }

    // If a transactionBalance is provided, use it to update currentBalance
    if (transactionBalance !== null) {
      currentBalance = transactionBalance;
    }

    rows.push([
      formatDate(date, yearInput), // Pass yearInput to formatDate
      fullDescription,
      debit,
      credit,
      currentBalance !== null ? formatBalance(currentBalance) : ''
    ]);
  }

  // Add rows to table
  rows.forEach(row => {
    const tr = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;

      // Apply highlight if the cell content contains any of the highlight words
      const lowerCaseCellContent = String(cell).toLowerCase();
      const shouldHighlight = highlightWords.some(word =>
        lowerCaseCellContent.includes(word.toLowerCase()));
      if (shouldHighlight) {
        td.classList.add('highlight-word');
      }

      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(rows);

  function formatDate(dateStr, year) {
    // Convert Wells Fargo date format (MM/DD) to our format (MM DD)
    const [month, day] = dateStr.split('/');
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const monthName = months[parseInt(month) - 1] || month;
    // Ensure day is always two digits (e.g., "01" instead of "1")
    const formattedDay = String(day).padStart(2, '0');
    // Re-introduce the year if provided
    return year ? `${monthName} ${formattedDay} ${year}` : `${monthName} ${formattedDay}`;
  }

  function formatBalance(balance) {
    if (balance === null || isNaN(balance)) return '';
    return balance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}

window.processData = processData;