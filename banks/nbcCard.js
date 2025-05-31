function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').filter(l => l.trim());
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];
  const table = document.createElement('table');

  // Header row
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  // Updated regex to capture both dates, ignoring the reference code, and the rest of the line
  const transactionLineRegex = /^(\d{1,2})\s+(\d{1,2})\s+[A-Za-z0-9]+\s+(\d{1,2})\s+(\d{1,2})\s+(.*)$/;
  // Regex to find an amount, potentially with a trailing minus sign
  const amountRegex = /([\d,]+\.\d{2})(-?)$/; // Changed to end of line to be more specific

  const monthMap = {
    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
    '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
  };

  const seen = new Set();

  lines.forEach(line => {
    const match = line.match(transactionLineRegex);

    if (!match) {
      // If the line doesn't match the expected transaction format, it's noise.
      return;
    }

    const firstMonthNum = match[1];
    const firstDayNum = match[2];
    const secondMonthNum = match[3];
    const secondDayNum = match[4];
    let restOfLine = match[5].trim(); // This contains description and amount

    const formattedFirstDate = `${monthMap[firstMonthNum]} ${firstDayNum}`;
    const formattedSecondDate = `${monthMap[secondMonthNum]} ${secondDayNum}`;

    let formattedDate = '';
    if (yearInput) {
      formattedDate = `${formattedFirstDate} ${yearInput} ${formattedSecondDate} ${yearInput}`;
    } else {
      formattedDate = `${formattedFirstDate} ${formattedSecondDate}`;
    }

    let debit = '', credit = '';
    let description = restOfLine;

    // Extract the amount from the end of the `restOfLine`
    const amountMatch = restOfLine.match(amountRegex);
    
    if (amountMatch) {
      const rawAmount = amountMatch[1]; // The number part
      const sign = amountMatch[2];     // The optional minus sign
      const amountVal = parseFloat(rawAmount.replace(/,/g, '')); // Remove commas for parsing

      if (sign === '-') {
        credit = amountVal.toFixed(2);
      } else {
        debit = amountVal.toFixed(2);
      }
      // Remove the amount from the description
      description = restOfLine.replace(amountMatch[0], '').trim();
    }

    // Check for duplicates (case-insensitive description and amount)
    const signature = `${description.toLowerCase()}|${debit || credit}`;
    const isDuplicate = seen.has(signature);
    if (!isDuplicate) seen.add(signature);

    const row = [formattedDate, description, debit, credit, '']; // Balance is always empty for now
    const tr = document.createElement('tr');
    if (isDuplicate) tr.style.backgroundColor = '#ffcccc'; // Highlight duplicates

    row.forEach(cellContent => {
      const td = document.createElement('td');
      td.textContent = cellContent;
      tr.appendChild(td);
    });

    table.appendChild(tr);
    rows.push(row);
  });

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(rows);
}

window.processData = processData;