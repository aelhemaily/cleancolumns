// cibcCard.js

// Keywords data embedded directly
let keywords = {
  debit: [
    "atm w/d", "cash withdra", "withdraw", "fee", "service charge",
    "monthly plan fee", "overdraft fee", "o.d.p. fee", "send e-tfr",
    "tfr-to", "payment to", "nsf fee", "bill payment", "purchase", "payment"
  ],
  credit: [
    "deposit", "tfr-fr", "e-transfer", "e-tfr", "payment - thank you",
    "refund", "interest received", "remittance", "gc deposit",
    "transfer fr", "received", "credit", "pay with points", "paiement par points" // Added hardcoded credit keywords
  ]
};

// Category words data embedded directly
let categoryWords = [
  "foreign currency transactions",
  "health and education",
  "home and office improvement",
  "hotel, entertainment and recreation",
  "miscellaneous",
  "personal and household expenses",
  "professional and financial services",
  "restaurants",
  "retail and grocery",
  "transportation",
  "travel"
];

// Console logs to confirm data is loaded (these will now always run immediately)
console.log('Keywords loaded directly:', keywords);
console.log('Categories loaded directly:', categoryWords);


function injectPaymentBoxIfNeeded() {
  if (!document.getElementById('paymentText')) {
    const mainBox = document.getElementById('inputText');
    const newBox = document.createElement('textarea');
    newBox.id = 'paymentText';
    newBox.placeholder = 'Paste "Your payments" section here (optional)';
    newBox.style.width = '100%';
    newBox.style.minHeight = '100px';
    newBox.style.marginTop = '10px';

    mainBox.parentNode.insertBefore(newBox, mainBox.nextSibling);
  }
}

function capitalizeCategory(cat) {
  return cat
    .split(' ')
    .map(word => (word === 'and' ? 'and' : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

// Function to parse a date string for sorting purposes (consistent year)
function parseDate(text) {
  // This function is used for sorting, so it needs a consistent year.
  // The display date is handled separately in parseLines.
  // The dateMatch[0] contains "Mon1 Day1 Mon2 Day2". We need Mon1 Day1 for sorting.
  const dateParts = text.match(/^([A-Za-z]{3}) (\d{1,2})/);
  if (dateParts) {
    const [, mon1, d1] = dateParts;
    return new Date(`${mon1} ${d1}, 2000`); // Use a dummy year for consistent sorting
  }
  return new Date(); // Fallback to current date if parsing fails
}

// Existing parseLines function, now also used for PDF-extracted text
function parseLines(text, yearInput, isPayment = false) {
  // Split text into lines and clean them, removing 'Ý' character and filtering empty lines
  const lines = text.split('\n').map(line =>
    line.replace(/Ý/g, '').trim()
  ).filter(Boolean);

  // Helper to identify a new transaction line (starts with two dates)
  const isNewTransaction = (line) => /^[A-Za-z]{3} \d{1,2} [A-Za-z]{3} \d{1,2}/.test(line);

  const transactions = [];
  let current = '';
  lines.forEach(line => {
    // If it's a new transaction, push the previous one and start a new 'current'
    if (isNewTransaction(line)) {
      if (current) transactions.push(current.trim());
      current = line;
    } else {
      // If it's not a new transaction, append to the current one
      current += ' ' + line; // Concatenate multi-line transactions
    }
  });
  if (current) transactions.push(current.trim()); // Add the last transaction

  return transactions.map(line => {
    // Regex to capture both date sets for extraction
    const dateMatch = line.match(/^([A-Za-z]{3}) (\d{1,2}) ([A-Za-z]{3}) (\d{1,2})/);
    // Regex to capture all potential amounts, including those that might be in the description
    const amountPattern = /-?\d{1,3}(?:,\d{3})*\.\d{2}(?:\*+)?/g;
    const allAmountMatches = [...line.matchAll(amountPattern)];

    if (!dateMatch || allAmountMatches.length === 0) return null; // Skip if no date or amount found

    // Extract only the first date (Mon1 Day1)
    let date = `${dateMatch[1]} ${dateMatch[2]}`;
    if (yearInput) {
      date = `${date} ${yearInput}`; // Append year to the first date
    }

    // The actual transaction amount is typically the LAST matched amount in the line
    const amountRaw = allAmountMatches[allAmountMatches.length - 1][0];
    // IMPORTANT FIX: Remove only asterisks and commas, preserve the negative sign
    const cleanAmount = amountRaw.replace(/\*+$/, '').replace(/,/g, '');

    // Get the description by taking everything BEFORE the last amount match
    let description = line.substring(0, allAmountMatches[allAmountMatches.length - 1].index).trim();
    // Remove the full date part (both dates) from the beginning of the description
    description = description.replace(dateMatch[0], '').trim();

    // Clean up any extra spaces in the description
    description = description.replace(/\s+/g, ' ').trim();

    let category = '';
    const descLower = description.toLowerCase();

    // Always give "INTEREST REVERSAL" the category of interest
    if (descLower.includes("interest reversal")) {
      category = "Interest";
    }
    // Hardcoded categories for specific phrases (CIBC-specific)
    else if (descLower.includes("payment thank you")) {
      category = "Payment";
    } else if (descLower.includes("regular purchases")) {
      category = "Interest";
    } else if (descLower.includes("cash advances")) {
      category = "Cash Advance";
    } else {
      // Find a category from the loaded categoryWords that matches anywhere in the description
      // and move it to the category column
      // Check if categoryWords is populated before using it
      if (categoryWords && categoryWords.length > 0) {
        console.log('Category words array in parseLines:', categoryWords); // Added log
        const matchedCategory = categoryWords.find(cat => descLower.includes(cat));
        if (matchedCategory) {
          category = capitalizeCategory(matchedCategory);
          // Remove the matched category from the description
          description = description.replace(new RegExp(matchedCategory, 'gi'), '').trim().replace(/\s+/g, ' ');
        }
      } else {
        console.warn('categoryWords array is empty or not loaded when parsing lines.'); // Added warning
      }
    }

    // Remove the airplane symbol (Q or →) from the beginning of transaction descriptions
    description = description.replace(/^[→Q]\s*/, '').trim();

    // Determine if it's a credit based on negative sign or specific keywords
    const isCredit = cleanAmount.startsWith('-') || isPayment ||
      descLower.includes("payment thank you") ||
      keywords.credit.some(k => descLower.includes(k));

    const debit = (!isCredit) ? cleanAmount : '';
    const credit = isCredit ? cleanAmount.replace(/^-/, '') : ''; // Remove leading '-' for credit column

    return {
      rawDate: dateMatch[0], // Original date string for sorting
      parsedDate: parseDate(dateMatch[0]), // Parsed date object for sorting
      row: [date, description, category, debit, credit, ''] // Formatted row data for the table
    };
  }).filter(Boolean); // Filter out any null returns
}


// Start PDF Parsing Logic from cardcibc.html
// This function extracts text from a PDF file
async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  // pdfjsLib is assumed to be loaded globally by index.html
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

  let allText = '';

  // Extract text from all pages
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Get text items with their positions for better parsing
    const textItems = textContent.items;
    let pageLines = [];
    let currentLine = '';
    let lastY = null;

    // Group text items by line based on Y position
    for (const item of textItems) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) { // New line detected
        if (currentLine.trim()) {
          pageLines.push(currentLine.trim());
        }
        currentLine = item.str;
      } else { // Same line
        if (currentLine && !currentLine.endsWith(' ') && !item.str.startsWith(' ')) {
          currentLine += ' '; // Add space if needed
        }
        currentLine += item.str;
      }
      lastY = item.transform[5];
    }

    if (currentLine.trim()) {
      pageLines.push(currentLine.trim()); // Add the last line
    }

    allText += pageLines.join('\n') + '\n'; // Join page lines with newline
  }

  return allText;
}

// This function takes the raw text and cleans it for transaction parsing
function cleanAndParseTransactions(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  const transactions = [];
  let currentTransactionBuffer = []; // Buffer to hold lines of a single transaction

  // Regex to identify the start of a new transaction (two dates at the beginning)
  const transactionStartPattern = /^[A-Z][a-z]{2}\s+\d{1,2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+/;

  // Patterns to explicitly exclude as noise (summary lines, headers, page numbers, etc.)
  const noisePatterns = [
    // General headers and footers
    /^(Your|Total|Previous|New|Interest|Limit|Available|Card number|Trans date|Post date|Description)/i,
    /^(Amount|Transactions|Spend Categories|\$|Page \d+ of \d+)/,
    /^Page \d+ of \d+$/i,
    /^\*?\d{9}\*?$/i, // The *0201550000* type lines
    /^CIBC Aventura® Visa Infinite™ Card$/i, // Card name
    /^CIBC CreditSmart™™™ Spend Report$/i, // Spend report header
    /^This month Year-to-date$/i, // Spend report sub-header

    // Specific CIBC statement sections/headers
    /^Trans date Post date Description Amount\(\$\)$/i, // Payments table header
    /^Trans date Post date Description Annual interest rate Amount\(\$\)$/i, // Interest table header
    /^Trans date Post date Description$/i, // Charges/credits table header (first part)
    /^Spend Categories Amount\(\$\)$/i, // Charges/credits table header (second part)
    /^Q Identifies Points Multiplier.*$/i, // The long explanatory line
    /^Information about your CIBC Aventura Visa Infinite Card account$/i, // Section header
    /^Prepared for: MR MUHAMMAD HARIS ABBASI January \d{1,2} to February \d{1,2}, \d{4} Account number: \d{4} XXXX XXXX \d{4}$/i, // Header on page 3
    /^Spend Categories Transactions Amount\(\$\) Budget \(\$\) Difference \(\$\) Transactions Amount \(\$\)$/i, // Spend report table header
    /^Total for \d{4} XXXX XXXX \d{4}$/i, // "Total for 4500 XXXX XXXX 5438" line
    /^Total payments$/i, // "Total payments" line in payments section
    /^Total interest this period$/i, // "Total interest this period" line
    /^Total$/i, // "Total" line in spend report
    /^Amount\(\$\) Budget \(\$\) Difference \(\$\)$/i, // Specific line from spend report

    // Legal/explanatory text blocks (often multi-line, so match start)
    /^If you find an error or irregularity.*$/i,
    /^How we charge interest:.*$/i,
    /^Payment period extensions:.*$/i,
    /^Your statement \(including the Balance and Minimum Payment\).*$/i,
    /^\*\*Foreign currency Transactions, except Convenience Cheques, are converted to Canadian dollars.*$/i,
    /^Amount Due is the amount you must pay if you want to avoid interest.*$/i,
    /^Minimum Payment is the minimum amount you must pay this month.*$/i,
    /^For more information, please refer to the CIBC Cardholder Agreement.$/i,
    /^Trademark of CIBC\.$/i,
    /^Registered trademark of CIBC$/i,
    /^Transactions are assigned a spend category based on where the goods or services are purchased.*$/i,
    /^A negative difference \(–\) means you spent more than you budgeted\.$/i,
    /^Reminder : If you only make the minimum payment every month.*$/i,
    /^Your Promotional Balance Transfer Summary$/i,
    /^Annual Interest Rate Remaining Balance E xpiry Date 1$/i,
    /^1 Your Promotional Balance Transfer offer will end on the Statement Date of the month and year listed here.*$/i,
    /^Your message centre$/i,
    /^You have promotional interest rate Balance Transfer \(BT\).*$/i,
    /^Since your credit card has been replaced, please notify any merchants processing pre-authorized payments.*$/i,
    /^Visit CIBCRewards\.com or call CIBC Rewards Centre at.*$/i,
    /^Payment options$/i,
    /^Online Banking: www\.cibc\.com$/i,
    /^Telephone Banking: 1 800 465-CIBC \(2422\)$/i,
    /^CIBC bank machines and most financial institutions$/i,
    /^Mail: Return completed slip with your cheque or money order payable to CIBC\.$/i,
    /^For general inquiries call$/i,
    /^Do not staple or attach correspondence\.$/i,
    /^MR MUHAMMAD HARIS ABBASI$/i, // Specific name from the PDF
    /^\d{3}-\d{7}$/i, // e.g., 188-024464

    // Specific problematic merged lines identified from user's output
    // These patterns are designed to catch the *entire merged line* as noise
    /^Feb \d{1,2} Feb \d{1,2} PAYMENT THANK YOU\/PAIEMENT MERCI \d+\.\d+\s+Trans date Post date Description Annual interest rate Amount\(\$\)$/i,
    /^Feb \d{1,2} Feb \d{1,2} REGULAR PURCHASES \d+\.\d+%\s+\d+\.\d+\s+Q Identifies Points Multiplier TM\* transactions that have earned 1\.5 Aventura Points for every dollar spent \(a Bonus of 50%\s+more\)\. Any returns\/credits are deducted at the same rate\.$/i,
    // New patterns for the large merged blocks
    /^Feb \d{1,2} Feb \d{1,2} SUN LIFE CHOICES A&A 800-669-7921 ON Professional and Financial Services \d+\.\d+\s+fraudulent Transactions\).*Minimum Payment is the minimum amount you must pay this month and it includes your monthly installment payments due \(if applicable\)\.\s+TM\* Trademark of CIBC\.\s+® Registered trademark of CIBC\.\s+\d{6}\s+date Description Spend Categories Amount\(\$\)$/i,
    /^Feb \d{1,2} Feb \d{1,2} Q PIONEER STN #187 BRAMPTON ON Transportation \d+\.\d+\s+\*0202560000\*\s+\*0202560000\*\s+CIBC CreditSmart Spend Report.*You can find your current regular Cash Advances interest rate in the “Interest Rates” section of this statement\.$/i,
  ];

  for (const line of lines) {
    // First, check if the line is global noise and should be discarded immediately
    let isGlobalNoise = false;
    for (const pattern of noisePatterns) {
      if (pattern.test(line)) {
        isGlobalNoise = true;
        break;
      }
    }
    if (isGlobalNoise) {
      // If we were accumulating a transaction, and this noise line interrupts it,
      // try to save the accumulated part if it's a valid transaction.
      if (currentTransactionBuffer.length > 0) {
        const fullTransactionString = currentTransactionBuffer.join(' ');
        if (isValidTransaction(fullTransactionString)) {
          transactions.push(fullTransactionString);
        }
        currentTransactionBuffer = []; // Reset buffer
      }
      continue; // Skip this noise line
    }

    // Check if the current line starts a new transaction
    if (transactionStartPattern.test(line)) {
      // If we have a buffered transaction, process it before starting a new one
      if (currentTransactionBuffer.length > 0) {
        const fullTransactionString = currentTransactionBuffer.join(' ');
        if (isValidTransaction(fullTransactionString)) {
          transactions.push(fullTransactionString);
        }
      }
      // Start buffering the new transaction
      currentTransactionBuffer = [line];
    } else {
      // If it's not a new transaction start, and we have an active transaction being built,
      // append the line if it seems like a continuation (e.g., part of description/category)
      // and doesn't look like a new transaction or a known noise pattern.
      if (currentTransactionBuffer.length > 0 && line.length > 3) { // Small length check to avoid very short junk lines
         // If the line contains an amount, it might be the end of the transaction,
         // or it's a new transaction that wasn't caught by transactionStartPattern.
         // For now, append it and let isValidTransaction handle the final check.
         currentTransactionBuffer.push(line);
      }
    }
  }

  // After the loop, process any remaining buffered transaction
  if (currentTransactionBuffer.length > 0) {
    const fullTransactionString = currentTransactionBuffer.join(' ');
    if (isValidTransaction(fullTransactionString)) {
      transactions.push(fullTransactionString);
    }
  }

  return transactions;
}

// Function to validate if a string is a well-formed transaction
function isValidTransaction(transaction) {
  if (!transaction || transaction.length < 15) return false;

  // Must start with two dates in format: e.g., "Feb 05 Feb 05"
  const datePattern = /^[A-Z][a-z]{2}\s+\d{1,2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+/;
  if (!datePattern.test(transaction)) return false;

  // Must contain a merchant/description name (at least two uppercase letters or a common word)
  if (!transaction.match(/[A-Z]{2,}|[a-z]{3,}/)) return false;

  // Crucially, it must contain an amount. The amount should be near the end of the valid transaction part.
  // This regex captures the amount and any optional category that might follow immediately.
  // The key is to ensure there isn't significant *other* text after the amount/category.
  const amountAndOptionalCategoryPattern = /(-?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?(\*+)?)\s*([A-Za-z\s&,-]+)?$/;
  const match = transaction.match(amountAndOptionalCategoryPattern);

  if (!match) return false;

  // Check if there's any significant text *before* the date pattern, which would indicate noise at the start
  const preDateText = transaction.substring(0, transaction.indexOf(match[0])).trim();
  if (preDateText.length > 0 && !datePattern.test(preDateText)) {
      // If there's text before the date, and it's not itself a date pattern, it's likely noise.
      return false;
  }


  // Filter out summary lines and totals. These patterns should be robust.
  const excludePatterns = [
    /^.*TOTAL\s+(CHARGES|CREDITS)\s+\$?\d+\.\d+$/i,
    /^.*PREVIOUS\s+BALANCE\s+\$?\d+\.\d+$/i,
    /^.*NEW\s+BALANCE\s+\$?\d+\.\d+$/i,
    /^.*Total\s+for\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}/i,
    /^.*Total\s+payments\s+\$?\d+\.\d+$/i,
    /^.*Total\s+\d+\s+\$?\d+\.\d+$/i,
    /^Page \d+ of \d+$/i // Exclude page numbers
  ];

  for (const pattern of excludePatterns) {
    if (pattern.test(transaction)) return false;
  }

  return true;
}

// Expose the PDF processing function to window.bankUtils
window.bankUtils = window.bankUtils || {};
window.bankUtils.processPDFFile = async function(file) {
  try {
    const rawText = await extractTextFromPDF(file);
    const transactionsArray = cleanAndParseTransactions(rawText);
    // Return a single string with transactions separated by newlines, as expected by parseLines
    return transactionsArray.join('\n');
  } catch (error) {
    console.error('Error in window.bankUtils.processPDFFile:', error);
    // Propagate the error so main.js can handle it
    throw new Error('Failed to process CIBC PDF: ' + error.message);
  }
};
// End PDF Parsing Logic from cardcibc.html


// Main data processing function for CIBC (now handles both text and PDF-extracted text)
function processData() { // Made this function synchronous again
  // Removed the areCategoriesLoaded check and async/await here to revert to previous behavior
  // This means processData might run before JSONs are fully loaded, but it's what was requested.

  const yearInput = document.getElementById('yearInput').value.trim();
  // inputText will contain combined text from uploaded PDFs or manually pasted text
  const input = document.getElementById('inputText').value.trim();
  const paymentInput = document.getElementById('paymentText')?.value.trim() || ''; // Optional payments section
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = ''; // Clear previous output

  // Parse all lines from the main input and the payments input
  const allItems = [
    ...parseLines(input, yearInput, false), // Main transactions
    ...parseLines(paymentInput, yearInput, true) // Payments (treated as credits)
  ];

  // Sort all items by parsed date
  allItems.sort((a, b) => a.parsedDate - b.parsedDate);

  const headers = ['Date', 'Description', 'Category', 'Debit', 'Credit', 'Balance'];
  const table = document.createElement('table');

  // Create and append the row for "Copy Column" buttons
  const copyRow = document.createElement('tr');
  headers.forEach((_, index) => {
    const th = document.createElement('th');
    const div = document.createElement('div');
    div.className = 'copy-col';

    const btn = document.createElement('button');
    btn.textContent = 'Copy';
    btn.className = 'copy-btn';
    btn.onclick = () => window.bankUtils.copyColumn(index); // Assuming copyColumn exists in window.bankUtils

    div.appendChild(btn);
    th.appendChild(div);
    copyRow.appendChild(th);
  });
  table.appendChild(copyRow);

  // Create and append the header row with column names
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  const rows = []; // Array to store processed row data

  // Populate the table with transaction rows
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
  table.dataset.rows = JSON.stringify(rows); // Store rows in dataset for external use (e.g., saving)

  // Ensure toolbar is visible and interactive features are setup after table generation
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
  // Save the state of the table for undo/redo functionality
  if (typeof saveState === 'function') { // saveState is defined in main.js
    saveState();
  }
}

// Export processData globally for main.js to call
window.processData = processData;
