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
    const yyyy = yearInput || m[3];
    return `${mm}/${dd}/${yyyy}`;
  }

  // Keywords to infer credit transactions when delta & amount don't match
  const creditKeywords = ['DEPOSIT', 'REBATE', 'ACCT BAL REBATE'];

  const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
  let lastBalance = null;

  lines.forEach(line => {
    const dateMatch = line.match(/^([A-Za-z]{3}\s?\d{1,2},\s?\d{4})/);
    if (!dateMatch) return;

    const rawDate = dateMatch[1];
    const date = normalizeDate(rawDate);

    let rest = line.slice(rawDate.length).trim();

    const balanceMatch = rest.match(/\$[\d,]+\.\d{2}$/);
    if (!balanceMatch) return;

    const balanceStr = balanceMatch[0];
    const balanceNum = parseFloat(balanceStr.replace(/[\$,]/g, ''));

    rest = rest.slice(0, rest.lastIndexOf(balanceStr)).trim();

    const amountMatch = rest.match(/[\d,]+\.\d{2}$/);
    if (!amountMatch) return;

    const amountStr = amountMatch[0];
    const amountNum = parseFloat(amountStr.replace(/,/g, ''));

    let description = rest.slice(0, rest.lastIndexOf(amountStr)).trim();

    let debit = '';
    let credit = '';

    if (lastBalance === null) {
      // First line special case, treat amount as debit by default unless opening balance
      if (Math.abs(balanceNum - amountNum) < 0.001) {
        // opening balance line - no debit/credit
        debit = '';
        credit = '';
      } else {
        // first transaction defaults to debit as balance increases
        debit = amountNum.toFixed(2);
      }
    } else {
      const delta = balanceNum - lastBalance;
      const epsilon = 0.01; // tolerance for floating point precision

      if (Math.abs(delta - amountNum) < epsilon) {
        // Delta matches amount: assign debit/credit according to your bank's rules
        if (delta > 0) {
          // Balance increased → DEBIT transaction (money in)
          debit = amountNum.toFixed(2);
        } else if (delta < 0) {
          // Balance decreased → CREDIT transaction (money out)
          credit = amountNum.toFixed(2);
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

    lastBalance = balanceNum;

    const row = [date, description, debit, credit, balanceNum.toFixed(2)];
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