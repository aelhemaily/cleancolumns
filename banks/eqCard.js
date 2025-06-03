// eqCard.js - New parser for EQ Bank statements

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

  // Regex to capture:
  // Group 1: Date (e.g., "Sep 28")
  // Group 2: Description (everything between date and amount, non-greedy)
  // Group 3: Amount (e.g., "-$5.60" or "$10.00")
  // The amount regex is refined to specifically look for the dollar sign and optional minus at the end of the line.
  const transactionLineRegex = /^([A-Za-z]{3}\s+\d{1,2})\s+(.*?)\s+(-?\s*\$?\s*[\d,]+\.\d{2})$/;

  const seen = new Set();

  lines.forEach(line => {
    const match = line.match(transactionLineRegex);

    if (!match) {
      // If the line doesn't match the expected transaction format, it's considered noise.
      return;
    }

    const datePart = match[1]; // e.g., "Sep 28"
    const descriptionPart = match[2].trim(); // e.g., "PRESTO ETIK/HSR****2590, TORON"
    const amountString = match[3]; // e.g., "-$5.60" or "$10.00"

    let formattedDate = datePart;
    // Append year if provided in the year input field
    if (yearInput) {
      formattedDate = `${datePart} ${yearInput}`;
    }

    let debit = '', credit = '';

    // Clean the amount string by removing '$' and commas, then parse to a float.
    const cleanedAmount = amountString.replace(/[\$,]/g, '');
    const amountVal = parseFloat(cleanedAmount);

    // Determine Debit vs. Credit based on EQ Bank's specific rule:
    // Negative amounts are DEBIT, Positive amounts are CREDIT.
    // The absolute value is used for display, removing the negative sign.
    if (amountVal < 0) {
      debit = Math.abs(amountVal).toFixed(2); // Display as positive in Debit column
    } else {
      credit = amountVal.toFixed(2); // Display as positive in Credit column
    }

    // Create a unique signature for duplicate checking (case-insensitive description and amount)
    const signature = `${descriptionPart.toLowerCase()}|${debit || credit}`;
    const isDuplicate = seen.has(signature);
    if (!isDuplicate) seen.add(signature);

    // Construct the table row data
    const row = [formattedDate, descriptionPart, debit, credit, '']; // Balance column is always empty for now
    const tr = document.createElement('tr');
    // Highlight duplicate rows for visual indication
    if (isDuplicate) tr.style.backgroundColor = '#ffcccc';

    // Populate table cells for the current row
    row.forEach(cellContent => {
      const td = document.createElement('td');
      td.textContent = cellContent;
      tr.appendChild(td);
    });

    table.appendChild(tr);
    rows.push(row);
  });

  outputDiv.appendChild(table);
  // Store the processed rows as a dataset attribute on the table for potential future use
  table.dataset.rows = JSON.stringify(rows);
}

// Make the processData function globally accessible
window.processData = processData;
