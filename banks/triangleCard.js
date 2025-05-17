function parseLines(text, yearInput) {
  if (!text) return [];
  
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const transactions = [];
  let currentTransaction = null;

  lines.forEach(line => {
    // Check if line starts with a date pattern (e.g., "Jun 19 Jun 19")
    const dateMatch = line.match(/^([A-Za-z]{3} \d{1,2} [A-Za-z]{3} \d{1,2})/);
    
    if (dateMatch) {
      // If we have a current transaction being built, push it before starting new one
      if (currentTransaction) {
        transactions.push(currentTransaction);
      }
      
      // Extract the amount if it exists in this line
      const amountMatch = line.match(/-?\d{1,3}(?:,\d{3})*\.\d{2}$/);
      const amount = amountMatch ? amountMatch[0].replace(/,/g, '') : null;
      
      // Start new transaction
      currentTransaction = {
        rawDate: dateMatch[1],
        descriptionParts: [line.replace(dateMatch[1], '').replace(amount || '', '').trim()],
        amount: amount
      };
    } else if (currentTransaction) {
      // Check if this line contains an amount
      const amountMatch = line.match(/-?\d{1,3}(?:,\d{3})*\.\d{2}$/);
      if (amountMatch) {
        currentTransaction.amount = amountMatch[0].replace(/,/g, '');
        // Add any text before the amount to description
        const textBeforeAmount = line.replace(amountMatch[0], '').trim();
        if (textBeforeAmount) {
          currentTransaction.descriptionParts.push(textBeforeAmount);
        }
      } else {
        // Just add to description
        currentTransaction.descriptionParts.push(line);
      }
    }
  });

  // Push the last transaction if it exists
  if (currentTransaction) {
    transactions.push(currentTransaction);
  }

  return transactions.map(t => {
    if (!t.amount) return null;
    
    let date = t.rawDate;
    if (yearInput) {
      const parts = date.split(' ');
      date = `${parts[0]} ${parts[1]} ${yearInput} ${parts[2]} ${parts[3]} ${yearInput}`;
    }
    
    const isCredit = t.amount.startsWith('-');
    const cleanAmount = t.amount.replace(/-/g, '');
    const description = t.descriptionParts.filter(p => p).join(' ').replace(/\s+/g, ' ').trim();

    return {
      rawDate: t.rawDate,
      parsedDate: parseDate(t.rawDate),
      row: [
        date,
        description,
        isCredit ? '' : cleanAmount, // Debit amount
        isCredit ? cleanAmount : '', // Credit amount
        '' // Balance (empty)
      ]
    };
  }).filter(Boolean);
}

function parseDate(text) {
  // Takes date format like "Jun 20 Jun 21" and uses the second date (posting date)
  const parts = text.split(' ');
  return new Date(`${parts[2]} ${parts[3]}, 2000`);
}

function processData() {
  const yearInput = document.getElementById('yearInput').value.trim();
  const input = document.getElementById('inputText').value.trim();
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';
  
  if (!input) {
    showToast("Please insert bank statement data!", "error");
    return;
  }
  
  // Parse transactions
  const items = parseLines(input, yearInput);
  
  if (items.length === 0) {
    showToast("No valid transactions found!", "error");
    return;
  }
  
  // Sort by date
  items.sort((a, b) => a.parsedDate - b.parsedDate);
  
  const headers = ['#', 'Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const table = document.createElement('table');
  
  // Header row with CIBC-style copy buttons
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    
    // Add copy button to each header except the # column
    if (header !== '#') {
      const button = document.createElement('button');
      button.className = 'copy-btn';
      button.innerHTML = '<i class="fa-solid fa-copy"></i>';
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        // Adjust index for # column
        const colIndex = headers.indexOf(header);
        window.bankUtils.copyColumn(colIndex);
      });
      th.insertBefore(button, th.firstChild);
    }
    
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);
  
  // Add transactions to table with numbered rows
  items.forEach(({ row }, index) => {
    const tr = document.createElement('tr');
    // Add row number
    const numberCell = document.createElement('td');
    numberCell.textContent = index + 1;
    tr.appendChild(numberCell);
    
    // Add the rest of the cells
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  
  outputDiv.appendChild(table);
  
  // Store raw data for potential export
  table.dataset.rows = JSON.stringify(items.map((item, index) => [
    index + 1, // Row number
    ...item.row // Original row data
  ]));
  
  // Show the toolbar
  document.getElementById('toolbar').classList.add('show');
  saveState();
}

window.processData = processData;