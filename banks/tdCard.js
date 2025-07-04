// tdcard.js - Combines PDF extraction from cardtd.html with bmoAccount.js's processing and UI features

// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

/**
 * Displays status messages to the user. This function is re-added here
 * as it was present in the original bmoAccount.js and used internally.
 * @param {string} message The message to display.
 * @param {string} type The type of message (e.g., 'success', 'error', 'info').
 */
function displayStatusMessage(message, type) {
  // Assumes a div with class 'status-message' exists in the HTML to display messages.
  const statusMessageDiv = document.querySelector('.status-message');
  if (statusMessageDiv) {
    statusMessageDiv.textContent = message;
    // Set class for styling (e.g., green for success, red for error)
    statusMessageDiv.className = `status-message ${type}`;
    statusMessageDiv.style.display = 'block';
    // Hide the message after a few seconds
    setTimeout(() => {
      statusMessageDiv.style.display = 'none';
    }, 5000); // Hide after 5 seconds
  } else {
    // Fallback to console log if the status message div is not found
    console.log(`Status (${type}): ${message}`);
  }
}

/**
 * Parses a PDF file to extract its text content and then extracts TD-specific transactions.
 * This function is adapted from the `parsePDF` and `extractTransactions` logic found in `cardtd.html`.
 * It leverages `pdfjsLib` (expected to be globally available from index.html).
 * @param {File} file The PDF file to parse.
 * @returns {Promise<string>} A promise that resolves with a single string of extracted transaction lines,
 * separated by single newlines, ready for `processData`. This *matches* the output of `cardtd.html`.
 */
window.bankUtils.processPDFFile = async function(file) {
  return new Promise(async (resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async function(event) {
      try {
        const typedArray = new Uint8Array(event.target.result);
        // pdfjsLib is expected to be loaded globally by index.html
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

        let fullText = '';

        // Iterate through each page of the PDF
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();

          // Sort text items by y-coordinate (top to bottom), then x-coordinate (left to right).
          // This is crucial for reconstructing lines accurately from the PDF's text layer,
          // as PDF text often isn't stored in reading order.
          const sortedItems = textContent.items.sort((a, b) => {
            const yDiff = b.transform[5] - a.transform[5]; // y-coordinate is transform[5]
            if (Math.abs(yDiff) > 5) return yDiff; // Tolerance for slight y variations within a single line
            return a.transform[4] - b.transform[4]; // x-coordinate is transform[4]
          });

          let pageLines = [];
          let currentLine = '';
          let lastY = null;

          // Reconstruct lines from sorted text items
          for (const item of sortedItems) {
            // If the current item is on the "same line" (within a Y tolerance) as the previous
            if (lastY === null || Math.abs(item.transform[5] - lastY) < 5) {
              currentLine += item.str + ' '; // Append text with a space
            } else {
              // New line detected, push the complete current line and start a new one
              pageLines.push(currentLine.trim());
              currentLine = item.str + ' ';
            }
            lastY = item.transform[5];
          }
          if (currentLine) { // Add the very last line on the page
            pageLines.push(currentLine.trim());
          }
          fullText += pageLines.join('\n') + '\n'; // Join all lines from the current page with newlines
        }

        // Use the TD-specific transaction extraction logic.
        // NOTE: The description cleaning logic is removed from these functions
        // and applied globally below to match cardtd.html's behavior exactly.
        const transactionsArray = extractTransactionsTD(fullText);

        // --- START: Exact cleaning logic from cardtd.html's displayResults ---
        // This ensures the output is an "exact carbon copy" as requested.
        const finalTransactions = transactionsArray.map(transaction => {
            let cleanedTransaction = transaction.replace(/\bcontinued\b/gi, ' ');
            cleanedTransaction = cleanedTransaction.replace(/CALCULATING\s*YOUR\s*BALANCE/gi, ' ');
            cleanedTransaction = cleanedTransaction.replace(/The\s*estimated\s*time\s*to\s*pay\s*your\s*New\s*Balance\s*in\s*full/gi, ' ');
            cleanedTransaction = cleanedTransaction.replace(/Estimated\s*Time\s*to\s*Pay/gi, ' ');
            cleanedTransaction = cleanedTransaction.replace(/Annual\s*Interest\s*Rate:\s*Purchases\s*\d+\.\d+%/gi, ' ');
            cleanedTransaction = cleanedTransaction.replace(/Cash\s*Advances\s*\d+\.\d+%/gi, ' ');
            cleanedTransaction = cleanedTransaction.replace(/\s+/g, ' ').trim(); // Normalize spaces and trim
            return cleanedTransaction;
        });
        // --- END: Exact cleaning logic from cardtd.html's displayResults ---

        // Join the array of cleaned transaction strings into a single string with single newlines.
        // This is the *exact* output format that cardtd.html uses for its textarea.
        resolve(finalTransactions.join('\n'));

      } catch (error) {
        console.error("Error parsing PDF in tdcard.js:", error);
        displayStatusMessage("Failed to parse PDF file. " + error.message, 'error');
        reject(new Error("Failed to parse PDF file. " + error.message));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Extracts TD Visa transaction details from the raw text content of a PDF.
 * This function is adapted from `cardtd.html`'s `extractTransactions`. It attempts
 * to identify transaction blocks and parse individual transaction lines.
 * NOTE: This function no longer calls `cleanDescriptionTD`. The cleaning is
 * now applied after this function returns, to the full transaction string.
 * @param {string} text The full text content extracted from the PDF.
 * @returns {string[]} An array of formatted transaction strings. Each string
 * is typically structured as "TRANSACTION_DATE POSTING_DATE DESCRIPTION AMOUNT [FOREIGN_INFO]".
 */
function extractTransactionsTD(text) {
  const transactions = [];
  // Normalize newlines and split into individual lines, filtering out empty ones.
  const lines = text.replace(/\r\n/g, '\n').split('\n').map(line => line.trim()).filter(line => line.length > 0);

  let transactionStartIndex = -1;
  // Attempt to find a clear transaction header to delineate the start of the data.
  // This makes the parsing more robust by focusing on a specific section.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('TRANSACTION') && line.includes('DATE') &&
      line.includes('ACTIVITY') && line.includes('DESCRIPTION') &&
      line.includes('AMOUNT')) {
      transactionStartIndex = i;
      break;
    }
  }

  // If no explicit transaction header is found, fall back to a more general extraction.
  if (transactionStartIndex === -1) {
    return extractTransactionsFallbackTD(text);
  }

  let transactionEndIndex = lines.length;
  // Identify common footer patterns to determine where the transaction data ends.
  for (let i = transactionStartIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('NET AMOUNT OF MONTHLY ACTIVITY') ||
      line.includes('TOTAL NEW BALANCE') ||
      line.includes('CALCULATING YOUR BALANCE') ||
      line.includes('PAYMENT INFORMATION') ||
      line.includes('TD MESSAGE CENTRE') ||
      line.includes('Estimated Time to Pay')) {
      transactionEndIndex = i;
      break;
    }
  }

  // Slice the lines to only include the relevant transaction data.
  const relevantLines = lines.slice(transactionStartIndex + 1, transactionEndIndex);

  let i = 0;
  while (i < relevantLines.length) {
    let line = relevantLines[i];

    // Skip very short or empty lines that are unlikely to be valid transactions.
    if (!line || line.length < 10) {
      i++;
      continue;
    }

    // Regex to capture key components of a TD transaction line:
    // Group 1: Transaction Date (e.g., "MAR 15") - first date pattern
    // Group 2: Posting Date (e.g., "MAR 18") - second date pattern
    // Group 3: Description (non-greedy, captures everything between dates and amount)
    // Group 4: Amount (e.g., "$8.11" or "-$10.00")
    // Group 5: Any trailing characters after the amount (e.g., page numbers, document IDs)
    const transactionMatch = line.match(/^.*?([A-Z]{3}\s+\d{1,2})\s+([A-Z]{3}\s+\d{1,2})\s+(.*?)(-?\$[\d,]+\.\d{2})(.*)$/);

    if (transactionMatch) {
      const transactionDate = transactionMatch[1];
      const postingDate = transactionMatch[2];
      let description = transactionMatch[3].trim(); // Direct capture, no pre-cleaning here
      const amount = transactionMatch[4];
      // const trailingChars = transactionMatch[5].trim(); // Captured but not used in the final output

      let foreignInfo = '';
      // Check the next line(s) for foreign currency and exchange rate details.
      if (i + 1 < relevantLines.length) {
        const nextLine = relevantLines[i + 1];

        if (nextLine.includes('FOREIGN CURRENCY') && nextLine.includes('USD')) {
          foreignInfo += ' ' + nextLine.trim(); // Append the foreign currency line
          i++; // Consume this line

          // Check if there's another line for the exchange rate.
          if (i + 1 < relevantLines.length) {
            const nextNextLine = relevantLines[i + 1];
            if (nextNextLine.includes('EXCHANGE RATE')) {
              foreignInfo += ' ' + nextNextLine.trim(); // Append the exchange rate line
              i++; // Consume this line
            }
          }
        }
        // Also check if the next line is a continuation of the description (e.g., a city name).
        // This heuristic looks for lines starting with a capital letter, not resembling a new date,
        // and within a reasonable length.
        else if (
          nextLine.match(/^[A-Z][a-zA-Z0-9\s.-]+$/) &&
          !nextLine.match(/^[A-Z]{3}\s+\d{1,2}\s+[A-Z]{3}\s+\d{1,2}/) && // Not a new date line
          !nextLine.includes('NET AMOUNT') && !nextLine.includes('TOTAL') &&
          !nextLine.includes('CALCULATING') && !nextLine.includes('PAYMENT INFORMATION') &&
          !nextLine.includes('MINIMUM PAYMENT') && !nextLine.includes('TD MESSAGE CENTRE') &&
          !nextLine.includes('Estimated Time to Pay') &&
          !nextLine.includes('Annual Interest Rate:') &&
          nextLine.length > 1 && nextLine.length < 50
        ) {
          description += ' ' + nextLine.trim();
          i++; // Consume this line
        }
      }

      // Format the extracted data into a single string for further processing.
      transactions.push(`${transactionDate} ${postingDate} ${description} ${amount}${foreignInfo}`);
    }
    i++; // Move to the next line in the relevantLines array
  }

  // If the primary extraction method yielded no transactions, try the fallback.
  if (transactions.length === 0) {
    return extractTransactionsFallbackTD(text);
  }

  return transactions;
}

/**
 * Fallback function for extracting TD Visa transactions. This is used if the primary
 * method (which relies on finding specific headers) fails to yield results.
 * It uses a more lenient pattern matching approach.
 * Adapted from `cardtd.html`'s `extractTransactionsFallback`.
 * NOTE: This function no longer calls `cleanDescriptionTD`. The cleaning is
 * now applied after this function returns, to the full transaction string.
 * @param {string} text The full text content extracted from the PDF.
 * @returns {string[]} An array of formatted transaction strings.
 */
function extractTransactionsFallbackTD(text) {
  const transactions = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip lines that are clearly headers or footers, even in fallback mode.
    if (line.includes('TRANSACTION DATE') ||
      line.includes('POSTING DATE') ||
      line.includes('ACTIVITY DESCRIPTION') ||
      line.includes('AMOUNT (S)') ||
      line.includes('PREVIOUS STATEMENT BALANCE') ||
      line.includes('NET AMOUNT OF MONTHLY ACTIVITY') ||
      line.includes('TOTAL NEW BALANCE') ||
      line.includes('CALCULATING YOUR BALANCE') ||
      line.includes('PAYMENT INFORMATION') ||
      line.includes('Minimum Payment') ||
      line.includes('TD MESSAGE CENTRE') ||
      line.includes('Estimated Time to Pay')) {
      continue;
    }

    // Regex to match lines that look like a transaction:
    // "MONTH DAY MONTH DAY DESCRIPTION $AMOUNT"
    const match = line.match(/^([A-Z]{3}\s+\d{1,2})\s+([A-Z]{3}\s+\d{1,2})\s+(.*?)(-?\$[\d,]+\.\d{2})/);

    if (match) {
      const transactionDate = match[1];
      const postingDate = match[2];
      let description = match[3].trim(); // Direct capture, no pre-cleaning here
      const amount = match[4];

      // Further filter out lines that might be misidentified as transactions
      // due to short or problematic descriptions.
      // NOTE: `cleanDescriptionTD` specific logic is removed from here.
      if (description.length < 3 ||
        description.includes('BALANCE') ||
        description.includes('STATEMENT') ||
        description.includes('MINIMUM') ||
        description.includes('ANNUAL INTEREST RATE')) {
        continue;
      }

      let foreignInfo = '';
      // Check for foreign currency or description continuation on the next line(s).
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine.includes('FOREIGN CURRENCY') && nextLine.includes('USD')) {
          foreignInfo += ' ' + nextLine.trim();
          i++; // Consume this line

          if (i + 1 < lines.length) {
            const nextNextLine = lines[i + 1];
            if (nextNextLine.includes('EXCHANGE RATE')) {
              foreignInfo += ' ' + nextNextLine.trim();
              i++; // Consume this line
            }
          }
        }
        else if (
          nextLine.match(/^[A-Z][a-zA-Z0-9\s.-]+$/) &&
          !nextLine.match(/^[A-Z]{3}\s+\d{1,2}\s+[A-Z]{3}\s+\d{1,2}/) &&
          !nextLine.includes('TOTAL') && !nextLine.includes('BALANCE') &&
          !nextLine.includes('Annual Interest Rate:') &&
          nextLine.length > 1 && nextLine.length < 50
        ) {
          description += ' ' + nextLine.trim();
          i++;
        }
      }
      // Add the formatted transaction string to the results.
      transactions.push(`${transactionDate} ${postingDate} ${description} ${amount}${foreignInfo}`);
    }
  }
  return transactions;
}


/**
 * Main data processing function for text input, adapted from `bmoAccount.js`.
 * This function now expects the `inputText` to contain pre-processed and cleaned
 * TD transaction lines generated by `window.bankUtils.processPDFFile`.
 */
function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim(); // Get optional year input
  // Split the input by single newlines, as `processPDFFile` now joins transactions with `\n`.
  const lines = input.split('\n').filter(l => l.trim()); // Changed to split by single newline
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = ''; // Clear previous output

  const fileListContainer = document.getElementById('fileListContainer');
  // Show/hide the file list container based on whether there's data to process.
  if (lines.length > 0) {
    fileListContainer.style.display = 'block';
  } else {
    fileListContainer.style.display = 'none';
  }

  // Define the table headers.
  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = []; // Array to hold the parsed table rows.

  const table = document.createElement('table');

  // Create and append the row for "Copy Column" buttons.
  const copyRow = document.createElement('tr');
  headers.forEach((_, index) => {
    const th = document.createElement('th');
    const div = document.createElement('div');
    div.className = 'copy-col';

    const btn = document.createElement('button');
    btn.textContent = `Copy`;
    btn.className = 'copy-btn';
    // This button will call `window.bankUtils.copyColumn` which is defined in `main.js`
    // but a placeholder is also provided at the end of this file for robustness.
    btn.onclick = () => window.bankUtils.copyColumn(index);

    div.appendChild(btn);
    th.appendChild(div);
    copyRow.appendChild(th);
  });
  table.appendChild(copyRow);

  // Create and append the main header row for the table.
  const headerRow = document.createElement('tr');
  headers.forEach(headerText => {
    const th = document.createElement('th');
    th.textContent = headerText;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  let currentYear = new Date().getFullYear(); // Default year to current

  // Parse the year input if provided and valid.
  if (yearInput) {
    currentYear = parseInt(yearInput);
    if (isNaN(currentYear)) {
      displayStatusMessage('Invalid Year Input. Please enter a valid year (e.g., 2023).', 'error');
      return;
    }
  }

  let previousBalance = null; // Variable to track the running balance, starting as null.

  // Define the comprehensive regex for a pre-formatted transaction line
  // This regex should match the output format of extractTransactionsTD
  const transactionLineRegex = /^([A-Z]{3}\s+\d{1,2})\s+([A-Z]{3}\s+\d{1,2})\s+(.*?)(-?\$[\d,]+\.\d{2})(.*)$/;


  // Process each pre-extracted transaction line.
  lines.forEach(line => {
    // Each `line` is expected to be a formatted string from `extractTransactionsTD`, like:
    // "MAR 15 MAR 18 Description of Transaction $135.00 FOREIGN CURRENCY USD 100.00 EXCHANGE RATE 1.3500"
    const partsMatch = line.match(transactionLineRegex);

    if (partsMatch) {
      let transactionDate = partsMatch[1]; // e.g., "MAR 15"
      // let postingDate = partsMatch[2]; // e.g., "MAR 18", not directly used in output table
      let description = partsMatch[3].trim(); // This is the already cleaned description
      let amountStr = partsMatch[4]; // e.g., "$135.00" or "-$50.00"
      // let foreignInfo = partsMatch[5].trim(); // Trailing info, not directly used in table columns

      // Append the year to the transaction date if available.
      if (yearInput && transactionDate) {
        transactionDate += ` ${currentYear}`;
      }

      let amountValue = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));

      let debit = '';
      let credit = '';
      // For credit cards, a negative amount is a debit (expense), positive is a credit (payment/refund).
      if (amountValue < 0) {
        debit = Math.abs(amountValue).toFixed(2);
      } else {
        credit = amountValue.toFixed(2);
      }

      // Calculate the running balance.
      // Initialize theoretical balance to 0 if this is the first transaction.
      if (previousBalance === null) {
        previousBalance = 0;
      }

      // Adjust balance based on debit/credit. For a credit card:
      // Debits (purchases) increase the balance owed.
      // Credits (payments/returns) decrease the balance owed.
      if (debit) {
        previousBalance += parseFloat(debit);
      } else if (credit) {
        previousBalance -= parseFloat(credit);
      }

      let balance = previousBalance.toFixed(2); // Format the balance to two decimal places.

      // Construct the row array for the table.
      const row = [transactionDate, description, debit, credit, balance];
      rows.push(row);
    } else {
      // If a line from inputText doesn't match the expected format, log it and skip.
      console.warn("Skipping line in processData due to unexpected format:", line);
      displayStatusMessage("Skipping some data due to unexpected format. Check console for details.", 'error');
    }
  });

  // If any rows were successfully parsed, populate the table.
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
    // Store the raw parsed rows data in a dataset attribute for later use (e.g., export).
    table.dataset.rows = JSON.stringify(rows);

    // Call `updateTableCursor` (assumed to be in `main.js`) to apply cursor styles and interactivity.
    if (typeof window.updateTableCursor === 'function') {
      window.updateTableCursor();
    }
    displayStatusMessage('Data processed successfully!', 'success');

  } else {
    // If no data was parsed, display an error message.
    displayStatusMessage('No data parsed. Please check the input format or ensure the correct bank is selected.', 'error');
  }
}

// Export `processData` globally so `main.js` can call it directly.
window.processData = processData;

/**
 * Handles file uploads and display them in the file list.
 * This function is retained from the original `bmoAccount.js` and adapted to
 * call the bank-specific `window.bankUtils.processPDFFile`.
 * @param {FileList} files A FileList object containing the uploaded files.
 */
// NOTE: This window.bankUtils.handleFiles in main.js will override this,
// which is the intended behavior as main.js handles the file list and inputText updates.
// This block is left here for clarity on what this bank's script provides,
// but the actual execution flow for file handling will largely be managed by main.js.
window.bankUtils.handleFiles = async function(files) {
  // Main.js now manages the `uploadedFilesData` array and `inputText` updates.
  // This function will be called by main.js's handleFiles,
  // which then calls window.bankUtils.processPDFFile for each file.
  displayStatusMessage('File handling managed by main application.', 'info');
  // The actual processing of each file will happen via the `window.bankUtils.processPDFFile`
  // that main.js will call for each file.
};


// Initialize file upload setup when the DOM is fully loaded.
// This is not needed here as main.js handles the setupFileUpload call.
// Keeping it commented out to avoid redundant calls.
// document.addEventListener('DOMContentLoaded', () => {
//   setupFileUpload();
// });

// Placeholder/fallback for `window.bankUtils.copyColumn`.
// This function is primarily defined in `main.js`, but this ensures `processData`
// can call it without error even if `main.js` isn't fully loaded yet or if
// this script is used standalone.
window.bankUtils.copyColumn = window.bankUtils.copyColumn || function(columnIndex) {
  const table = document.querySelector('#output table');
  if (!table) return;

  // Skip the first row (copy buttons) and get all subsequent data rows.
  const rows = Array.from(table.querySelectorAll('tr')).slice(1);
  // Extract content from the specified column for each row and join with newlines.
  const columnData = rows.map(row => row.cells[columnIndex]?.textContent.trim() || '').join('\n');

  // Use `document.execCommand('copy')` for clipboard operations,
  // as `navigator.clipboard.writeText()` might have restrictions in some iframe environments.
  const tempTextArea = document.createElement('textarea');
  tempTextArea.value = columnData;
  document.body.appendChild(tempTextArea);
  tempTextArea.select(); // Select the text in the temporary textarea.
  document.execCommand('copy'); // Execute the copy command.
  document.body.removeChild(tempTextArea); // Remove the temporary textarea.

  displayStatusMessage('Column copied to clipboard!', 'success');
};
