// tdAccount.js - Combined and restructured for PDF processing and text parsing

// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

// Regex patterns (from TdFull.html)
const REGEX_PARSER1 = /^(?<description>.+?)\s*(?:(?<amount>[\d,]+\.\d{2}))?\s*(?<date>[A-Z]{3}\d{2})(?:\s+(?<balance>[\d,]+\.\d{2}))?$/;
const STRICT_BALANCE_FORWARD_REGEX_PARSER1 = /^BALANCE FORWARD\s+([A-Z]{3}\d{2})\s+([\d,]+\.\d{2})$/;
const BF_MERGED_LINE_REGEX_PARSER1 = /^(BALANCE FORWARD\s+[A-Z]{3}\d{2}\s+[\d,]+\.\d{2})\s+(.+)$/;

// Regex patterns for Parser 2 (from TdFull.html)
const DATE_PATTERN_PARSER2 = /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{2}/i;
const AMOUNT_PATTERN_PARSER2 = /[\d,]+\.\d{2}/;
const BALANCE_PATTERN_PARSER2 = /[\d,]+\.\d{2}(?:0D|OD)?/i;

/**
 * Extracts text content from a single PDF page, preserving line structure by sorting and grouping.
 * Used by Parser 1.
 * @param {Object} page - The PDF.js page object.
 * @returns {Promise<string>} The text content of the page, with lines separated by newlines.
 */
async function getTextFromPdfPageParser1(page) {
    const textContent = await page.getTextContent();
    let lastY = -1;
    let line = [];
    const lines = [];

    // Sort items primarily by Y-coordinate (descending) and secondarily by X-coordinate (ascending)
    const sortedItems = textContent.items.sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) < 2) { // Tolerance of 2 pixels for grouping text on the same line
            return a.transform[4] - b.transform[4];
        }
        return yDiff;
    });

    for (const item of sortedItems) {
        const currentY = item.transform[5];
        if (lastY === -1 || Math.abs(currentY - lastY) < 2) {
            line.push(item.str);
        } else {
            lines.push(line.join(' ').trim());
            line = [item.str];
        }
        lastY = currentY;
    }
    if (line.length > 0) {
        lines.push(line.join(' ').trim());
    }
    return lines.filter(l => l.length > 0).join('\n');
}

/**
 * Cleans and formats a transaction line based on extracted components.
 * Used by Parser 1.
 * @param {string} description - The transaction description.
 * @param {string} amount - The transaction amount (can be null/undefined).
 * @param {string} date - The transaction date.
 * @param {string} balance - The balance after the transaction (can be null/undefined).
 * @returns {string} The formatted transaction string.
 */
function formatTransactionParser1(description, amount, date, balance) {
    let formattedLine = description.replace(/\s+/g, ' ').trim();
    if (amount) {
        formattedLine += ` ${amount.replace(/,/g, '')}`;
    }
    formattedLine += ` ${date}`;
    if (balance) {
        formattedLine += ` ${balance.replace(/,/g, '')}`;
    }
    return formattedLine;
}

/**
 * Parses PDF content using the logic from tdacc.html (Parser 1).
 * @param {Object} pdfDocument - The PDF.js PDF document object.
 * @returns {Promise<string[]>} A promise that resolves to an array of extracted transaction strings.
 */
async function parsePdfFormat1(pdfDocument) {
    let fullText = '';
    for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const pageText = await getTextFromPdfPageParser1(page);
        fullText += pageText + '\n';
    }

    const lines = fullText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const extractedTransactions = [];
    let balanceForwardAlreadyExtracted = false;

    for (let i = 0; i < lines.length; i++) {
        let currentLine = lines[i];

        if (!balanceForwardAlreadyExtracted) {
            const bfStrictMatch = currentLine.match(STRICT_BALANCE_FORWARD_REGEX_PARSER1);
            if (bfStrictMatch) {
                extractedTransactions.push(`BALANCE FORWARD ${bfStrictMatch[1]} ${bfStrictMatch[2]}`);
                balanceForwardAlreadyExtracted = true;
                continue;
            }
            const bfMergedMatch = currentLine.match(BF_MERGED_LINE_REGEX_PARSER1);
            if (bfMergedMatch) {
                const bfPart = bfMergedMatch[1];
                const remainingPart = bfMergedMatch[2];
                extractedTransactions.push(bfPart);
                balanceForwardAlreadyExtracted = true;
                currentLine = remainingPart;
            }
        }

        const match = currentLine.match(REGEX_PARSER1);
        if (match) {
            let { description, amount, date, balance } = match.groups;
            if (balanceForwardAlreadyExtracted && description.includes('BALANCE FORWARD') && !currentLine.match(STRICT_BALANCE_FORWARD_REGEX_PARSER1)) {
                // Skip adding redundant BF if it's already captured.
            } else {
                extractedTransactions.push(formatTransactionParser1(description, amount, date, balance));
            }
        }
    }
    return extractedTransactions;
}

/**
 * Core function to extract transaction lines from PDF.js text content,
 * using right-to-left parsing from tdaccc2.html (Parser 2).
 * @param {Object} textContent - The textContent object from PDF.js.
 * @returns {string[]} An array of formatted transaction strings.
 */
function extractTransactionsFromTextContentParser2(textContent) {
    const items = textContent.items;
    let rawLines = [];
    let currentLineText = '';
    let lastY = -1;
    let lastX = -1;

    items.sort((a, b) => {
        if (a.transform[5] !== b.transform[5]) {
            return b.transform[5] - a.transform[5];
        }
        return a.transform[4] - b.transform[4];
    });

    for (const item of items) {
        const y = item.transform[5];
        const x = item.transform[4];
        const text = item.str.trim();

        if (!text) continue;

        if (lastY === -1 || Math.abs(y - lastY) > item.height * 0.75) {
            if (currentLineText.length > 0) {
                rawLines.push(currentLineText.trim());
            }
            currentLineText = text;
        } else {
            const horizontalGap = x - lastX;
            const spaceThreshold = 2.25;
            if (horizontalGap > spaceThreshold) {
                currentLineText += ' ' + text;
            } else {
                currentLineText += text;
            }
        }
        lastY = y;
        lastX = x + item.width;
    }
    if (currentLineText.length > 0) {
        rawLines.push(currentLineText.trim());
    }

    let extractedTransactions = [];
    let inTransactionBlock = false;

    for (let line of rawLines) {
        let cleanLine = line.replace(/\s+/g, ' ').trim();
        cleanLine = cleanLine.replace(/STARTINGBALANCE/g, 'STARTING BALANCE');
        cleanLine = cleanLine.replace(/CLOSINGBALANCE/g, 'CLOSING BALANCE');

        if (cleanLine.includes("Description Withdrawals Deposits Date Balance") ||
            cleanLine.includes("Statement From To") ||
            cleanLine.includes("STARTING BALANCE")
        ) {
            inTransactionBlock = true;
            if (cleanLine.includes("Description Withdrawals Deposits Date Balance") || cleanLine.includes("Statement From To")) {
                continue;
            }
        }

        if (inTransactionBlock) {
            let tempLine = cleanLine;
            let finalBalance = '';
            let finalDate = '';
            let finalAmount = '';
            let finalDescription = '';

            const balanceMatch = tempLine.match(/(\S+)$/);
            if (balanceMatch && balanceMatch[1].match(BALANCE_PATTERN_PARSER2)) {
                finalBalance = balanceMatch[1];
                tempLine = tempLine.substring(0, balanceMatch.index).trim();
            }

            const dateMatch = tempLine.match(/(\S+)$/);
            if (dateMatch && dateMatch[1].match(DATE_PATTERN_PARSER2)) {
                finalDate = dateMatch[1];
                tempLine = tempLine.substring(0, dateMatch.index).trim();
            } else {
                continue;
            }

            const amountMatch = tempLine.match(/(\S+)$/);
            if (amountMatch && amountMatch[1].match(AMOUNT_PATTERN_PARSER2)) {
                finalAmount = amountMatch[1];
                tempLine = tempLine.substring(0, amountMatch.index).trim();
            }

            finalDescription = tempLine.trim();

            const isNoise = finalDescription.includes('ACCOUNT ISSUED BY') ||
                            finalDescription.includes('Overdraft Limit') ||
                            finalDescription.includes('Minimum Payment') ||
                            finalDescription.includes('Examples of Interest Charges') ||
                            finalDescription.includes('You are over your Overdraft Limit') ||
                            finalDescription.includes('Fees Paid') ||
                            finalDescription.includes('TRANSACTIONS') ||
                            finalDescription.includes('UNLIMITED') ||
                            finalDescription.includes('Page') ||
                            finalDescription.includes('Statement From To') ||
                            finalDescription.toLowerCase() === 'description' ||
                            finalDescription.toLowerCase() === 'withdrawals' ||
                            finalDescription.toLowerCase() === 'deposits' ||
                            finalDescription.toLowerCase() === 'date' ||
                            finalDescription.toLowerCase() === 'balance' ||
                            finalDescription.length < 3;

            if (finalDescription && finalDate && !isNoise) {
                let formattedTransaction = finalDescription;
                if (finalAmount) {
                    formattedTransaction += ` ${finalAmount}`;
                }
                formattedTransaction += ` ${finalDate}`;
                if (finalBalance) {
                    formattedTransaction += ` ${finalBalance}`;
                }
                extractedTransactions.push(formattedTransaction.trim());
            }
        }
    }
    return extractedTransactions;
}

/**
 * Main function to parse the PDF and extract transactions using both parsers.
 * It attempts Parser 1 first, and if results are few, it tries Parser 2.
 * This function is adapted from TdFull.html's parsePdf function.
 * @param {File} file - The PDF file to parse.
 * @returns {Promise<string>} A promise that resolves to a single string containing all extracted transactions,
 * separated by newlines, suitable for inputText.
 */
window.bankUtils.processPDFFile = async function(file) {
    displayStatusMessage('Parsing PDF...', 'info');

    try {
        const arrayBuffer = await file.arrayBuffer();
        // pdfjsLib is expected to be loaded globally by index.html
        const pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let extractedTransactions = [];

        // --- Attempt to parse with Parser 1 (tdacc.html logic) ---
        try {
            const transactionsFromParser1 = await parsePdfFormat1(pdfDocument);
            if (transactionsFromParser1.length > 5) { // Heuristic: if more than 5 transactions, assume success
                extractedTransactions = transactionsFromParser1;
                displayStatusMessage('Successfully parsed with Parser 1.', 'success');
            } else {
                displayStatusMessage('Parser 1 found few transactions, trying Parser 2...', 'info');
                // If Parser 1 yields few results, try Parser 2
                let allPageTextContents = [];
                for (let i = 1; i <= pdfDocument.numPages; i++) {
                    const page = await pdfDocument.getPage(i);
                    const textContent = await page.getTextContent();
                    allPageTextContents.push(textContent);
                }

                for (const textContent of allPageTextContents) {
                    const pageTransactions = extractTransactionsFromTextContentParser2(textContent);
                    extractedTransactions = extractedTransactions.concat(pageTransactions);
                }
                if (extractedTransactions.length > 0) {
                    displayStatusMessage('Successfully parsed with Parser 2.', 'success');
                }
            }
        } catch (error) {
            console.warn('Parser 1 failed, attempting Parser 2:', error);
            displayStatusMessage('Parser 1 failed, trying Parser 2...', 'error');
            // If Parser 1 throws an error, proceed to try Parser 2
            let allPageTextContents = [];
            for (let i = 1; i <= pdfDocument.numPages; i++) {
                const page = await pdfDocument.getPage(i);
                const textContent = await page.getTextContent();
                allPageTextContents.push(textContent);
            }

            for (const textContent of allPageTextContents) {
                const pageTransactions = extractTransactionsFromTextContentParser2(textContent);
                extractedTransactions = extractedTransactions.concat(pageTransactions);
            }
            if (extractedTransactions.length > 0) {
                displayStatusMessage('Successfully parsed with Parser 2 after Parser 1 failure.', 'success');
            }
        }

        if (extractedTransactions.length === 0) {
            displayStatusMessage('No transactions found in the PDF using either parser. Please ensure it is a valid TD bank statement format.', 'error');
            return ''; // Return empty string if no transactions found
        }

        return extractedTransactions.join('\n');

    } catch (error) {
        console.error('Error parsing PDF:', error);
        displayStatusMessage(`Failed to parse PDF: ${error.message}. Please check the file or try again.`, 'error');
        throw new Error(`Failed to parse PDF: ${error.message}`);
    }
};


// Main data processing function for text input (from original tdAccount.js)
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
  const rows = [];
  let currentBalance = null;
  let isOverdraft = false;
  let buffer = []; // Buffer for multi-line transactions

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

  // Default keywords (fallback) - these are not directly used for debit/credit in this version
  // but kept for potential future use or consistency with other scripts.
  const defaultKeywords = {
    debit: [
      "ATM W/D", "CASH WITHDRA", "WITHDRAW", "FEE", "SERVICE CHARGE",
      "MONTHLY PLAN FEE", "OVERDRAFT FEE", "O.D.P. FEE", "SEND E-TFR", // "SEND E-TFR" is here
      "TFR-TO", "PAYMENT TO", "NSF FEE", "BILL PAYMENT", "PURCHASE", "PAYMENT"
    ],
    credit: [
      "DEPOSIT", "TFR-FR", "E-TRANSFER", "E-TFR", // "E-TFR" is here
      "PAYMENT - THANK YOU", "REFUND", "INTEREST RECEIVED", "REMITTANCE", "GC DEPOSIT",
      "TRANSFER FR", "RECEIVED", "CREDIT"
    ]
  };

  // Regular expressions for parsing
  // This regex is for lines that contain a description, amount, date, and optionally a balance.
  // It's designed to be flexible for multi-line descriptions.
  // CORRECTED: Added optional '-' to the balance amount capture group (?:-?[\d,]+\.\d{2})
  const transactionLinePattern = /^(.*?)\s+([\d,]+\.\d{2})\s+([A-Z]{3}\d{1,2})(?:\s+(-?[\d,]+\.\d{2})(OD)?)?$/i;
  const balanceForwardRegex = /(BALANCE FORWARD|STARTING BALANCE)\s+([A-Z]{3}\d{1,2})(?:\s+(-?[\d,]+\.\d{2})(OD)?)?/i;
  const dateRegex = /^([A-Z]{3})(\d{1,2})$/; // For parsing date strings like "JAN31"

  // Helper function to format date (e.g., "JAN31" -> "Jan 31 2024")
  function formatDate(dateStr, year) {
    const match = dateStr.match(dateRegex);
    if (!match) return dateStr;

    const [, monthAbbr, day] = match;
    const months = {
      JAN: 'Jan', FEB: 'Feb', MAR: 'Mar', APR: 'Apr', MAY: 'May', JUN: 'Jun',
      JUL: 'Jul', AUG: 'Aug', SEP: 'Oct', NOV: 'Nov', DEC: 'Dec'
    };

    const month = months[monthAbbr.toUpperCase()] || monthAbbr;
    const dayPadded = day.padStart(2, '0');

    // Only include year if provided
    return year ? `${month} ${dayPadded} ${year}` : `${month} ${dayPadded}`;
  }

  // Helper function to format balance (e.g., "123.45" or "-123.45")
  function formatBalance(balance, overdraft) {
    if (balance === null || isNaN(balance)) return '';
    // Removed the 'OD' suffix. toFixed(2) will handle the negative sign if balance is negative.
    return balance.toFixed(2);
  }

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const fullBufferedText = buffer.join(' '); // Combine all lines in the buffer
    buffer = []; // Clear buffer after joining

    // Check for BALANCE FORWARD or STARTING BALANCE line
    const balanceForwardMatch = fullBufferedText.match(balanceForwardRegex);
    if (balanceForwardMatch) {
      const [, balanceType, dateStr, balanceAmountStr, odFlag] = balanceForwardMatch;
      if (balanceAmountStr) {
        currentBalance = parseFloat(balanceAmountStr.replace(/,/g, ''));
        isOverdraft = odFlag === 'OD';
        // NEW RULE: If it's an overdraft and not already negative, make it negative.
        if (isOverdraft && currentBalance > 0) {
          currentBalance = -currentBalance;
        }
      }
      // Do NOT push balance lines to rows array, just update currentBalance
      return;
    }

    // Try to match the full transaction line pattern
    const transactionMatch = fullBufferedText.match(transactionLinePattern);
    if (!transactionMatch) {
      // If it doesn't match the standard transaction pattern, it might be a multi-line description
      // that doesn't have the amount/date at the very end, or an unparsable line.
      // For now, we'll skip it, but this is where more complex multi-line logic would go.
      return;
    }

    // Extract parts from the transaction match
    const [, rawDescriptionPart, amountStr, dateStr, newBalanceStr, newOdFlag] = transactionMatch;
    const amount = parseFloat(amountStr.replace(/,/g, ''));

    let newBalance = newBalanceStr ? parseFloat(newBalanceStr.replace(/,/g, '')) : null;
    const willBeOverdraft = newOdFlag === 'OD';

    // NEW RULE: If it's an overdraft and not already negative, make it negative.
    if (newBalance !== null && willBeOverdraft && newBalance > 0) {
      newBalance = -newBalance;
    }

    // The description should be the rawDescriptionPart, which already excludes the final amount, date, and balance
    let description = rawDescriptionPart.trim();
    description = description.replace(/\s+/g, ' ').trim(); // Normalize spaces

    let debit = '';
    let credit = '';

    // Step 1: Explicitly handle "SEND E-TFR" as a debit, overriding other logic.
    if (description.toLowerCase().includes("send e-tfr")) {
        debit = amount.toFixed(2);
        if (currentBalance !== null) {
            currentBalance = currentBalance - amount;
            isOverdraft = currentBalance < 0;
        }
    }
    // Step 2: If not "SEND E-TFR", then proceed with balance-based or other keyword-based logic.
    else if (currentBalance !== null && newBalance !== null) {
      // Use the actual balance change to determine debit/credit
      const balanceBefore = isOverdraft ? -Math.abs(currentBalance) : currentBalance; // Use Math.abs for overdraft balance, then negate
      const balanceAfter = willBeOverdraft ? -Math.abs(newBalance) : newBalance;
      const calculatedChange = balanceAfter - balanceBefore;

      if (Math.abs(calculatedChange - amount) < 0.01) {
        // Balance increased by amount = credit
        credit = amount.toFixed(2);
      } else if (Math.abs(calculatedChange + amount) < 0.01) {
        // Balance decreased by amount = debit
        debit = amount.toFixed(2);
      } else {
        // Fallback if precise match fails (e.g., for fees, interest, or complex transactions)
        // Infer based on balance change direction
        if (calculatedChange < 0) {
          debit = amount.toFixed(2);
        } else {
          credit = amount.toFixed(2);
        }
      }
      currentBalance = newBalance;
      isOverdraft = willBeOverdraft;
    } else {
      // If newBalance is not available, use keyword matching (or just assume debit if no keywords)
      const descLower = description.toLowerCase();
      const isCreditByKeyword = defaultKeywords.credit.some(keyword =>
          descLower.includes(keyword.toLowerCase())
      );

      if (isCreditByKeyword) {
        credit = amount.toFixed(2);
        if (currentBalance !== null) { // Update estimated balance if possible
          currentBalance = currentBalance + amount;
          isOverdraft = currentBalance < 0;
        }
      } else {
        // Fallback: if no specific credit keywords, assume debit
        debit = amount.toFixed(2);
        if (currentBalance !== null) { // Update estimated balance if possible
          currentBalance = currentBalance - amount;
          isOverdraft = currentBalance < 0;
        }
      }
    }

    // Add the row to the table
    rows.push([
      formatDate(dateStr, yearInput),
      description,
      debit,
      credit,
      newBalance !== null ? formatBalance(newBalance, willBeOverdraft) : '' // Use empty string if no balance
    ]);
  };

  // Iterate through lines to build transaction buffers
  lines.forEach(line => {
    // If the line matches the start of a new transaction or a balance forward, flush the buffer
    if (transactionLinePattern.test(line) || balanceForwardRegex.test(line)) {
      flushBuffer(); // Process previous transaction
    }
    buffer.push(line); // Add current line to buffer
  });

  flushBuffer(); // Process the last transaction in the buffer

  // Add rows to the table
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
  table.dataset.rows = JSON.stringify(rows); // Ensure rows are stored in dataset

  // Assuming updateTableCursor is available globally from main.js or other script
  if (typeof window.updateTableCursor === 'function') {
      window.updateTableCursor();
  }
  displayStatusMessage('Data processed successfully!', 'success');
}

// Export processData globally
window.processData = processData;


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
  dropArea.addEventListener('drop', async (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    await window.bankUtils.handleFiles(files); // Call the bankUtils version
  }, false);

  // Handle file input changes - now calls window.bankUtils.handleFiles
  fileInput.addEventListener('change', async (e) => {
    await window.bankUtils.handleFiles(e.target.files); // Call the bankUtils version
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
  // Assumes Sortable.js library is available
  if (typeof Sortable !== 'undefined') {
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
      removeBtn.innerHTML = '<i class="fas fa-times"></i>'; // Requires FontAwesome or similar for icon
      removeBtn.onclick = () => {
          fileItem.remove();
          // Re-process inputText if files are removed and order matters, or clear if no files remain
          if (fileList.children.length === 0) {
              inputText.value = '';
              fileListContainer.style.display = 'none';
          }
      };

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
        // Automatically trigger processing of the combined text after PDF is parsed
        processData();
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

// Re-adding this function as it was present in bmoAccount.js and is good practice for status messages
function displayStatusMessage(message, type) {
  const statusMessageDiv = document.querySelector('.status-message'); // Assumes an element with this class exists
  if (statusMessageDiv) {
    statusMessageDiv.textContent = message;
    statusMessageDiv.className = `status-message ${type}`; // Apply type for styling (e.g., 'error', 'success', 'info')
    statusMessageDiv.style.display = 'block';
    setTimeout(() => {
        statusMessageDiv.style.display = 'none'; // Hide after a few seconds
    }, 5000); // Hide after 5 seconds
  } else {
    // Fallback if no specific status message div is found, useful for debugging
    console.log(`Status (${type}): ${message}`);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  setupFileUpload();
});
