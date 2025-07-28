// triangleCard.js - Integrated PDF processing and Triangle Card statement parsing

// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

// Set up PDF.js worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.worker.min.js';

// --- UI Utility Functions (Copied from pars.html for direct use) ---
/**
 * Displays a message in the message box.
 * Assumes a div with id 'messageBox' exists in the HTML.
 * @param {string} message - The message to display.
 * @param {string} type - The type of message (e.g., 'error', 'info').
 */
function showMessage(message, type = 'info') {
  const messageBox = document.getElementById('messageBox');
  if (messageBox) {
    messageBox.textContent = message;
    messageBox.className = `message-box show bg-${type === 'error' ? 'red' : 'yellow'}-100 border-${type === 'error' ? 'red' : 'yellow'}-400 text-${type === 'error' ? 'red' : 'yellow'}-700`;
  } else {
    console.warn("Message box not found in DOM.");
  }
}

/**
 * Clears the message box.
 * Assumes a div with id 'messageBox' exists in the HTML.
 */
function clearMessage() {
  const messageBox = document.getElementById('messageBox');
  if (messageBox) {
    messageBox.textContent = '';
    messageBox.classList.remove('show');
  } else {
    console.warn("Message box not found in DOM.");
  }
}

// --- PDF Parsing Logic (Adapted from triangle.html) ---

/**
 * Parses a PDF file and extracts text content with line breaks.
 * @param {File} file - The PDF file to parse.
 * @returns {Promise<string>} - A promise that resolves with the extracted text.
 */
async function parsePdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullTextWithLineBreaks = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        let lastY = -1;
        let lastX = -1;
        let lastFontHeight = -1;

        textContent.items.forEach(item => {
            const currentY = item.transform[5]; // Y-coordinate
            const currentX = item.transform[4]; // X-coordinate
            const currentFontHeight = item.height; // Approximate font height

            // Add a newline if the Y coordinate significantly changes (new line)
            // or if there's a large horizontal gap that suggests a new block
            if (lastY !== -1 && (currentY < lastY - (currentFontHeight * 0.5) || // New line (Y decreased significantly)
                                 (currentY > lastY + (currentFontHeight * 0.5) && currentX < lastX) || // New line (Y increased, but X is left, implying new block)
                                 (currentX > lastX + (item.width * 2) && currentY === lastY) // Large horizontal gap on same line
                                )) {
                fullTextWithLineBreaks += '\n';
            } else if (lastX !== -1 && currentX > lastX && currentY === lastY) {
                // If on the same line, add a space if there's a gap
                if (currentX - lastX > item.width * 0.5) { // If gap is more than half a character width
                    fullTextWithLineBreaks += ' ';
                }
            }

            fullTextWithLineBreaks += item.str;
            lastY = currentY;
            lastX = currentX + item.width; // Update lastX to the end of the current item
            lastFontHeight = currentFontHeight;
        });
        fullTextWithLineBreaks += '\n\n'; // Add extra newlines between pages
    }

    return fullTextWithLineBreaks;
}

/**
 * Extracts and formats transactions from the raw text content.
 * This function is adapted from triangle.html's extractTransactions,
 * modified to only take the first date and handle debit/credit.
 * @param {string} text - The raw text content from the PDF.
 * @returns {Array<Object>} - An array of transaction objects.
 */
function extractTransactions(text) {
    const transactions = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    const monthOrder = {
        "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
        "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12
    };

    // Regex to match an amount, including an optional leading negative sign
    const amountPattern = /-?\d{1,3}(?:,\d{3})*\.\d{2}/;

    let currentTransaction = null;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Check if the line starts with two dates (potential transaction start)
        const transactionStartMatch = line.match(/^(\w{3} \d{1,2})\s+(\w{3} \d{1,2})\s+(.*)/);

        if (transactionStartMatch) {
            // If we have a pending transaction, finalize it
            if (currentTransaction) {
                const finalAmountMatch = currentTransaction.description.match(amountPattern);
                if (finalAmountMatch) {
                    // Use finalAmountMatch[0] to get the full matched string (including '-')
                    const amount = parseFloat(finalAmountMatch[0].replace(/,/g, ''));
                    const description = currentTransaction.description.replace(finalAmountMatch[0], '').trim();
                    transactions.push({
                        date: currentTransaction.postingDate, // Only take the first date
                        description: description,
                        amount: amount
                    });
                }
            }

            // Start a new transaction
            currentTransaction = {
                postingDate: transactionStartMatch[1], // This is the first date
                transactionDate: transactionStartMatch[2],
                description: transactionStartMatch[3].trim()
            };

            // Check if the amount is on the same line
            const amountOnSameLineMatch = currentTransaction.description.match(amountPattern);
            if (amountOnSameLineMatch) {
                // Use amountOnSameLineMatch[0] to get the full matched string (including '-')
                const amount = parseFloat(amountOnSameLineMatch[0].replace(/,/g, ''));
                const description = currentTransaction.description.replace(amountOnSameLineMatch[0], '').trim();
                transactions.push({
                    date: currentTransaction.postingDate, // Only take the first date
                    description: description,
                    amount: amount
                });
                currentTransaction = null; // Transaction complete
            }

        } else if (currentTransaction) {
            // If we are in the middle of a multi-line transaction description
            // Check if the line contains an amount, which would signify the end of the description
            const amountInLineMatch = line.match(amountPattern);
            if (amountInLineMatch) {
                // Use amountInLineMatch[0] to get the full matched string (including '-')
                const amount = parseFloat(amountInLineMatch[0].replace(/,/g, ''));
                const descriptionPart = line.replace(amountInLineMatch[0], '').trim();
                currentTransaction.description += ' ' + descriptionPart; // Add remaining part of description
                transactions.push({
                    date: currentTransaction.postingDate, // Only take the first date
                    description: currentTransaction.description.trim(),
                    amount: amount
                });
                currentTransaction = null; // Transaction complete
            } else {
                // Otherwise, it's just another line of the description
                currentTransaction.description += ' ' + line;
            }
        }
    }

    // Finalize any remaining transaction after the loop
    if (currentTransaction) {
        const finalAmountMatch = currentTransaction.description.match(amountPattern);
        if (finalAmountMatch) {
            // Use finalAmountMatch[0] to get the full matched string (including '-')
            const amount = parseFloat(finalAmountMatch[0].replace(/,/g, ''));
            const description = currentTransaction.description.replace(finalAmountMatch[0], '').trim();
            transactions.push({
                date: currentTransaction.postingDate, // Only take the first date
                description: description,
                amount: amount
            });
        }
    }

    // Post-processing, cleaning, and sorting
    const finalTransactions = [];
    for (const trans of transactions) {
        let { date, description, amount } = trans;

        // Clean description
        description = description.replace(/5446 12XX XXXX \d{4}/g, '').trim();
        description = description.replace(/Total purchases for \S+ \S+ \S+ \S+/g, '').trim();
        description = description.replace(/Purchases - Card #\S+ \S+ \S+ \S+/g, '').trim();
        description = description.replace(/TRANSACTION DATE POSTING DATE TRANSACTION DESCRIPTION AMOUNT \(\$\)/g, '').trim();
        description = description.replace(/TRANSACTION DESCRIPTION DATE AMOUNT \(\$\)/g, '').trim();
        description = description.replace(/TRANSACTION POSTING DATE TRANSACTION DESCRIPTION AMOUNT \(\$\)/g, '').trim();
        description = description.replace(/TRANSACTION DATE POSTING TRANSACTION DESCRIPTION AMOUNT \(\$\)/g, '').trim();
        description = description.replace(/Card #/g, '').trim();
        description = description.replace(/^[-\s]+/, '').trim();
        description = description.replace(/[\r\n]+/g, ' ').trim();
        description = description.replace(/\s+/g, ' ').trim(); // Normalize multiple spaces

        // Filter out known non-transaction lines that might have slipped through
        const nonTransactionKeywords = [
            'Total purchases', 'Total payments received', 'Total returns and credits',
            'Your Triangle Mastercard Statement', 'Account number',
            'Information about your account', 'Billing errors', 'If your card has been stolen or lost',
            'Minimum payment due', 'Making payments', 'Pre-authorized payment',
            'Receiving promotional material', 'Details of the Loyalty rewards program',
            'Charges include the following taxes', 'Tax rates are subject to change',
            'The Triangle Rewards Program is owned and operated by Canadian Tire Corporation',
            'Unless otherwise noted', 'Mastercard is a registered trademark', 'WAYS TO PAY',
            'Online banking', 'Pre-authorized payment', 'At any Canadian Tire store',
            'Please allow enough time for your payment to reach us by the due date',
            'New address', 'If you choose to mail your payment', 'You can mail payment to',
            'MESSAGES', 'continued on next page', 'Page', 'Bank', 'MY Y TRAN', 'QUESTIONS', 'Customer service',
            'Payment Information', 'Statement date', 'Card #', 'Balance Due', 'Minimum payment due',
            'Payment due date', 'CTB E', 'TRIANGLE REWARDSTM', 'Canadian Tire Money',
            'Previous balance', 'New this period', 'Adjustments', 'Redeemed this period', 'Bonus',
            'Total on', 'SEE PAGE 2 FOR WAYS TO PAY', 'URGENT ATTENTION REQUIRED',
            'PAST DUE - PAY TODAY', 'Includes Past Due Amount', 'If you only pay the minimum payment due',
            'Pay this amount by the Payment que date', 'Avoid interruption', 'COLLECT CT MONEY EVERYWHERE YOU SHOP',
            'Collect 4% back', 'Hockey Life', 'The gear you need', 'The rewards you love',
            'on qualifying purchases in-store and online at Pro Hockey Life', 'Not all items sold are eligible',
            'Conditions apply', 'The offered rate is exclusive', 'CT Money is collected on the pre-tax amount',
            '/TM Unless otherwise noted, all trademarks are owned', 'Mastercard, World Mastercard, World Elite Mastercard and the circles are registered trademarks of Mastercard International Incorporated',
            'Details of your Canadian Tire store purchases', 'The total of each transaction is included in the Purchases section',
            'QUANTITY DETAILS', 'GST/HST', 'PST', 'Total for transaction', 'Pay bills from the comfort of home',
            'Get rewarded', 'Hydro', 'Cell Phone', 'Internet', '...and more', 'For more information, see the "Details of your Party City store purchases" section.',
            'TRANSACTION TYPE', 'ANNUAL INTEREST RATE', 'DAILY INTEREST RATE',
            'Cash Transactions and Fees', 'Total interest charges', 'Other details about your account',
            'Details of your interest charges', 'New Offer!', 'Get 50 per litre in CT Money', 'PLUS, collect 20% more Petro-Points',
            'You must have a registered account with both Thangle Rewards', 'Learn more at triangle.com /petro-points',
            'CT Money is collected on the number of whole litres of fuel', 'Rate subject to change and could vary by location',
            'Triangle World Elite Mastercard holders collect 7 per litre back on premium fuel', 'Not all Gas+ locations have premium fuel',
            'Petro-Canada in a Partr In the Triangle Rewards program', 'Visit the Parmers page at triangle.com .for details and exclusions',
            'Mastercard, World Mastercard and World Elite Mastercant are registered trademarks',
            'Each time you use your linked Triangle Rewards cand or Felro-Points card', 'on qurrifying purchases at Petro-Canada and participating Gas locations',
            'you will sam a bonus of twenty percent (20%) more Petro-Points than you normally sarn',
            'Bonus points are not calculated on an sam already amplified by another partner bonus',
            'You must have a registered account with both Triangle Rewards and Petro-Paints to link your accounts',
            'Once linked, meribers can use either their Triangle Rewards or Petro-Points card',
            'The Triangle Rewards Program is owned and operated by Canadian Tine Corporation',
            'Petro-Canada is a Partner in the Triangle Rewards program', 'Terms and conditions apply',
            'Visit triangle.com for full program rules and Partner location information',
            'Excludes the Gas+ location at 2, rue Gauthier Nord, Notre-Dame-des-Prairies, QC',
            'Petro-Canada in a Suncor business Petro-Canada', 'the Petro-Canada logo', 'Petro-Points and the Petro-Points logo are trademarks of Suncor Energy Inc.',
            'Used under licencs', 'Canadian Tire Money, CT Money, Triangle, Triangle Rewards and the Triangle design am registered trademarics owned by Canallion Tim Corporation, Limited, and are used under licence'
        ];

        let isNonTransaction = false;
        for (const keyword of nonTransactionKeywords) {
            if (description.includes(keyword)) {
                isNonTransaction = true;
                break;
            }
        }
        if (isNonTransaction) {
            continue; // Skip this entry if it contains a non-transaction keyword
        }

        if (description.length > 0) {
            finalTransactions.push({ date, description, amount });
        }
    }

    // Sort transactions by their date in ascending order
    finalTransactions.sort((a, b) => {
        const aParts = a.date.split(' ');
        const bParts = b.date.split(' ');

        const aMonth = monthOrder[aParts[0]];
        const aDay = parseInt(aParts[1]);
        const bMonth = monthOrder[bParts[0]];
        const bDay = parseInt(bParts[1]);

        if (aMonth !== bMonth) {
            return aMonth - bMonth;
        }
        return aDay - bDay;
    });

    return finalTransactions;
}

// --- Main PDF File Processing Function (part of window.bankUtils) ---
// This function will be called by main.js when a PDF file is uploaded
window.bankUtils.processPDFFile = async function(file) {
  clearMessage(); // Clear any previous messages
  showMessage('Processing PDF... Please wait.', 'info');

  if (!file || file.type !== 'application/pdf') {
    showMessage('Please upload a valid PDF file.', 'error');
    return ""; // Return empty string if not a PDF
  }

  try {
    const rawText = await parsePdf(file);
    const parsedTransactions = extractTransactions(rawText);

    if (parsedTransactions.length > 0) {
      // Format transactions for inputText: Date Description Debit Credit
      // We need to convert the array of objects into a string format that processData expects.
      const formattedText = parsedTransactions.map(tx => {
        const date = tx.date;
        const description = tx.description;
        let debit = '';
        let credit = '';

        if (tx.amount >= 0) {
          debit = tx.amount.toFixed(2);
        } else {
          // Keep the negative sign for the input box, processData will handle it
          credit = tx.amount.toFixed(2); 
        }
        return `${date} ${description} ${debit} ${credit}`;
      }).join('\n');

      showMessage('PDF processed successfully!', 'success');
      return formattedText;
    } else {
      showMessage('No transactions found or could not parse the document from PDF.', 'error');
      return ''; // Return empty string if no transactions found
    }

  } catch (error) {
    console.error('Error processing PDF:', error);
    showMessage(`An error occurred during PDF processing: ${error.message}`, 'error');
    return ''; // Return empty string on error
  }
};


// --- Main Data Processing Function (Existing bmoCard.js logic, adapted for Triangle) ---
// This function processes the text content (either manually entered or from PDF)
// and populates the HTML table.
function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = ''; // Clear previous output

  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
  const rows = [];
  const table = document.createElement('table');

  // Header row
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  const lines = input.split('\n').map(l => l.trim()).filter(Boolean);

  // Regex pattern for the expected input format: Date Description Debit Credit
  // Date: (Month Day) e.g., Jan 15
  // Description: (any text)
  // Debit/Credit: (numeric amount, optional)
  // Updated to allow for optional negative sign for both debit and credit amounts
  const linePattern = /^(\w{3}\s+\d{1,2})\s+(.*?)\s+(-?\d{1,3}(?:,\d{3})*\.\d{2})?\s*(-?\d{1,3}(?:,\d{3})*\.\d{2})?$/;

  lines.forEach(line => {
    const match = line.match(linePattern);
    if (match) {
      const [, dateRaw, description, debitRaw, creditRaw] = match;

      const date = yearInput ? `${dateRaw} ${yearInput}` : dateRaw;
      let debit = '';
      let credit = '';

      // Logic to correctly assign amounts to Debit/Credit columns
      if (debitRaw && debitRaw.trim() !== '') {
        const amount = parseFloat(debitRaw.replace(/,/g, ''));
        if (!isNaN(amount)) {
          if (amount >= 0) {
            debit = amount.toFixed(2);
          } else {
            // If a negative amount is found in the debit position, treat as credit
            credit = Math.abs(amount).toFixed(2);
          }
        }
      } else if (creditRaw && creditRaw.trim() !== '') {
        const amount = parseFloat(creditRaw.replace(/,/g, ''));
        if (!isNaN(amount)) {
          if (amount < 0) {
            // Negative amount in credit position means it's a credit (display as positive)
            credit = Math.abs(amount).toFixed(2);
          } else {
            // If a positive amount is found in the credit position, treat as debit
            debit = amount.toFixed(2);
          }
        }
      }
      
      const row = [date, description.trim(), debit, credit, '']; // Balance not available
      rows.push(row);

      const tr = document.createElement('tr');
      row.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      });
      table.appendChild(tr);
    }
  });

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(rows);

  // Update UI elements from main.js (assuming they are globally available or imported)
  // These functions are expected to be present in main.js
  if (typeof document.getElementById('toolbar') !== 'undefined') {
    document.getElementById('toolbar').classList.add('show');
  }
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
  if (typeof saveState === 'function') { // saveState is defined in main.js
    saveState();
  }
  if (typeof createCopyColumnButtons === 'function') { // createCopyColumnButtons is defined in main.js
    createCopyColumnButtons();
  }
  if (typeof checkAndRemoveEmptyBalanceColumn === 'function') { // checkAndRemoveEmptyBalanceColumn is defined in main.js
    checkAndRemoveEmptyBalanceColumn();
  }
  if (typeof updateTableCursor === 'function') { // updateTableCursor is defined in main.js
    updateTableCursor();
  }
}

// Export processData globally so main.js can call it
window.processData = processData;
