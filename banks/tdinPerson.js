function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];
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

  // Helper to normalize date into MM/DD/YYYY
  function normalizeDate(dateStr) {
    const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
    // Match formats like Jan31,2024 or Jan 31, 2024
    const m = dateStr.match(/^([A-Za-z]{3})\s?(\d{1,2}),\s?(\d{4})$/);
    if (!m) return dateStr;
    const mm = months[m[1]] || '01';
    const dd = m[2].padStart(2, '0');
    const yyyy = yearInput || m[3]; // Use yearInput if provided, otherwise use year from match
    return `${mm}/${dd}/${yyyy}`;
  }

  // Keywords to infer credit transactions when delta & amount don't match
  const creditKeywords = ['DEPOSIT', 'REBATE', 'ACCT BAL REBATE'];

  const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
  let lastBalance = null;
  let buffer = []; // Added buffer for multi-line transactions

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const fullLine = buffer.join(' ');
    const dateMatch = fullLine.match(/^([A-Za-z]{3}\s?\d{1,2},\s?\d{4})/);
    if (!dateMatch) {
      buffer = [];
      return;
    }

    const rawDate = dateMatch[1];
    const date = normalizeDate(rawDate);

    let rest = fullLine.slice(rawDate.length).trim();

    // Regex to capture balance, allowing for -$ or $- at the beginning, and optional OD
    // This regex now explicitly handles $ before or after -
    const balanceRegex = /(?:-?\s*\$|(?:\s*\$)?-)\s*([\d,]+\.\d{2})(OD)?$/i;
    const balanceMatch = rest.match(balanceRegex);

    if (!balanceMatch) {
      buffer = [];
      return;
    }

    const balanceNumericPart = balanceMatch[1]; // Just the digits and comma/decimal
    const isOverdraftFlag = balanceMatch[2] ? true : false; // Check for OD suffix

    // Clean and parse balance number
    let balanceNum = parseFloat(balanceNumericPart.replace(/,/g, ''));

    // Determine if the balance should be negative based on original string or OD flag
    // Check if the original matched string (balanceMatch[0]) contains a negative sign
    if (balanceMatch[0].includes('-') || isOverdraftFlag) {
        balanceNum = -Math.abs(balanceNum); // Ensure it's negative
    } else {
        balanceNum = Math.abs(balanceNum); // Ensure it's positive if no negative indicator
    }

    rest = rest.slice(0, rest.lastIndexOf(balanceMatch[0])).trim(); // Remove balance string from rest

    // Regex to capture amount, which is the last number before the balance
    const amountRegex = /(-?[\d,]+\.\d{2})$/;
    const amountMatch = rest.match(amountRegex);
    if (!amountMatch) {
      buffer = [];
      return;
    }

    const amountStr = amountMatch[1];
    const amountNum = parseFloat(amountStr.replace(/,/g, ''));

    let description = rest.slice(0, rest.lastIndexOf(amountMatch[0])).trim(); // Remove amount string from description

    let debit = '';
    let credit = '';

    if (lastBalance === null) {
      // First line special case, if it's an opening balance, no debit/credit
      // Otherwise, if it's the very first transaction, infer debit/credit based on amount sign
      if (description.toLowerCase().includes('opening balance') || description.toLowerCase().includes('balance forward')) {
        debit = '';
        credit = '';
      } else {
        if (amountNum < 0) {
          credit = Math.abs(amountNum).toFixed(2);
        } else {
          debit = amountNum.toFixed(2);
        }
      }
    } else {
      const delta = balanceNum - lastBalance;
      const epsilon = 0.01; // tolerance for floating point precision

      if (Math.abs(delta - amountNum) < epsilon) {
        // Delta matches amount: assign debit/credit according to your bank's rules
        if (delta > 0) {
          // Balance increased → CREDIT transaction (money in)
          credit = amountNum.toFixed(2);
        } else if (delta < 0) {
          // Balance decreased → DEBIT transaction (money out)
          debit = amountNum.toFixed(2);
        } else {
          // No significant change; assign debit by default
          debit = amountNum.toFixed(2);
        }
      } else {
        // Delta and amount do not match; use keywords to infer credit, else debit
        const upperDesc = description.toUpperCase();
        const isCredit = creditKeywords.some(k => upperDesc.includes(k));
        if (isCredit) {
          credit = amountNum.toFixed(2);
        } else {
          debit = amountNum.toFixed(2);
        }
      }
    }

    lastBalance = balanceNum; // Update lastBalance for the next transaction

    const row = [date, description, debit, credit, balanceNum.toFixed(2)];
    rows.push(row);

    const tr = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    table.appendChild(tr);

    buffer = [];
  };

  lines.forEach(line => {
    // Check if line starts with a date (e.g., "Jan 31, 2024")
    if (/^[A-Za-z]{3}\s?\d{1,2},\s?\d{4}/.test(line)) {
      flushBuffer(); // Process previous transaction
    }
    buffer.push(line); // Add to current transaction
  });

  flushBuffer(); // Process last transaction

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(rows);
}

window.processData = processData;
