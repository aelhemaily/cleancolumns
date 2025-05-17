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

// Inject a second box for 'Your payments' if it doesn't exist
function injectPaymentBoxIfNeeded() {
  if (!document.getElementById('paymentText')) {
    const mainBox = document.getElementById('inputText');
    const newBox = document.createElement('textarea');
    newBox.id = 'paymentText';
    newBox.placeholder = 'Paste "Your payments" section here (optional)';
    newBox.style.width = '100%';
    newBox.style.minHeight = '100px';
    newBox.style.marginTop = '10px';

    mainBox.parentNode.insertBefore(newBox, mainBox.nextSibling);
  }
}

injectPaymentBoxIfNeeded();

function parseLines(text, yearInput, isPayment = false) {
  const lines = text.split('\n').map(line =>
    line.replace(/Ý/g, '').trim()
  ).filter(Boolean);

  // Detect if a line is the start of a new transaction
  const isNewTransaction = (line) => /^[A-Za-z]{3} \d{1,2} [A-Za-z]{3} \d{1,2}/.test(line);

  // Merge multiline transactions
  const transactions = [];
  let current = '';
  lines.forEach(line => {
    if (isNewTransaction(line)) {
      if (current) transactions.push(current.trim());
      current = line;
    } else {
      current += ' ' + line;
    }
  });
  if (current) transactions.push(current.trim());

  return transactions.map(line => {
    const dateMatch = line.match(/^[A-Za-z]{3} \d{1,2} [A-Za-z]{3} \d{1,2}/);
    const amountMatch = [...line.matchAll(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g)].map(m => m[0].replace(/,/g, ''));

    if (!dateMatch || amountMatch.length === 0) return null;

    let date = dateMatch[0].trim();
    if (yearInput) {
      const parts = date.split(' ');
      date = `${parts[0]} ${parts[1]} ${yearInput} ${parts[2]} ${parts[3]} ${yearInput}`;
    }

    const amount = amountMatch[amountMatch.length - 1];
    let description = line.replace(dateMatch[0], '').trim();
    amountMatch.forEach(a => description = description.replace(a, ''));
    description = description.replace(/-\s+/g, ' ').replace(/\s+/g, ' ').trim();

    const descLower = description.toLowerCase();
    const isSpecialCredit = isPayment ||
      descLower.includes("payment thank you") ||
      keywords.credit.some(k => descLower.includes(k));

    const amountIsCredit = amount.startsWith('-') || amount.endsWith('-');
    const cleanAmount = amount.replace(/-/g, '');

    const debit = (!amountIsCredit && !isSpecialCredit) ? cleanAmount : '';
    const credit = (amountIsCredit || isSpecialCredit) ? cleanAmount : '';

    return {
      rawDate: dateMatch[0],
      parsedDate: parseDate(dateMatch[0]),
      row: [date, description, debit, credit, '']
    };
  }).filter(Boolean);
}

function parseDate(text) {
  const [mon1, d1] = text.split(' ');
  return new Date(`${mon1} ${d1}, 2000`);
}

function processData() {
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

window.processData = processData;
