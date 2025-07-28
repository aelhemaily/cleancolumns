// bmoAccount.js - Corrected and merged content with PDF processing and all original features retained

// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

// Main data processing function for text input (from original bmoAccount.js)
function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').filter(l => l.trim());
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  // Show the file list container if we have processed files
  const fileListContainer = document.getElementById('fileListContainer');
  if (lines.length > 0) {
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
  headers.forEach(headerText => {
    const th = document.createElement('th');
    th.textContent = headerText;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  let currentYear = new Date().getFullYear(); // Default to current year

  if (yearInput) {
    currentYear = parseInt(yearInput);
    if (isNaN(currentYear)) {
      displayStatusMessage('Invalid Year Input. Please enter a valid year (e.g., 2023).', 'error');
      return;
    }
  }

  // Date pattern safeguard for processData
  const isNewTransaction = (line) => {
    const datePattern = /^[A-Za-z]{3} \d{1,2}(?!\d)/;
    const validMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const match = line.match(datePattern);
    if (!match) return false;
    const [month, day] = match[0].split(' ');
    return validMonths.includes(month) && parseInt(day) >= 1 && parseInt(day) <= 31;
  };

  // Merge lines into full transactions (from original bmoAccount.js)
  const transactions = [];
  let current = '';
  lines.forEach(line => {
    // Check for "Opening balance" or "Closing totals" to ensure they are treated as new lines if they start a new logical entry
    if (isNewTransaction(line) || /opening balance|closing totals/i.test(line.trim())) {
      if (current) transactions.push(current.trim());
      current = line;
    } else {
      current += ' ' + line;
    }
  });
  if (current) transactions.push(current.trim());

  let previousBalance = null;

  transactions.forEach(line => {
    const dateMatch = line.match(/^[A-Za-z]{3} \d{1,2}/);
    let date = dateMatch ? dateMatch[0] : '';
    // Append year if provided and date format is Month Day
    if (yearInput && /^[A-Za-z]{3} \d{1,2}$/.test(date)) {
      date += ` ${currentYear}`; // Corrected to use currentYear
    }

    // Get the part of the line after the date
    const contentAfterDate = line.replace(dateMatch ? dateMatch[0] : '', '').trim();

    // Regex to find all amount-like numbers
    const amountPattern = /-?\d{1,3}(?:,\d{3})*\.\d{2}/g;
    const allAmountMatches = [...contentAfterDate.matchAll(amountPattern)];

    let desc = '';
    let amount = '';
    let balance = '';
    let debit = '';
    let credit = '';

    if (allAmountMatches.length >= 2) {
      // The last two matches are typically the transaction amount and the balance
      const balanceMatch = allAmountMatches[allAmountMatches.length - 1];
      const transactionAmountMatch = allAmountMatches[allAmountMatches.length - 2];

      balance = parseFloat(balanceMatch[0].replace(/,/g, ''));
      amount = parseFloat(transactionAmountMatch[0].replace(/,/g, ''));

      // The description is the part of the string before the second-to-last amount match
      desc = contentAfterDate.substring(0, transactionAmountMatch.index).trim();

    } else if (allAmountMatches.length === 1) {
      // This case handles lines with only a balance (e.g., "Opening Balance")
      balance = parseFloat(allAmountMatches[0][0].replace(/,/g, ''));
      desc = contentAfterDate.substring(0, allAmountMatches[0].index).trim();

      // MODIFIED LOGIC: If it's an opening balance, set previousBalance but DO NOT add to table
      if (/opening balance/i.test(desc)) {
        previousBalance = balance;
        // Do NOT return here, instead continue to add this row to the `rows` array
        // However, the user explicitly asked to NOT bring it into the table.
        // So, we will set previousBalance and then skip adding it to `rows`.
        return; // Skip adding this row to the output table
      } else if (/closing totals/i.test(desc)) {
        previousBalance = balance; // Still update previous balance for closing totals
        return; // Skip these rows from the output table
      }
    } else {
      // No amounts found, skip this line as it's not a valid transaction for our table
      return;
    }

    // Determine debit/credit based on balance change
    if (previousBalance !== null) {
      const delta = +(balance - previousBalance).toFixed(2);
      if (Math.abs(delta - amount) < 0.01) {
        credit = amount.toFixed(2);
      } else if (Math.abs(delta + amount) < 0.01) {
        debit = amount.toFixed(2);
      } else {
        // If delta doesn't match +/- amount, assume it's a debit for consistency
        debit = amount.toFixed(2);
      }
    } else {
      // If no previous balance, assume the first transaction amount is a debit
      // This logic will now apply to the first *actual transaction* after an opening balance
      debit = amount.toFixed(2);
    }

    const row = [date, desc, debit, credit, balance.toFixed(2)];
    rows.push(row);
    previousBalance = balance;
  });

  if (rows.length > 0) {
    rows.forEach(rowData => {
      const tr = document.createElement('tr');
      rowData.forEach(cellData => {
        const td = document.createElement('td');
        td.textContent = cellData;
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

  } else {
    displayStatusMessage('No data parsed. Please check the input format or ensure the correct bank is selected.', 'error');
  }
}

// Export processData globally (as main.js seems to call it directly)
window.processData = processData;

// PDF Processing Function (adapted from workingparser.html and integrated for bmoAccount)
// This will be part of window.bankUtils
window.bankUtils.processPDFFile = async function(file) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async function(event) {
      const arrayBuffer = event.target.result;
      try {
        // pdfjsLib is expected to be loaded globally by index.html
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let allLines = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str.trim()).filter(Boolean);
          allLines.push(...pageText);
        }

        // Find the specific starting point: "Mar 01" followed by "Opening balance"
        let contentStartLineIndex = -1;
        for (let i = 0; i < allLines.length; i++) {
            // Look for "Mar 01" and then check the next line for "Opening balance"
            // This assumes "Mar 01" and "Opening balance" are on consecutive lines.
            if (allLines[i].includes("Mar 01") && (i + 1 < allLines.length && allLines[i+1].includes("Opening balance"))) {
                contentStartLineIndex = i;
                break;
            }
        }

        if (contentStartLineIndex !== -1) {
            // Slice the array to start from "Mar 01" line
            allLines = allLines.slice(contentStartLineIndex);
        } else {
            // Fallback: If the specific "Mar 01 Opening balance" isn't found,
            // try to find the first line that starts with a month and day (a date)
            let firstDateLineIndex = allLines.findIndex(line => /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{1,2}/i.test(line));
            if (firstDateLineIndex !== -1) {
                allLines = allLines.slice(firstDateLineIndex);
            }
            // If no date found, allLines remains as is. This might include more junk, but ensures no data is lost.
        }

        const transactionLines = [];
        const dateRegex = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{1,2}/i;
        const skipPatterns = [
          /Page \d+ of \d+/i, // Page numbers
          /Closing totals/i, // Summary line, should not be in the input box
          /Transaction details \(continued\)/i, // Continuation header
          /Date Description/i, // Column headers that might repeat on new pages
          /Amounts debited/i,
          /Amounts credited/i,
          /Balance \(\$\)/i,
          /from your account \(\$\)/i,
          /to your account \(\$\)/i,
          /Business Account # \d{4} \d{4}-\d{3}/i, // Account number that might repeat
          /\(continued\)/i, // General continuation text
          // New patterns to filter out unwanted summary blocks and headers
          /^\s*Business Account\s*$/i, // "Business Account" standalone
          /^\s*# \d{4} \d{4}-\d{3}\s*$/i, // Account number standalone
          /^\s*\d{1,3}(?:,\d{3})*\.\d{2}\s*\d{1,3}(?:,\d{3})*\.\d{2}\s*\d{1,3}(?:,\d{3})*\.\d{2}/, // Lines with multiple amounts, typical of summary
          /^\s*Account Type:/i, // "Account Type:" line
          /^\s*Business name:/i, // "Business name:" line
          /^\s*Transaction details\s*$/i, // The "Transaction details" header itself
          /^\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\s*$/i, // Dates like "Jun 30, 2023" as standalone lines
          /^\s*Business Banking statement/i,
          /^\s*For the period ending/i,
          /^\s*Summary of account/i,
          /^\s*Your Branch/i,
          /^\s*Transit number:/i,
          /^\s*For questions about your/i,
          /^\s*Direct Banking/i,
          /^\s*www\.bmo\.com/i,
          /^\s*Your Plan/i,
          /^\s*eBusiness Plan/i,
          /^\s*Opening\s*Total\s*amounts/i, // Header for summary table
          /^\s*balance \(\$\)\s*debited \(\$\)/i, // Header for summary table
          /^\s*Account\s*balance \(\$\)/i, // Header for summary table
          /^\s*When in doubt, don't click!/i, // Security message
          /^\s*clicking links found in suspicious/i, // Security message
          /^\s*View our phishing/i, // Security message
          /^\s*videos by visiting/i // Security message
        ];


        for (let i = 0; i < allLines.length; i++) {
          const line = allLines[i];

          // Skip lines that are part of the general header/footer or summary
          if (skipPatterns.some(pattern => pattern.test(line))) {
            continue;
          }

          // If it's a new transaction line (starts with a date)
          if (dateRegex.test(line)) {
            let combinedLine = line;
            let j = i + 1;
            // Continue combining lines until a new date, a skip pattern, or end of lines is found
            while (j < allLines.length && !dateRegex.test(allLines[j]) && !skipPatterns.some(p => p.test(allLines[j]))) {
              combinedLine += '\n' + allLines[j];
              j++;
            }
            transactionLines.push(combinedLine);
            i = j - 1; // Adjust i to the last line processed in this transaction
          }
        }
        resolve(transactionLines.join('\n\n'));
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

// Function to handle file uploads and display them (retained from original bmoAccount.js)
// This will be part of window.bankUtils
window.bankUtils.handleFiles = async function(files) {
  const fileList = document.getElementById('fileList');
  const inputText = document.getElementById('inputText');
  const fileListContainer = document.getElementById('fileListContainer'); // Ensure it's accessed

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
        // Call the bank-specific PDF processor defined above
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
      // Handle non-PDF files if necessary, or show an error
      console.warn(`File type not supported for direct processing: ${file.name}`);
      displayStatusMessage(`File type not supported for direct processing: ${file.name}`, 'error');
    }
  }
}

// File Upload and Drag/Drop Handling initialization (from original bmoAccount.js)
// This function still sets up the event listeners for the UI
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
