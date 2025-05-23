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

  let initialLines = input.split('\n').map(l => l.trim()).filter(Boolean);
  let processedTransactionLines = [];
  let currentBalance = null; // Initialize currentBalance for tracking

  // Helper function to format date (Day Month Year or Day Month)
  function formatDate(dateStr, year) {
    const [day, monthAbbr] = dateStr.split(' ');
    const months = {
      JAN: 'Jan', FEB: 'Feb', MAR: 'Mar', APR: 'Apr', MAY: 'May', JUN: 'Jun',
      JUL: 'Jul', AUG: 'Aug', SEP: 'Sep', OCT: 'Oct', NOV: 'Nov', DEC: 'Dec'
    };
    const month = months[monthAbbr.toUpperCase()] || monthAbbr;
    return year ? `${day} ${month} ${year}` : `${day} ${month}`;
  }

  // Helper function to format balance (e.g., 1,234.56)
  function formatBalance(balance) {
    if (balance === null || isNaN(balance)) return '';
    return balance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // Handle Opening Principal Balance separately to initialize currentBalance
  const openingBalanceLineIndex = initialLines.findIndex(line => line.toLowerCase().includes('opening principal balance'));
  if (openingBalanceLineIndex !== -1) {
    // Check for an amount on the line immediately following "Opening Principal Balance"
    if (openingBalanceLineIndex + 1 < initialLines.length) {
        const amountMatch = initialLines[openingBalanceLineIndex + 1].match(/^-?\$?(\d{1,3}(?:,\d{3})*\.\d{2})/);
        if (amountMatch) {
            currentBalance = parseFloat(amountMatch[1].replace(/,/g, ''));
        }
    }
    // Remove the 'Opening Principal Balance' line and its amount line from initialLines
    // This assumes the format is 'Opening Principal Balance' \n '$Amount'
    initialLines.splice(openingBalanceLineIndex, 2);
  }


  // Main loop to gather multi-line transactions into single strings
  let i = 0;
  const startsWithDateRegex = /^[A-Za-z]{3}\s\d{1,2}/;
  while (i < initialLines.length) {
    let currentBlock = [];
    const firstLine = initialLines[i];

    // Ensure the current line starts with a date to be considered a new transaction
    if (!startsWithDateRegex.test(firstLine)) {
        i++; // Skip lines that don't start with a date (e.g., orphaned description lines or other headers)
        continue;
    }

    // Start of a new transaction block with the first date
    currentBlock.push(firstLine);
    i++;

    // Check if the very next line is a second date for the same transaction
    if (i < initialLines.length && startsWithDateRegex.test(initialLines[i])) {
      currentBlock.push(initialLines[i]); // Add the second date
      i++;
    }

    // Gather all subsequent lines that are not new transaction dates or balance summary lines
    while (i < initialLines.length && !startsWithDateRegex.test(initialLines[i]) &&
           !initialLines[i].toLowerCase().includes('closing principal balance') &&
           !initialLines[i].toLowerCase().includes('balance forward')) {
      currentBlock.push(initialLines[i]);
      i++;
    }
    processedTransactionLines.push(currentBlock.join(' ')); // Join the collected lines into one full transaction string
  }

  // Now, iterate through each assembled full transaction string and parse it
  processedTransactionLines.forEach(fullText => {
    // Skip balance-related transactions that might have been grouped
    if (/(Opening Principal Balance|Closing Principal Balance|Balance Forward)/i.test(fullText)) {
      return; // Do not add these to the table
    }

    // Extract dates (could be one or two dates)
    const dateMatches = [...fullText.matchAll(/([A-Za-z]{3}\s\d{2})/g)];
    let dates = dateMatches.map(m => m[1]);

    // Apply year if provided
    if (yearInput) {
      dates = dates.map(date => `${date} ${yearInput}`);
    }

    const formattedDate = dates.join(' '); // Join multiple dates with a space

    // Extract all amounts (transaction amount and balance, plus any in description)
    const allAmountMatches = [...fullText.matchAll(/-?\$?\d{1,3}(?:,\d{3})*\.\d{2}/g)];
    const amounts = allAmountMatches.map(m => m[0].replace(/\$/g, '').replace(/,/g, ''));

    // A transaction must have at least a transaction amount and a balance
    if (amounts.length < 2) {
        return; // Not enough amounts to be a valid transaction
    }

    // CORRECTED: Get the actual transaction amount and balance from the END of the amounts array
    const transactionAmountRaw = amounts[amounts.length - 2]; // Second to last is the transaction amount string
    const balanceAmountRaw = amounts[amounts.length - 1];     // Last is the balance amount string

    const transactionAmount = parseFloat(transactionAmountRaw); // Numerical value
    const balanceAmount = parseFloat(balanceAmountRaw);

    let debit = '';
    let credit = '';

    // Determine debit/credit based on the sign of the transaction amount string
    // Positive numbers (no leading '-') go to Debit
    // Negative numbers (leading '-') go to Credit
    if (transactionAmountRaw.startsWith('-')) {
      credit = Math.abs(transactionAmount).toFixed(2); // Ensure no negative sign
    } else {
      debit = transactionAmount.toFixed(2); // Already positive
    }

    currentBalance = balanceAmount; // Update current balance for the next transaction

    // Get description by removing only the *last two* amounts and dates from the full text
    let description = fullText;
    if (allAmountMatches.length >= 2) {
        // Find the index of the start of the second-to-last amount match in the original fullText
        const indexOfSecondLastAmount = fullText.lastIndexOf(allAmountMatches[allAmountMatches.length - 2][0]);
        if (indexOfSecondLastAmount !== -1) {
            // Take everything from the beginning up to the start of the second-to-last amount
            description = fullText.substring(0, indexOfSecondLastAmount).trim();
        } else {
            // Fallback if lastIndexOf fails, remove by replacing the string values
            description = fullText.replace(allAmountMatches[allAmountMatches.length - 2][0], '')
                                  .replace(allAmountMatches[allAmountMatches.length - 1][0], '').trim();
        }
    } else if (allAmountMatches.length === 1) {
        // If only one amount, remove that one
        description = fullText.replace(allAmountMatches[0][0], '').trim();
    }

    // Remove original dates from the description
    dateMatches.forEach(match => {
        description = description.replace(match[0], '');
    });

    description = description.replace(/\s+/g, ' ').trim(); // Replace multiple spaces with a single space and trim

    const row = [
      formattedDate,
      description,
      debit,
      credit,
      formatBalance(balanceAmount)
    ];

    rows.push(row);
  });

  // Render all gathered rows to the table
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
