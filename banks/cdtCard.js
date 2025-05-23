let keywords = { debit: [], credit: [] };

// Load keywords.json (assuming it's in the same directory as the HTML file)
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

// Helper to parse a date string (e.g., "Jul 01") into a Date object for sorting
function parseDateForSorting(dateStr, year) {
  const [mon, day] = dateStr.split(' ');
  const monthNames = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };
  const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();
  return new Date(currentYear, monthNames[mon], parseInt(day, 10));
}

function parseLines(text, yearInput, isPayment = false) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const transactions = [];
  let currentTransactionBuffer = [];

  // Regex to detect a new transaction start (either format 1 or format 2 date patterns)
  const newTransactionStartRegex = /^(?:\d+\s+)?([A-Za-z]{3}\s+\d{2})(?:\s+([A-Za-z]{3}\s+\d{2}))?/;
  // Regex to find amounts, including negative and optional USD
  const amountRegex = /(-?\s*\d{1,3}(?:,\d{3})*\.\d{2}(?:\s*USD)?)/g;

  lines.forEach((line, index) => {
    const isNewTransactionLine = newTransactionStartRegex.test(line);
    const hasAmount = amountRegex.test(line);

    // If it's a new transaction line, or if it's a line with an amount and there's an existing buffer
    // that needs to be flushed (e.g., multi-line description ending with amount)
    if (isNewTransactionLine && currentTransactionBuffer.length > 0) {
      // Flush the previous transaction
      processBufferedTransaction(currentTransactionBuffer.join(' '), yearInput, isPayment, transactions);
      currentTransactionBuffer = [];
    } else if (!isNewTransactionLine && currentTransactionBuffer.length > 0 && hasAmount && index === lines.length -1) {
        // This is a multi-line transaction that ends with an amount on the last line
        currentTransactionBuffer.push(line);
        processBufferedTransaction(currentTransactionBuffer.join(' '), yearInput, isPayment, transactions);
        currentTransactionBuffer = [];
        return;
    }


    currentTransactionBuffer.push(line);

    // If the current line contains an amount and is not the start of a new dated transaction,
    // and the next line is either a new dated transaction or the end of the input,
    // then this buffer represents a complete transaction.
    const nextLine = lines[index + 1];
    const nextLineIsNewTransactionStart = nextLine && newTransactionStartRegex.test(nextLine);
    const isLastLine = (index === lines.length - 1);

    if (hasAmount && (nextLineIsNewTransactionStart || isLastLine)) {
      processBufferedTransaction(currentTransactionBuffer.join(' '), yearInput, isPayment, transactions);
      currentTransactionBuffer = [];
    }
  });

  // Flush any remaining transaction in the buffer after the loop
  if (currentTransactionBuffer.length > 0) {
    processBufferedTransaction(currentTransactionBuffer.join(' '), yearInput, isPayment, transactions);
  }

  return transactions;
}

// Helper function to process a single buffered transaction string
function processBufferedTransaction(fullText, yearInput, isPayment, transactionsArray) {
  const newTransactionStartRegex = /^(?:\d+\s+)?([A-Za-z]{3}\s+\d{2})(?:\s+([A-Za-z]{3}\s+\d{2}))?/;
  const amountRegex = /(-?\s*\d{1,3}(?:,\d{3})*\.\d{2}(?:\s*USD)?)/g;

  const match = fullText.match(newTransactionStartRegex);
  const allAmountMatches = [...fullText.matchAll(amountRegex)];

  if (!match || allAmountMatches.length === 0) {
    return; // Cannot parse as a transaction
  }

  // Extract dates
  let date1Part = match[1];
  let date2Part = match[2]; // This could be undefined for single-date format

  // Store the first date for sorting purposes
  const sortDate = parseDateForSorting(date1Part, yearInput);

  // Apply year to display dates
  let displayDate = '';
  if (yearInput) {
    if (date2Part) {
      displayDate = `${date1Part} ${yearInput} ${date2Part} ${yearInput}`;
    } else {
      displayDate = `${date1Part} ${yearInput}`;
    }
  } else {
    if (date2Part) {
      displayDate = `${date1Part} ${date2Part}`;
    } else {
      displayDate = date1Part;
    }
  }

  // Determine the actual transaction amount
  // The transaction amount is the LAST numeric value in the string
  const rawAmountString = allAmountMatches[allAmountMatches.length - 1][0];
  const amount = parseFloat(rawAmountString.replace(/[^0-9.-]/g, ''));

  // Extract description: everything before the last amount, after removing dates and optional leading number
  let description = fullText;
  // Remove the last amount string from the text
  const lastAmountIndex = fullText.lastIndexOf(rawAmountString);
  if (lastAmountIndex !== -1) {
    description = fullText.substring(0, lastAmountIndex).trim();
  }

  // Remove the date parts and optional leading number from the description
  description = description
    .replace(new RegExp(`^(?:\\d+\\s+)?${date1Part.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:\\s+${date2Part ? date2Part.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') : ''})?`, 'i'), '')
    .trim();

  // Normalize spaces
  description = description.replace(/\s+/g, ' ').trim();

  let debit = '';
  let credit = '';

  if (amount < 0 || isPayment || keywords.credit.some(kw => description.toLowerCase().includes(kw))) {
    credit = Math.abs(amount).toFixed(2);
  } else {
    debit = amount.toFixed(2);
  }

  transactionsArray.push({
    sortDate: sortDate,
    row: [displayDate, description, debit, credit, '']
  });
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

  // Sort transactions by date in ascending order
  allItems.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

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
