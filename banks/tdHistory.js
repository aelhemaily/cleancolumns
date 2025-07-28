function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim(); // Get the year input
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];
  const table = document.createElement('table');

  // Copy buttons row (as in bmoCard.js)
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
  const transactions = [];

  // Regex to parse each line:
  // 1. Date (MM/DD/YYYY OR MMM DD, YYYY)
  // 2. Description (can contain spaces and special characters)
  // 3. Amount (with or without commas, with two decimal places)
  // 4. Transaction type (CR or DR)
  // 5. Optional Balance at the end
  // Updated transactionPattern to accept "MMM DD, YYYY" format
  const transactionPattern = /^((\d{2}\/\d{2}\/\d{4})|(\w{3}\s+\d{1,2},\s+\d{4}))\s+(.*?)\s+([\d,]+\.\d{2})\s+(CR|DR)(?:\s+([\d,]+\.\d{2}))?$/;


  lines.forEach(line => {
    const match = line.match(transactionPattern);
    if (match) {
      // The dateRaw is now either match[2] (MM/DD/YYYY) or match[3] (MMM DD, YYYY)
      const dateRaw = match[2] || match[3];
      const description = match[4];
      const amountRaw = match[5];
      const typeRaw = match[6];
      const balanceRaw = match[7];

      // 1) Convert date from MM/DD/YYYY or MMM DD, YYYY to "Mon DD YYYY"
      let date;
      if (match[2]) { // MM/DD/YYYY format
        const [month, day, year] = dateRaw.split('/');
        date = new Date(`${month}/${day}/${year}`);
      } else if (match[3]) { // MMM DD, YYYY format
        date = new Date(dateRaw);
      }
      
      const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      });

      // 2) Put amounts in credit or debit
      const amount = parseFloat(amountRaw.replace(/,/g, ''));
      let debit = '';
      let credit = '';
      if (typeRaw === 'CR') {
        credit = amount.toFixed(2);
      } else { // typeRaw === 'DR'
        debit = amount.toFixed(2);
      }

      // 3) Put the number at the end of the line in balance column
      const balance = balanceRaw ? parseFloat(balanceRaw.replace(/,/g, '')).toFixed(2) : '';

      transactions.push({
        date: formattedDate,
        description: description.trim(),
        debit: debit,
        credit: credit,
        balance: balance
      });
    } else {
      console.warn(`Skipping malformed line: ${line}`);
    }
  });

  transactions.forEach(tx => {
    const row = [tx.date, tx.description, tx.debit, tx.credit, tx.balance];
    rows.push(row);

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

  // Ensure toolbar and save state are updated after processing
  document.getElementById('toolbar').classList.add('show');
  if (typeof window.bankUtils.setupCellSelection === 'function') {
    window.bankUtils.setupCellSelection(table);
  }
  if (typeof window.bankUtils.setupTableContextMenu === 'function') {
    window.bankUtils.setupTableContextMenu(table);
  }
  if (typeof window.bankUtils.setupCellDragAndDrop === 'function') {
    window.bankUtils.setupCellDragAndDrop(table);
  }
  if (typeof window.bankUtils.setupColumnResizing === 'function') {
    window.bankUtils.setupColumnResizing(table);
  }
  if (typeof saveState === 'function') {
    saveState();
  }
}

// Export globally
window.processData = processData;
