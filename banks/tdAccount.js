function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').filter(l => l.trim());
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];
  let currentBalance = null;
  let isOverdraft = false;

  const table = document.createElement('table');

  // Copy buttons row
  const copyRow = document.createElement('tr');
  headers.forEach((_, index) => {
    const th = document.createElement('th');
    const div = document.createElement('div');
    div.className = 'copy-col';

    const btn = document.createElement('button');
    btn.textContent = `Copy`;
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

  // Default keywords (fallback)
  const defaultKeywords = {
    debit: [
      "ATM W/D", "CASH WITHDRA", "WITHDRAW", "FEE", "SERVICE CHARGE",
      "MONTHLY PLAN FEE", "OVERDRAFT FEE", "O.D.P. FEE", "SEND E-TFR",
      "TFR-TO", "PAYMENT TO", "NSF FEE", "BILL PAYMENT", "PURCHASE", "PAYMENT"
    ],
    credit: [
      "DEPOSIT", "TFR-FR", "E-TRANSFER", "E-TFR", "PAYMENT - THANK YOU",
      "REFUND", "INTEREST RECEIVED", "REMITTANCE", "GC DEPOSIT",
      "TRANSFER FR", "RECEIVED", "CREDIT"
    ]
  };

  // Load keywords from JSON file
  let keywords = defaultKeywords;
  if (window.bankUtils && window.bankUtils.loadKeywords) {
    try {
      const loadedKeywords = window.bankUtils.loadKeywords();
      if (loadedKeywords && loadedKeywords.debit && loadedKeywords.credit) {
        keywords = loadedKeywords;
      }
    } catch (e) {
      console.warn('Error loading keywords.json, using defaults', e);
    }
  }

  // Regular expressions for parsing
  const balanceForwardRegex = /(BALANCE FORWARD|STARTING BALANCE)\s+([A-Z]{3}\d{1,2})(?:\s+([\d,]+\.\d{2})(OD)?)?/i;
  const transactionRegex = /^(.+?)\s+([\d,]+\.\d{2})\s+([A-Z]{3}\d{1,2})(?:\s+([\d,]+\.\d{2})(OD)?)?/;
  const dateRegex = /^([A-Z]{3})(\d{1,2})$/;

  lines.forEach(line => {
    // Check for BALANCE FORWARD or STARTING BALANCE line
    const balanceForwardMatch = line.match(balanceForwardRegex);
    if (balanceForwardMatch) {
      const [, balanceType, date, balance, odFlag] = balanceForwardMatch;
      if (balance) {
        currentBalance = parseFloat(balance.replace(/,/g, ''));
        isOverdraft = odFlag === 'OD';
        rows.push([
          formatDate(date, yearInput),
          balanceType,
          '',
          '',
          formatBalance(currentBalance, isOverdraft)
        ]);
      }
      return;
    }

    // Process regular transaction lines
    const transactionMatch = line.match(transactionRegex);
    if (!transactionMatch) return;

    const [, description, amountStr, date, newBalanceStr, newOdFlag] = transactionMatch;
    const amount = parseFloat(amountStr.replace(/,/g, ''));
    const newBalance = newBalanceStr ? parseFloat(newBalanceStr.replace(/,/g, '')) : null;
    const willBeOverdraft = newOdFlag === 'OD';

    // Determine if this is a debit or credit
    let debit = '';
    let credit = '';

    if (currentBalance !== null && newBalance !== null) {
      // We have both current and new balance - most reliable method
      const balanceChange = newBalance - (isOverdraft ? -currentBalance : currentBalance);
      
      if (balanceChange < 0) {
        // Balance decreased (or overdraft increased) - this is a debit
        debit = Math.abs(balanceChange).toFixed(2);
      } else {
        // Balance increased (or overdraft decreased) - this is a credit
        credit = balanceChange.toFixed(2);
      }
      currentBalance = newBalance;
      isOverdraft = willBeOverdraft;
    } else if (currentBalance !== null) {
      // No new balance provided - use keyword matching
      const descLower = description.toLowerCase();
      
      // Check for credit keywords first
      const isCredit = keywords.credit.some(keyword => 
        descLower.includes(keyword.toLowerCase())
      );
      
      if (isCredit) {
        credit = amount.toFixed(2);
        currentBalance = (isOverdraft ? -currentBalance : currentBalance) + amount;
        isOverdraft = currentBalance < 0;
        currentBalance = Math.abs(currentBalance);
      } else {
        // Default to debit (most transactions are debits)
        debit = amount.toFixed(2);
        currentBalance = (isOverdraft ? -currentBalance : currentBalance) - amount;
        isOverdraft = currentBalance < 0;
        currentBalance = Math.abs(currentBalance);
      }
    } else {
      // No balance context at all - use keyword matching
      const descLower = description.toLowerCase();
      const isCredit = keywords.credit.some(keyword => 
        descLower.includes(keyword.toLowerCase())
      );
      
      if (isCredit) {
        credit = amount.toFixed(2);
      } else {
        debit = amount.toFixed(2);
      }
    }

    // Add the row
    rows.push([
      formatDate(date, yearInput),
      description.trim(),
      debit,
      credit,
      currentBalance !== null ? formatBalance(currentBalance, isOverdraft) : ''
    ]);
  });

  // Add rows to the table
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

  function formatDate(dateStr, year) {
    const match = dateStr.match(dateRegex);
    if (!match) return dateStr;
    
    const [, monthAbbr, day] = match;
    const months = {
      JAN: 'Jan', FEB: 'Feb', MAR: 'Mar', APR: 'Apr', MAY: 'May', JUN: 'Jun',
      JUL: 'Jul', AUG: 'Aug', SEP: 'Sep', OCT: 'Oct', NOV: 'Nov', DEC: 'Dec'
    };
    
    const month = months[monthAbbr] || monthAbbr;
    const dayPadded = day.padStart(2, '0');
    
    // Only include year if provided
    return year ? `${month} ${dayPadded} ${year}` : `${month} ${dayPadded}`;
  }

  function formatBalance(balance, overdraft) {
    return overdraft ? `${balance.toFixed(2)}OD` : balance.toFixed(2);
  }
}

// Export for use
window.processData = processData;