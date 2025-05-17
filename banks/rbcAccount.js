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

    // Handle opening balance
    if (line.includes('Opening balance')) {
      const amountMatch = line.match(/(-?\d{1,3}(?:,\d{3})*\.\d{2})/);
      if (amountMatch) {
        currentBalance = parseFloat(amountMatch[0].replace(/,/g, ''));
        rows.push(['Opening balance', '', '', '', formatBalance(currentBalance)]);
      }
      i++;
      continue;
    }

    // Check for date line (e.g. "02 Jan")
    const dateMatch = line.match(/^(\d{1,2}\s[A-Za-z]{3})\s(.+)/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      const restOfLine = dateMatch[2];
      processRbcTransaction(currentDate, [restOfLine]);
      i++;
      continue;
    }

    // Handle continuation lines (no date)
    if (currentDate) {
      processRbcTransaction(currentDate, [line]);
      i++;
      continue;
    }

    i++; // Skip lines we can't process
  }

  function processRbcTransaction(date, firstLines) {
    // Collect all description parts
    let descriptionParts = [...firstLines];
    let amountLineIndex = i;
    let amounts = [];

    // Look ahead to find the amount line
    while (amountLineIndex < lines.length) {
      const currentLine = lines[amountLineIndex];
      const lineAmounts = currentLine.match(/(-?\d{1,3}(?:,\d{3})*\.\d{2})/g) || [];
      
      if (lineAmounts.length > 0) {
        amounts = lineAmounts.map(a => parseFloat(a.replace(/,/g, '')));
        
        // Check if this line has non-amount text to include in description
        const nonAmountText = currentLine.replace(/(-?\d{1,3}(?:,\d{3})*\.\d{2})/g, '').trim();
        if (nonAmountText.length > 0) {
          if (amountLineIndex === i) {
            // First line - replace existing description
            descriptionParts[0] = nonAmountText;
          } else {
            // Additional lines - append to description
            descriptionParts.push(nonAmountText);
          }
        }
        break;
      }
      
      if (amountLineIndex > i) {
        descriptionParts.push(currentLine);
      }
      
      amountLineIndex++;
    }

    if (amounts.length === 0) return;

    const amount = amounts[0];
    const newBalance = amounts.length > 1 ? amounts[1] : null;
    const fullDescription = descriptionParts.join(' ').trim();

    // Determine debit/credit using balance changes (primary method)
    let debit = '', credit = '';
    if (currentBalance !== null && newBalance !== null) {
      const balanceChange = newBalance - currentBalance;
      
      // Precise balance-based classification
      if (Math.abs(balanceChange - amount) < 0.01) {
        // Amount matches balance increase exactly = credit
        credit = amount.toFixed(2);
        currentBalance = newBalance;
      } else if (Math.abs(balanceChange + amount) < 0.01) {
        // Amount matches balance decrease exactly = debit
        debit = amount.toFixed(2);
        currentBalance = newBalance;
      } else {
        // Fallback to direction only
        if (balanceChange > 0) {
          credit = amount.toFixed(2);
          currentBalance = newBalance;
        } else {
          debit = amount.toFixed(2);
          currentBalance = newBalance;
        }
      }
    } 
    // Fallback to keyword matching if balance comparison not available
    else if (window.bankUtils?.keywords) {
      const isCredit = window.bankUtils.keywords.credit.some(kw => 
        fullDescription.toLowerCase().includes(kw.toLowerCase())
      );
      if (isCredit) {
        credit = amount.toFixed(2);
        currentBalance = currentBalance !== null ? currentBalance + amount : null;
      } else {
        debit = amount.toFixed(2);
        currentBalance = currentBalance !== null ? currentBalance - amount : null;
      }
    } 
    // Final fallback
    else {
      debit = amount.toFixed(2);
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