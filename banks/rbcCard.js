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
  let buffer = [];
  let currentAltDate = '';
  let altBuffer = [];
  let altBalance = '';

  function isValidMonthAbbreviation(month) {
    return ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].includes(month);
  }

  function flushBufferedAltFormat() {
    if (altBuffer.length === 0 || !currentAltDate) return;

    let temp = [];
    altBuffer.forEach(line => {
      temp.push(line);
      const amountMatch = line.match(/-?\$[\d,]+\.\d{2}/);
      if (amountMatch) {
        processBufferedTransaction(currentAltDate, temp, rows, altBalance);
        temp = [];
        altBalance = '';
      }
    });

    if (temp.length > 0) {
      processBufferedTransaction(currentAltDate, temp, rows, altBalance);
    }

    altBuffer = [];
    altBalance = '';
  }

  function flushBufferIfNeeded() {
    if (!currentTransaction || buffer.length === 0) return;

    processBufferedTransaction(currentTransaction.date, buffer, rows, '');
    buffer = [];
    currentTransaction = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const dateMatch = line.match(/^([A-Z]{3})\s+(\d{2})\s+([A-Z]{3})\s+(\d{2})/);
    if (dateMatch) {
      flushBufferIfNeeded();

      const [_, m1, d1, m2, d2] = dateMatch;
      if (isValidMonthAbbreviation(m1) && isValidMonthAbbreviation(m2)) {
        const date1 = yearInput ? `${m1} ${d1} ${yearInput}` : `${m1} ${d1}`;
        const date2 = yearInput ? `${m2} ${d2} ${yearInput}` : `${m2} ${d2}`;
        const fullDate = `${date1} ${date2}`;

        currentTransaction = { date: fullDate };
        const rest = line.replace(dateMatch[0], '').trim();
        buffer = rest ? [rest] : [];
        continue;
      }
    }

    const altDateMatch = line.match(/^([A-Za-z]{3,})\s+(\d{1,2}),\s*(\d{4})$/);
    if (altDateMatch) {
      flushBufferIfNeeded();
      flushBufferedAltFormat();
      currentAltDate = `${altDateMatch[1]} ${altDateMatch[2]} ${altDateMatch[3]}`;

      const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
      const nextNextLine = lines[i + 2] ? lines[i + 2].trim() : '';
      const dollarMatch = nextLine.match(/^\$[\d,]+\.\d{2}$/);
      const hasNextDescription = nextNextLine && !nextNextLine.match(/^-?\$[\d,]+\.\d{2}$/);

      if (dollarMatch && !hasNextDescription) {
        altBalance = nextLine.replace('$', '').replace(/,/g, '');
        i++; // skip balance line
      }
      continue;
    }

    if (currentAltDate) {
      altBuffer.push(line);
      continue;
    }

    buffer.push(line);
  }

  flushBufferIfNeeded();
  flushBufferedAltFormat();

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

  function processBufferedTransaction(date, lines, rows, balance) {
    const full = lines.join(' ');
    const amountMatches = [...full.matchAll(/-?\$[\d,]+\.\d{2}/g)];
    if (amountMatches.length === 0) return;

    const lastAmount = amountMatches[amountMatches.length - 1][0];
    const amount = lastAmount.replace('$', '').replace(/,/g, '');
    const description = full.replace(lastAmount, '').trim();

    let debit = '', credit = '', bal = balance || '';

    if (!description) {
      bal = amount;
    } else if (amount.startsWith('-')) {
      credit = amount.slice(1);
    } else {
      debit = amount;
    }

    rows.push([date, description, debit, credit, bal]);
  }
}

window.processData = processRBCCardData;
