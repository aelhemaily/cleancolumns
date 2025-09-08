// amexCard.js - Handles American Express PDF statement processing

// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

/**
 * Displays a status message to the user.
 * This function is replicated from bmoAccount.js as it's a utility needed by PDF processing.
 * @param {string} message - The message to display.
 * @param {string} type - The type of message ('success', 'error', 'info').
 */
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

/**
 * Main function to process bank statement data, either from text input or processed PDF text.
 * It parses, sorts, and displays the transactions in a table.
 * This function is adapted from scotiaCard.js.
 */
function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').map(line => line.trim()).filter(Boolean);
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  // Adjust headers to include Debit and Credit columns, like scotiaCard.js
  const headers = ['Date', 'Description', 'Debit', 'Credit'];
  const transactions = []; // Use a temporary array to store parsed transactions for sorting
  const table = document.createElement('table');

  // Copy buttons row (adapted from scotiaCard.js)
  const copyRow = document.createElement('tr');
  headers.forEach((_, index) => {
    const th = document.createElement('th');
    const div = document.createElement('div');
    div.className = 'copy-col';

    const btn = document.createElement('button');
    btn.textContent = 'Copy';
    btn.className = 'copy-btn';
    // Assumes copyColumn is available in window.bankUtils (from main.js)
    btn.onclick = () => window.bankUtils.copyColumn(index);

    div.appendChild(btn);
    th.appendChild(div);
    copyRow.appendChild(th);
  });
  table.appendChild(copyRow);

  // Header row (adapted from scotiaCard.js)
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  let buffer = [];

  /**
   * Flushes the current buffer of lines, attempting to parse them into a transaction.
   * This logic is specific to the Amex text format, now expecting a unified format.
   */
  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const full = buffer.join(' ');
    // Regex to match Amex transaction format: Transaction Date Posting Date Details Amount
    // This regex now expects the amount to be the last part of the line.
    const match = full.match(/^([A-Z][a-z]{2}\s+\d{1,2})\s+([A-Z][a-z]{2}\s+\d{1,2})\s+(.*?)\s+([-\d,]+\.\d{2})$/i);

    if (!match) {
      buffer = [];
      return;
    }

    // Destructure the matched groups
    let [, transDate, postDate, description, amountRaw] = match;

    // Store the original transaction date for sorting purposes, appending the provided year or current year
    const originalDateForSort = new Date(`${transDate} ${yearInput || new Date().getFullYear()}`);

    // Append year to display dates if provided
    if (yearInput) {
      transDate += ` ${yearInput}`;
      postDate += ` ${yearInput}`;
    }

    // Parse amount, handling negative sign
    let amountValue = parseFloat(amountRaw.replace(/,/g, '')); // Remove commas, parseFloat handles leading '-'
    
    const debit = amountValue > 0 ? amountValue.toFixed(2) : '';
    const credit = amountValue < 0 ? Math.abs(amountValue).toFixed(2) : '';

    // Push an object with the sortable date and the row data
    transactions.push({
      sortDate: originalDateForSort,
      row: [transDate, description.trim(), debit, credit]
    });

    buffer = []; // Clear buffer after processing
  };

  // Process each line to build transactions
  lines.forEach(line => {
    // Check if the line starts a new transaction based on the date pattern
    // Amex transactions usually start with a month abbreviation and day, followed by another date.
    if (/^[A-Z][a-z]{2}\s+\d{1,2}\s+[A-Z][a-z]{2}\s+\d{1,2}/.test(line)) {
      flushBuffer(); // Flush any buffered lines if a new transaction starts
    }
    buffer.push(line); // Add the current line to the buffer
  });

  flushBuffer(); // Final flush to process any remaining lines in the buffer

  // Sort transactions by date in ascending order
  transactions.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

  // Add sorted rows to table
  transactions.forEach(({ row }) => {
    const tr = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  outputDiv.appendChild(table);
  // Store only the row data in the dataset for consistency with other bank parsers
  table.dataset.rows = JSON.stringify(transactions.map(t => t.row));

  // Assuming updateTableCursor is available globally from main.js or other script
  if (typeof window.updateTableCursor === 'function') {
      window.updateTableCursor();
  }
  displayStatusMessage('Data processed successfully!', 'success');
}

// Export processData globally (as main.js calls it directly)
window.processData = processData;

/**
 * PDF Processing Function for American Express statements.
 * This function extracts text from PDF and then normalizes it for parsing by processData.
 * @param {File} file - The PDF file to process.
 * @returns {Promise<string>} - A promise that resolves with the extracted and cleaned text.
 */
window.bankUtils.processPDFFile = async function(file) {
  // Ensure PDF.js worker is configured.
  if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  } else {
    console.warn("pdfjsLib not found or worker options already set. Ensure pdf.js is loaded.");
  }

  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async function(event) {
      const arrayBuffer = event.target.result;
      try {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let allProcessedLines = []; // Collect all processed lines from all pages

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          let linesByY = new Map(); // Map<Y_coord, Array<TextItem>>
          const Y_TOLERANCE = 5; // Pixels tolerance for grouping items on the same line

          // Group text items by their Y-coordinate
          for (const item of textContent.items) {
              const currentY = item.transform[5];
              let foundLine = false;
              // Check if this item is close enough to an existing line
              for (let [yKey, items] of linesByY.entries()) {
                  if (Math.abs(currentY - yKey) < Y_TOLERANCE) {
                      items.push(item);
                      foundLine = true;
                      break;
                  }
              }
              if (!foundLine) {
                  // If not, start a new line
                  linesByY.set(currentY, [item]);
              }
          }

          // Sort Y-coordinates in descending order (from top to bottom of the page)
          let sortedYKeys = Array.from(linesByY.keys()).sort((a, b) => b - a);

          let reconstructedLines = [];
          for (const yKey of sortedYKeys) {
              const itemsOnLine = linesByY.get(yKey);
              // Sort items on the same line by their X-coordinate
              itemsOnLine.sort((a, b) => a.transform[4] - b.transform[4]);

              let currentLine = '';
              let lastXEnd = -Infinity;

              for (const item of itemsOnLine) {
                  const currentX = item.transform[4];
                  // Add a space if there's a significant horizontal gap between text items
                  // or if it's not the first item on the line and there's any horizontal movement.
                  if (currentLine !== '' && (currentX > lastXEnd + (item.width * 0.2 || 2))) {
                      currentLine += ' ';
                  }
                  currentLine += item.str;
                  lastXEnd = currentX + (item.width || 0); // Update lastXEnd
              }
              reconstructedLines.push(currentLine.trim());
          }

          // Filter out any empty lines that might result from reconstruction
          const lines = reconstructedLines.filter(Boolean);

          let currentTransaction = null;
          // Regex to identify the start of a transaction line, capturing dates, description, and amount
          // This regex is made more flexible to capture various descriptions and amounts.
          const TRANSACTION_LINE_REGEX = /^([A-Z][a-z]{2}\s+\d{1,2})\s+([A-Z][a-z]{2}\s+\d{1,2})\s+(.+?)\s+([-\d,]+\.\d{2})$/i;
          // Regex for foreign currency details that might appear on a new line
          const FOREIGN_CURRENCY_REGEX = /^(UNITED STATES DOLLAR|U\.S\.\s*DOLLAR)\s+[\d,]+\.\d{2}\s+@\s+[\d.]+$/i;
          // Regex for reference numbers
          const REFERENCE_REGEX = /Reference\s+[A-Z0-9]+$/i;

          // Use regex for summary keywords for more robust matching
          const SUMMARY_REGEXES = [
              /TOTAL\s+OF/, /ACCOUNT\s+SUMMARY/, /NEW\s+TRANSACTIONS\s+FOR/, /PREVIOUS\s+BALANCE/,
              /PAYMENTS/, /OTHER\s+CREDITS/, /INTEREST\s+-\s+YOU\s+MAY\s+PAY/, /PURCHASES/, /FEES/,
              /FUNDS\s+ADVANCES/, /OTHER\s+CHARGES/, /EQUALS\s+NEW\s+BALANCE/, /MINIMUM\s+AMOUNT\s+DUE/,
              /FLEXIBLE\s+PAYMENT\s+OPTION\s+LIMIT/, /AVAILABLE\s+FLEXIBLE\s+PAYMENT\s+OPTION\s+LIMIT/,
              /TOTAL\s+SPENDING\s+LIMIT/, /AVAILABLE\s+SPENDING\s+LIMIT/,
              /STATEMENT\s+INCLUDES\s+PAYMENTS\s+AND\s+CHARGES\s+RECEIVED/, /PAYMENT\s+PERIOD\s+REMAINING/,
              /WE\s+VALUE\s+YOUR\s+MEMBERSHIP/, /PLEASE\s+PAY\s+BY\s+PAYMENT\s+DUE\s+DATE/,
              /ABOUT\s+YOUR\s+FLEXIBLE\s+PAYMENT\s+OPTION\s+LIMIT/, /ABOUT\s+YOUR\s+INTEREST\s+RATES/,
              /CATEGORY/, /DAILY\s+PERIODIC\s+RATE/, /CURRENT\s+ANNUAL\s+INTEREST\s+RATE/,
              /ANNUAL\s+INTEREST\s+RATES/, /PREFERRED/, /STANDARD/, /BASIC/,
              /SEE\s+YOUR\s+INFORMATION\s+BOX/, /ABOUT\s+YOUR\s+STATEMENT/,
              /TRANSACTION\/POSTING\s+DETAILS/, /CHARGES\s+MADE\s+IN\s+FOREIGN\s+CURRENCIES/,
              /BILLING\s+ERRORS/, /PAYMENT\s+DUE\s+DATE/,
              /PAYMENTS\s+-\s+PAYMENTS\s+MAY\s+BE\s+MADE/, /RECURRING\s+CHARGES/,
              /QUESTIONS\s+-\s+IF\s+YOU\s+HAVE\s+ANY\s+QUESTIONS/, /MEMBERSHIP\s+REWARDS/,
              /PREVIOUS\s+POINTS\s+EARNED/, /BONUS\s+POINTS/, /POINTS\s+ADJUSTMENTS/,
              /POINTS\s+REDEEMED/, /NEW\s+POINTS\s+BALANCE/, /REWARDS\s+NUMBER/,
              /POINTS\s+BALANCE/, /POINTS\s+EARNED/, /CARD\s+TYPE/, /CARD\s+NUMBER/,
              /TOTAL\s+POINTS\s+EARNED/, /NO\.\s+OF\s+POINTS/, /LOG\s+ON\s+TO\s+YOUR\s+ACCOUNT/,
              /ANY\s+REWARDS\s+ACTIVITY/,
              // Specific to the "Total of Other Account Transactions" issue
              /TOTAL\s+OF\s+OTHER\s+ACCOUNT\s+TRANSACTIONS/,
              // Add more specific summary lines if they are problematic
              /NEW\s+PAYMENTS/, // "New Payments" header
              /OTHER\s+ACCOUNT\s+TRANSACTIONS/ // "Other Account Transactions" header
          ];

          function flushCurrentTransaction() {
              if (currentTransaction) {
                  let { transDate, postDate, descriptionParts, amount } = currentTransaction;
                  let cleanDesc = descriptionParts.join(' ').replace(/\s+/g, ' ').trim();

                  // Determine if it's a "PAYMENT RECEIVED - THANK YOU" transaction
                  const isPayment = cleanDesc.includes('PAYMENT RECEIVED - THANK YOU');

                  if (isPayment) {
                      // For payment lines, remove reference numbers and foreign currency details
                      cleanDesc = cleanDesc.replace(REFERENCE_REGEX, '').trim();
                      cleanDesc = cleanDesc.replace(FOREIGN_CURRENCY_REGEX, '').trim();
                      // Keep only the first logical line for payments
                      cleanDesc = cleanDesc.split(/\s{2,}|\n|\r/)[0].trim();
                  } else {
                      // For other transactions, remove only reference numbers if they appear at the end
                      cleanDesc = cleanDesc.replace(REFERENCE_REGEX, '').trim();
                      // Foreign currency details are retained for non-payment transactions
                  }
                  allProcessedLines.push(`${transDate} ${postDate} ${cleanDesc} ${amount}`);
              }
              currentTransaction = null; // Reset for the next transaction
          }

          for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const checkableLine = line.toUpperCase().replace(/\s+/g, ' ').trim();

              // Check if it's a summary line first
              const isSummaryLine = SUMMARY_REGEXES.some(regex => regex.test(checkableLine));
              if (isSummaryLine) {
                  flushCurrentTransaction(); // Flush any ongoing transaction
                  continue; // Skip this line
              }

              const transactionMatch = line.match(TRANSACTION_LINE_REGEX);

              if (transactionMatch) {
                  // This line is a new transaction
                  flushCurrentTransaction(); // Flush previous transaction if any
                  currentTransaction = {
                      transDate: transactionMatch[1],
                      postDate: transactionMatch[2],
                      descriptionParts: [transactionMatch[3]], // Start description with the captured part
                      amount: transactionMatch[4]
                  };
              } else if (currentTransaction) {
                  // This line is a continuation of the current transaction's description
                  // Only add if it's not another summary type line or clearly irrelevant
                  const isContinuation = !/^\d{1,2}\.\d{2}$/.test(line.trim()) && // Not just an amount
                                         !/^\s*Page\s+\d+\/\d+/.test(line.trim()); // Not a page number
                  if (isContinuation) {
                      currentTransaction.descriptionParts.push(line);
                  }
              }
              // If currentTransaction is null and it's not a new transaction or summary, it's irrelevant.
          }
          flushCurrentTransaction(); // Flush the last transaction after the loop
        }

        if (allProcessedLines.length === 0) {
          displayStatusMessage('No transactions found in this PDF. Please ensure it is an American Express statement.', 'error');
          reject(new Error('No transactions found in PDF.'));
          return;
        }

        resolve(allProcessedLines.join('\n'));

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
