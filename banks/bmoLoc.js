// bmoLoc.js - Merged and restructured with PDF parsing capabilities,
//             and corrected to remove the leading transaction number and trailing summary from PDF extraction,
//             by closely mirroring loc.html's extraction method.

// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

// Set PDF.js worker path - IMPORTANT: This must be accessible
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';

// Main data processing function for text input
function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  // Remove existing warning if any
  let warning = document.getElementById('parseWarning');
  if (warning) {
    warning.remove();
  }

  // Show the file list container if we have processed files
  const fileListContainer = document.getElementById('fileListContainer');
  if (input.length > 0) { // Check if inputText has content
    fileListContainer.style.display = 'block';
  }

  const transactions = parseBmoLocStatement(input, yearInput);
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
    btn.textContent = `Copy`;
    btn.className = 'copy-btn';
    btn.onclick = () => window.bankUtils.copyColumn(index); // Assuming copyColumn exists in bankUtils
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

  if (transactions.length > 0) {
    transactions.forEach(tx => {
      const {
        startDate,
        endDate,
        description,
        amount,
        type
      } = tx;
      let debit = '',
        credit = '';

      if (type === 'credit') {
        credit = amount.toFixed(2);
      } else if (type === 'debit') {
        debit = amount.toFixed(2);
      }

      // Format the date column to include both dates, with year if provided
      const dateColumn = startDate + (endDate ? ' ' + endDate : '');
      const row = [dateColumn, description, debit, credit, '']; // Balance is not directly extracted by the LOC parser
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

    // Ensure toolbar and save state are updated after processing
    document.getElementById('toolbar').classList.add('show');
    if (typeof window.bankUtils.setupCellSelection === 'function') {
      window.bankUtils.setupCellSelection(table);
    }
    if (typeof window.bankUtils.setupTableContextMenu === 'function') {
      window.bankUtils.setupTableContextMenu(table);
    }
    if (typeof window.bankUtils.setupCellDragAndDrop === 'function') {
      window.bankUtils.setupCellDragAndDrop(table);
    }
    if (typeof window.bankUtils.setupColumnResizing === 'function') {
      window.bankUtils.setupColumnResizing(table);
    }
    if (typeof saveState === 'function') {
      saveState();
    }
    displayStatusMessage('Data processed successfully!', 'success');
  } else {
    displayStatusMessage('No transactions found. Please check the input format or uploaded files.', 'error');
  }
}

function parseBmoLocStatement(inputText, yearInput) {
  const lines = inputText.split('\n').map(l => l.trim()).filter(Boolean);
  const transactions = [];
  const buffer = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const fullLine = buffer.join(' ');
    // Expects two date patterns, then the rest of the description/amount.
    // No leading transaction number here.
    const linePattern = /^([A-Za-z]{3,4}\.?\s*\d{1,2})\s+([A-Za-z]{3,4}\.?\s*\d{1,2})\s+(.+)$/;
    const match = fullLine.match(linePattern);

    if (!match) {
      buffer.length = 0;
      return;
    }

    let [, startDateRaw, endDateRaw, rest] = match;

    // Normalize dates: append year only if yearInput is provided
    function normalizeDate(dateStr) {
      dateStr = dateStr.replace('.', ''); // Remove period if present
      return yearInput ? `${dateStr} ${yearInput}` : dateStr;
    }

    const startDate = normalizeDate(startDateRaw);
    const endDate = normalizeDate(endDateRaw);

    // Amount pattern at the end of the 'rest' string, optionally followed by 'CR'
    let amountMatch = rest.match(/([\d,]+\.\d{2})(CR)?$/i);
    if (!amountMatch) {
      buffer.length = 0;
      return;
    }

    let amountStr = amountMatch[1].replace(/,/g, '');
    let amount = parseFloat(amountStr);
    let isCredit = !!amountMatch[2];

    // Description is everything before the matched amount part
    let description = rest.slice(0, rest.length - amountMatch[0].length).trim();

    transactions.push({
      startDate,
      endDate,
      description,
      amount,
      type: isCredit ? 'credit' : 'debit'
    });

    buffer.length = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // This regex checks if a line starts with a month and day, then another month and day.
    // It NO LONGER expects a number at the very beginning.
    if (/^[A-Za-z]{3,4}\.?\s*\d{1,2}\s+[A-Za-z]{3,4}\.?\s*\d{1,2}/.test(line)) {
      flushBuffer(); // Flush previous transaction if any
      buffer.push(line); // Start new buffer with this line
    } else {
      // If it's not a new transaction line, it's part of the current transaction's description
      buffer.push(line);
    }
  }

  flushBuffer(); // Final flush to process any remaining data in the buffer
  return transactions;
}

// Export the processData function globally for the main script to use
window.processData = processData;

// Helper function to extract transactions from a single page's text content
// This function directly mirrors loc.html's extractTransactions logic,
// but formats the output as strings suitable for parseBmoLocStatement.
function _extractTransactionsFromPage(pageText) {
    const extractedLines = [];
    // This regex looks for: number transactionDate postingDate description amount(CR optional)
    // This is directly from loc.html. It captures the leading number, but we explicitly
    // exclude it when constructing the formattedLine.
    const transactionRegex = /(\d+)\s+(\w{3}\s*\.\s*\d{1,2})\s+(\w{3}\s*\.\s*\d{1,2})\s+(.*?)\s+(\d[\d,]*\.\d{2})(\s*CR)?(?=\s|$)/g;

    let match;
    while ((match = transactionRegex.exec(pageText)) !== null) {
        // match[0] is the full match, match[1] is num, match[2] is transDate, match[3] is postDate, etc.
        const [_, num, transDate, postDate, description, amount, isCredit] = match;

        // Clean up dates and description as done in loc.html
        const cleanTransDate = transDate.replace(/\s*\.\s*/g, '. ').trim();
        const cleanPostDate = postDate.replace(/\s*\.\s*/g, '. ').trim();
        let cleanDescription = description.replace(/\s+/g, ' ').trim();

        // Construct the line in the format expected by parseBmoLocStatement:
        // "START_DATE END_DATE DESCRIPTION AMOUNT[CR]" (without the leading transaction number)
        const formattedLine = `${cleanTransDate} ${cleanPostDate} ${cleanDescription} ${amount}${isCredit ? 'CR' : ''}`;
        extractedLines.push(formattedLine);
    }
    return extractedLines;
}

// PDF Processing Function (refactored to process page by page, like loc.html)
window.bankUtils.processPDFFile = async function(file) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async function(event) {
      const arrayBuffer = event.target.result;
      try {
        const pdf = await pdfjsLib.getDocument({
          data: arrayBuffer
        }).promise;
        let allFormattedTransactions = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          // Join items with a space for the current page
          const pageText = textContent.items.map(item => item.str).join(' ');
          
          // Extract transactions from this single page's text
          const transactionsFromPage = _extractTransactionsFromPage(pageText);
          allFormattedTransactions = allFormattedTransactions.concat(transactionsFromPage);
        }
        
        // Resolve with the combined, newline-separated formatted transaction lines
        resolve(allFormattedTransactions.join('\n'));

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


// Function to handle file uploads and display them
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
      removeBtn.innerHTML = '<i class="fas fa-times"></i>'; // Assuming Font Awesome is used
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

// File Upload and Drag/Drop Handling initialization
function setupFileUpload() {
  const dropArea = document.getElementById('dropArea');
  const fileInput = document.getElementById('pdfUpload'); // Ensure this ID matches your HTML input
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

  // Make file list sortable (requires Sortable.js)
  // Ensure Sortable.js is loaded in your HTML, if this functionality is desired
  if (typeof Sortable !== 'undefined') {
    new Sortable(fileList, {
      animation: 150,
      handle: '.file-item-name',
      onEnd: () => {
        // Re-evaluate or re-process inputText if order matters after sorting
        // This might be complex depending on how inputText is generated from multiple files
      }
    });
  }
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