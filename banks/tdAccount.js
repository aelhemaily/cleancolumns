function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').map(line => line.trim()).filter(Boolean);
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];
  let currentBalance = null;
  let isOverdraft = false;
  let buffer = []; // Buffer for multi-line transactions

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

  // Default keywords (fallback) - these are not directly used for debit/credit in this version
  // but kept for potential future use or consistency with other scripts.
  const defaultKeywords = {
    debit: [
      "ATM W/D", "CASH WITHDRA", "WITHDRAW", "FEE", "SERVICE CHARGE",
      "MONTHLY PLAN FEE", "OVERDRAFT FEE", "O.D.P. FEE", "SEND E-TFR",
      "TFR-TO", "PAYMENT TO", "NSF FEE", "BILL PAYMENT", "PURCHASE", "PAYMENT"
    ],
    credit: [
      "DEPOSIT", "TFR-FR", "E-TRANSFER", "E-TFR", "PAYMENT - THANK YOU",
      "REFUND", "INTEREST RECEIVED", "REMITTANCE", "GC DEPOSIT",
      "TRANSFER FR", "RECEIVED", "CREDIT"
    ]
  };

  // Regular expressions for parsing
  // This regex is for lines that contain a description, amount, date, and optionally a balance.
  // It's designed to be flexible for multi-line descriptions.
  // CORRECTED: Added optional '-' to the balance amount capture group (?:-?[\d,]+\.\d{2})
  const transactionLinePattern = /^(.*?)\s+([\d,]+\.\d{2})\s+([A-Z]{3}\d{1,2})(?:\s+(-?[\d,]+\.\d{2})(OD)?)?$/i;
  const balanceForwardRegex = /(BALANCE FORWARD|STARTING BALANCE)\s+([A-Z]{3}\d{1,2})(?:\s+(-?[\d,]+\.\d{2})(OD)?)?/i;
  const dateRegex = /^([A-Z]{3})(\d{1,2})$/; // For parsing date strings like "JAN31"

  // Helper function to format date (e.g., "JAN31" -> "Jan 31 2024")
  function formatDate(dateStr, year) {
    const match = dateStr.match(dateRegex);
    if (!match) return dateStr;

    const [, monthAbbr, day] = match;
    const months = {
      JAN: 'Jan', FEB: 'Feb', MAR: 'Mar', APR: 'Apr', MAY: 'May', JUN: 'Jun',
      JUL: 'Jul', AUG: 'Aug', SEP: 'Sep', OCT: 'Oct', NOV: 'Nov', DEC: 'Dec'
    };

    const month = months[monthAbbr.toUpperCase()] || monthAbbr;
    const dayPadded = day.padStart(2, '0');

    // Only include year if provided
    return year ? `${month} ${dayPadded} ${year}` : `${month} ${dayPadded}`;
  }

  // Helper function to format balance (e.g., "123.45" or "-123.45")
  function formatBalance(balance, overdraft) {
    if (balance === null || isNaN(balance)) return '';
    // Removed the 'OD' suffix. toFixed(2) will handle the negative sign if balance is negative.
    return balance.toFixed(2);
  }

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const fullBufferedText = buffer.join(' '); // Combine all lines in the buffer
    buffer = []; // Clear buffer after joining

    // Check for BALANCE FORWARD or STARTING BALANCE line
    const balanceForwardMatch = fullBufferedText.match(balanceForwardRegex);
    if (balanceForwardMatch) {
      const [, balanceType, dateStr, balanceAmountStr, odFlag] = balanceForwardMatch;
      if (balanceAmountStr) {
        currentBalance = parseFloat(balanceAmountStr.replace(/,/g, ''));
        isOverdraft = odFlag === 'OD';
        // NEW RULE: If it's an overdraft and not already negative, make it negative.
        if (isOverdraft && currentBalance > 0) {
          currentBalance = -currentBalance;
        }
      }
      // Do NOT push balance lines to rows array, just update currentBalance
      return;
    }

    // Try to match the full transaction line pattern
    const transactionMatch = fullBufferedText.match(transactionLinePattern);
    if (!transactionMatch) {
      // If it doesn't match the standard transaction pattern, it might be a multi-line description
      // that doesn't have the amount/date at the very end, or an unparsable line.
      // For now, we'll skip it, but this is where more complex multi-line logic would go.
      return;
    }

    // Extract parts from the transaction match
    const [, rawDescriptionPart, amountStr, dateStr, newBalanceStr, newOdFlag] = transactionMatch;
    const amount = parseFloat(amountStr.replace(/,/g, ''));
    
    let newBalance = newBalanceStr ? parseFloat(newBalanceStr.replace(/,/g, '')) : null;
    const willBeOverdraft = newOdFlag === 'OD';

    // NEW RULE: If it's an overdraft and not already negative, make it negative.
    if (newBalance !== null && willBeOverdraft && newBalance > 0) {
      newBalance = -newBalance;
    }

    // The description should be the rawDescriptionPart, which already excludes the final amount, date, and balance
    let description = rawDescriptionPart.trim();
    description = description.replace(/\s+/g, ' ').trim(); // Normalize spaces

    let debit = '';
    let credit = '';

    // Determine if this is a debit or credit based on balance changes
    if (currentBalance !== null && newBalance !== null) {
      // Use the actual balance change to determine debit/credit
      const balanceBefore = isOverdraft ? -currentBalance : currentBalance;
      const balanceAfter = willBeOverdraft ? -newBalance : newBalance;
      const calculatedChange = balanceAfter - balanceBefore;

      if (Math.abs(calculatedChange - amount) < 0.01) {
        // Balance increased by amount = credit
        credit = amount.toFixed(2);
      } else if (Math.abs(calculatedChange + amount) < 0.01) {
        // Balance decreased by amount = debit
        debit = amount.toFixed(2);
      } else {
        // Fallback if precise match fails (e.g., for fees, interest, or complex transactions)
        // Infer based on balance change direction
        if (calculatedChange < 0) {
          debit = amount.toFixed(2);
        } else {
          credit = amount.toFixed(2);
        }
      }
      currentBalance = newBalance;
      isOverdraft = willBeOverdraft;
    } else {
      // If newBalance is not available, use keyword matching (or just assume debit if no keywords)
      // This part of the logic is kept as per user's instruction to keep debit/credit allocation intact
      const descLower = description.toLowerCase();
      const isCreditByKeyword = defaultKeywords.credit.some(keyword =>
        descLower.includes(keyword.toLowerCase())
      );

      if (isCreditByKeyword) {
        credit = amount.toFixed(2);
        if (currentBalance !== null) { // Update estimated balance if possible
          currentBalance = currentBalance + amount;
          isOverdraft = currentBalance < 0;
        }
      } else {
        debit = amount.toFixed(2);
        if (currentBalance !== null) { // Update estimated balance if possible
          currentBalance = currentBalance - amount;
          isOverdraft = currentBalance < 0;
        }
      }
    }

    // Add the row to the table
    rows.push([
      formatDate(dateStr, yearInput),
      description,
      debit,
      credit,
      newBalance !== null ? formatBalance(newBalance, willBeOverdraft) : '' // Use empty string if no balance
    ]);
  };

  // Iterate through lines to build transaction buffers
  lines.forEach(line => {
    // If the line matches the start of a new transaction or a balance forward, flush the buffer
    if (transactionLinePattern.test(line) || balanceForwardRegex.test(line)) {
      flushBuffer(); // Process previous transaction
    }
    buffer.push(line); // Add current line to buffer
  });

  flushBuffer(); // Process the last transaction in the buffer

  // Add rows to the table
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

window.processData = processData;
