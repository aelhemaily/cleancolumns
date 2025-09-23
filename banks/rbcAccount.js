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
    let transactionLines = []; 
    let amountFound = false;
    let newBalance = null;
    let transactionAmount = null; // This will hold the debit/credit amount

    // Start with the initial description parts if they exist
    if (initialDescriptionParts.length > 0 && initialDescriptionParts[0].trim() !== '') {
        transactionLines.push(initialDescriptionParts[0].trim());
    }

    // Look ahead to find the amount line and collect description parts
    // j iterates from the current global 'i' (which is the start of the current transaction block)
    // up to the end of the lines.
    let amountLineFoundIndex = -1; // To store the index of the line where amounts are found

    for (let j = i; j < lines.length; j++) {
        const currentLine = lines[j];
        
        // If the current line is a balance line, stop collecting description parts for the current transaction
        const isCurrentLineBalance = currentLine.toLowerCase().includes('opening balance') ||
                                     currentLine.toLowerCase().includes('balance forward') ||
                                     currentLine.toLowerCase().includes('closing balance');
        if (isCurrentLineBalance) {
            break; // Stop processing this transaction if a balance line is hit
        }

        // Regex to find 1 or 2 currency amounts at the very end of the line.
        // Captures the part *before* the amounts (which is the description segment for this line).
        // Group 1: description part (optional)
        // Group 2: first amount string
        // Group 3: second amount string (balance, optional)
        const regexToEndOfLineAmounts = /(.*?)\s*(-?\d{1,3}(?:,\d{3})*\.\d{2})\s*(?:(-?\d{1,3}(?:,\d{3})*\.\d{2}))?$/;
        const match = currentLine.match(regexToEndOfLineAmounts);

        if (match) {
            // Found the amounts line.
            // Match[1] is the description part from this line (before the amounts).
            // Match[2] is the first amount.
            // Match[3] is the second amount (balance), if present.

            const descPart = match[1] ? match[1].trim() : ''; // Description from this line before the amounts
            transactionAmount = parseFloat(match[2].replace(/,/g, ''));
            newBalance = match[3] ? parseFloat(match[3].replace(/,/g, '')) : null;
            
            // Add the description part from this line if it's not empty and it's a new line,
            // or if it's the first line and initialDescriptionParts was empty.
            // This condition ensures we don't duplicate the first line's description if it was already pushed.
            if (descPart !== '' && (j > i || initialDescriptionParts.length === 0 || initialDescriptionParts[0].trim() === '')) {
                transactionLines.push(descPart);
            } else if (j === i && initialDescriptionParts.length > 0 && initialDescriptionParts[0].trim() !== '') {
                // If it's the very first line of the transaction and it had a description part,
                // ensure we override it with the more accurate one from this regex match.
                // This prevents cases where a prior date match was used to push a partial description.
                if (transactionLines.length > 0 && transactionLines[0] !== descPart) {
                    transactionLines[0] = descPart;
                }
            }
            amountFound = true;
            amountLineFoundIndex = j; // Store the index of the line where amounts are found
            break; // Exit the loop, we found the amounts for this transaction
        } else {
            // This line does not contain the final amounts, so it's purely a description part.
            // Add it to transactionLines.
            // Only add if it's a new line (j > i) and it's not empty.
            // The initialDescriptionParts[0] is handled by the first push to transactionLines outside this loop,
            // or by the 'if (match)' block above if amounts are on the first line.
            if (j > i && currentLine.trim() !== '') {
                transactionLines.push(currentLine.trim());
            }
        }
    }

    if (!amountFound || transactionAmount === null) return; // No amounts found for this transaction, skip

    // The full description is now the joined transactionLines.
    // Filter out potential empty strings from `transactionLines` before joining.
    let fullDescription = transactionLines
        .filter(part => part.trim() !== '')
        .join(' ')
        .replace(/\s\s+/g, ' ') // Replace multiple spaces with a single space
        .trim();

    // NEW: Remove common date patterns from the fullDescription
    // This regex looks for patterns like "DD Mon" or "DD Mon YYYY" at the beginning of the string
    // and removes them. It's applied after the initial parsing to ensure dates are stripped
    // specifically from the description, not from potential amount lines.
    const datePatternInDescription = /^(?:(?:\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+\d{2,4})?)\s*)+/i;
    fullDescription = fullDescription.replace(datePatternInDescription, '').trim();


    // Ensure the global 'i' (outer loop index) is updated correctly.
    // It should move to the line *after* the amounts were found.
    if (amountLineFoundIndex !== -1) {
        i = amountLineFoundIndex; 
    }

    let debit = '', credit = '';
    let allocatedByKeywords = false;

    // --- Start of Modified Logic for Hard Rules with intuitive overrides ---

    // Define hardcoded keyword arrays
    const hardcodedDebitKeywords = ["e-transfer sent", "e-Transfer sent"];
    const hardcodedCreditKeywords = ["nsf", "refund", "CPP CANADA"];

    // NEW: Rule #1 - Super Keywords (case-insensitive)
    const superDebitKeywords = 
    ["Online Transfer to Deposit Account", "Monthly Fee",  "PAY EMP-VENDOR",
      "Telephone Banking transfer", "transfer sent", "special deposit", "Online banking transfer"
    ];
    const superCreditKeywords = ["e-transfer received", "payment received", "Misc Payment Uber Holdings C" , "Misc Payment Lyft", "Prov/Local Gvt Payment",
      "carbon rebate", "seniors rebate", "CPP CANADA", "Old Age Security",  "SQUARE CANADA", "Square, Inc"
    ];

    const lowerCaseDescription = fullDescription.toLowerCase();

    // Priority 1: Check for SUPER debit keywords (highest priority)
    const isSuperDebit = superDebitKeywords.some(keyword => lowerCaseDescription.includes(keyword.toLowerCase()));
    if (isSuperDebit) {
        debit = transactionAmount.toFixed(2); // Use transactionAmount
        currentBalance = currentBalance !== null ? currentBalance - transactionAmount : null;
        allocatedByKeywords = true;
    } else {
        // Priority 2: If no SUPER debit, check for SUPER credit keywords
        const isSuperCredit = superCreditKeywords.some(keyword => lowerCaseDescription.includes(keyword.toLowerCase()));
        if (isSuperCredit) {
            credit = transactionAmount.toFixed(2); // Use transactionAmount
            currentBalance = currentBalance !== null ? currentBalance + transactionAmount : null;
            allocatedByKeywords = true;
        } else {
            // Original Priority 1: Check for override debit keywords (now effectively Priority 3)
            const overrideDebitKeywords = ["fee"]; // Existing override keywords
            const isOverrideDebit = overrideDebitKeywords.some(keyword => lowerCaseDescription.includes(keyword));

            if (isOverrideDebit) {
              debit = transactionAmount.toFixed(2); // Use transactionAmount
              currentBalance = currentBalance !== null ? currentBalance - transactionAmount : null;
              allocatedByKeywords = true;
            } else {
              // Original Priority 2: If no override debit, check for override credit keywords (now effectively Priority 4)
              const overrideCreditKeywords = ["Misc Payment Uber Holdings C", "CPP CANADA"]; // Existing override keywords
              const isOverrideCredit = overrideCreditKeywords.some(keyword => lowerCaseDescription.includes(keyword));
              if (isOverrideCredit) {
                credit = transactionAmount.toFixed(2); // Use transactionAmount
                currentBalance = currentBalance !== null ? currentBalance + transactionAmount : null;
                allocatedByKeywords = true;
              } else {
                // Original Priority 3: If no overrides, check other hardcoded debit and credit keywords (now effectively Priority 5)
                let isHardcodedDebit = hardcodedDebitKeywords.some(keyword => lowerCaseDescription.includes(keyword));
                let isHardcodedCredit = hardcodedCreditKeywords.some(keyword => lowerCaseDescription.includes(keyword));

                if (isHardcodedDebit) {
                  debit = transactionAmount.toFixed(2); // Use transactionAmount
                  currentBalance = currentBalance !== null ? currentBalance - transactionAmount : null;
                  allocatedByKeywords = true;
                } else if (isHardcodedCredit) {
                  credit = transactionAmount.toFixed(2); // Use transactionAmount
                  currentBalance = currentBalance !== null ? currentBalance + transactionAmount : null;
                  allocatedByKeywords = true;
                }
              }
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
        debit = transactionAmount.toFixed(2); // Use transactionAmount
        currentBalance = currentBalance !== null ? currentBalance - transactionAmount : null;
        allocatedByKeywords = true;
      } else if (bestCreditMatch.length > 0) {
        // If there's a credit match (and it's better than debit, or no debit match)
        credit = transactionAmount.toFixed(2); // Use transactionAmount
        currentBalance = currentBalance !== null ? currentBalance + transactionAmount : null;
        allocatedByKeywords = true;
      }
    }

    // 3. Secondary Method: Balance Tracking if not allocated by keywords
    if (!allocatedByKeywords && currentBalance !== null && newBalance !== null) {
      const balanceChange = newBalance - currentBalance;

      if (Math.abs(balanceChange - transactionAmount) < 0.01) { // Use transactionAmount
        credit = transactionAmount.toFixed(2); // Use transactionAmount
        currentBalance = newBalance;
      } else if (Math.abs(balanceChange + transactionAmount) < 0.01) { // Use transactionAmount
        debit = transactionAmount.toFixed(2); // Use transactionAmount
        currentBalance = newBalance;
      } else {
        debit = transactionAmount.toFixed(2); // Default to debit if balance tracking ambiguous
        currentBalance = newBalance;
      }
      allocatedByKeywords = true; // Mark as allocated to prevent default fallback
    }

    // 4. Third Option: Default to Debit if all fails
    if (!allocatedByKeywords) {
      debit = transactionAmount.toFixed(2); // Use transactionAmount
      currentBalance = currentBalance !== null ? currentBalance - transactionAmount : null;
    }

    rows.push([
      formatDate(date, yearInput),
      fullDescription,
      debit,
      credit,
      newBalance !== null ? formatBalance(newBalance) : (currentBalance !== null ? formatBalance(currentBalance) : '')
    ]);

    // Update the global 'i' to the line where amounts were found, so the outer loop continues from there.
    if (amountLineFoundIndex !== -1) {
      i = amountLineFoundIndex; 
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
