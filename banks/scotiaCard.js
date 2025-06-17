// scotiaCard.js - Merged content with PDF processing and original features retained

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
 */
function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').map(line => line.trim()).filter(Boolean);
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const transactions = []; // Use a temporary array to store parsed transactions for sorting
  const table = document.createElement('table');

  // Copy buttons row
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

  // Header row
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
   * This logic is specific to the Scotia Card text format.
   */
  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const full = buffer.join(' ');
    // Regex to match Scotia Card transaction format: RefNum Date1 Date2 Description Amount
    // Example: "345 Sep 8 Sep 8 INTERNET PAYMENT THANK YOU 1,000.00-"
    // The first group `(\d+)` is the reference number which is ignored by this processData,
    // but the regex from cardscotia.html uses it. Here, we capture but discard.
    const match = full.match(/^(\d+)\s+([A-Za-z]{3} \d{1,2})\s+([A-Za-z]{3} \d{1,2})\s+(.*?)\s+([\d,]+\.\d{2}-?)$/);

    if (!match) {
      buffer = [];
      return;
    }

    // Destructure the matched groups
    // Group 1: Reference Number (ignored for table output)
    // Group 2: First Date (e.g., "Sep 8")
    // Group 3: Second Date (e.g., "Sep 8")
    // Group 4: Description
    // Group 5: Raw Amount (e.g., "1,000.00" or "1,000.00-")
    let [, , date1, date2, description, amountRaw] = match;

    // Store the original date1 for sorting purposes, appending the provided year or current year
    const originalDateForSort = new Date(`${date1} ${yearInput || new Date().getFullYear()}`);

    // Append year to display dates if provided
    if (yearInput) {
      date1 += ` ${yearInput}`;
      date2 += ` ${yearInput}`;
    }

    const date = `${date1} ${date2}`;
    const amount = amountRaw.replace(/,/g, '').replace('-', ''); // Remove commas and trailing hyphen
    const isCredit = amountRaw.endsWith('-'); // Check if it's a credit based on trailing hyphen

    const debit = isCredit ? '' : amount;
    const credit = isCredit ? amount : '';

    // Push an object with the sortable date and the row data
    transactions.push({
      sortDate: originalDateForSort,
      row: [date, description.trim(), debit, credit, ''] // Balance column is empty initially
    });

    buffer = []; // Clear buffer after processing
  };

  // Process each line to build transactions
  lines.forEach(line => {
    // Check if the line starts a new transaction based on the date pattern
    if (/^\d+\s+[A-Za-z]{3} \d{1,2}\s+[A-Za-z]{3} \d{1,2}/.test(line)) {
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
 * PDF Processing Function for Scotia Card statements.
 * This function is adapted from cardscotia.html.
 * It extracts text from PDF and then normalizes it for parsing by processData.
 * @param {File} file - The PDF file to process.
 * @returns {Promise<string>} - A promise that resolves with the extracted and cleaned text.
 */
window.bankUtils.processPDFFile = async function(file) {
  // Ensure PDF.js worker is configured. This might already be done in index.html,
  // but it's good to ensure it here for robustness in case this script runs independently.
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

        let fullText = '';
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          // Join items with a space, then replace multiple spaces/newlines with a single space.
          const pageText = textContent.items.map(item => item.str).join(' ').replace(/\s{2,}/g, ' ');
          fullText += pageText + '\n';
        }

        // --- Scotia Card Specific Text Cleaning and Parsing Logic (from cardscotia.html) ---
        // Normalize text: replace multiple spaces/newlines with a single space to help regex
        const normalizedText = fullText.replace(/\s{2,}/g, ' ').trim();

        let transactions = [];
        // Regex to capture the entire transaction line, ensuring it waits for the amount.
        // It looks for:
        // (\d{3})        : Reference Number (3 digits)
        // \s+            : One or more spaces
        // ([A-Z][a-z]{2}\s+\d{1,2}) : Transaction Date (e.g., Sep 8)
        // \s+            : One or more spaces
        // ([A-Z][a-z]{2}\s+\d{1,2}) : Post Date (e.g., Sep 8)
        // \s+            : One or more spaces
        // (.*?)          : Description (non-greedy match for any characters)
        // \s+            : One or more spaces
        // ([\d,]+\.?\d*[-]?)\s* : Amount (numbers, comma, optional decimal, optional trailing hyphen for credits)
        //                : followed by optional spaces
        // (?=            : Positive lookahead to ensure we stop before
        //   \d{3}\s+[A-Z][a-z]{2}\s+\d{1,2} :  the start of the next transaction OR
        //   |BALANCE|TOTAL|SUB-TOTAL|$    : common end-of-section markers or end of string
        // )              : End lookahead
        const transactionRegex = /(\d{3})\s+([A-Z][a-z]{2}\s+\d{1,2})\s+([A-Z][a-z]{2}\s+\d{1,2})\s+(.*?)\s+([\d,]+\.?\d*[-]?)\s*(?=\d{3}\s+[A-Z][a-z]{2}\s+\d{1,2}|BALANCE|TOTAL|SUB-TOTAL|INTEREST CHARGES|NEW BALANCE|$)/gis;

        let match;
        const processedLines = [];
        while ((match = transactionRegex.exec(normalizedText)) !== null) {
          const [, refNum, transDate, postDate, description, amount] = match;

          // Clean up description: remove extra spaces and trim
          let cleanDesc = description.replace(/\s+/g, ' ').trim();

          // Remove phone numbers and long numbers (potential IDs/transit) from description
          cleanDesc = cleanDesc.replace(/\s+\d{3}-\d{3}-\d{4}\s*$/, '').trim();
          cleanDesc = cleanDesc.replace(/\s+\d{6,}\s*$/, '').trim();

          // Format the line to be compatible with `processData`'s expected input format
          // `processData` expects: RefNum Date1 Date2 Description Amount
          processedLines.push(`${refNum} ${transDate} ${postDate} ${cleanDesc} ${amount}`);
        }

        if (processedLines.length === 0) {
          displayStatusMessage('No transactions found in this PDF. Please ensure it is a Scotia Momentum Visa statement.', 'error');
          reject(new Error('No transactions found in PDF.'));
          return;
        }

        // Return the joined processed lines, which `processData` can then parse and sort.
        resolve(processedLines.join('\n'));

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

// The setupFileUpload and handleFiles functions from bmoAccount.js/main.js
// are now assumed to be responsible for calling window.bankUtils.processPDFFile
// and updating the inputText textarea.
