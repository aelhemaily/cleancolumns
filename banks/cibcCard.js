let keywords = { debit: [], credit: [] };
let categoryWords = [];

// Load keywords.json
fetch('../keywords.json')
  .then(response => response.json())
  .then(data => {
    keywords = {
      debit: data.debit.map(k => k.toLowerCase()),
      credit: data.credit.map(k => k.toLowerCase())
    };
  })
  .catch(error => console.error('Failed to load keywords:', error));

// Load cibcCardCategories.json
fetch('../cibcCardCategories.json')
  .then(response => response.json())
  .then(data => {
    categoryWords = data.categories.map(k => k.toLowerCase());
  })
  .catch(error => console.error('Failed to load categories:', error));

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

function capitalizeCategory(cat) {
  return cat
    .split(' ')
    .map(word => (word === 'and' ? 'and' : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

function parseLines(text, yearInput, isPayment = false) {
  const lines = text.split('\n').map(line =>
    line.replace(/Ý/g, '').trim()
  ).filter(Boolean);

  const isNewTransaction = (line) => /^[A-Za-z]{3} \d{1,2} [A-Za-z]{3} \d{1,2}/.test(line);

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
    // This regex captures all potential amounts, including those in description
    const amountPattern = /-?\d{1,3}(?:,\d{3})*\.\d{2}(?:\*+)?/g;
    const allAmountMatches = [...line.matchAll(amountPattern)];

    if (!dateMatch || allAmountMatches.length === 0) return null;

    let date = dateMatch[0].trim();
    if (yearInput) {
      const parts = date.split(' ');
      // Ensure year is appended to both date parts if present
      date = `${parts[0]} ${parts[1]} ${yearInput} ${parts[2]} ${parts[3]} ${yearInput}`;
    }

    // The actual transaction amount is the LAST matched amount in the line
    const amountRaw = allAmountMatches[allAmountMatches.length - 1][0];
    const cleanAmount = amountRaw.replace(/\*+$/, '').replace(/,/g, '').replace(/-/g, '');

    // Get the description by taking everything BEFORE the last amount match
    // This preserves numbers that are part of the description (e.g., "0.75")
    let description = line.substring(0, allAmountMatches[allAmountMatches.length - 1].index).trim();
    // Remove the date part from the beginning of the description
    description = description.replace(dateMatch[0], '').trim();

    // Clean up any extra spaces
    description = description.replace(/\s+/g, ' ').trim();

    let category = '';
    const descLower = description.toLowerCase();

    // Hardcoded categories for specific phrases
    if (descLower.includes("payment thank you")) {
      category = "Payment";
    } else if (descLower.includes("regular purchases")) {
      category = "Interest";
    } else if (descLower.includes("cash advances")) {
      category = "Interest";
    } else {
      const matchedCategory = categoryWords.find(cat => descLower.endsWith(cat));
      if (matchedCategory) {
        category = capitalizeCategory(matchedCategory);
        const idx = description.toLowerCase().lastIndexOf(matchedCategory);
        description = description.slice(0, idx).trim().replace(/\s+/g, ' ');
      }
    }

    const isSpecialCredit = isPayment ||
      descLower.includes("payment thank you") ||
      keywords.credit.some(k => descLower.includes(k));

    const isCredit = amountRaw.startsWith('-') || amountRaw.endsWith('-') || isSpecialCredit;
    const debit = (!isCredit) ? cleanAmount : '';
    const credit = isCredit ? cleanAmount : '';

    return {
      rawDate: dateMatch[0],
      parsedDate: parseDate(dateMatch[0]),
      row: [date, description, category, debit, credit, '']
    };
  }).filter(Boolean);
}

function parseDate(text) {
  // This function is used for sorting, so it needs a consistent year.
  // The display date is handled separately in parseLines.
  const [mon1, d1] = text.split(' ');
  return new Date(`${mon1} ${d1}, 2000`); // Use a dummy year for consistent sorting
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

  const headers = ['Date', 'Description', 'Category', 'Debit', 'Credit', 'Balance'];
  const table = document.createElement('table');

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

window.processData = processData;
