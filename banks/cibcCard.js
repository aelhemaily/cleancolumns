// cibcCard.js

let keywords = { debit: [], credit: [] };
let categoryWords = [];

// Load keywords.json
fetch('../keywords.json')
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} from ../keywords.json`);
    }
    return response.json();
  })
  .then(data => {
    keywords = {
      debit: data.debit.map(k => k.toLowerCase()),
      credit: data.credit.map(k => k.toLowerCase())
    };
    console.log('Keywords loaded successfully:', keywords);
  })
  .catch(error => console.error('Failed to load keywords.json:', error));

// Load cibcCardCategories.json
fetch('../cibcCardCategories.json')
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} from ../cibcCardCategories.json`);
    }
    return response.json();
  })
  .then(data => {
    categoryWords = data.categories.map(k => k.toLowerCase());
    console.log('Categories loaded successfully:', categoryWords);
  })
  .catch(error => console.error('Failed to load cibcCardCategories.json:', error));


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

  // Helper to identify a new transaction line
  const isNewTransaction = (line) => /^[A-Za-z]{3} \d{1,2} [A-Za-z]{3} \d{1,2}/.test(line);

  const transactions = [];
  let current = '';
  lines.forEach(line => {
    if (isNewTransaction(line)) {
      if (current) transactions.push(current.trim());
      current = line;
    } else {
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
  // Split text into lines and clean them
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  const transactions = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Look for transaction pattern: Sep 07 Sep 09 or Oct 06 Oct 07 etc.
    const transactionMatch = line.match(/^([A-Z][a-z]{2})\s+(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+(.+)/);

    if (transactionMatch) {
      let transactionText = line;
      let nextLineIndex = i + 1;

      // Check if next lines are continuation of this transaction
      while (nextLineIndex < lines.length) {
        const nextLine = lines[nextLineIndex];

        // Stop if we hit another transaction line
        if (nextLine.match(/^[A-Z][a-z]{2}\s+\d{1,2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+/)) {
          break;
        }

        // Stop if we hit section headers or other non-transaction content
        if (nextLine.match(/^(Your|Total|Previous|New|Interest|Limit|Available|Card number|Trans date|Post date|Description)/i)) {
          break;
        }

        // Stop if line looks like a table header or summary
        if (nextLine.match(/^(Amount|Transactions|Spend Categories|\$|Page \d+ of \d+)/)) {
          break;
        }

        // Check if this line could be a continuation based on specific patterns
        if (nextLine.length > 0 && nextLine.length < 200) {
          if (nextLine.match(/^\d+\.\d+\s+USD\s+@/) || // Foreign currency conversion line
            nextLine.match(/^Foreign Currency Transactions\s+\d+\.\d+/) || // Foreign currency final amount
            nextLine.match(/^[A-Z][a-z]+(\s+(and\s+)?[A-Z][a-z]+)*\s*$/) || // Category names
            nextLine.match(/^\d+\.\d+\s*\*?\*?\s*$/) || // Amount with possible **
            nextLine.match(/^\*\*/) || // Foreign currency marker
            (nextLine.match(/^[A-Z\s]+$/) && nextLine.length < 50) || // Short all-caps continuation
            // Special case: if current line ends with ** and next line starts with category or amount
            (transactionText.endsWith('**') && (nextLine.match(/^[A-Z][a-z]/) || nextLine.match(/^\d/)))) {

            transactionText += ' ' + nextLine;
            nextLineIndex++;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      // Clean and add the transaction if valid
      const cleanedTransaction = cleanIndividualTransaction(transactionText);
      if (cleanedTransaction && isValidTransaction(cleanedTransaction)) {
        transactions.push(cleanedTransaction);
      }

      i = nextLineIndex; // Move index to the next unprocessed line
    } else {
      i++; // Move to the next line if no transaction pattern found
    }
  }

  return transactions;
}

// Function to clean an individual transaction string
function cleanIndividualTransaction(transaction) {
  if (!transaction) return '';

  let cleaned = transaction.replace(/\s+/g, ' ').trim(); // Normalize spaces

  // Handle foreign currency transactions specially
  if (cleaned.includes('USD @') && cleaned.includes('**')) {
    // Pattern: "description USD_AMOUNT USD @ RATE** Foreign Currency Transactions FINAL_AMOUNT"
    cleaned = cleaned.replace(/(\d+\.\d+)\s+USD\s+@\s+([\d\.]+)\*\*/, '$1 USD @ $2**');

    // Ensure proper spacing around "Foreign Currency Transactions"
    cleaned = cleaned.replace(/\*\*\s*Foreign\s+Currency\s+Transactions\s+/, '** Foreign Currency Transactions ');
  }

  return cleaned;
}

// Function to validate if a string is a well-formed transaction
function isValidTransaction(transaction) {
  if (!transaction || transaction.length < 15) return false;

  // Must start with two dates in format: Sep 07 Sep 09
  const datePattern = /^[A-Z][a-z]{2}\s+\d{1,2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+/;
  if (!datePattern.test(transaction)) return false;

  // Must contain a merchant/description name (at least two uppercase letters)
  if (!transaction.match(/[A-Z]{2,}/)) return false;

  // Must end with a number (amount) - could be just digits.decimals or with ** for foreign currency
  // Also accept "Foreign Currency Transactions X.XX" format
  // Updated to specifically look for the amount at the end, including optional asterisks
  if (!transaction.match(/(-?\d{1,3}(?:,\d{3})*\.\d{2}(?:\*+)?|Foreign\s+Currency\s+Transactions\s+\d+\.\d+)$/)) return false;

  // Filter out summary lines and totals
  const excludePatterns = [
    /^.*TOTAL\s+(CHARGES|CREDITS)\s+\$?\d+\.\d+$/i,
    /^.*PREVIOUS\s+BALANCE\s+\$?\d+\.\d+$/i,
    /^.*NEW\s+BALANCE\s+\$?\d+\.\d+$/i,
    /^.*Total\s+for\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}/i,
    /^.*Total\s+payments\s+\$?\d+\.\d+$/i,
    /^.*Total\s+\d+\s+\$?\d+\.\d+$/i
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
