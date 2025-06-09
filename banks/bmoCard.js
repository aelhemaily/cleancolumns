// bmoCard.js - Integrated PDF processing and BMO Card statement parsing

// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

// Set up PDF.js worker source
// This line must be present to allow PDF.js to function
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

// --- PDF Parsing Logic (Adapted from pars.html) ---

/**
 * Detects if the PDF is in Format 1.
 * Format 1 typically has "Transactions since your last statement" and a simpler structure.
 * @param {string[]} lines - All extracted lines from the PDF.
 * @returns {boolean} - True if Format 1 is detected.
 */
function detectFormat1(lines) {
  const keywords = [
    "Transactions since your last statement",
    "Previous total balance",
    "Payment due date:",
    "Your credit limit"
  ];
  return keywords.some(keyword => lines.some(line => line.includes(keyword))) &&
         !lines.some(line => line.includes("TRANS") && line.includes("REFERENCE NO.")); // Exclude if it looks like Format 2
}

/**
 * Detects if the PDF is in Format 2.
 * Format 2 typically has "TRANS DATE POSTING DATE DESCRIPTION REFERENCE NO. AMOUNT (S)" header.
 * @param {string[]} lines - All extracted lines from the PDF.
 * @returns {boolean} - True if Format 2 is detected.
 */
function detectFormat2(lines) {
  const keywords = [
    "TRANS", "DATE", "POSTING", "DESCRIPTION", "REFERENCE NO.", "AMOUNT (S)",
    "Purchases and other charges",
    "New Balance, Feb." // Specific to format 2s.pdf
  ];
  return keywords.every(keyword => lines.some(line => line.includes(keyword)));
}

/**
 * Parses transactions from Format 1 PDF text lines.
 * This function handles multi-line descriptions and filters out irrelevant lines.
 * It also includes logic to omit the "Total for card number" line and remove "$" from amounts.
 * @param {string[]} allLines - All extracted lines from the PDF.
 * @returns {string[]} - Array of formatted transaction strings.
 */
function parseFormat1(allLines) {
  const transactions = [];
  const amountRegex = /\d{1,3}(?:,\d{3})*\.\d{2}\s*(CR)?$/; // "123.45" or "123.45 CR"
  const datePattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}/g; // Matches "Jan. 1" or "Jan 1"
  // Regex to specifically identify and omit the "Total for card number" line
  const totalCardNumberOmissionPattern = /Total for card number(?: XXXX){3} \d{4}\s*\$?\d{1,3}(?:,\d{3})*\.\d{2}/i;
  const subtotalOmissionPattern = /Subtotal for(?: MR ALI AL-JANABI| card number)?\s*\$?\d{1,3}(?:,\d{3})*\.\d{2}/i;


  let currentTransactionLines = [];
  let inTransactionSection = false;

  // Find the start of the transaction section.
  let startIndex = allLines.findIndex(line => line.includes("Transactions since your last statement"));
  if (startIndex === -1) {
    startIndex = allLines.findIndex(line => line.includes("TRANS") && line.includes("DATE") && line.includes("DESCRIPTION") && line.includes("AMOUNT (S)"));
  }

  if (startIndex !== -1) {
    inTransactionSection = true;
    // Skip header lines and any immediate non-transactional lines after the header
    let tempIndex = startIndex + 1;
    while (tempIndex < allLines.length && (allLines[tempIndex].includes("Card number:") || allLines[tempIndex].trim() === "" || allLines[tempIndex].includes("Mr Ali Al-Janabi"))) {
        tempIndex++;
    }
    startIndex = tempIndex;
  } else {
    // Fallback: if no clear section header, start from the beginning and try to find transactions
    startIndex = 0;
  }

  for (let i = startIndex; i < allLines.length; i++) {
    let line = allLines[i].trim();

    // Check if the current line matches the "Total for card number" or "Subtotal for" line and omit it
    if (totalCardNumberOmissionPattern.test(line) || subtotalOmissionPattern.test(line)) {
        // If there's an ongoing transaction block, process it before skipping
        if (currentTransactionLines.length > 0) {
            processFormat1TransactionBlock(currentTransactionLines, transactions);
            currentTransactionLines = [];
        }
        continue; // Skip this line entirely
    }

    // New stopping conditions for the end of transaction data
    const endOfTransactionsPatterns = [
        /Subtotal for(?: MR ALI AL-JANABI| card number)?\s*\$?\d{1,3}(?:,\d{3})*\.\d{2}/i,
        /Total for card number(?: XXXX){3} \d{4}\s*\$?\d{1,3}(?:,\d{3})*\.\d{2}/i,
        /Important Information about changes to your BMO Credit Card/i,
        /Cashback Changes effective/i,
        /Interest Rate Changes:/i,
        /The minimum payment definitions were amended/i,
        /The inactive fee definition was amended/i,
        /The Promotional Balance Transfers rate was amended/i,
        /The interest-free grace period was amended/i,
        /The installment plan fee was amended/i,
        /Important Information about your BMO Cardholder Agreement/i,
        /payments; you will continue to get/i, // New pattern
        /Beginning on your/i, // New pattern
        /Not applicable for Quebec residents/i, // New pattern
        /If you convert a transaction into an interest-bearing installment plan/i, // New pattern
        /Page \d+ of \d+/i, // Skip page numbers
        /TRANS DATE POSTING DATE DESCRIPTION REFERENCE NO\. AMOUNT \(S\)/i // Skip format 2 headers
    ];

    if (endOfTransactionsPatterns.some(pattern => pattern.test(line))) {
        // If an end-of-transaction pattern is found, process any pending transaction and then stop
        if (currentTransactionLines.length > 0) {
            processFormat1TransactionBlock(currentTransactionLines, transactions);
        }
        return transactions; // Stop processing further lines
    }

    // Skip known non-transaction lines regardless of section status
    const globalSkipPatterns = [
      /Page \d+ of \d+/i, /Card number:/i,
      /Trade-marks/i, /Mastercard is a registered trademark/i,
      /Indicates eligible grocery purchases/i, /Indicates eligible recurring bill payments/i,
      /All purchases earn 0\.5% cashback/i, /BMO CashBack Mastercard/i, /Mr Ali Al-Janabi/i,
      /Concerning Agreement/i, /Important Payment Information:/i,
      /Important information about your BMO Mastercard account/i,
      /How to make payments to your credit card account/i,
      /Thank you for choosing BMO/i, /If you only make the minimum monthly payment/i,
      /Please see the back of your statement/i, /BMO Bank of Montreal/i,
      /Balance due/i, /Minimum payment due/i, /Payment due date/i,
      /Your credit limit/i, /Your available credit/i, /Amount over credit limit/i,
      /Estimated time to repay/i, /Security Tip/i, /Your interest charges/i,
      /Contact us/i, /Lost\/stolen cards/i, /Online via Online Banking/i,
      /If you are paying by mail/i, /Currency conversion/i, /We do not accept written requests/i,
      /Please call us/i, /YOUR REWARDS/i, /Cashback earned/i, /Bonus Cashback earned/i,
      /Groceries/i, /Recurring bill/i, /Subtotal bonus earn/i, /Cashback adjusted/i,
      /Cashback redeemed/i, /Total Cashback earned this statement/i, /Cashback balance year to date/i,
      /Redeem now at bmocashback.com/i, /Refer to the Installment Plan section/i,
      /P\.O\. BOX \d+/i, /STATION CENTRE-VILLE/i, /MONTREAL QC/i, /BMO BANK OF MONTREAL/i,
      /5191230200739994/i, /0000000007500/i, /0000000422676/i, /XXXX XXXX XXXX \d{4}/i,
      /MR ALI AL-JANABI/i, /SAEID GORJIAN/i, /1-\d{3}-\d{3}-\d{4}/i, /514-877-0330/i,
      /1-866-859-2089/i, /1-800-263-2263/i, /1-800-361-3361/i, /TTY \(For the Deaf & Hard of Hearing\)/i,
      /Estimated Time to Repay/i, /Foreign currency transactions/i, /Foreign currency conversion/i,
      /Interest-free grace period/i, /Your minimum payment if you reside/i,
      /If your credit card account was opened/i, /How we apply payments to your account/i,
      /If you are moving to or out of Quebec/i, /Includes: credit card cheques/i,
      /Excludes: promotional balance transfers/i, /Indicates eligible grocery purchases that may qualify for/i,
      /Indicates eligible recurring bill payments that may qualify for/i,
      /DATE DESCRIPTION AMOUNT \(\$\)/i, /TRANS DATE POSTING DATE DESCRIPTION REFERENCE NO\. AMOUNT \(S\)/i,
      /^DATE\s+DESCRIPTION\s+AMOUNT \(\$\)$/i,
      /^TRANS DATE\s+POSTING DATE\s+DESCRIPTION\s+REFERENCE NO\.\s+AMOUNT \(S\)$/i,
      /TRANS$/i, // Skip standalone "TRANS" from headers
      /Subtotal for(?: MR ALI AL-JANABI| card number)?\s*\$?\d{1,3}(?:,\d{3})*\.\d{2}/i, // More specific subtotal omission
      /Total for card number(?: XXXX){3} \d{4}\s*\$?\d{1,3}(?:,\d{3})*\.\d{2}/i // More specific total omission
    ];
    
    if (globalSkipPatterns.some(pattern => pattern.test(line))) {
      if (currentTransactionLines.length > 0) {
        processFormat1TransactionBlock(currentTransactionLines, transactions);
        currentTransactionLines = [];
      }
      continue;
    }

    // If the current line contains an amount, it's likely the end of a transaction
    if (amountRegex.test(line)) {
      currentTransactionLines.push(line);

      // --- MODIFIED LOGIC: Check for standalone "CR" on the very next line and include it ---
      if (i + 1 < allLines.length) {
          const nextLine = allLines[i + 1].trim();
          if (nextLine.toLowerCase() === "cr") {
              currentTransactionLines.push(nextLine); // Add "CR" to the block
              i++; // Increment `i` to skip the "CR" line in the next iteration
          }
      }
      // --- END MODIFIED LOGIC ---

      processFormat1TransactionBlock(currentTransactionLines, transactions); // Call this after potential "CR" append
      currentTransactionLines = []; // Reset for the next transaction
    } else {
      // Otherwise, add the line to the current transaction block
      currentTransactionLines.push(line);
    }
  }

  // Process any remaining lines if they form a transaction
  if (currentTransactionLines.length > 0) {
    processFormat1TransactionBlock(currentTransactionLines, transactions);
  }
  return transactions;
}

/**
 * Helper function to process a raw transaction data block for Format 1.
 * This function extracts dates, description, and amounts from a block of lines
 * that are identified as belonging to a single transaction.
 * @param {string[]} blockLines - Array of lines forming a potential transaction block.
 * @param {string[]} transactionsArray - The array to add the formatted transaction to.
 */
function processFormat1TransactionBlock(blockLines, transactionsArray) {
  // Skip header lines immediately
  const headerPatterns = [
    /^DATE DESCRIPTION AMOUNT \(\$\)$/i,
    /^TRANS DATE POSTING DATE DESCRIPTION REFERENCE NO\. AMOUNT \(S\)$/i
  ];
  
  if (headerPatterns.some(pattern => pattern.test(blockLines.join(' ')))) {
    return;
  }

  let combinedText = blockLines.join(' ').replace(/\s+/g, ' ').trim();
  let tempText = combinedText;

  // 1. Extract amount and determine if it's a credit
  // Ensure the regex captures the number and optional CR
  const amountPattern = /\$*(\d{1,3}(?:,\d{3})*\.\d{2})\s*(CR)?$/; 
  let amountMatch = tempText.match(amountPattern);
  
  let amountValue = '';
  let isCredit = false;

  if (amountMatch) {
    amountValue = amountMatch[1]; // The numeric part of the amount
    isCredit = !!amountMatch[2]; // True if 'CR' is present, false otherwise
    tempText = tempText.substring(0, amountMatch.index).replace(/\s{2,}/g, ' ').replace(/\$/g, '').trim(); // Remove amount and any leading '$' from tempText
  } else {
    return; // Skip if no valid amount found
  }

  // 2. Extract dates (looking for 1-2 dates)
  const dates = [];
  const datePattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}/g;
  const dateMatches = [...tempText.matchAll(datePattern)];
  
  if (dateMatches.length >= 2) {
    // Take the last two date matches as Trans Date and Posting Date
    dates.push(dateMatches[dateMatches.length-2][0].replace('.', ''));
    dates.push(dateMatches[dateMatches.length-1][0].replace('.', ''));
    tempText = tempText.replace(datePattern, '').trim(); // Remove dates from tempText
  } else if (dateMatches.length === 1) {
    // If only one date, use it for both Trans and Posting
    dates.push(dateMatches[0][0].replace('.', ''));
    tempText = tempText.replace(datePattern, '').trim(); // Remove date from tempText
  }

  // 3. Clean up description (remove any leftover header fragments)
  const description = tempText
    .replace(/DATE DESCRIPTION AMOUNT \(\$\)/gi, '')
    .replace(/TRANS DATE POSTING DATE DESCRIPTION REFERENCE NO\. AMOUNT \(S\)/gi, '')
    .replace(/Page \d+ of \d+/gi, '') // Remove page numbers
    .replace(/\bTRANS\b/gi, '') // Remove standalone "TRANS" from headers
    .trim();

  // 4. Format the final output line to include " CR" if it's a credit
  let formattedLine;
  if (dates.length >= 2) {
    formattedLine = `${dates[0]} ${dates[1]} ${description} ${amountValue}${isCredit ? ' CR' : ''}`;
  } else if (dates.length === 1) {
    formattedLine = `${dates[0]} ${dates[0]} ${description} ${amountValue}${isCredit ? ' CR' : ''}`; // Duplicate for consistency
  } else {
    formattedLine = `${description} ${amountValue}${isCredit ? ' CR' : ''}`; // Fallback if no dates found
  }

  // 5. Final cleanup and validation
  formattedLine = formattedLine
    .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
    .trim();

  // Only add if we have a valid transaction (description and amount)
  if (description && amountValue) {
    transactionsArray.push(formattedLine);
  }
}

/**
 * Helper function to process a structured transaction object for Format 2.
 * @param {object} transactionData - Object containing parsed transaction details.
 * @param {string[]} transactionsArray - The array to add the formatted transaction string to.
 */
function processFormat2Transaction(transactionData, transactionsArray) {
  let formattedLine = '';
  // Ensure description is a single string for proper regex matching in processData
  const description = Array.isArray(transactionData.description) ? transactionData.description.join(' ').trim() : transactionData.description.trim();

  // The amount and CR indicator should be combined into a single string for parsing by fullLinePattern
  const amountWithCreditIndicator = `${transactionData.amount}${transactionData.isCredit}`;

  if (transactionData.transDate && transactionData.postingDate) {
    formattedLine = `${transactionData.transDate} ${transactionData.postingDate} ${description} ${amountWithCreditIndicator}`;
  } else {
    // Fallback if dates are missing, though ideally Format 2 always has them
    formattedLine = `${description} ${amountWithCreditIndicator}`;
  }

  // Final cleanup
  formattedLine = formattedLine
    .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
    .trim();

  // Only add if we have valid data
  if (description && transactionData.amount) {
    transactionsArray.push(formattedLine);
  }
}


/**
 * Parses transactions from Format 2 PDF.
 * @param {string[]} allLines - All extracted lines from the PDF.
 * @returns {string[]} - Array of formatted transaction strings.
 */
function parseFormat2(allLines) {
  const transactions = [];
  const dateRegex = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.\s\d{1,2}$/; // "Jan. 25"
  const amountRegex = /^\d{1,3}(,\d{3})*\.\d{2}$/; // "4.52"

  let inTransactionSection = false;
  let currentTransactionData = {
    transDate: '',
    postingDate: '',
    description: [],
    referenceNo: '',
    amount: '',
    isCredit: ''
  };

  // Find the start of the transaction section
  let startIndex = allLines.findIndex(line => line.includes("TRANS") && line.includes("DATE") && line.includes("DESCRIPTION") && line.includes("REFERENCE NO.") && line.includes("AMOUNT (S)"));
  if (startIndex !== -1) {
    inTransactionSection = true;
    // Skip the header line and the line below it if it contains card number
    startIndex = startIndex + 1;
    if (allLines[startIndex] && allLines[startIndex].includes("Card Number:")) {
        startIndex++;
    }
  } else {
      // Fallback: find the first line that looks like a transaction start
      startIndex = allLines.findIndex(line => {
          const parts = line.split(/\s+/);
          return parts.length >= 2 && dateRegex.test(parts[0]) && dateRegex.test(parts[1]);
      });
      if (startIndex !== -1) {
          inTransactionSection = true;
      }
  }

  for (let i = startIndex; i < allLines.length; i++) {
    let line = allLines[i].trim();

    // Skip known non-transaction lines
    const skipPatterns = [
      /^Page \d+ of \d+$/i, /Concerning Agreement/i, /Important Payment Information:/i,
      /Important information about your BMO Mastercard account/i,
      /How to make payments to your credit card account/i,
      /Thank you for choosing BMO/i, /If you only make the minimum monthly payment/i,
      /Please see the back of your statement/i, /BMO CashBack Mastercard/i,
      /BMO Bank of Montreal/i, 
      /DATE DESCRIPTION AMOUNT \(\$\)/i,
      /TRANS DATE POSTING DATE DESCRIPTION REFERENCE NO\. AMOUNT \(S\)/i,
      /^TRANS\s+DATE\s+POSTING\s+DATE\s+DESCRIPTION\s+REFERENCE NO\.\s+AMOUNT \(S\)$/i // More robust header matching
    ];
    if (skipPatterns.some(pattern => pattern.test(line))) {
      if (currentTransactionData.transDate) { // If a transaction was being built, process it
        processFormat2Transaction(currentTransactionData, transactions);
        currentTransactionData = { transDate: '', postingDate: '', description: [], referenceNo: '', amount: '', isCredit: '' };
      }
      continue;
    }

    // Check for CR on a new line (specific to format 2s.pdf)
    if (line === "CR" && currentTransactionData.transDate) {
        currentTransactionData.isCredit = ' CR';
        continue; // CR is processed, move to next
    }

    // Attempt to parse a new transaction line
    const parts = line.split(/\s+/);
    let potentialTransDate = parts[0];
    let potentialPostingDate = parts[1];

    if (dateRegex.test(potentialTransDate) && dateRegex.test(potentialPostingDate)) {
      // This is a new transaction line
      if (currentTransactionData.transDate) { // If a previous transaction was being built
        processFormat2Transaction(currentTransactionData, transactions);
      }
      currentTransactionData = {
        transDate: potentialTransDate.replace('.', ''),
        postingDate: potentialPostingDate.replace('.', ''),
        description: [],
        referenceNo: '',
        amount: '',
        isCredit: ''
      };

      // Try to extract amount and reference number if they are on the same line
      let remainingParts = parts.slice(2);
      // Amount is usually the last part, reference number before that
      if (remainingParts.length > 0 && amountRegex.test(remainingParts[remainingParts.length - 1])) {
        currentTransactionData.amount = remainingParts.pop();
        // The part before amount could be reference number if it's numeric/alphanumeric
        if (remainingParts.length > 0 && /^[A-Z0-9]+$/i.test(remainingParts[remainingParts.length - 1])) {
            currentTransactionData.referenceNo = remainingParts.pop();
        }
      }
      currentTransactionData.description = remainingParts; // The rest is description

    } else if (currentTransactionData.transDate) {
      // This line belongs to the current transaction (description, reference, amount)
      // Try to find amount and reference number first
      let foundAmount = false;
      let foundReference = false;

      const lastPart = parts[parts.length - 1];
      if (amountRegex.test(lastPart)) {
        currentTransactionData.amount = lastPart;
        parts.pop(); // Remove amount
        foundAmount = true;
      }

      const secondLastPart = parts[parts.length - 1];
      if (secondLastPart && /^[A-Z0-9]+$/i.test(secondLastPart) && !foundAmount) { // If amount wasn't found, this might be reference
        currentTransactionData.referenceNo = secondLastPart;
        parts.pop(); // Remove reference
        foundReference = true;
      } else if (secondLastPart && /^[A-Z0-9]+$/i.test(secondLastPart) && foundAmount) { // If amount was found, this is definitely reference
        currentTransactionData.referenceNo = secondLastPart;
        parts.pop(); // Remove reference
        foundReference = true;
      }

      // Add remaining parts to description
      currentTransactionData.description.push(...parts);
    }
  }

  // Process the last transaction if any
  if (currentTransactionData.transDate) {
    processFormat2Transaction(currentTransactionData, transactions);
  }
  return transactions;
}

/**
 * Generic parser for unknown formats (fallback).
 * This will be less precise but might catch some transactions.
 * It also includes logic to omit the "Total for card number" line and remove "$" from amounts.
 * @param {string[]} allLines - All extracted lines from the PDF.
 * @returns {string[]} - Array of formatted transaction strings.
 */
function parseGeneric(allLines) {
    const transactions = [];
    const dateRegex = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}/g; // Matches "Jan. 1" or "Jan 1"
    const amountRegex = /\d{1,3}(?:,\d{3})*\.\d{2}\s*(CR)?$/; // Matches "123.45" or "123.45 CR"

    let currentBlock = [];
    for (let i = 0; i < allLines.length; i++) {
        let line = allLines[i].trim();

        // New stopping conditions for the end of transaction data
        const endOfTransactionsPatterns = [
            /Subtotal for(?: MR ALI AL-JANABI| card number)?\s*\$?\d{1,3}(?:,\d{3})*\.\d{2}/i,
            /Total for card number(?: XXXX){3} \d{4}\s*\$?\d{1,3}(?:,\d{3})*\.\d{2}/i,
            /Important Information about changes to your BMO Credit Card/i,
            /Cashback Changes effective/i,
            /Interest Rate Changes:/i,
            /The minimum payment definitions were amended/i,
            /The inactive fee definition was amended/i,
            /The Promotional Balance Transfers rate was amended/i,
            /The interest-free grace period was amended/i,
            /The installment plan fee was amended/i,
            /Important Information about your BMO Cardholder Agreement/i,
            /payments; you will continue to get/i,
            /Beginning on your/i,
            /Not applicable for Quebec residents/i,
            /If you convert a transaction into an interest-bearing installment plan/i,
        ];

        if (endOfTransactionsPatterns.some(pattern => pattern.test(line))) {
            // If an end-of-transaction pattern is found, process any pending transaction and then stop
            if (currentBlock.length > 0) {
                processGenericBlock(currentBlock, transactions);
            }
            return transactions; // Stop processing further lines
        }

        // Skip common non-transactional lines, including the specific omission for "Total for card number"
        const skipPatterns = [
            /Page \d+ of \d+/i, /Summary of your account/i, /Your interest charges/i,
            /Contact us/i, /Important information about your BMO/i, /How to make payments/i,
            /Trade-marks/i, /BMO CashBack Mastercard/i, /BMO Bank of Montreal/i,
            /Mr Ali Al-Janabi/i, /Card number/i, /Statement date/i, /Statement period/i,
            /YOUR REWARDS/i, /Security Tip/i, /POSTING/i, /DATE/i, /DESCRIPTION/i,
            /AMOUNT/i, /REFERENCE NO./i, /INTEREST CHARGES/i, /ANNUAL INTEREST RATE/i,
            /DAILY INTEREST RATE/i, /Purchases/i, /Cash Advances/i, /Includes:/i,
            /Excludes:/i,
            // Specific omission for "Total for card number"
            /Total for card number(?: XXXX){3} \d{4}\s*\$?\d{1,3}(?:,\d{3})*\.\d{2}/i,
            /Subtotal for(?: MR ALI AL-JANABI| card number)?\s*\$?\d{1,3}(?:,\d{3})*\.\d{2}/i,
            /Payment due date/i, /Minimum payment due/i, /Payment due date/i,
            /Minimum payment due/i, /New Balance/i,
            /Previous Balance/i, /Purchases and other charges/i, /Payments and Credits/i,
            /Total Interest Charges/i, /Fees/i, /Your Credit Limit/i,
            /Your Available Credit/i, /Amount Over Credit Limit/i, /Estimated time to repay/i,
            /Redeem now at/i, /Disputes:/i, /Enquiries/i, /Toll Free Calls/i,
            /Outside Canada/i, /TTY/i, /Online via Online Banking/i, /If you are paying by mail/i,
            /Currency conversion/i, /We do not accept written requests/i, /Please call us/i,
            /PERIOD COVERED BY THIS STATEMENT/i,
            /TRANS DATE POSTING DATE DESCRIPTION REFERENCE NO\. AMOUNT \(S\)/i,
            /DATE DESCRIPTION AMOUNT \(\$\)/i,
            /^TRANS\s+DATE\s+POSTING\s+DATE\s+DESCRIPTION\s+REFERENCE NO\.\s+AMOUNT \(S\)$/i // More robust header matching
        ];

        if (skipPatterns.some(pattern => pattern.test(line))) {
            if (currentBlock.length > 0) {
                processGenericBlock(currentBlock, transactions);
                currentBlock = [];
            }
            continue;
        }

        // If the line contains an amount, it's likely the end of a transaction
        if (amountRegex.test(line)) {
            currentBlock.push(line);

            // --- MODIFIED LOGIC: Check for standalone "CR" on the very next line and include it ---
            if (i + 1 < allLines.length) {
                const nextLine = allLines[i + 1].trim();
                if (nextLine.toLowerCase() === "cr") {
                    currentBlock.push(nextLine); // Add "CR" to the block
                    i++; // Increment `i` to skip the "CR" line in the next iteration
                }
            }
            // --- END MODIFIED LOGIC ---

            processGenericBlock(currentBlock, transactions);
            currentBlock = []; // Reset for the next transaction
        } else {
            // Otherwise, add the line to the current transaction block
            currentBlock.push(line);
        }
    }

    // Process the last block
    if (currentBlock.length > 0) {
        processGenericBlock(currentBlock, transactions);
    }

    return transactions;
}

/**
 * Helper function to process a block of lines for generic parsing.
 * @param {string[]} blockLines - Array of lines forming a potential transaction block.
 * @param {string[]} transactionsArray - The array to add the formatted transaction to.
 */
function processGenericBlock(blockLines, transactionsArray) {
    let combinedText = blockLines.join(' ').replace(/\s+/g, ' ').trim();

    // Try to extract two dates (Trans Date, Posting Date)
    const dates = [];
    let tempText = combinedText;
    const datePattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}/g;

    let match;
    const allDateMatches = [...tempText.matchAll(datePattern)];

    if (allDateMatches.length >= 2) {
        dates.push(allDateMatches[allDateMatches.length - 2][0].replace('.', ''));
        dates.push(allDateMatches[allDateMatches.length - 1][0].replace('.', ''));
        tempText = tempText.replace(datePattern, '').replace(/\s+/g, ' ').trim();
    } else if (allDateMatches.length === 1) {
        dates.push(allDateMatches[0][0].replace('.', ''));
        tempText = tempText.replace(datePattern, '').replace(/\s+/g, ' ').trim();
    }

    // Extract amount and CR. Ensure to capture the number and optional 'CR', but not '$'.
    let amount = '';
    let isCredit = false; // Flag to indicate if it's a credit
    const amountPattern = /\$*(\d{1,3}(?:,\d{3})*\.\d{2})\s*(CR)?$/; // Added optional '$' at the beginning
    const amountMatch = tempText.match(amountPattern);
    if (amountMatch) {
        amount = amountMatch[1]; // Captured number part
        isCredit = !!amountMatch[2]; // Set isCredit flag
        tempText = tempText.substring(0, amountMatch.index).trim();
    } else {
        // If no amount found, it's not a valid transaction block
        return;
    }

    // The remaining text is the description, remove common header fragments and page numbers
    const description = tempText
        .replace(/DATE DESCRIPTION AMOUNT \(\$\)/gi, '')
        .replace(/TRANS DATE POSTING DATE DESCRIPTION REFERENCE NO\. AMOUNT \(S\)/gi, '')
        .replace(/TRANS\s+DATE\s+POSTING\s+DATE\s+DESCRIPTION\s+REFERENCE NO\.\s+AMOUNT \(S\)/gi, '')
        .replace(/Page \d+ of \d+/gi, '')
        .replace(/TRANS/gi, '') // Remove standalone "TRANS"
        .trim();

    // Format the output, appending " CR" if it's a credit
    let formattedLine = '';
    if (dates.length === 2) {
        formattedLine = `${dates[0]} ${dates[1]} ${description} ${amount}${isCredit ? ' CR' : ''}`;
    } else if (dates.length === 1) {
        formattedLine = `${dates[0]} ${dates[0]} ${description} ${amount}${isCredit ? ' CR' : ''}`; // Duplicate for consistency
    } else {
        formattedLine = `${description} ${amount}${isCredit ? ' CR' : ''}`;
    }

    transactionsArray.push(formattedLine.trim());
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
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let allLines = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // New: Define patterns to clean from each line immediately after extraction
      const patternsToClean = [
          /Page \d+ of \d+/i,
          /Transactions since your last statement \(continued\)/i,
          // More robust patterns to capture header variations
          /TRANS DATE POSTING DATE DESCRIPTION(?: REFERENCE NO\.)? AMOUNT \(S\)/i,
          /DATE DESCRIPTION AMOUNT \(\$\)/i,
          /\s*REFERENCE NO\.\s*AMOUNT \(S\)\s*$/i, 
          /\s*TRANS DATE\s*POSTING DATE\s+DESCRIPTION\s*(?:REFERENCE NO\.)?\s*$/i, // Captures more header variations
          /\s*AMOUNT \(\$\)\s*$/i,
          /^TRANS\s+DATE\s+POSTING\s+DATE\s+DESCRIPTION\s+REFERENCE NO\.\s+AMOUNT \(S\)$/i, // Explicit for full header
          // Generic header patterns to remove
          /Total for card number(?: XXXX){3} \d{4}\s*\$?\d{1,3}(?:,\d{3})*\.\d{2}/i,
          /Subtotal for(?: MR ALI AL-JANABI| card number)?\s*\$?\d{1,3}(?:,\d{3})*\.\d{2}/i, // Added for removal
          /Balance due/i, /Minimum payment due/i, /Payment due date/i,
          /Your credit limit/i, /Your available credit/i, /Amount over credit limit/i,
          /Estimated time to repay/i, /Security Tip/i, /Your interest charges/i,
          /Contact us/i, /Lost\/stolen cards/i, /Online via Online Banking/i,
          /If you are paying by mail/i, /Currency conversion/i, /We do not accept written requests/i,
          /Please call us/i, /YOUR REWARDS/i, /Cashback earned/i, /Bonus Cashback earned/i,
          /Groceries/i, /Recurring bill/i, /Subtotal bonus earn/i, /Cashback adjusted/i,
          /Cashback redeemed/i, /Total Cashback earned this statement/i, /Cashback balance year to date/i,
          /Redeem now at bmocashback.com/i, /Refer to the Installment Plan section/i,
          /P\.O\. BOX \d+/i, /STATION CENTRE-VILLE/i, /MONTREAL QC/i, /BMO BANK OF MONTREAL/i,
          /5191230200739994/i, /0000000007500/i, /0000000422676/i, /XXXX XXXX XXXX \d{4}/i,
          /MR ALI AL-JANABI/i, /SAEID GORJIAN/i, /1-\d{3}-\d{3}-\d{4}/i, /514-877-0330/i,
          /1-866-859-2089/i, /1-800-263-2263/i, /1-800-361-3361/i, /TTY \(For the Deaf & Hard of Hearing\)/i,
          /Estimated Time to Repay/i, /Foreign currency transactions/i, /Foreign currency conversion/i,
          /Interest-free grace period/i, /Your minimum payment if you reside/i,
          /If your credit card account was opened/i, /How we apply payments to your account/i,
          /If you are moving to or out of Quebec/i, /Includes: credit card cheques/i,
          /Excludes: promotional balance transfers/i, /Indicates eligible grocery purchases that may qualify for/i,
          /Indicates eligible recurring bill payments that may qualify for/i,
          /Summary of your account/i, /Your interest charges/i, /Concerning Agreement/i,
          /Important Payment Information:/i, /Important information about your BMO Mastercard account/i,
          /How to make payments to your credit card account/i, /Thank you for choosing BMO/i,
          /If you only make the minimum monthly payment/i, /Please see the back of your statement/i,
          /BMO CashBack Mastercard/i, /BMO Bank of Montreal/i, /POSTING/i, /DATE/i, /DESCRIPTION/i,
          /AMOUNT/i, /REFERENCE NO\./i, /INTEREST CHARGES/i, /ANNUAL INTEREST RATE/i,
          /DAILY INTEREST RATE/i, // Removed "Purchases" here
          /Cash Advances/i, /PERIOD COVERED BY THIS STATEMENT/i,
          /Trade-marks/i, /Mastercard is a registered trademark/i, /Indicates eligible grocery purchases/i,
          /Indicates eligible recurring bill payments/i, /All purchases earn 0\.5% cashback/i,
          /TRANS\s+/i // Specifically remove "TRANS" followed by space
      ];

      // New: Function to clean a single line
      const cleanLine = (line) => {
          let cleaned = line;
          for (const pattern of patternsToClean) {
              cleaned = cleaned.replace(pattern, ' '); // Replace with space to maintain separation
          }
          return cleaned.replace(/\s{2,}/g, ' ').trim(); // Collapse multiple spaces and trim
      };

      // Map items to their string representation, clean, and filter out empty strings
      const pageText = textContent.items.map(item => cleanLine(item.str.trim())).filter(Boolean);
      allLines.push(...pageText);
    }

    // Detect format and parse into an array of formatted transaction strings
    let parsedTransactions;
    if (detectFormat1(allLines)) {
      showMessage('Detected Format 1. Parsing transactions from PDF...');
      parsedTransactions = parseFormat1(allLines);
    } else if (detectFormat2(allLines)) {
      showMessage('Detected Format 2. Parsing transactions from PDF...');
      parsedTransactions = parseFormat2(allLines);
    } else {
      showMessage('Could not determine statement format. Attempting generic parsing.', 'error');
      parsedTransactions = parseGeneric(allLines); // Fallback to generic if format not detected
    }

    if (parsedTransactions.length > 0) {
      // Join parsed transactions into a single string, separated by newlines, for inputText
      showMessage('PDF processed successfully!', 'success');
      return parsedTransactions.join('\n');
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


// --- Main Data Processing Function (Existing bmoCard.js logic) ---
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

  // Copy buttons row
  const copyRow = document.createElement('tr');
  headers.forEach((_, index) => {
    const th = document.createElement('th');
    const div = document.createElement('div');
    div.className = 'copy-col';
    const btn = document.createElement('button');
    btn.textContent = 'Copy';
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

  const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
  const transactions = [];

  // Updated Regex pattern:
  // - Captures date1 (group 1)
  // - Captures date2 (group 2)
  // - Captures description (group 3)
  // - Captures debit or credit amount (group 4)
  // - The last part is optional, only there to catch any stray CR for consistency, but the parsing
  //   logic for debit/credit happens inside processFormat1TransactionBlock for format 1 and
  //   processData for all parsed lines
  const fullLinePattern =
    /^((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2})\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2})\s+(.*?)\s+([\d,]+\.\d{2})(?:\s+(CR))?$/i;


  lines.forEach(line => {
    const match = fullLinePattern.exec(line);
    if (match) {
      const [, date1, date2, desc, amountRaw, crIndicator] = match;
      
      // Determine if it's a credit transaction based on the presence of crIndicator group
      const isCreditTransaction = !!crIndicator;
      // Parse the numeric amount, removing commas if present
      const amount = parseFloat(amountRaw.replace(/,/g, '').trim());
      
      // Assign to debit or credit based on isCreditTransaction
      let debitAmount = '';
      let creditAmount = '';
      if (isCreditTransaction) {
        creditAmount = amount !== null ? amount.toFixed(2) : '';
      } else {
        debitAmount = amount !== null ? amount.toFixed(2) : '';
      }
      
      // Append year if provided and dates are just Month Day
      const formattedStartDate = yearInput && /^\w{3}\s\d{1,2}$/.test(date1) ? `${date1} ${yearInput}` : date1;
      const formattedEndDate = yearInput && /^\w{3}\s\d{1,2}$/.test(date2) ? `${date2} ${yearInput}` : date2;

      transactions.push({
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        description: desc.trim(),
        debit: debitAmount,
        credit: creditAmount
      });
    }
  });

  // Process collected transactions and add to table
  transactions.forEach(tx => {
    let startDate = tx.startDate;
    let endDate = tx.endDate;
    let description = tx.description;

    let debit = tx.debit;
    let credit = tx.credit;

    // Format date column - always show both dates even if same
    const dateColumn = startDate + ' ' + endDate;

    const row = [dateColumn, description, debit, credit, '']; // Balance not available
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
