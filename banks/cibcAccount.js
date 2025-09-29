// cibcAccount.js - Updated with improved PDF processing logic

// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// NEW PDF Parsing Function (from the HTML parser)
async function parsePDF(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        
        fileReader.onload = async function() {
            try {
                const typedarray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                const transactions = [];
                
                // Process each page
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    const textItems = textContent.items;
                    
                    // Extract transactions from this page
                    const pageTransactions = extractTransactions(textItems);
                    transactions.push(...pageTransactions);
                }
                
                // Format transactions for output
                const outputText = formatTransactionsForOutput(transactions);
                resolve(outputText);
            } catch (error) {
                reject(error);
            }
        };
        
        fileReader.onerror = function(error) {
            reject(error);
        };
        
        fileReader.readAsArrayBuffer(file);
    });
}

function extractTransactions(textItems) {
    const transactions = [];
    let currentDate = '';
    let currentTransactionLines = [];
    let inTransactionSection = false;
    
    // Group text items by line (based on y-position)
    const lines = [];
    let currentLine = {text: '', y: 0};
    
    textItems.forEach(item => {
        // If this item is on a new line (based on y-position)
        if (lines.length === 0 || Math.abs(item.transform[5] - currentLine.y) > 5) {
            if (currentLine.text.trim()) {
                lines.push({...currentLine});
            }
            currentLine = {text: item.str, y: item.transform[5]};
        } else {
            // Add space between words on the same line
            currentLine.text += ' ' + item.str;
        }
    });
    
    // Add the last line
    if (currentLine.text.trim()) {
        lines.push({...currentLine});
    }
    
    // Process lines to find transactions
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].text.trim();
        
        // Skip completely empty lines
        if (!line) continue;
        
        // Check if we're entering the transaction section
        if (line.includes('Transaction details') || line.match(/Date\s+Description/)) {
            inTransactionSection = true;
            continue;
        }
        
        // Check if we're leaving the transaction section (footer content)
        if (line.includes('Important:') || line.includes('Foreign Currency') || 
            line.includes('Trademark') || line.includes('Registered trademark')) {
            inTransactionSection = false;
            break; // Stop processing this page when we hit footer
        }
        
        if (!inTransactionSection) continue;
        
        // Check if this is a date line (e.g., "Jan 1")
        const dateMatch = line.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/);
        if (dateMatch) {
            // Process previous transaction if we have one
            if (currentDate && currentTransactionLines.length > 0) {
                const transaction = processTransactionLines(currentDate, currentTransactionLines);
                if (transaction) {
                    transactions.push(transaction);
                }
            }
            
            // Start new transaction
            currentDate = dateMatch[0];
            currentTransactionLines = [];
            
            // Add the rest of the line after the date
            const remainingText = line.substring(dateMatch[0].length).trim();
            if (remainingText && !isNoiseText(remainingText)) {
                currentTransactionLines.push(remainingText);
            }
        } 
        // Check if this is a transaction line with amounts (like CORRECTION)
        else if (isTransactionLine(line) && currentDate) {
            // Check if this line has amounts
            if (hasAmounts(line)) {
                // This line completes a transaction
                currentTransactionLines.push(line);
                const transaction = processTransactionLines(currentDate, currentTransactionLines);
                if (transaction) {
                    transactions.push(transaction);
                }
                currentTransactionLines = [];
            } else {
                // This is a continuation line
                currentTransactionLines.push(line);
            }
        }
        // Check if this is an amount line (just numbers)
        else if (isAmountLine(line) && currentDate) {
            // This might be an amount line for the current transaction
            currentTransactionLines.push(line);
            
            // Check if next line is also an amount line (balance)
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].text.trim();
                if (isAmountLine(nextLine)) {
                    currentTransactionLines.push(nextLine);
                    i++; // Skip the next line since we've processed it
                }
            }
            
            // Complete the transaction
            const transaction = processTransactionLines(currentDate, currentTransactionLines);
            if (transaction) {
                transactions.push(transaction);
            }
            currentTransactionLines = [];
        }
        // Regular transaction description line
        else if (currentDate && line && isTransactionLine(line)) {
            currentTransactionLines.push(line);
        }
    }
    
    // Process the last transaction if any
    if (currentDate && currentTransactionLines.length > 0) {
        const transaction = processTransactionLines(currentDate, currentTransactionLines);
        if (transaction) {
            transactions.push(transaction);
        }
    }
    
    return transactions;
}

function isTransactionLine(line) {
    // Lines that are definitely NOT transactions
    const notTransactionPatterns = [
        /CIBC Account Statement/i,
        /Account number/i,
        /Branch transit number/i,
        /Transaction details/i,
        /Opening balance/i,
        /Closing balance/i,
        /Account summary/i,
        /Contact information/i,
        /Important:/i,
        /Foreign Currency Conversion Fee/i,
        /Trademark/i,
        /Registered trademark/i,
        /Page \d+ of \d+/i,
        /Balance forward/i,
        /continued on next page/i,
        /^\d{5,}/, // Long numbers (like page numbers)
        /^[\d\s]*$/, // Only numbers and spaces
    ];
    
    return !notTransactionPatterns.some(pattern => pattern.test(line));
}

function hasAmounts(line) {
    return line.match(/[\d,]+\.\d{2}/) && 
           (line.match(/[\d,]+\.\d{2}\s+[\d,]+\.\d{2}$/) || 
            isTransactionType(line));
}

function isTransactionType(line) {
    const transactionTypes = [
        /CORRECTION/i,
        /DEPOSIT/i,
        /WITHDRAWAL/i,
        /CREDIT MEMO/i,
        /PRE-AUTH DEBIT/i,
        /E-TRANSFER/i,
        /PURCHASE/i,
        /ACC FEE/i
    ];
    
    return transactionTypes.some(pattern => pattern.test(line));
}

function isAmountLine(line) {
    return line.match(/^[\d,]+\.\d{2}$/);
}

function isNoiseText(line) {
    const noisePatterns = [
        /continued on next page/i,
        /^\d{5,}/,
        /^[\d\s]*$/,
    ];
    
    return noisePatterns.some(pattern => pattern.test(line));
}

function processTransactionLines(date, lines) {
    if (lines.length === 0) return null;
    
    // Filter out any noise lines that might have slipped through
    const cleanLines = lines.filter(line => !isNoiseText(line));
    if (cleanLines.length === 0) return null;
    
    let description = '';
    let amount = '';
    let balance = '';
    
    // The last line typically contains amounts
    const lastLine = cleanLines[cleanLines.length - 1];
    
    // Check if last line has both amount and balance
    const amountBalanceMatch = lastLine.match(/^([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/);
    if (amountBalanceMatch) {
        amount = amountBalanceMatch[1];
        balance = amountBalanceMatch[2];
        description = cleanLines.slice(0, -1).join('\n');
    } 
    // Check if last line is just a balance
    else if (lastLine.match(/^[\d,]+\.\d{2}$/)) {
        balance = lastLine;
        // Check if previous line is an amount
        if (cleanLines.length >= 2) {
            const prevLine = cleanLines[cleanLines.length - 2];
            if (prevLine.match(/^[\d,]+\.\d{2}$/)) {
                amount = prevLine;
                description = cleanLines.slice(0, -2).join('\n');
            } else {
                description = cleanLines.slice(0, -1).join('\n');
            }
        } else {
            description = cleanLines.slice(0, -1).join('\n');
        }
    }
    // Check for transaction types like CORRECTION that have amounts inline
    else if (hasAmounts(lastLine)) {
        // Extract amounts from the line
        const amounts = lastLine.match(/[\d,]+\.\d{2}/g);
        if (amounts && amounts.length >= 2) {
            amount = amounts[0];
            balance = amounts[1];
            description = cleanLines.slice(0, -1).join('\n') + '\n' + lastLine.replace(/[\d,]+\.\d{2}/g, '').trim();
        } else if (amounts && amounts.length === 1) {
            amount = amounts[0];
            description = cleanLines.slice(0, -1).join('\n') + '\n' + lastLine.replace(/[\d,]+\.\d{2}/, '').trim();
        } else {
            description = cleanLines.join('\n');
        }
    } else {
        description = cleanLines.join('\n');
    }
    
    // Clean up the description - remove any trailing noise
    description = description.trim();
    
    // Remove empty lines from description
    description = description.split('\n').filter(line => line.trim()).join('\n');
    
    return {
        date: date,
        description: description,
        amount: amount,
        balance: balance
    };
}

function formatTransactionsForOutput(transactions) {
    let outputText = '';
    
    transactions.forEach(transaction => {
        outputText += `${transaction.date} ${transaction.description}\n`;
        
        // Only add amount and balance if they exist and are not empty
        if (transaction.amount || transaction.balance) {
            if (transaction.amount && transaction.balance) {
                outputText += `${transaction.amount} ${transaction.balance}\n`;
            } else if (transaction.amount) {
                outputText += `${transaction.amount}\n`;
            } else if (transaction.balance) {
                outputText += `${transaction.balance}\n`;
            }
        }
        
        outputText += '\n'; // Separate transactions with a line break
    });
    
    return outputText || 'No transactions found.';
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

// PDF Processing Function (using the new parsing logic)
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

// Function to handle file uploads and display them
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

// File Upload and Drag/Drop Handling initialization
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

  // Make file list sortable
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