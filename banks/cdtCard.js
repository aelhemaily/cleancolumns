let keywords = { debit: [], credit: [] };

// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

// Load keywords.json (assuming it's in the same directory as the HTML file)
fetch('keywords.json')
  .then(response => response.json())
  .then(data => {
    keywords = {
      debit: data.debit.map(k => k.toLowerCase()),
      credit: data.credit.map(k => k.toLowerCase())
    };
  })
  .catch(error => console.error('Failed to load keywords:', error));

// Helper to parse a date string (e.g., "Jul 01") into a Date object for sorting
function parseDateForSorting(dateStr, year) {
  const [mon, day] = dateStr.split(' ');
  const monthNames = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };
  const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();
  return new Date(currentYear, monthNames[mon], parseInt(day, 10));
}

function parseLines(text, yearInput, isPayment = false) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const transactions = [];
  let currentTransactionLines = [];

  // Regex to find ANY date pattern within a line (e.g., "Dec 14")
  const datePatternFinder = /[A-Za-z]{3}\s+\d{1,2}/;
  // Regex to find ANY amount pattern within a line, now explicitly handling spaces or commas as thousands separators
  const amountPatternFinder = /(-?\s*\d{1,3}(?:[,\s]\d{3})*\.\d{2}(?:\s*USD)?)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];

    const isCurrentLineDate = datePatternFinder.test(line);
    const isCurrentLineAmount = amountPatternFinder.test(line);

    // If the buffer is empty, we must start a new transaction with a date line.
    if (currentTransactionLines.length === 0) {
      if (isCurrentLineDate) {
        currentTransactionLines.push(line);
      } else {
        // Skip lines until a date is found to start a transaction.
        continue;
      }
    } else {
      // Add the current line to the buffer.
      currentTransactionLines.push(line);
    }

    // Determine if the current transaction buffer is complete.
    // A transaction is considered complete if the current line contains an amount,
    // AND (the next line starts with a date, OR it's the last line of the input).
    const nextLineIsDate = nextLine && datePatternFinder.test(nextLine);
    const isLastLine = (i === lines.length - 1);

    if (isCurrentLineAmount && (nextLineIsDate || isLastLine)) {
      // Process the buffered lines as a single transaction.
      processBufferedTransaction(currentTransactionLines.join('\n'), yearInput, isPayment, transactions);
      currentTransactionLines = []; // Reset buffer for the next transaction.
    }
  }

  // After the loop, if there's any remaining content in the buffer, process it.
  // This handles cases where the last transaction doesn't end with an amount on the very last line.
  if (currentTransactionLines.length > 0) {
    processBufferedTransaction(currentTransactionLines.join('\n'), yearInput, isPayment, transactions);
  }

  return transactions;
}

// Helper function to process a single buffered transaction string
function processBufferedTransaction(fullText, yearInput, isPayment, transactionsArray) {
  // General regex to find all date patterns in the text
  const datePatternRegex = /([A-Za-z]{3}\s+\d{1,2})/g;
  // Regex to find all amount patterns in the text, handling spaces or commas
  const amountRegex = /(-?\s*\d{1,3}(?:[,\s]\d{3})*\.\d{2}(?:\s*USD)?)/g;

  // Find all matches for dates and amounts
  const allDateMatches = [...fullText.matchAll(datePatternRegex)];
  const allAmountMatches = [...fullText.matchAll(amountRegex)];

  // If no dates or no amounts are found, it's not a valid transaction, so return.
  if (allDateMatches.length === 0 || allAmountMatches.length === 0) {
    return;
  }

  // Extract the first date part (always present if we reached here)
  let date1Part = allDateMatches[0][1];
  // Extract the second date part if it exists
  let date2Part = allDateMatches.length > 1 ? allDateMatches[1][1] : undefined;

  // Store the first date for primary sorting purposes
  const sortDate = parseDateForSorting(date1Part, yearInput);
  // Store the second date for secondary sorting purposes (if available)
  const sortDate2 = date2Part ? parseDateForSorting(date2Part, yearInput) : null;

  // Construct the displayDate string, combining both dates if the second one exists
  let displayDate = date1Part;
  if (date2Part) {
    displayDate += ` ${date2Part}`;
  }

  // If a year input is provided, append it to the appropriate date parts for display
  if (yearInput) {
    const yearSuffix = ` ${yearInput}`;
    if (date2Part) {
      // If both dates are present, append year to each for display
      displayDate = `${date1Part}${yearSuffix} ${date2Part}${yearSuffix}`;
    } else {
      // If only one date, append year to it for display
      displayDate = `${date1Part}${yearSuffix}`;
    }
  }

  // Determine the actual transaction amount, which is the LAST numeric value in the string
  const rawAmountString = allAmountMatches[allAmountMatches.length - 1][0];
  // Normalize the amount string by removing all spaces and then parsing
  const amount = parseFloat(rawAmountString.replace(/\s/g, '').replace(/,/g, ''));

  // Extract the description: everything before the last amount, after removing date parts and optional leading numbers.
  let description = fullText;
  const lastAmountIndex = fullText.lastIndexOf(rawAmountString);
  if (lastAmountIndex !== -1) {
    description = fullText.substring(0, lastAmountIndex).trim();
  }

  // Remove all identified date parts from the description.
  let datesToRemove = [date1Part];
  if (date2Part) {
    datesToRemove.push(date2Part);
  }

  datesToRemove.forEach(datePart => {
    // Escape special characters in the date string for use in a regular expression.
    const escapedDatePart = datePart.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // Remove the date part, optionally preceded by a number and space, from the description.
    // Use 'g' flag for global replacement if a date might appear multiple times (though unlikely for these formats).
    description = description.replace(new RegExp(`(?:\\d+\\s+)?${escapedDatePart}`, 'gi'), '').trim();
  });

  // Normalize multiple spaces to single spaces and trim.
  description = description.replace(/\s+/g, ' ').trim();

  let debit = '';
  let credit = '';

  // Determine if the amount is a debit or credit based on its value and keywords.
  // Use toLocaleString for consistent number formatting with commas.
  const formattedAmount = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Apply the rule: Positive numbers are Debit, Negative numbers are Credit.
  if (amount < 0) { // If the amount is negative, it's a credit
    credit = formattedAmount;
  } else { // If the amount is positive (or zero), it's a debit
    debit = formattedAmount;
  }

  // Add the processed transaction to the array, including sortDate2 for secondary sorting.
  transactionsArray.push({
    sortDate: sortDate,
    sortDate2: sortDate2, // Include the second date for secondary sorting
    row: [displayDate, description, debit, credit, '']
  });
}

// PDF Processing Function (adapted from cdtparser.html)
window.bankUtils.processPDFFile = async function(file) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = async function() {
      try {
        const typedArray = new Uint8Array(this.result);
        // pdfjsLib is expected to be loaded globally by index.html or similar
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        let transactions = [];

        // Process each page
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const text = textContent.items.map(item => item.str).join(' ');

          // Check if this is format 2 (has reference numbers)
          const isFormat2 = text.includes('Ref. Trans. Post');

          if (isFormat2) {
            transactions = transactions.concat(parseFormat2(textContent.items));
          } else {
            transactions = transactions.concat(parseFormat1(text));
          }
        }
        resolve(transactions.join('\n')); // Join transactions for inputText
      } catch (error) {
        displayStatusMessage("Failed to parse PDF file: " + error.message, 'error');
        reject(error);
      }
    };

    fileReader.onerror = reject;
    fileReader.readAsArrayBuffer(file);
  });
};

function parseFormat1(text) {
  const transactions = [];

  // Regex to find the start of the section to be banned
  // It looks for "QUANTITY" followed by optional whitespace, then "DETAILS"
  const bannedSectionHeaderRegex = /QUANTITY\s+DETAILS/;
  const bannedSectionMatch = text.match(bannedSectionHeaderRegex);

  let textToParse = text;
  if (bannedSectionMatch) {
    // If the banned section header is found, truncate the text at that point
    // This assumes the banned section always appears at the end of the relevant text for this format.
    textToParse = text.substring(0, bannedSectionMatch.index);
  }

  // Original transaction regex
  const transactionRegex = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})\s+((?:(?!-?\d{1,3}(?:[,\s]\d{3})*\.\d{2}).)*?)(-?\d{1,3}(?:[,\s]\d{3})*\.\d{2})/g;

  let match;
  while ((match = transactionRegex.exec(textToParse)) !== null) {
    const transDate = match[1].trim();
    const postDate = match[2].trim();
    let description = match[3].trim();
    
    // Normalize and format the amount before adding to transactions
    const rawAmount = match[4].trim();
    const amountFloat = parseFloat(rawAmount.replace(/\s/g, '').replace(/,/g, ''));
    const formattedAmount = amountFloat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Clean up description and remove excessive spaces
    description = description.replace(/[^a-zA-Z0-9\s#*&@-]+$/g, '').trim();
    description = description.replace(/\s+/g, ' ');

    transactions.push(`${transDate} ${postDate} ${description} ${formattedAmount}`.replace(/\s+/g, ' '));
  }

  return transactions;
}

function parseFormat2(textItems) {
  const transactions = [];
  let currentRef = null;
  let currentTransDate = null;
  let currentPostDate = null;
  let currentDescription = null;
  let currentAmount = null;

  let inBannedSection = false;

  for (let i = 0; i < textItems.length; i++) {
    const item = textItems[i].str.trim();

    // Check for the start of the banned section
    // Looking for "QUANTITY" on the current line and "DETAILS" on the next.
    if (item.includes("QUANTITY") && textItems[i + 1] && textItems[i + 1].str.trim().includes("DETAILS")) {
      inBannedSection = true;
      // If there's a pending transaction, add it before breaking the loop.
      if (currentRef !== null && currentTransDate !== null && currentAmount !== null) {
        transactions.push(`${currentTransDate} ${currentPostDate} ${currentDescription} ${currentAmount}`.replace(/\s+/g, ' '));
      }
      break; // Stop processing further items from this PDF page as we've hit the banned section
    }

    if (inBannedSection) {
      continue; // Skip lines if we are already in the banned section
    }

    // Process main transaction lines (Ref TransDate PostDate Description Amount)
    const mainTransactionRegex = /^(\d+)\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})\s+(.*?)\s+(-?\d{1,3}(?:[,\s]\d{3})*\.\d{2})$/;
    const mainMatch = item.match(mainTransactionRegex);

    if (mainMatch) {
      if (currentRef !== null && currentTransDate !== null && currentAmount !== null) {
        transactions.push(`${currentTransDate} ${currentPostDate} ${currentDescription} ${currentAmount}`.replace(/\s+/g, ' '));
      }

      currentRef = mainMatch[1];
      currentTransDate = mainMatch[2];
      currentPostDate = mainMatch[3];
      currentDescription = mainMatch[4].trim();
      
      const amountFloat = parseFloat(mainMatch[5].replace(/\s/g, '').replace(/,/g, ''));
      currentAmount = amountFloat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    // Check for partial transaction lines (without amount)
    else if (/^\d+\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+.*$/.test(item)) {
      const parts = item.split(/\s+/);
      if (parts.length >= 4) {
        if (currentRef !== null && currentTransDate !== null && currentAmount !== null) {
          transactions.push(`${currentTransDate} ${currentPostDate} ${currentDescription} ${currentAmount}`.replace(/\s+/g, ' '));
        }

        currentRef = parts[0];
        currentTransDate = parts[1] + ' ' + parts[2];
        currentPostDate = parts[3] + ' ' + parts[4];
        currentDescription = parts.slice(5).join(' ').trim();
        currentAmount = null; // Reset as amount is not yet found
      }
    }
    // Check for amount-only lines (could be continuation of previous transaction)
    else if (/^-?\d{1,3}(?:[,\s]\d{3})*\.\d{2}$/.test(item.trim()) && currentTransDate !== null && currentAmount === null) {
      const amountFloat = parseFloat(item.trim().replace(/\s/g, '').replace(/,/g, ''));
      currentAmount = amountFloat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    // The previous `else if` block that specifically matched itemized transactions
    // in the "Details of your Canadian Tire store purchases" section is implicitly
    // skipped due to the `inBannedSection` flag and the `break` statement above.
  }

  // Add the last pending transaction if exists
  if (currentRef !== null && currentTransDate !== null && currentAmount !== null) {
    transactions.push(`${currentTransDate} ${currentPostDate} ${currentDescription} ${currentAmount}`.replace(/\s+/g, ' '));
  }

  return transactions;
}


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


function processCTBCardData() {
  const yearInput = document.getElementById('yearInput').value.trim();
  const input = document.getElementById('inputText').value.trim();
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const allItems = [
    ...parseLines(input, yearInput, false),
  ];

  // Sort transactions by the first date in ascending order.
  // If first dates are the same, sort by the second date in ascending order.
  allItems.sort((a, b) => {
    const primarySort = a.sortDate.getTime() - b.sortDate.getTime();
    if (primarySort === 0 && a.sortDate2 && b.sortDate2) {
      return a.sortDate2.getTime() - b.sortDate2.getTime();
    }
    return primarySort;
  });

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
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


  // Create the header row for the table.
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  const rows = [];

  // Populate the table with transaction data.
  if (allItems.length > 0) {
    allItems.forEach(({ row }) => {
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
    // Store the raw row data in a dataset for potential future use (e.g., export).
    table.dataset.rows = JSON.stringify(rows);

    // Assuming updateTableCursor is available globally from main.js or other script
    if (typeof window.updateTableCursor === 'function') {
      window.updateTableCursor();
    }
    displayStatusMessage('Data processed successfully!', 'success');

  } else {
    displayStatusMessage('No data parsed. Please check the input format or ensure the correct bank is selected.', 'error');
  }
}

// Make the processCTBCardData function globally accessible for use by other scripts (e.g., main.js).
window.processData = processCTBCardData;


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
