// rbcAccount.js - Complete file with PDF processing capability

// PDF Processing Function
window.bankUtils = window.bankUtils || {};

window.bankUtils.processPDFFile = async function(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let allPageLines = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const sortedItems = textContent.items.sort((a, b) => {
        const yDiff = Math.abs(a.transform[5] - b.transform[5]);
        if (yDiff > 5) {
          return b.transform[5] - a.transform[5];
        }
        return a.transform[4] - b.transform[4];
      });

      let currentLine = [];
      let lastY = null;

      for (let item of sortedItems) {
        const y = item.transform[5];
        
        if (lastY !== null && Math.abs(y - lastY) > 5) {
          if (currentLine.length > 0) {
            allPageLines.push(currentLine.map(i => i.str).join(' ').trim());
            currentLine = [];
          }
        }
        
        if (item.str.trim()) {
          currentLine.push(item);
        }
        lastY = y;
      }
      
      if (currentLine.length > 0) {
        allPageLines.push(currentLine.map(i => i.str).join(' ').trim());
      }
    }

    return parseTransactions(allPageLines);
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw error;
  }
};

function parseTransactions(lines) {
  let result = '';
  
  // Find opening balance
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (line.includes('opening balance')) {
      const match = lines[i].match(/[-$]?\d{1,3}(,\d{3})*\.\d{2}/);
      if (match) {
        result += `Opening balance ${match[0].replace(/[$,]/g, '')}\n`;
        break;
      }
    }
  }

  // Find transaction section
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if ((line.includes('date') && line.includes('description')) ||
        (line === 'date' && i + 1 < lines.length && lines[i + 1].toLowerCase().includes('description'))) {
      startIdx = i + 1;
      while (startIdx < lines.length && 
             (lines[startIdx].toLowerCase().includes('balance') ||
              lines[startIdx].toLowerCase().includes('withdrawals') ||
              lines[startIdx].toLowerCase().includes('deposits') ||
              lines[startIdx].toLowerCase().includes('cheques') ||
              lines[startIdx].toLowerCase().includes('debits') ||
              lines[startIdx].toLowerCase().includes('credits') ||
              lines[startIdx].match(/^[\(\$\)]+$/))) {
        startIdx++;
      }
      break;
    }
  }

  if (startIdx === -1) return result;

  let endIdx = lines.length;
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if ((line.includes('closing') && line.includes('balance') && !line.includes('opening')) ||
        line.includes('account fees:') ||
        line.includes('serial #:') ||
        line.startsWith('please check this') ||
        line.startsWith('if you opted')) {
      endIdx = i;
      break;
    }
  }

  // Process all lines into raw transaction data
  let currentDate = '';
  const rawTransactions = [];

  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip header/footer lines
    const lower = line.toLowerCase();
    if (lower.includes('business account statement') ||
        lower.includes('account number:') ||
        lower.includes('account activity details') ||
        lower.includes('date description') ||
        lower.match(/^\d+ of \d+$/) ||
        lower.match(/^(january|february|march|april|may|june|july|august|september|october|november|december) \d+, \d{4} to/i) ||
        lower.includes('cheques & debits') ||
        lower.includes('deposits & credits') ||
        lower.includes('balance ($)') ||
        lower.includes('withdrawals ($)') ||
        lower.includes('your rbc personal banking') ||
        lower.includes('account statement') ||
        lower.match(/rbpda\d+_\d+_\d+/) ||
        lower.match(/from \w+ \d+, \d{4} to/) ||
        lower.includes('details of your account activity')) {
      continue;
    }

    const dateMatch = line.match(/^(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\s+(.*)$/i);
    
    if (dateMatch) {
      currentDate = dateMatch[1];
      let remainder = dateMatch[2].trim();
      
      // Clean up any embedded header text
      remainder = remainder.replace(/RBPDA\d+_\d+_\d+[^\d]+-[^\d]+\d+[^\d]+-[^\d]+\d+[^\d]+-[^\d]+\d+[^\d]+-[^\d]+\d+[^\d]+-[^\d]+-[^\d]+-?/gi, '');
      remainder = remainder.replace(/Your RBC personal banking account statement/gi, '');
      remainder = remainder.replace(/From \w+ \d+, \d{4} to \w+ \d+, \d{4}/gi, '');
      remainder = remainder.replace(/Details of your account activity - continued/gi, '');
      remainder = remainder.trim();
      
      if (remainder) {
        rawTransactions.push({ date: currentDate, text: remainder });
      }
    } else if (currentDate) {
      rawTransactions.push({ date: currentDate, text: line });
    }
  }

  // Now parse each raw transaction into actual transactions
  const transactions = [];
  let pendingDesc = '';
  let pendingDate = '';

  for (let raw of rawTransactions) {
    const text = raw.text;
    const date = raw.date;

    // Skip transactions that are just a dash (fake transactions)
    if (text.trim() === '-' || text.trim() === '') {
      continue;
    }

    // Find all amounts
    const amountRegex = /\d{1,3}(,\d{3})*\.\d{2}/g;
    const amounts = [];
    let match;
    
    while ((match = amountRegex.exec(text)) !== null) {
      amounts.push({
        value: match[0],
        index: match.index
      });
    }

    if (amounts.length === 0) {
      // No amounts - description continuation
      pendingDesc += (pendingDesc ? ' ' : '') + text;
      pendingDate = date;
      continue;
    }

    // Process amounts and their descriptions
    let lastEnd = 0;

    for (let j = 0; j < amounts.length; j++) {
      const amt = amounts[j];
      let desc = text.substring(lastEnd, amt.index).trim();

      // Check if we have a pending description
      if (pendingDesc) {
        desc = pendingDesc + (desc ? ' ' + desc : '');
        pendingDesc = '';
      }

      // Skip transactions that are just a dash (fake transactions)
      if (desc.trim() === '-' || desc.trim() === '') {
        // This is a fake transaction, add the amount to the previous transaction as balance
        if (transactions.length > 0) {
          const lastTxn = transactions[transactions.length - 1];
          if (lastTxn.amounts.length < 2) {
            lastTxn.amounts.push(amt.value);
          }
        }
        lastEnd = amt.index + amt.value.length;
        continue;
      }

      // Determine if this is a new transaction
      if (desc.length > 0) {
        // New transaction
        const txn = {
          date: date,
          description: desc,
          amounts: [amt.value]
        };

        // Check if next amount is a balance (within 5 chars)
        if (j + 1 < amounts.length) {
          const nextAmt = amounts[j + 1];
          const gap = text.substring(amt.index + amt.value.length, nextAmt.index).trim();
          if (gap.length < 5) {
            txn.amounts.push(nextAmt.value);
            j++;
            lastEnd = nextAmt.index + nextAmt.value.length;
          } else {
            lastEnd = amt.index + amt.value.length;
          }
        } else {
          lastEnd = amt.index + amt.value.length;
        }

        transactions.push(txn);
      } else if (transactions.length > 0) {
        // No description - add to last transaction as balance
        transactions[transactions.length - 1].amounts.push(amt.value);
        lastEnd = amt.index + amt.value.length;
      }
    }

    // Check if there's trailing text (continuation)
    const trailing = text.substring(lastEnd).trim();
    if (trailing && trailing.length > 2 && !trailing.match(/^\d/)) {
      pendingDesc = trailing;
      pendingDate = date;
    }
  }

  // Output all transactions
  for (let txn of transactions) {
    let line = txn.date + ' ' + txn.description;
    for (let amt of txn.amounts) {
      line += ' ' + amt;
    }
    result += line + '\n';
  }

  return result;
}

// Main processing function
function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').map(line => line.trim()).filter(Boolean);
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];
  let currentBalance = null;
  let currentDate = '';

  const table = document.createElement('table');

  // Define words to highlight
  const highlightWords = ["payment"];

  // Add CSS for highlighting directly in JS
  if (!document.getElementById('highlight-style')) {
    const style = document.createElement('style');
    style.id = 'highlight-style';
    style.textContent = `
      table td.highlight-word {
        background-color: #ffe0e0 !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Create table headers
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

  // Process transactions
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const isBalanceLine = line.toLowerCase().includes('opening balance') ||
                          line.toLowerCase().includes('balance forward') ||
                          line.toLowerCase().includes('closing balance');

    if (isBalanceLine) {
      const amountMatch = line.match(/(-?\d{1,3}(?:,\d{3})*\.\d{2})/);
      if (amountMatch) {
        currentBalance = parseFloat(amountMatch[0].replace(/,/g, ''));
      }

      const dateMatchInBalance = line.match(/(\d{1,2}\s[A-Za-z]{3})/);
      if (dateMatchInBalance) {
          currentDate = dateMatchInBalance[1];
      }
      i++;
      continue;
    }

    const dateMatch = line.match(/^(\d{1,2}\s[A-Za-z]{3})\s(.+)/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      const restOfLine = dateMatch[2];
      processRbcTransaction(currentDate, [restOfLine]);
      i++;
      continue;
    }

    if (currentDate) {
      processRbcTransaction(currentDate, [line]);
      i++;
      continue;
    }

    i++;
  }

  function processRbcTransaction(date, initialDescriptionParts) {
    let transactionLines = []; 
    let amountFound = false;
    let newBalance = null;
    let transactionAmount = null;

    if (initialDescriptionParts.length > 0 && initialDescriptionParts[0].trim() !== '') {
        transactionLines.push(initialDescriptionParts[0].trim());
    }

    let amountLineFoundIndex = -1;

    for (let j = i; j < lines.length; j++) {
        const currentLine = lines[j];
        
        const isCurrentLineBalance = currentLine.toLowerCase().includes('opening balance') ||
                                     currentLine.toLowerCase().includes('balance forward') ||
                                     currentLine.toLowerCase().includes('closing balance');
        if (isCurrentLineBalance) {
            break;
        }

        // Check if line contains @ symbol - this affects how we parse amounts
        const hasAtSymbol = currentLine.includes('@');
        
        if (hasAtSymbol) {
            // Special handling for @ symbol lines
            // Format: "description @ amount1 amount2 amount3"
            // We need to find ALL amounts, not just the last 2
            const amountRegex = /\d{1,3}(?:,\d{3})*\.\d{2}/g;
            const allAmounts = [];
            let amountMatch;
            while ((amountMatch = amountRegex.exec(currentLine)) !== null) {
                allAmounts.push({
                    value: amountMatch[0],
                    index: amountMatch.index
                });
            }
            
            if (allAmounts.length >= 2) {
                // Find the @ position
                const atIndex = currentLine.indexOf('@');
                
                // Find which amount comes right after @
                let amountAfterAt = -1;
                for (let k = 0; k < allAmounts.length; k++) {
                    if (allAmounts[k].index > atIndex) {
                        amountAfterAt = k;
                        break;
                    }
                }
                
                if (amountAfterAt !== -1 && amountAfterAt < allAmounts.length - 1) {
                    // We have at least one amount after the @ amount
                    // Get description up to and including the first amount after @
                    const descEndIndex = allAmounts[amountAfterAt].index + allAmounts[amountAfterAt].value.length;
                    const descPart = currentLine.substring(0, descEndIndex).trim();
                    
                    // The next amount is the transaction amount
                    transactionAmount = parseFloat(allAmounts[amountAfterAt + 1].value.replace(/,/g, ''));
                    
                    // If there's another amount after that, it's the balance
                    newBalance = (amountAfterAt + 2 < allAmounts.length) 
                        ? parseFloat(allAmounts[amountAfterAt + 2].value.replace(/,/g, '')) 
                        : null;
                    
                    if (j === i && initialDescriptionParts.length > 0 && initialDescriptionParts[0].trim() !== '') {
                        transactionLines[0] = descPart;
                    } else {
                        transactionLines.push(descPart);
                    }
                    
                    amountFound = true;
                    amountLineFoundIndex = j;
                    break;
                }
            }
            // If we can't parse it properly with @, continue to next line
            continue;
        }
        
        // Normal case: no @ symbol
        const regexToEndOfLineAmounts = /(.*?)\s*(-?\d{1,3}(?:,\d{3})*\.\d{2})\s*(?:(-?\d{1,3}(?:,\d{3})*\.\d{2}))?$/;
        const match = currentLine.match(regexToEndOfLineAmounts);

        if (match) {
            const descPart = match[1] ? match[1].trim() : '';
            transactionAmount = parseFloat(match[2].replace(/,/g, ''));
            newBalance = match[3] ? parseFloat(match[3].replace(/,/g, '')) : null;
            
            if (descPart !== '' && (j > i || initialDescriptionParts.length === 0 || initialDescriptionParts[0].trim() === '')) {
                transactionLines.push(descPart);
            } else if (j === i && initialDescriptionParts.length > 0 && initialDescriptionParts[0].trim() !== '') {
                if (transactionLines.length > 0 && transactionLines[0] !== descPart) {
                    transactionLines[0] = descPart;
                }
            }
            
            amountFound = true;
            amountLineFoundIndex = j;
            break;
        } else {
            if (j > i && currentLine.trim() !== '') {
                transactionLines.push(currentLine.trim());
            }
        }
    }

    if (!amountFound || transactionAmount === null) return;

    let fullDescription = transactionLines
        .filter(part => part.trim() !== '')
        .join(' ')
        .replace(/\s\s+/g, ' ')
        .trim();

    const datePatternInDescription = /^(?:(?:\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+\d{2,4})?)\s*)+/i;
    fullDescription = fullDescription.replace(datePatternInDescription, '').trim();

    if (amountLineFoundIndex !== -1) {
        i = amountLineFoundIndex; 
    }

    let debit = '', credit = '';
    let allocatedByKeywords = false;

    const hardcodedDebitKeywords = ["e-transfer sent", "e-Transfer sent"];
    const hardcodedCreditKeywords = ["nsf", "refund", "CPP CANADA"];

    const superDebitKeywords = 
    ["Online Transfer to Deposit Account", "Monthly Fee", "PAY EMP-VENDOR",
      "Telephone Banking transfer", "transfer sent", "special deposit", "Online banking transfer"
    ];
    const superCreditKeywords = ["e-transfer received", "payment received", "Misc Payment Uber Holdings C", "Misc Payment Lyft", "Prov/Local Gvt Payment",
      "carbon rebate", "seniors rebate", "CPP CANADA", "Old Age Security", "SQUARE CANADA", "Square, Inc"
    ];

    const lowerCaseDescription = fullDescription.toLowerCase();

    const isSuperDebit = superDebitKeywords.some(keyword => lowerCaseDescription.includes(keyword.toLowerCase()));
    if (isSuperDebit) {
        debit = transactionAmount.toFixed(2);
        currentBalance = currentBalance !== null ? currentBalance - transactionAmount : null;
        allocatedByKeywords = true;
    } else {
        const isSuperCredit = superCreditKeywords.some(keyword => lowerCaseDescription.includes(keyword.toLowerCase()));
        if (isSuperCredit) {
            credit = transactionAmount.toFixed(2);
            currentBalance = currentBalance !== null ? currentBalance + transactionAmount : null;
            allocatedByKeywords = true;
        } else {
            const overrideDebitKeywords = ["fee"];
            const isOverrideDebit = overrideDebitKeywords.some(keyword => lowerCaseDescription.includes(keyword));

            if (isOverrideDebit) {
              debit = transactionAmount.toFixed(2);
              currentBalance = currentBalance !== null ? currentBalance - transactionAmount : null;
              allocatedByKeywords = true;
            } else {
              const overrideCreditKeywords = ["Misc Payment Uber Holdings C", "CPP CANADA"];
              const isOverrideCredit = overrideCreditKeywords.some(keyword => lowerCaseDescription.includes(keyword));
              if (isOverrideCredit) {
                credit = transactionAmount.toFixed(2);
                currentBalance = currentBalance !== null ? currentBalance + transactionAmount : null;
                allocatedByKeywords = true;
              } else {
                let isHardcodedDebit = hardcodedDebitKeywords.some(keyword => lowerCaseDescription.includes(keyword));
                let isHardcodedCredit = hardcodedCreditKeywords.some(keyword => lowerCaseDescription.includes(keyword));

                if (isHardcodedDebit) {
                  debit = transactionAmount.toFixed(2);
                  currentBalance = currentBalance !== null ? currentBalance - transactionAmount : null;
                  allocatedByKeywords = true;
                } else if (isHardcodedCredit) {
                  credit = transactionAmount.toFixed(2);
                  currentBalance = currentBalance !== null ? currentBalance + transactionAmount : null;
                  allocatedByKeywords = true;
                }
              }
            }
        }
    }

    if (!allocatedByKeywords && window.bankUtils?.keywords) {
      let bestDebitMatch = '';
      let bestCreditMatch = '';

      if (window.bankUtils.keywords.debit) {
        window.bankUtils.keywords.debit.forEach(kw => {
          if (lowerCaseDescription.includes(kw.toLowerCase()) && kw.length > bestDebitMatch.length) {
            bestDebitMatch = kw;
          }
        });
      }

      if (window.bankUtils.keywords.credit) {
        window.bankUtils.keywords.credit.forEach(kw => {
          if (lowerCaseDescription.includes(kw.toLowerCase()) && kw.length > bestCreditMatch.length) {
            bestCreditMatch = kw;
          }
        });
      }

      if (bestDebitMatch.length > 0 && bestDebitMatch.length >= bestCreditMatch.length) {
        debit = transactionAmount.toFixed(2);
        currentBalance = currentBalance !== null ? currentBalance - transactionAmount : null;
        allocatedByKeywords = true;
      } else if (bestCreditMatch.length > 0) {
        credit = transactionAmount.toFixed(2);
        currentBalance = currentBalance !== null ? currentBalance + transactionAmount : null;
        allocatedByKeywords = true;
      }
    }

    if (!allocatedByKeywords && currentBalance !== null && newBalance !== null) {
      const balanceChange = newBalance - currentBalance;

      if (Math.abs(balanceChange - transactionAmount) < 0.01) {
        credit = transactionAmount.toFixed(2);
        currentBalance = newBalance;
      } else if (Math.abs(balanceChange + transactionAmount) < 0.01) {
        debit = transactionAmount.toFixed(2);
        currentBalance = newBalance;
      } else {
        debit = transactionAmount.toFixed(2);
        currentBalance = newBalance;
      }
      allocatedByKeywords = true;
    }

    if (!allocatedByKeywords) {
      debit = transactionAmount.toFixed(2);
      currentBalance = currentBalance !== null ? currentBalance - transactionAmount : null;
    }

    rows.push([
      formatDate(date, yearInput),
      fullDescription,
      debit,
      credit,
      newBalance !== null ? formatBalance(newBalance) : (currentBalance !== null ? formatBalance(currentBalance) : '')
    ]);

    if (amountLineFoundIndex !== -1) {
      i = amountLineFoundIndex; 
    }
  }

  // Add rows to table
  rows.forEach(row => {
    const tr = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;

      const lowerCaseCellContent = String(cell).toLowerCase();
      const shouldHighlight = highlightWords.some(word => lowerCaseCellContent.includes(word.toLowerCase()));
      if (shouldHighlight) {
        td.classList.add('highlight-word');
      }

      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(rows);

  function formatDate(dateStr, year) {
    const [day, monthAbbr] = dateStr.split(' ');
    const months = {
      JAN: 'Jan', FEB: 'Feb', MAR: 'Mar', APR: 'Apr', MAY: 'May', JUN: 'Jun',
      JUL: 'Jul', AUG: 'Aug', SEP: 'Sep', OCT: 'Oct', NOV: 'Nov', DEC: 'Dec'
    };
    const month = months[monthAbbr.toUpperCase()] || monthAbbr;
    return year ? `${day} ${month} ${year}` : `${day} ${month}`;
  }

  function formatBalance(balance) {
    if (balance === null || isNaN(balance)) return '';
    return balance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}

window.processData = processData;