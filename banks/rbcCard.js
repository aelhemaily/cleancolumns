function processRBCCardData() {
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

  let currentTransaction = null;

  // Helper: strict date check
  function isValidMonthAbbreviation(month) {
    return ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].includes(month);
  }

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Stricter date match logic
    const dateMatch = line.match(/^([A-Z]{3})\s+(\d{2})\s+([A-Z]{3})\s+(\d{2})/);
    if (dateMatch) {
      const month1 = dateMatch[1], day1 = parseInt(dateMatch[2], 10);
      const month2 = dateMatch[3], day2 = parseInt(dateMatch[4], 10);

      if (isValidMonthAbbreviation(month1) && isValidMonthAbbreviation(month2) &&
          day1 >= 1 && day1 <= 31 && day2 >= 1 && day2 <= 31) {

        // Process any pending multi-line transaction
        if (currentTransaction) {
          processTransaction(currentTransaction, rows);
        }

        // Format dates - add year if specified
        const date1 = yearInput ? `${month1} ${day1} ${yearInput}` : `${month1} ${day1}`;
        const date2 = yearInput ? `${month2} ${day2} ${yearInput}` : `${month2} ${day2}`;
        const date = `${date1} ${date2}`;

        currentTransaction = {
          date: date,
          descriptionParts: [],
          amount: null
        };

        // Add the main description line (remove dates)
        let descPart = line.replace(/^([A-Z]{3})\s+(\d{2})\s+([A-Z]{3})\s+(\d{2})/, '').trim();
        if (descPart) {
          currentTransaction.descriptionParts.push(descPart);
        }

        continue; // already handled this line
      }
    }

    // Not a new transaction line — part of a multiline description or amount
    if (currentTransaction) {
      const amountMatch = line.match(/(-?\$[\d,]+\.\d{2})/);
      if (amountMatch) {
        currentTransaction.amount = amountMatch[1].replace(/\$/g, '').replace(/,/g, '');
      } else if (!line.match(/^[-$0-9]/)) {
        currentTransaction.descriptionParts.push(line);
      }
    }
  }

  // Process the last transaction if any
  if (currentTransaction) {
    processTransaction(currentTransaction, rows);
  }

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

  function processTransaction(txn, rows) {
    const description = txn.descriptionParts.join(' ');
    let debit = '';
    let credit = '';

    if (txn.amount) {
      if (txn.amount.startsWith('-')) {
        credit = txn.amount.replace('-', '');
      } else {
        debit = txn.amount;
      }
    }

    rows.push([txn.date, description, debit, credit, '']);
  }
}

window.processData = processRBCCardData;
