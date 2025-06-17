// scotiaAccount.js - Corrected and merged content with PDF processing and all original features retained

// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

// Main data processing function for text input (from original scotiaAccount.js)
function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  // Show the file list container if we have processed files
  const fileListContainer = document.getElementById('fileListContainer');
  if (input.length > 0) {
    fileListContainer.style.display = 'block';
  }

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];
  const table = document.createElement('table');

  // Copy buttons row (always render for consistency)
  const copyRow = document.createElement('tr');
  headers.forEach((_, index) => {
    const th = document.createElement('th');
    const div = document.createElement('div');
    div.className = 'copy-col';

    const btn = document.createElement('button');
    btn.textContent = `Copy`;
    btn.className = 'copy-btn';
    // Assumes copyColumn is available in window.bankUtils, as per main.js interaction
    btn.onclick = () => window.bankUtils.copyColumn(index);

    div.appendChild(btn);
    th.appendChild(div);
    copyRow.appendChild(th);
  });
  table.appendChild(copyRow);

  // Header row (always render for consistency)
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
  let buffer = [];
  let lastBalance = null;
  let isFirstTransaction = true; // Flag to track the very first transaction

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const full = buffer.join(' ');
    const dateMatch = full.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
    const allAmountMatches = [...full.matchAll(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g)];
    const amounts = allAmountMatches.map(m => m[0].replace(/,/g, ''));

    // --- START: Balance Line Handling ---
    const balanceKeywords = ['opening balance', 'balance forward', 'closing balance'];
    const isBalanceLine = balanceKeywords.some(keyword => full.toLowerCase().includes(keyword));

    if (isBalanceLine) {
      if (amounts.length > 0) {
          lastBalance = parseFloat(amounts[amounts.length - 1]);
      }
      buffer = [];
      isFirstTransaction = false; // A balance line indicates we're past the very first transaction inference
      return;
    }
    // --- END: Balance Line Handling ---

    if (!dateMatch || amounts.length < 2) {
      buffer = [];
      return;
    }

    let dateStr = dateMatch[1];
    let [month, day, year] = dateStr.split('/');

    if (yearInput) {
      year = yearInput;
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formattedMonth = monthNames[parseInt(month, 10) - 1];

    const formattedDate = `${formattedMonth} ${parseInt(day, 10)} ${year}`;

    const amount = parseFloat(amounts[amounts.length - 2]);
    const balance = parseFloat(amounts[amounts.length - 1]);

    let description = full;
    description = description.replace(allAmountMatches[allAmountMatches.length - 1][0], '');
    description = description.replace(allAmountMatches[allAmountMatches.length - 2][0], '');
    description = description.replace(dateMatch[0], '');

    description = description.replace(/\s+/g, ' ').trim();

    let debit = '', credit = '';
    if (lastBalance !== null) {
      const delta = +(balance - lastBalance).toFixed(2);
      // Determine if it's a debit or credit based on the change in balance relative to the transaction amount
      // We check if delta is close to amount (credit) or -amount (debit) to account for floating point inaccuracies
      if (Math.abs(delta - amount) < 0.01) { // Credit if balance increased by amount
          credit = amount.toFixed(2);
      } else if (Math.abs(delta + amount) < 0.01) { // Debit if balance decreased by amount
          debit = amount.toFixed(2);
      } else {
          // Fallback if balance change doesn't perfectly align, assume debit as default
          // This might need further refinement based on actual Scotiabank statement patterns
          debit = amount.toFixed(2);
      }
    } else {
        // If no prior balance is available (lastBalance is null) AND it's the very first transaction,
        // assume it's a debit as requested by the user.
        if (isFirstTransaction) {
            debit = Math.abs(amount).toFixed(2);
            isFirstTransaction = false; // After processing the first transaction, set to false
        } else {
            // For subsequent transactions where lastBalance might still be null (unexpected, but fallback)
            // or if it's not the absolute first, use original inference logic
            if (amount >= 0) {
                credit = amount.toFixed(2);
            } else {
                debit = Math.abs(amount).toFixed(2);
            }
        }
    }

    lastBalance = balance;

    const row = [formattedDate, description, debit, credit, balance.toFixed(2)];
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
    if (/^\d{2}\/\d{2}\/\d{4}/.test(line)) {
      flushBuffer();
      buffer.push(line);
    } else {
      buffer.push(line);
    }
  });

  flushBuffer();

  if (rows.length > 0) {
    outputDiv.appendChild(table);
    table.dataset.rows = JSON.stringify(rows); // Ensure rows are stored in dataset

    // Assuming updateTableCursor is available globally from main.js or other script
    if (typeof window.updateTableCursor === 'function') {
        window.updateTableCursor();
    }
    displayStatusMessage('Data processed successfully!', 'success');

  } else {
    displayStatusMessage('No data parsed. Please check the input format or ensure the correct bank is selected.', 'error');
  }
}

// Export processData globally (as main.js seems to call it directly)
window.processData = processData;

// PDF Processing Function (adapted from scotiaacc.html and integrated for scotiaAccount)
// This will be part of window.bankUtils
window.bankUtils.processPDFFile = async function(file) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async function(event) {
      const arrayBuffer = event.target.result;
      try {
        // pdfjsLib is expected to be loaded globally by index.html
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join('\n');
        }

        // --- Start of text processing logic from scotiaacc.html ---
        const lines = fullText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const processedTransactions = new Set();
        let currentTransactionLines = [];
        const transactionPattern = /(\d{2}\/\d{2}\/\d{4})\s*(.*?)\s*([\$]?[\d,]+\.\d{2})\s*([\$]?[\d,]+\.\d{2})/;
        let outputText = '';

        const attemptConsolidateAndDisplay = (textSegment) => {
            let cleanedSegment = textSegment.replace(/(\r\n|\n|\r)/gm, ' ').replace(/\s+/g, ' ').trim();
            const match = cleanedSegment.match(transactionPattern);

            if (match) {
                const date = match[1];
                const description = match[2].trim();
                const amount1 = match[3];
                const amount2 = match[4];
                const finalLine = `${date} ${description} ${amount1} ${amount2}`;
                if (!processedTransactions.has(finalLine)) {
                    processedTransactions.add(finalLine);
                    outputText += finalLine + '\n';
                }
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const isDateLine = /^\d{2}\/\d{2}\/\d{4}/.test(line);

            if (isDateLine && line.match(/[\d,]+\.\d{2}\s*[\d,]+\.\d{2}$/)) {
                const cleanedLine = line.replace(/\s+/g, ' ').trim();
                if (!processedTransactions.has(cleanedLine)) {
                    processedTransactions.add(cleanedLine);
                    outputText += cleanedLine + '\n';
                }
            } else if (isDateLine) {
                if (currentTransactionLines.length > 0) {
                    attemptConsolidateAndDisplay(currentTransactionLines.join(' '));
                }
                currentTransactionLines = [line];
            } else {
                currentTransactionLines.push(line);
            }
        }

        if (currentTransactionLines.length > 0) {
            attemptConsolidateAndDisplay(currentTransactionLines.join(' '));
        }
        // --- End of text processing logic from scotiaacc.html ---

        resolve(outputText.trim()); // Return the cleaned text
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

// Function to handle file uploads and display them (retained from original bmoAccount.js structure)
// This will be part of window.bankUtils
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
      removeBtn.innerHTML = '<i class="fas fa-times"></i>';
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

// File Upload and Drag/Drop Handling initialization (from original bmoAccount.js)
// This function still sets up the event listeners for the UI
function setupFileUpload() {
  const dropArea = document.getElementById('dropArea');
  const fileInput = document.getElementById('pdfUpload'); // Assuming an input with this ID
  const fileList = document.getElementById('fileList');
  const inputText = document.getElementById('inputText');
  const clearAllFiles = document.getElementById('clearAllFiles');
  const fileListContainer = document.getElementById('fileListContainer');

  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    if (dropArea) dropArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop area when item is dragged over it
  ['dragenter', 'dragover'].forEach(eventName => {
    if (dropArea) dropArea.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    if (dropArea) dropArea.addEventListener(eventName, unhighlight, false);
  });

  // Handle dropped files - now calls window.bankUtils.handleFiles
  if (dropArea) {
    dropArea.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      window.bankUtils.handleFiles(files);
    }, false);
  }

  // Handle file input changes - now calls window.bankUtils.handleFiles
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      window.bankUtils.handleFiles(e.target.files);
    });
  }

  // Clear all files
  if (clearAllFiles) {
    clearAllFiles.addEventListener('click', () => {
      if (fileList) fileList.innerHTML = '';
      if (inputText) inputText.value = '';
      if (fileListContainer) fileListContainer.style.display = 'none';
      displayStatusMessage('Cleared all files and input.', 'info');
    });
  }


  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlight() {
    if (dropArea) dropArea.classList.add('highlight');
  }

  function unhighlight() {
    if (dropArea) dropArea.classList.remove('highlight');
  }

  // Make file list sortable (retained from original bmoAccount.js)
  // This requires the Sortable.js library to be loaded in the HTML
  if (typeof Sortable !== 'undefined' && fileList) {
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  setupFileUpload();
});

// Re-adding this function as it was present in the original bmoAccount.js and used internally
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