// rbcCard.js - Merged content with PDF processing and original text processing features
// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

// Main data processing function for text input (from original rbcCard.js)
function processRBCCardData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').filter(Boolean);
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const table = document.createElement('table');
  const copyRow = document.createElement('tr');
  const headerRow = document.createElement('tr');
  const rows = [];

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

  let currentTransaction = null;
  let buffer = [];
  let currentAltDate = '';
  let altBuffer = [];
  let altBalance = '';

  function isValidMonthAbbreviation(month) {
    return ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].includes(month);
  }

  function flushBufferedAltFormat() {
    if (altBuffer.length === 0 || !currentAltDate) return;

    let temp = [];
    altBuffer.forEach(line => {
      temp.push(line);
      const amountMatch = line.match(/-?\$[\d,]+\.\d{2}/);
      if (amountMatch) {
        processBufferedTransaction(currentAltDate, temp, rows, altBalance);
        temp = [];
        altBalance = '';
      }
    });

    if (temp.length > 0) {
      processBufferedTransaction(currentAltDate, temp, rows, altBalance);
    }

    altBuffer = [];
    altBalance = '';
  }

  function flushBufferIfNeeded() {
    if (!currentTransaction || buffer.length === 0) return;

    processBufferedTransaction(currentTransaction.date, buffer, rows, '');
    buffer = [];
    currentTransaction = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const dateMatch = line.match(/^([A-Z]{3})\s+(\d{2})\s+([A-Z]{3})\s+(\d{2})/);
    if (dateMatch) {
      flushBufferIfNeeded();
      flushBufferedAltFormat(); // Flush alt format buffer when a new main format date is found

      const [_, m1, d1, m2, d2] = dateMatch;
      if (isValidMonthAbbreviation(m1) && isValidMonthAbbreviation(m2)) {
        const date1 = yearInput ? `${m1} ${d1} ${yearInput}` : `${m1} ${d1}`;
        const date2 = yearInput ? `${m2} ${d2} ${yearInput}` : `${m2} ${d2}`;
        const fullDate = `${date1} ${date2}`;

        currentTransaction = { date: fullDate };
        const rest = line.replace(dateMatch[0], '').trim();
        buffer = rest ? [rest] : [];
        continue;
      }
    }

    const altDateMatch = line.match(/^([A-Za-z]{3,})\s+(\d{1,2}),\s*(\d{4})(.*)/); // Added (.*) to capture the rest of the line
    if (altDateMatch) {
      flushBufferIfNeeded();
      flushBufferedAltFormat();
      currentAltDate = `${altDateMatch[1]} ${altDateMatch[2]} ${altDateMatch[3]}`;
      const restOfLine = altDateMatch[4].trim();

      const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
      const nextNextLine = lines[i + 2] ? lines[i + 2].trim() : '';
      const dollarMatch = nextLine.match(/^\$[\d,]+\.\d{2}$/);
      const hasNextDescription = nextNextLine && !nextNextLine.match(/^-?\$[\d,]+\.\d{2}$/);

      if (restOfLine) {
        // If there's content after the date on the same line, it's a single-line transaction
        altBuffer.push(restOfLine);
        flushBufferedAltFormat(); // Process immediately for single-line transactions
      } else if (dollarMatch && !hasNextDescription) {
        // Original multi-line alt format with balance on next line
        altBalance = nextLine.replace('$', '').replace(/,/g, '');
        i++; // skip balance line
      }
      continue;
    }

    if (currentAltDate) {
      altBuffer.push(line);
      continue;
    }

    buffer.push(line);
  }

  flushBufferIfNeeded();
  flushBufferedAltFormat();

  if (rows.length > 0) {
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

    // Assuming updateTableCursor is available globally from main.js or other script
    if (typeof window.updateTableCursor === 'function') {
        window.updateTableCursor();
    }
    displayStatusMessage('Data processed successfully!', 'success');

  } else {
    displayStatusMessage('No data parsed. Please check the input format or ensure the correct bank is selected.', 'error');
  }

  function processBufferedTransaction(date, lines, rows, balance) {
    const full = lines.join(' ');
    const amountMatches = [...full.matchAll(/-?\$[\d,]+\.\d{2}/g)];
    if (amountMatches.length === 0) return;

    const lastAmount = amountMatches[amountMatches.length - 1][0];
    const amount = lastAmount.replace('$', '').replace(/,/g, '');
    const description = full.replace(lastAmount, '').trim();

    let debit = '',
      credit = '',
      bal = balance || '';

    if (!description) {
      bal = amount;
    } else if (amount.startsWith('-')) {
      credit = amount.slice(1);
    } else {
      debit = amount;
    }

    rows.push([date, description, debit, credit, bal]);
  }
}

// Export processRBCCardData globally
window.processData = processRBCCardData;

// Initialize PDF.js worker (matching version in index.html)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';

// PDF Processing Functions (adapted from cardrbc.html)
window.bankUtils.parseRBCFormat = function(text) {
    const transactions = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // RBC transaction patterns - updated to handle negative amounts
    const datePattern = /^[A-Z][a-z]{2}\s\d{1,2},\s\d{4}$/;
    const amountPattern = /^-?\$?\d{1,3}(?:,\d{3})*\.\d{2}$/;

    let currentDate = '';
    let collectingTransactions = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Look for transaction section start
        if (line.includes('Posted Transactions') ||
            (line.includes('Date') && lines[i+1] && lines[i+1].includes('Debit') && lines[i+2] && lines[i+2].includes('Credit'))) {
            collectingTransactions = true;
            i += 2; // Skip header lines
            continue;
        }

        if (!collectingTransactions) continue;

        // Check if current line is a date
        if (datePattern.test(line)) {
            currentDate = line;
        }
        // Check if line contains an amount (could be standalone transaction)
        else if (amountPattern.test(line.replace('$-', '-$')) && currentDate) {
            // This is probably an amount for previous description
            const amount = line.includes('$-') ? line.replace('$-', '-$') : line;
            const description = transactions.length > 0 && transactions[transactions.length-1].date === currentDate &&
                                !amountPattern.test(transactions[transactions.length-1].description) ?
                                transactions.pop().description : 'Unknown';
            transactions.push({
                date: currentDate,
                description: description,
                amount: amount
            });
        }
        // Check if line might be a description (next line is amount)
        else if (i + 1 < lines.length && amountPattern.test(lines[i + 1].replace('$-', '-$')) && currentDate) {
            const description = line;
            const amount = lines[i + 1].includes('$-') ? lines[i + 1].replace('$-', '-$') : lines[i + 1];
            transactions.push({
                date: currentDate,
                description: description,
                amount: amount
            });
            i++; // Skip amount line
        }
    }

    // Format the transactions
    return transactions.map(t => `${t.date} ${t.description} ${t.amount}`).join('\n');
};

window.bankUtils.parseVisaFormat = function(text) {
    const transactions = [];
    // Updated regex to correctly capture description and amount.
    // Group 1: Posting Date (e.g., "JAN 19")
    // Group 2: Transaction Date (e.g., "JAN 19")
    // Group 3: Activity Description (non-greedy, captures everything until optional ID or final amount)
    // Group 4 (optional capturing group for ID): The transaction ID (e.g., "74510204085619986268200")
    // Group 5: Amount (e.g., "$254.10", "-$500.00")
    const transactionRegex = /^([A-Z]{3}\s\d{2})\s+([A-Z]{3}\s\d{2})\s+(.*?)(?:\s+(\d{21,23}))?\s*(-?\$?\d{1,3}(?:,\d{3})*\.\d{2})$/gm;

    let match;
    while ((match = transactionRegex.exec(text)) !== null) {
        const postingDate = match[1];
        const transactionDate = match[2];
        let description = match[3].trim(); // Group 3 is the description
        const id = match[4]; // Group 4 is the optional ID, will be undefined if not present
        let amount = match[5]; // Group 5 is the amount

        // Append the ID to the description if it was found
        if (id) {
            description += ` ${id}`;
        }

        // Fix negative amounts that appear as "$-123.45" to "-$123.45"
        if (amount.includes('$-')) {
            amount = amount.replace('$-', '-$');
        }

        transactions.push(`${postingDate} ${transactionDate} ${description} ${amount}`);
    }

    return transactions.join('\n');
};

window.bankUtils.parseAlternativeFormat = function(text) {
    const transactions = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    const datePattern = /^[A-Z][a-z]{2}\s\d{1,2},\s\d{4}$/;
    const amountPattern = /^(-?\$?\d{1,3}(?:,\d{3})*\.\d{2}|CASH BACK REWARD)/;

    let currentDate = '';
    let collectingTransactions = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes('Posted Transactions') ||
            (line.match(/Date/) && lines[i+1] && lines[i+1].match(/Debit/) && lines[i+2] && lines[i+2].match(/Credit/))) {
            collectingTransactions = true;
            continue;
        }

        if (!collectingTransactions) continue;

        if (datePattern.test(line)) {
            currentDate = line;
            continue;
        }

        if (amountPattern.test(line) && currentDate) {
            // Look back for description
            let description = 'Unknown';
            if (i > 0 && !amountPattern.test(lines[i-1]) && !datePattern.test(lines[i-1])) {
                description = lines[i-1];
            }

            // Fix negative amounts if needed
            let amount = line;
            if (amount.includes('$-')) {
                amount = amount.replace('$-', '-$');
            }

            // Handle cash back rewards
            if (line === 'CASH BACK REWARD' && i+1 < lines.length && amountPattern.test(lines[i+1])) {
                amount = lines[i+1];
                if (amount.includes('$-')) {
                    amount = amount.replace('$-', '-$');
                }
                transactions.push(`${currentDate} ${line} ${amount}`);
                i++; // Skip amount line
            } else {
                transactions.push(`${currentDate} ${description} ${amount}`);
            }
        }
    }

    return transactions.join('\n');
};


window.bankUtils.processPDFFile = async function(file) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async function(event) {
      const arrayBuffer = event.target.result;
      try {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          // It's crucial to join items with a space or newline to preserve readability for regex
          const pageText = textContent.items.map(item => item.str).join('\n');
          fullText += pageText + '\n';
        }

        // Try RBC format parsing first
        let extractedText = window.bankUtils.parseRBCFormat(fullText);

        // If no RBC transactions found, try Alternative format
        if (!extractedText || extractedText.trim().length === 0) {
            extractedText = window.bankUtils.parseAlternativeFormat(fullText);
        }

        // Try Visa format if still no transactions
        if (!extractedText || extractedText.trim().length === 0) {
            extractedText = window.bankUtils.parseVisaFormat(fullText);
        }

        if (extractedText && extractedText.trim().length > 0) {
            resolve(extractedText);
        } else {
            displayStatusMessage("No recognizable transactions found in PDF.", 'error');
            reject(new Error("No recognizable transactions found in PDF."));
        }

      } catch (error) {
        console.error("Error parsing PDF:", error);
        displayStatusMessage("Failed to parse PDF file. " + error.message, 'error');
        reject(new Error("Failed to parse PDF file. " + error.message));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

// Function to handle file uploads and display them (retained from bmoAccount.js)
window.bankUtils.handleFiles = async function(files) {
  const fileList = document.getElementById('fileList');
  const inputText = document.getElementById('inputText');
  const fileListContainer = document.getElementById('fileListContainer');

  fileListContainer.style.display = 'block';

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
      removeBtn.innerHTML = '<i class="fas fa-times"></i>'; // FontAwesome icon
      removeBtn.onclick = () => fileItem.remove();

      actionsDiv.appendChild(removeBtn);
      fileItem.appendChild(fileNameSpan);
      fileItem.appendChild(actionsDiv);
      fileList.appendChild(fileItem);

      try {
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
}

// File Upload and Drag/Drop Handling initialization (from bmoAccount.js)
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
    window.bankUtils.handleFiles(files);
  }, false);

  // Handle file input changes - now calls window.bankUtils.handleFiles
  fileInput.addEventListener('change', (e) => {
    window.bankUtils.handleFiles(e.target.files);
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

  // Make file list sortable (requires Sortable.js, which is assumed to be loaded elsewhere in the project)
  // if (typeof Sortable !== 'undefined') {
  //   new Sortable(fileList, {
  //     animation: 150,
  //     handle: '.file-item-name',
  //     onEnd: () => {
  //       // This part might require more complex logic to re-process files
  //       // or to ensure the inputText accurately reflects the combined content
  //       // after reordering. For now, it's a placeholder as in the original.
  //     }
  //   });
  // }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  setupFileUpload();
});

// Re-adding this function as it was present in bmoAccount.js and used internally
function displayStatusMessage(message, type) {
  const statusMessageDiv = document.querySelector('.status-message');
  if (statusMessageDiv) {
    statusMessageDiv.textContent = message;
    statusMessageDiv.className = `status-message ${type}`;
    statusMessageDiv.style.display = 'block';
    setTimeout(() => {
        statusMessageDiv.style.display = 'none';
    }, 5000);
  } else {
    console.log(`Status (${type}): ${message}`);
  }
}
