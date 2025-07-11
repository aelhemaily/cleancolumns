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
  const highlightWords = ["payment"]; // Array for words to be highlighted

  // Add CSS for highlighting directly in JS
  if (!document.getElementById('highlight-style')) {
    const style = document.createElement('style');
    style.id = 'highlight-style';
    style.textContent = `
      table td.highlight-word { /* Made selector more specific */
        background-color: #ffe0e0 !important; /* Added !important to ensure precedence */
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

  function processRbcTransaction(date, initialDescriptionParts) {
    // Start description with the initial parts passed in (which should not contain the date)
    let descriptionParts = [...initialDescriptionParts];
    let amountLineIndex = i;
    let amounts = [];
    let transactionLines = []; // Store lines that form the transaction description

    // Add the initial description part to transactionLines
    if (initialDescriptionParts.length > 0 && initialDescriptionParts[0].trim() !== '') {
        transactionLines.push(initialDescriptionParts[0].trim());
    }

    // Look ahead to find the amount line and collect description parts
    while (amountLineIndex < lines.length) {
      const currentLine = lines[amountLineIndex];
      
      // If the current line is a balance line, stop collecting description parts for the current transaction
      const isCurrentLineBalance = currentLine.toLowerCase().includes('opening balance') ||
                                   currentLine.toLowerCase().includes('balance forward') ||
                                   currentLine.toLowerCase().includes('closing balance');
      if (isCurrentLineBalance) {
          break;
      }

      // Regex to find numbers that are NOT preceded by '@ ' AND NOT followed by a percentage sign or a letter.
      // This ensures that numbers like '05.00' in '05.00%P.A' are not matched as amounts,
      // and also that any number immediately following '@ ' is not matched as an amount.
      const lineAmounts = currentLine.match(/(?<!@\s)(-?\d{1,3}(?:,\d{3})*\.\d{2})(?![%A-Za-z])/g) || [];


      if (lineAmounts.length > 0) {
        amounts = lineAmounts.map(a => parseFloat(a.replace(/,/g, '')));

        // Extract non-amount text from the amount line itself
        // This regex now specifically targets numbers that are considered amounts (not preceded by '@ ' and not followed by % or letters)
        const nonAmountText = currentLine.replace(/(?<!@\s)(-?\d{1,3}(?:,\d{3})*\.\d{2})(?![%A-Za-z])|\b\d{1,2}\s[A-Za-z]{3}\b/g, '').trim();
        if (nonAmountText.length > 0) {
            // Only add if it's not already covered by initialDescriptionParts
            if (transactionLines.length === 0 || transactionLines[transactionLines.length - 1] !== nonAmountText) {
                transactionLines.push(nonAmountText);
            }
        }
        break; // Found the amount line, stop looking for more description parts
      }

      // If it's a continuation line (not the initial line of the transaction)
      // and it's not the amount line, add it to description parts.
      if (amountLineIndex > i) {
        transactionLines.push(currentLine.trim());
      }

      amountLineIndex++;
    }

    if (amounts.length === 0) return; // No amounts found for this transaction, skip

    const amount = amounts[0];
    const newBalance = amounts.length > 1 ? amounts[1] : null;

    // Filter out empty strings and duplicates, then join to form the full description
    // Ensure no amounts or dates are re-added to the description
    let fullDescription = transactionLines
        .filter(part => part.trim() !== '')
        .map(part => {
            // Remove only the numbers that are identified as actual transaction amounts or dates
            // Numbers preceded by '@ ' or followed by % or letters should NOT be removed from description
            let cleanedPart = part.replace(/(?<!@\s)(-?\d{1,3}(?:,\d{3})*\.\d{2})(?![%A-Za-z])|\b\d{1,2}\s[A-Za-z]{3}\b/g, '').trim();
            return cleanedPart;
        })
        .filter((value, index, self) => self.indexOf(value) === index && value !== '') // Remove duplicates and empty strings
        .join(' ')
        .trim();

    // If after cleaning, the description is empty, use the original initialDescriptionParts
    if (fullDescription === '' && initialDescriptionParts.length > 0) {
        fullDescription = initialDescriptionParts[0].trim();
    }

    let debit = '', credit = '';
    let allocatedByKeywords = false;

    // --- Start of Modified Logic for Hard Rules with intuitive overrides ---

    // Define hardcoded keyword arrays
    const hardcodedDebitKeywords = ["e-transfer sent"];
    const hardcodedCreditKeywords = ["nsf", "refund"];

    // Define keywords that override all other credit/debit rules and force a debit
    const overrideDebitKeywords = ["fee"];

    // Define keywords that override all other debit/credit rules and force a credit
    // Add words here if you need a transaction to *always* be a credit.
    const overrideCreditKeywords = []; // Currently empty, add words like ["interest earned"] if needed

    const lowerCaseDescription = fullDescription.toLowerCase();

    // Priority 1: Check for override debit keywords (highest priority)
    const isOverrideDebit = overrideDebitKeywords.some(keyword => lowerCaseDescription.includes(keyword));

    if (isOverrideDebit) {
      debit = amount.toFixed(2);
      currentBalance = currentBalance !== null ? currentBalance - amount : null;
      allocatedByKeywords = true;
    } else {
      // Priority 2: If no override debit, check for override credit keywords
      const isOverrideCredit = overrideCreditKeywords.some(keyword => lowerCaseDescription.includes(keyword));
      if (isOverrideCredit) {
        credit = amount.toFixed(2);
        currentBalance = currentBalance !== null ? currentBalance + amount : null;
        allocatedByKeywords = true;
      } else {
        // Priority 3: If no overrides, check other hardcoded debit and credit keywords
        let isHardcodedDebit = hardcodedDebitKeywords.some(keyword => lowerCaseDescription.includes(keyword));
        let isHardcodedCredit = hardcodedCreditKeywords.some(keyword => lowerCaseDescription.includes(keyword));

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

    // --- End of Modified Logic for Hard Rules with intuitive overrides ---

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

    // 3. Secondary Method: Balance Tracking if not allocated by keywords
    if (!allocatedByKeywords && currentBalance !== null && newBalance !== null) {
      const balanceChange = newBalance - currentBalance;

      if (Math.abs(balanceChange - amount) < 0.01) {
        credit = amount.toFixed(2);
        currentBalance = newBalance;
      } else if (Math.abs(balanceChange + amount) < 0.01) {
        debit = amount.toFixed(2);
        currentBalance = newBalance;
      } else {
        debit = amount.toFixed(2);
        currentBalance = newBalance;
      }
      allocatedByKeywords = true; // Mark as allocated to prevent default fallback
    }

    // 4. Third Option: Default to Debit if all fails
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

      // Apply highlight if the cell content contains any of the highlight words
      const lowerCaseCellContent = String(cell).toLowerCase(); // Ensure cell is treated as string
      const shouldHighlight = highlightWords.some(word => lowerCaseCellContent.includes(word.toLowerCase()));
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