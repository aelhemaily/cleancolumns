// cibcAccount.js - Merged content with PDF processing from cibcacc.html and original features retained

// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

// Set up PDF.js worker (from cibcacc.html)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// PDF Parsing Function (adapted from cibcacc.html)
async function parsePDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Join text items with a space, ensuring consistent spacing between words
        // and handling potential double spaces from PDF.js
        const pageText = textContent.items.map(item => item.str).join(' ').replace(/\s{2,}/g, ' ');
        fullText += pageText + ' '; // Add space between pages to ensure continuity
    }
    return extractTransactions(fullText);
}

// Transaction extraction logic (from cibcacc.html)
function extractTransactions(text) {
    const resultTransactions = [];
    let lastKnownDate = null;

    // Normalize whitespace: replace multiple spaces with single space, trim, then split into tokens
    const tokens = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ');

    let i = 0;

    // Regex for date patterns (Month Day)
    const datePattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i;
    const dayPattern = /^\d{1,2}$/;

    // Define regex for transaction keywords (start of a transaction description)
    const transactionKeywords = /^(RETAIL|INTERNET|E-TRANSFER|VISA|SERVICE|OVERDRAFT|Opening|Balance)$/i;

    // Define regex for currency amounts
    const amountPattern = /^-?\$?\d+\.\d{2}$/;

    // --- Phase 1: Locate the start of the transaction details section ---
    let foundTransactionDetailsHeader = false;
    while (i < tokens.length) {
        const currentToken = tokens[i];
        if (currentToken === "Transaction" && i + 1 < tokens.length && tokens[i+1] === "details") {
            i += 2; // Move past "Transaction details"
            // Now, skip the actual table header line (e.g., "Date Description Withdrawals ($) Deposits ($) Balance ($)")
            // We'll advance 'i' until we find a date or a transaction keyword, which should mark the start of actual transaction data.
            while (i < tokens.length) {
                const lookAheadToken = tokens[i];
                if (lookAheadToken.match(datePattern) || lookAheadToken.match(transactionKeywords) || (lookAheadToken.toLowerCase() === 'opening' && i + 1 < tokens.length && tokens[i+1].toLowerCase() === 'balance')) {
                    foundTransactionDetailsHeader = true;
                    break;
                }
                // Stop if we hit explicit end markers that might appear before first transaction
                if (lookAheadToken.match(/^(Free|Important|Contact|Account|TM|Registered|Interac|10774E|Page)$/i)) {
                    break;
                }
                i++;
            }
            break;
        }
        i++;
    }

    if (!foundTransactionDetailsHeader) {
        return ''; // No transaction details section found, return empty
    }

    // --- Phase 2: Parse transactions token by token ---
    while (i < tokens.length) {
        let transaction = {
            date: lastKnownDate,
            description: '',
            withdrawal: '',
            deposit: '',
            balance: ''
        };
        let currentToken = tokens[i];
        let isSpecialBalanceType = false; // Flag for Opening/Balance forward

        // Check for end of transaction section markers
        if (currentToken && currentToken.match(/^(Free|Important|Contact|Account|TM|Registered|Interac|10774E|Page)$/i)) {
            break;
        }

        // 1. Try to consume a date
        if (currentToken && currentToken.match(datePattern) && i + 1 < tokens.length && tokens[i + 1].match(dayPattern)) {
            transaction.date = `${currentToken} ${tokens[i + 1]}`;
            lastKnownDate = transaction.date;
            i += 2;
            currentToken = tokens[i]; // Update currentToken after date consumption
        } else {
            // If no date token found, use last known date. If still no date and not a transaction keyword, skip.
            if (!lastKnownDate && !(currentToken && currentToken.match(transactionKeywords))) {
                i++;
                continue;
            }
        }

        if (!currentToken && i < tokens.length) { // Ensure currentToken is valid
            currentToken = tokens[i];
        }
        if (!currentToken) {
            i++;
            continue;
        }

        // 2. Try to consume transaction description
        const initialTokenIndexForDescription = i;
        let tempScanIndex = i;
        let descriptionParts = [];

        // Check for specific multi-word phrases first (Opening Balance, Balance Forward, Closing Balance)
        if (tokens[tempScanIndex] && tokens[tempScanIndex].toLowerCase() === 'opening' &&
            tokens[tempScanIndex + 1] && tokens[tempScanIndex + 1].toLowerCase() === 'balance') {
            descriptionParts.push('Opening', 'balance');
            tempScanIndex += 2;
            isSpecialBalanceType = true;
        } else if (tokens[tempScanIndex] && tokens[tempScanIndex].toLowerCase() === 'balance' &&
                   tokens[tempScanIndex + 1] && tokens[tempScanIndex + 1].toLowerCase() === 'forward') {
            descriptionParts.push('Balance', 'forward');
            tempScanIndex += 2;
            isSpecialBalanceType = true;
        } else if (tokens[tempScanIndex] && tokens[tempScanIndex].toLowerCase() === 'closing' &&
                   tokens[tempScanIndex + 1] && tokens[tempScanIndex + 1].toLowerCase() === 'balance') {
            // This is the closing balance, consume its parts and completely skip it
            tempScanIndex += 2; // Move past "Closing balance" words
            // Consume any amounts associated with this closing balance line
            while (tempScanIndex < tokens.length && tokens[tempScanIndex].match(amountPattern)) {
                tempScanIndex++;
            }
            i = tempScanIndex; // Advance main loop index and continue to next iteration
            continue; // Skip the rest of the processing for this particular "Closing balance" transaction
        }
        else {
            // Original logic for collecting other description words
            while (tempScanIndex < tokens.length) {
                const scanToken = tokens[tempScanIndex];

                // Heuristic: Stop if we hit a currency amount or a new date/transaction type
                const isAmount = scanToken.match(amountPattern);
                const isNewDate = scanToken.match(datePattern) && tempScanIndex + 1 < tokens.length && tokens[tempScanIndex + 1].match(dayPattern);
                const isNewTransactionKeyword = scanToken.match(transactionKeywords) && tempScanIndex > initialTokenIndexForDescription;

                if (isAmount || isNewDate || isNewTransactionKeyword) {
                    break;
                }
                descriptionParts.push(scanToken);
                tempScanIndex++;
            }
        }

        if (descriptionParts.length === 0) {
            i++;
            continue;
        }

        transaction.description = descriptionParts.join(' ').trim();

        // 3. Try to consume amounts (withdrawal/deposit and balance)
        const collectedAmounts = [];
        while (tempScanIndex < tokens.length && collectedAmounts.length < 2) { // Max 2 amounts: primary amount and balance
            const potentialAmount = tokens[tempScanIndex];
            if (potentialAmount.match(amountPattern)) {
                collectedAmounts.push(potentialAmount);
            } else if (potentialAmount.match(datePattern) || potentialAmount.match(transactionKeywords)) {
                break; // Hit a new date or transaction, stop collecting amounts for current one
            }
            tempScanIndex++;
        }

        // Assign amounts based on whether it's a special balance type or a regular transaction
        if (isSpecialBalanceType) {
            if (collectedAmounts.length > 0) {
                transaction.balance = collectedAmounts[0]; // For these, the first amount is the balance
                transaction.withdrawal = ''; // Ensure no unintended withdrawal/deposit
                transaction.deposit = '';
            }
        } else {
            // For regular transactions
            if (collectedAmounts.length === 2) {
                const amount1 = collectedAmounts[0];
                const amount2 = collectedAmounts[1];

                if (transaction.description.toLowerCase().includes('deposit') || transaction.description.toLowerCase().includes('e-transfer')) {
                    transaction.deposit = amount1;
                    transaction.balance = amount2;
                } else {
                    transaction.withdrawal = amount1;
                    transaction.balance = amount2;
                }
            } else if (collectedAmounts.length === 1) {
                // If only one amount, it's typically the balance, or a standalone withdrawal/deposit
                const amount = collectedAmounts[0];
                if (transaction.description.toLowerCase().includes('deposit') || transaction.description.toLowerCase().includes('e-transfer')) {
                     transaction.deposit = amount;
                } else if (!transaction.description.toLowerCase().includes('service charge') && !transaction.description.toLowerCase().includes('overdraft')) {
                    // If it's not a service charge/overdraft, and no explicit deposit, assume withdrawal
                    transaction.withdrawal = amount;
                }
                transaction.balance = amount; // Also set as balance, will be deduplicated in output
            }
        }

        // Determine if a complete transaction has been parsed and add to results
        if (transaction.description && transaction.date && (transaction.withdrawal || transaction.deposit || transaction.balance)) {
            let outputLine = `${transaction.date} ${transaction.description}`;
            if (transaction.withdrawal) {
                outputLine += ` ${transaction.withdrawal}`;
            } else if (transaction.deposit) {
                outputLine += ` ${transaction.deposit}`;
            }
            // For Opening balance/Balance forward, only show the single balance amount.
            // For other transactions, show balance if it's present and distinct from the withdrawal/deposit amount.
            if (transaction.balance && (isSpecialBalanceType || (transaction.balance !== transaction.withdrawal && transaction.balance !== transaction.deposit))) {
                outputLine += ` ${transaction.balance}`;
            }
            resultTransactions.push(outputLine.trim());
        }

        // Advance main index to where this transaction's parsing stopped
        i = tempScanIndex;
    }

    return resultTransactions.join('\n');
}

// Main data processing function for text input (from original cibcAccount.js)
function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').map(line => line.trim()).filter(Boolean);
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  // Show the file list container if we have processed files
  const fileListContainer = document.getElementById('fileListContainer');
  if (lines.length > 0) {
    fileListContainer.style.display = 'block';
  }

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const table = document.createElement('table');

  // --- Copy Buttons Row ---
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

  // --- Header Row ---
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  let currentDate = '';
  const transactions = [];
  let tempLines = [];
  const validMonths = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

  lines.forEach((line) => {
    const dateMatch = line.match(/^([A-Za-z]{3})\s+\d{1,2}/);
    const isValidDateLine = dateMatch && validMonths.includes(dateMatch[1].toLowerCase());
    const isBalanceLine = line.toLowerCase().includes('opening balance') ||
                          line.toLowerCase().includes('balance forward') ||
                          line.toLowerCase().includes('closing balance');

    // If it's a balance line, filter it out but use its date for subsequent transactions if available
    if (isBalanceLine) {
      if (tempLines.length > 0) {
        // If there are accumulated non-balance lines, push them with the current date
        transactions.push({ date: currentDate, lines: [...tempLines] });
        tempLines = []; // Clear tempLines
      }
      if (isValidDateLine) {
        // Update currentDate with the date from the balance line
        // This date will apply to subsequent dateless transactions
        currentDate = dateMatch[0];
        if (yearInput) currentDate += ` ${yearInput}`;
      }
      return; // Skip this balance line entirely; do not add it to transactions
    }

    // Now handle regular transaction lines
    if (isValidDateLine) {
      if (tempLines.length > 0) {
        transactions.push({ date: currentDate, lines: [...tempLines] });
        tempLines = [];
      }
      currentDate = dateMatch[0];
      if (yearInput) currentDate += ` ${yearInput}`;
      const restOfLine = line.replace(dateMatch[0], '').trim();
      if (restOfLine) tempLines.push(restOfLine);
    } else {
      tempLines.push(line);
    }

    // This condition is for multi-line transactions where the last line contains two amounts (transaction and balance)
    const amountMatch = line.match(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g);
    if (amountMatch && amountMatch.length === 2) {
      transactions.push({ date: currentDate, lines: [...tempLines] });
      tempLines = [];
    }
  });

  // After the loop, push any remaining tempLines
  if (tempLines.length > 0) {
    transactions.push({ date: currentDate, lines: [...tempLines] });
  }

  const rows = [];
  let previousBalance = null;

  transactions.forEach(entry => {
    const { date, lines } = entry;
    const fullText = lines.join(' ').trim();
    // The balance lines are already filtered out earlier, so no need for 'isOpeningBalance' or 'isClosingBalance' checks here.

    const allAmounts = [...fullText.matchAll(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g)].map(m => parseFloat(m[0].replace(/,/g, '')));
    if (allAmounts.length < 1) return;

    const amount = allAmounts[0];
    const balance = allAmounts.length > 1 ? allAmounts[1] : null;
    const descText = fullText.replace(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g, '').trim();

    let debit = '', credit = '';

    if (balance !== null && previousBalance !== null) {
      const delta = balance - previousBalance;
      if (Math.abs(delta - amount) < 0.01) {
        credit = amount.toFixed(2);
      } else if (Math.abs(delta + amount) < 0.01) {
        debit = amount.toFixed(2);
      } else {
        // Fallback to direction (less reliable if delta doesn't match amount)
        if (delta < 0) debit = amount.toFixed(2);
        else credit = amount.toFixed(2);
      }
    } else if (window.bankUtils?.keywords) {
      const isCredit = window.bankUtils.keywords.credit.some(kw =>
        descText.toLowerCase().includes(kw.toLowerCase())
      );
      if (isCredit) credit = amount.toFixed(2);
      else debit = amount.toFixed(2);
    } else {
      debit = amount.toFixed(2); // Ultimate fallback
    }

    previousBalance = balance !== null ? balance : previousBalance;

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
  table.dataset.rows = JSON.stringify(rows); // Ensure rows are stored in dataset

  // Assuming updateTableCursor is available globally from main.js or other script
  if (typeof window.updateTableCursor === 'function') {
      window.updateTableCursor();
  }
  displayStatusMessage('Data processed successfully!', 'success');
}

// Export processData globally
window.processData = processData;

// PDF Processing Function (adapted from cibcacc.html and integrated for cibcAccount)
window.bankUtils.processPDFFile = async function(file) {
  try {
    const processedText = await parsePDF(file);
    return processedText;
  } catch (error) {
    console.error("Error processing PDF:", error);
    displayStatusMessage("Failed to process PDF file. " + error.message, 'error');
    throw new Error("Failed to process PDF file. " + error.message);
  }
};

// Function to handle file uploads and display them (adapted from bmoAccount.js)
window.bankUtils.handleFiles = async function(files) {
  const fileList = document.getElementById('fileList');
  const inputText = document.getElementById('inputText');
  const fileListContainer = document.getElementById('fileListContainer');

  fileListContainer.style.display = 'block'; // Ensure container is shown when files are handled

  for (const file of files) {
    if (file.type === 'application/pdf') {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.draggable = true;
      fileItem.dataset.fileName = file.name;

      const fileNameSpan = document.createElement('span');
      fileNameSpan.className = 'file-item-name';
      fileNameSpan.textContent = file.name;

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'file-item-actions';

      const removeBtn = document.createElement('button');
      removeBtn.className = 'file-item-btn';
      removeBtn.innerHTML = '<i class="fas fa-times"></i>';
      removeBtn.onclick = () => fileItem.remove();

      actionsDiv.appendChild(removeBtn);
      fileItem.appendChild(fileNameSpan);
      fileItem.appendChild(actionsDiv);
      fileList.appendChild(fileItem);

      try {
        // Call the bank-specific PDF processor
        const processedText = await window.bankUtils.processPDFFile(file);
        if (inputText.value) {
          inputText.value += '\n\n' + processedText;
        } else {
          inputText.value = processedText;
        }
      } catch (error) {
        console.error('Error processing PDF:', error);
        // Error message handled by processPDFFile already
      }
    } else {
      console.warn(`File type not supported for direct processing: ${file.name}`);
      displayStatusMessage(`File type not supported for direct processing: ${file.name}`, 'error');
    }
  }
};

// File Upload and Drag/Drop Handling initialization (adapted from bmoAccount.js)
function setupFileUpload() {
  const dropArea = document.getElementById('dropArea');
  const fileInput = document.getElementById('pdfUpload');
  const fileList = document.getElementById('fileList');
  const inputText = document.getElementById('inputText');
  const clearAllFiles = document.getElementById('clearAllFiles');
  const fileListContainer = document.getElementById('fileListContainer');

  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop area when item is dragged over it
  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });

  // Handle dropped files - now calls window.bankUtils.handleFiles
  dropArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    window.bankUtils.handleFiles(files); // Call the bankUtils version
  }, false);

  // Handle file input changes - now calls window.bankUtils.handleFiles
  fileInput.addEventListener('change', (e) => {
    window.bankUtils.handleFiles(e.target.files); // Call the bankUtils version
  });

  // Clear all files
  clearAllFiles.addEventListener('click', () => {
    fileList.innerHTML = '';
    inputText.value = '';
    fileListContainer.style.display = 'none';
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlight() {
    dropArea.classList.add('highlight');
  }

  function unhighlight() {
    dropArea.classList.remove('highlight');
  }

  // Make file list sortable (retained from original bmoAccount.js)
  new Sortable(fileList, {
    animation: 150,
    handle: '.file-item-name',
    onEnd: () => {
      // This part might require more complex logic to re-process files
      // or to ensure the inputText accurately reflects the combined content
      // after reordering. For now, it's a placeholder as in the original.
    }
  });
}

// Re-adding this function as it was present in bmoAccount.js and used internally
function displayStatusMessage(message, type) {
  const statusMessageDiv = document.querySelector('.status-message');
  if (statusMessageDiv) {
    statusMessageDiv.textContent = message;
    statusMessageDiv.className = `status-message ${type}`;
    statusMessageDiv.style.display = 'block';
    setTimeout(() => {
        statusMessageDiv.style.display = 'none'; // Hide after a few seconds
    }, 5000); // Hide after 5 seconds
  } else {
    console.log(`Status (${type}): ${message}`);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  setupFileUpload();
});