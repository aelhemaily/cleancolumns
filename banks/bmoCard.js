function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  // Remove existing warning if any
  let warning = document.getElementById('parseWarning');
  if (warning) {
    warning.remove();
  }

  const transactions = parseBankStatement(input, yearInput);

  if (transactions.length === 0) {
    // Show red warning message
    warning = document.createElement('div');
    warning.id = 'parseWarning';
    warning.textContent = '⚠️ Unexpected data format, please reload page!';
    outputDiv.appendChild(warning);
    return;
  }

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];

  const table = document.createElement('table');
  const headerRow = document.createElement('tr');

  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });

  table.appendChild(headerRow);

  transactions.forEach(tx => {
    const { startDate, endDate, description, amount, type } = tx;
    let debit = '', credit = '';

    if (type === 'credit') {
      credit = amount.toFixed(2);
    } else if (type === 'debit') {
      debit = amount.toFixed(2);
    }

    const row = [startDate + ' ' + endDate, description, debit, credit, ''];
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
}

function parseBankStatement(inputText, yearInput) {
  const lines = inputText.split('\n');
  const transactions = [];
  const datePattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\. \d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\. \d{1,2}/;

  let currentTransaction = null;
  let descriptionBuffer = '';

  function parseAmount(line) {
    const tokens = line.trim().split(/\s+/);
    let amount = null;
    let type = '';

    if (tokens[tokens.length - 1] && /\bCR\b/i.test(tokens[tokens.length - 1])) {
      type = 'credit';
      tokens.pop();
    } else {
      type = 'debit';
    }

    const numericToken = tokens[tokens.length - 1].replace(/,/g, '');

    if (!isNaN(numericToken) && parseFloat(numericToken) < 1000000) {
      amount = parseFloat(numericToken);
      return {
        amount,
        type,
        cleanedLine: tokens.slice(0, -1).join(' ')
      };
    }
    return null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (datePattern.test(line)) {
      if (currentTransaction && currentTransaction.amount !== null) {
        currentTransaction.description = descriptionBuffer.trim();
        transactions.push(currentTransaction);
        descriptionBuffer = '';
      }

      const match = line.match(datePattern);
      if (match && match.length > 0) {
        const parts = match[0].split(' ');
        const startDate = parts[0] + ' ' + parts[1] + ' ' + yearInput;
        const endDate = parts.length === 4 ? parts[2] + ' ' + parts[3] + ' ' + yearInput : startDate;
        const rest = line.replace(datePattern, '').trim();

        currentTransaction = {
          startDate,
          endDate,
          description: '',
          amount: null,
          type: ''
        };

        const amountInfo = parseAmount(rest);
        if (amountInfo) {
          currentTransaction.amount = amountInfo.amount;
          currentTransaction.type = amountInfo.type;
          currentTransaction.description = amountInfo.cleanedLine.trim();
          transactions.push(currentTransaction);
          currentTransaction = null;
          descriptionBuffer = '';
        } else {
          descriptionBuffer = rest + ' ';
        }
      }
    } else if (currentTransaction) {
      const amountInfo = parseAmount(line);
      if (amountInfo) {
        currentTransaction.amount = amountInfo.amount;
        currentTransaction.type = amountInfo.type;
        if (amountInfo.cleanedLine) {
          descriptionBuffer += amountInfo.cleanedLine + ' ';
        }
        currentTransaction.description = descriptionBuffer.trim();
        transactions.push(currentTransaction);
        currentTransaction = null;
        descriptionBuffer = '';
      } else {
        descriptionBuffer += line + ' ';
      }
    }
  }

  if (currentTransaction && currentTransaction.amount !== null) {
    currentTransaction.description = descriptionBuffer.trim();
    transactions.push(currentTransaction);
  }

  return transactions;
}

// Export the processData function globally for the main script to use
window.processData = processData;
