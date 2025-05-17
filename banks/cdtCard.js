let keywords = { debit: [], credit: [] };

// Load keywords.json
fetch('keywords.json')
  .then(response => response.json())
  .then(data => {
    keywords = {
      debit: data.debit.map(k => k.toLowerCase()),
      credit: data.credit.map(k => k.toLowerCase())
    };
  })
  .catch(error => console.error('Failed to load keywords:', error));

// Inject a second box for 'Your payments/credit' if it doesn't exist
function injectPaymentBoxIfNeeded() {
  if (!document.getElementById('paymentText')) {
    const mainBox = document.getElementById('inputText');
    const newBox = document.createElement('textarea');
    newBox.id = 'paymentText';
    newBox.placeholder = 'Paste "Your payments" / credit section here (optional)';
    newBox.style.width = '100%';
    newBox.style.minHeight = '100px';
    newBox.style.marginTop = '10px';

    mainBox.parentNode.insertBefore(newBox, mainBox.nextSibling);
  }
}

injectPaymentBoxIfNeeded();

function parseLines(text, yearInput, isPayment = false) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const transactions = [];
  let currentTransaction = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is a new transaction
    const transactionMatch = line.match(/^(?:\d+\s+)?([A-Za-z]{3}\s+\d{2})\s+([A-Za-z]{3}\s+\d{2})/);
    const amountMatch = line.match(/-?[\d,]+\.\d{2}(?=\s*$| USD)/);

    if (transactionMatch) {
      // Save previous transaction if exists
      if (currentTransaction) {
        transactions.push(currentTransaction);
      }
      
      // Format dates - only add year if specified in input field
      const date1 = yearInput ? `${transactionMatch[1]} ${yearInput}` : transactionMatch[1];
      const date2 = yearInput ? `${transactionMatch[2]} ${yearInput}` : transactionMatch[2];
      const date = `${date1} ${date2}`;

      currentTransaction = {
        date: date,
        descriptionParts: [],
        amount: amountMatch ? amountMatch[0].replace(/,/g, '') : null,
        isPayment: isPayment
      };

      // Add description part (remove ref, dates, and amount)
      let descPart = line
        .replace(/^\d+\s+/, '') // Remove reference number if present
        .replace(/^[A-Za-z]{3}\s+\d{2}\s+[A-Za-z]{3}\s+\d{2}/, '') // Remove dates
        .replace(/-?[\d,]+\.\d{2}(?:\s*USD)?(?:\s*@\s*[\d.]+)?(?:\s*[\d,]+\.\d{2})?/, '') // Remove amount/conv
        .trim();
      
      if (descPart) {
        currentTransaction.descriptionParts.push(descPart);
      }
    } else if (currentTransaction) {
      // This is a continuation line for current transaction
      if (amountMatch) {
        // If this line has an amount, use it as the transaction amount
        currentTransaction.amount = amountMatch[0].replace(/,/g, '');
      } else {
        // Check if this line might be a plain amount (like in EQUIFAX example)
        const potentialAmount = line.trim();
        if (/^-?\d+\.\d{2}$/.test(potentialAmount)) {
          currentTransaction.amount = potentialAmount.replace(/,/g, '');
        } else {
          // Add the line to description
          currentTransaction.descriptionParts.push(line);
        }
      }
    }
  }

  // Add the last transaction if exists
  if (currentTransaction) {
    transactions.push(currentTransaction);
  }

  return transactions.map(txn => {
    const description = txn.descriptionParts.join(' ').replace(/\s+/g, ' ').trim();
    let debit = '';
    let credit = '';

    if (txn.amount) {
      const amount = parseFloat(txn.amount);
      if (amount < 0 || txn.isPayment) {
        credit = Math.abs(amount).toFixed(2);
      } else {
        debit = amount.toFixed(2);
      }
    }

    return {
      rawDate: txn.date.split(' ').slice(0, 4).join(' '), // Get just the first two dates without year
      parsedDate: parseDate(txn.date.split(' ').slice(0, 2).join(' ')), // Parse just the first date
      row: [txn.date, description, debit, credit, '']
    };
  });
}

function parseDate(text) {
  const [mon, d] = text.split(' ');
  return new Date(`${mon} ${d}, 2000`);
}

function processCTBCardData() {
  const yearInput = document.getElementById('yearInput').value.trim();
  const input = document.getElementById('inputText').value.trim();
  const paymentInput = document.getElementById('paymentText')?.value.trim() || '';
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const allItems = [
    ...parseLines(input, yearInput, false),
    ...parseLines(paymentInput, yearInput, true)
  ];

  allItems.sort((a, b) => a.parsedDate - b.parsedDate);

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
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

  const rows = [];

  allItems.forEach(({ row }) => {
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

window.processData = processCTBCardData;