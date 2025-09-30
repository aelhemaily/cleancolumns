// meridianAccount.js - Complete with PDF parsing support

// PDF Processing Function for Meridian
window.bankUtils.processPDFFile = async function(file) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('PDF.js library not loaded');
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  
  let allTransactions = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map(item => item.str).join(' ');
    parseTransactions(text, allTransactions);
  }
  
  return allTransactions.join('\n');
};

function parseTransactions(text, allTransactions) {
  // Clean and split the text into words
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  
  const datePattern = /^\d{2}-\w{3}-\d{4}$/;
  const amountPattern = /^-?\d{1,3}(,\d{3})*\.\d{2}$/;
  const numberPattern = /^\d+$/;
  
  let i = 0;
  while (i < words.length) {
    if (datePattern.test(words[i])) {
      const date = words[i];
      i++;
      
      // Handle Balance Forward
      if (i < words.length - 1 && words[i] === 'Balance' && words[i + 1] === 'Forward') {
        i += 2;
        if (i < words.length && amountPattern.test(words[i])) {
          allTransactions.push(`${date} Balance Forward ${words[i]}`);
          i++;
        }
        continue;
      }
      
      // Parse different transaction types
      let transactionParts = [date];
      let companyName = '';
      let foundTransactionType = false;
      
      // Look for transaction type
      while (i < words.length && !datePattern.test(words[i])) {
        const word = words[i];
        
        // Pre-Authorized transactions
        if (word === 'Pre-Authorized' && i + 1 < words.length && words[i + 1] === '#') {
          transactionParts.push('Pre-Authorized #');
          i += 2;
          
          if (i < words.length && numberPattern.test(words[i])) {
            transactionParts.push(words[i]);
            i++;
          }
          
          if (i < words.length && amountPattern.test(words[i])) {
            transactionParts.push(words[i]);
            i++;
            if (i < words.length && amountPattern.test(words[i])) {
              transactionParts.push(words[i]);
              i++;
            }
          }
          
          const companyWords = [];
          while (i < words.length && !datePattern.test(words[i]) && 
                 !words[i].match(/^(Pre-Authorized|Cheque|Bill|e-Transfer|Transfer|Combined|Cash|Account|Interest|Service|Overdraft)$/)) {
            if (!amountPattern.test(words[i]) && !numberPattern.test(words[i]) && words[i] !== '#') {
              companyWords.push(words[i]);
            }
            i++;
          }
          companyName = companyWords.join(' ');
          foundTransactionType = true;
          break;
        }
        
        // Cheque transactions
        else if (word === 'Cheque' && i + 1 < words.length && words[i + 1] === '#') {
          transactionParts.push('Cheque #');
          i += 2;
          
          if (i < words.length && numberPattern.test(words[i])) {
            transactionParts.push(words[i]);
            i++;
          }
          
          if (i < words.length && amountPattern.test(words[i])) {
            transactionParts.push(words[i]);
            i++;
            if (i < words.length && amountPattern.test(words[i])) {
              transactionParts.push(words[i]);
              i++;
            }
          }
          foundTransactionType = true;
          break;
        }
        
        // Bill Payment transactions
        else if (word === 'Bill' && i + 1 < words.length && words[i + 1] === 'Payment') {
          transactionParts.push('Bill Payment #');
          i += 3;
          
          if (i < words.length && numberPattern.test(words[i])) {
            transactionParts.push(words[i]);
            i++;
          }
          
          if (i < words.length && amountPattern.test(words[i])) {
            transactionParts.push(words[i]);
            i++;
            if (i < words.length && amountPattern.test(words[i])) {
              transactionParts.push(words[i]);
              i++;
            }
          }
          
          const companyWords = [];
          while (i < words.length && !datePattern.test(words[i]) && 
                 !words[i].match(/^(Pre-Authorized|Cheque|Bill|e-Transfer|Transfer|Combined|Cash|Account|Interest|Service|Overdraft)$/)) {
            if (!amountPattern.test(words[i]) && !numberPattern.test(words[i]) && words[i] !== '#') {
              companyWords.push(words[i]);
            }
            i++;
          }
          companyName = companyWords.join(' ');
          foundTransactionType = true;
          break;
        }
        
        // e-Transfer transactions - FIXED: Prevent duplication
        else if (word === 'e-Transfer') {
          let direction = '';
          if (i + 1 < words.length && (words[i + 1] === 'Out' || words[i + 1] === 'In')) {
            direction = ' ' + words[i + 1];
            i++;
          }
          transactionParts.push('e-Transfer' + direction + ' #');
          i++;
          
          if (i < words.length && words[i] === '#') i++;
          
          if (i < words.length && numberPattern.test(words[i])) {
            transactionParts.push(words[i]);
            i++;
          }
          
          if (i < words.length && amountPattern.test(words[i])) {
            transactionParts.push(words[i]);
            i++;
            if (i < words.length && amountPattern.test(words[i])) {
              transactionParts.push(words[i]);
              i++;
            }
          }
          
          // Check for Service Charge but don't duplicate the e-Transfer
          if (i < words.length && words[i] === 'Service' && i + 1 < words.length && words[i + 1] === 'Charge') {
            // First, add the e-Transfer transaction
            if (foundTransactionType && transactionParts.length > 1) {
              allTransactions.push(transactionParts.join(' '));
              if (companyName.trim()) {
                allTransactions.push(companyName.trim());
              }
            }
            
            // Then add the Service Charge as a separate transaction
            i += 2;
            if (i < words.length && amountPattern.test(words[i])) {
              allTransactions.push(`${date} Service Charge ${words[i]}`);
              i++;
            }
            foundTransactionType = true;
            break;
          }
          
          foundTransactionType = true;
          break;
        }
        
        // Cash & Coin Fee
        else if (word === 'Cash' && i + 2 < words.length && words[i + 1] === '&' && words[i + 2] === 'Coin' && words[i + 3] === 'Fee') {
          i += 4;
          if (i < words.length && amountPattern.test(words[i])) {
            transactionParts.push('Cash & Coin Fee');
            transactionParts.push(words[i]);
            i++;
          }
          foundTransactionType = true;
          break;
        }
        
        // Account Fee
        else if (word === 'Account' && i + 1 < words.length && words[i + 1] === 'Fee') {
          transactionParts.push('Account Fee');
          i += 2;
          if (i < words.length && amountPattern.test(words[i])) {
            transactionParts.push(words[i]);
            i++;
            if (i < words.length && amountPattern.test(words[i])) {
              transactionParts.push(words[i]);
              i++;
            }
          }
          foundTransactionType = true;
          break;
        }
        
        // Interest Debit
        else if (word === 'Interest' && i + 1 < words.length && words[i + 1] === 'Debit') {
          transactionParts.push('Interest Debit');
          i += 2;
          if (i < words.length && amountPattern.test(words[i])) {
            transactionParts.push(words[i]);
            i++;
            if (i < words.length && amountPattern.test(words[i])) {
              transactionParts.push(words[i]);
              i++;
            }
          }
          foundTransactionType = true;
          break;
        }
        
        // Overdraft Fee
        else if (word === 'Overdraft' && i + 1 < words.length && words[i + 1] === 'Fee') {
          transactionParts.push('Overdraft Fee');
          i += 2;
          if (i < words.length && amountPattern.test(words[i])) {
            transactionParts.push(words[i]);
            i++;
            if (i < words.length && amountPattern.test(words[i])) {
              transactionParts.push(words[i]);
              i++;
            }
          }
          const descWords = [];
          while (i < words.length && !datePattern.test(words[i])) {
            if (!amountPattern.test(words[i])) {
              descWords.push(words[i]);
            }
            i++;
          }
          if (descWords.length > 0) {
            companyName = descWords.join(' ');
          }
          foundTransactionType = true;
          break;
        }
        
        i++;
      }
      
      if (foundTransactionType && transactionParts.length > 1) {
        allTransactions.push(transactionParts.join(' '));
        if (companyName.trim()) {
          allTransactions.push(companyName.trim());
        }
      }
      
      continue;
    }
    i++;
  }
}

// Main processing function
function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').map(line => line.trim()).filter(Boolean);
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const table = document.createElement('table');

  const copyRow = document.createElement('tr');
  const headerRow = document.createElement('tr');

  headers.forEach((header, index) => {
    const thCopy = document.createElement('th');
    const div = document.createElement('div');
    div.className = 'copy-col';
    const btn = document.createElement('button');
    btn.textContent = '📋';
    btn.className = 'copy-btn';
    btn.onclick = () => window.bankUtils.copyColumn(index);
    div.appendChild(btn);
    thCopy.appendChild(div);
    copyRow.appendChild(thCopy);

    const thHeader = document.createElement('th');
    thHeader.textContent = header;
    headerRow.appendChild(thHeader);
  });

  table.appendChild(copyRow);
  table.appendChild(headerRow);

  const dateRegex = /^(\d{2}-[A-Za-z]{3})(?:-\d{4})?/;
  const amountRegex = /-?\d{1,3}(?:,\d{3})*\.\d{2}/;
  const transactions = [];
  let currentDate = '';
  let currentLines = [];

  function pushTransaction() {
    if (currentLines.length === 0) return;
    transactions.push({ date: currentDate, lines: [...currentLines] });
    currentLines = [];
  }

  lines.forEach((line) => {
    const isBalanceLine = /opening balance|balance forward|closing balance/i.test(line);
    const isDateLine = dateRegex.test(line);
    const hasAmount = amountRegex.test(line);

    if (isBalanceLine) {
      pushTransaction();
      if (isDateLine) {
        const baseDate = line.match(dateRegex)[1];
        currentDate = yearInput ? `${baseDate}-${yearInput}` : line.match(dateRegex)[0];
      }
      return;
    }

    if (isDateLine) {
      pushTransaction();
      const baseDate = line.match(dateRegex)[1];
      currentDate = yearInput ? `${baseDate}-${yearInput}` : line.match(dateRegex)[0];
      const rest = line.replace(dateRegex, '').trim();
      if (rest) currentLines.push(rest);
    } else if (hasAmount) {
      pushTransaction();
      currentLines.push(line);
    } else {
      currentLines.push(line);
    }
  });

  pushTransaction();

  const rows = [];

  transactions.forEach(({ date, lines }) => {
    const fullText = lines.join(' ').trim();
    const isCashCoinFee = /Cash & Coin Fee/i.test(fullText);
    const amounts = [...fullText.matchAll(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g)].map(m => parseFloat(m[0].replace(/,/g, '')));
    
    if (amounts.length < 1) return;

    // Special handling for Cash & Coin Fee with only one amount
    if (isCashCoinFee && amounts.length === 1) {
      const row = [date, fullText.replace(amountRegex, '').trim(), '', '', amounts[0].toFixed(2)];
      rows.push(row);
      
      const tr = document.createElement('tr');
      row.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      });
      table.appendChild(tr);
      return;
    }

    const amount = amounts[0];
    const balance = amounts.length > 1 ? amounts[1] : null;
    const descText = fullText.replace(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g, '').trim();

    let debit = '', credit = '';
    if (amount < 0) {
      debit = (-amount).toFixed(2);
    } else {
      credit = amount.toFixed(2);
    }

    const row = [date, descText, debit, credit, balance !== null ? balance.toFixed(2) : ''];
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