function processData() {
    const input = document.getElementById('inputText').value.trim();
    const yearInput = document.getElementById('yearInput').value.trim();
    const lines = input.split('\n').filter(l => l.trim());
    const outputDiv = document.getElementById('output');
    outputDiv.innerHTML = '';

    // Year validation
    let currentYear = new Date().getFullYear(); // Default to current year

    if (yearInput) {
        currentYear = parseInt(yearInput);
        if (isNaN(currentYear)) {
            displayStatusMessage('Invalid Year Input. Please enter a valid year (e.g., 2023).', 'error');
            return;
        }
    }
    
    const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
    const rows = [];
    const table = document.createElement('table');
    const monthMap = {
        '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
        '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
    };

    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    let previousBalance = null;

    lines.forEach(line => {
        // Attempt to extract the initial previous balance if present on these lines.
        // This is crucial for correctly setting the starting balance if the user provides it.
        if (line.match(/PREVIOUS BALANCE|OPENING BALANCE|BALANCE FORWARD|CLOSING BALANCE/i)) {
            const balanceMatch = line.match(/-?\d+(?:,\d{3})*\.\d{2}/);
            if (balanceMatch) {
                previousBalance = parseFloat(balanceMatch[0].replace(/[^\d.-]/g, ''));
            }
            return; // Skip these lines from being processed as transactions
        }

        const dateMatch = line.match(/^(\d{2})\s(\d{2})/);
        let date = '';
        let contentAfterDate = line;

        if (dateMatch) {
            const monthNum = dateMatch[1];
            const dayNum = dateMatch[2];
            date = `${monthMap[monthNum]} ${dayNum}`;
            // Append year if provided
            if (yearInput) {
                date += ` ${currentYear}`;
            }
            contentAfterDate = line.substring(dateMatch[0].length).trim();
        } else {
            return; // If no date found, skip this line
        }

        const amountPattern = /-?\d+(?:,\d{3})*\.\d{2}/g;
        const allAmountMatches = [...contentAfterDate.matchAll(amountPattern)];

        let desc = '';
        let transactionAmount = 0;
        let currentBalance = 0;
        let debit = '';
        let credit = '';

        if (allAmountMatches.length >= 2) {
            const balanceMatch = allAmountMatches[allAmountMatches.length - 1];
            currentBalance = parseFloat(balanceMatch[0].replace(/[^\d.-]/g, ''));

            const balanceStartIndex = balanceMatch.index;
            const contentBeforeBalance = contentAfterDate.substring(0, balanceStartIndex).trim();

            const transactionAmountMatchesInDescription = [...contentBeforeBalance.matchAll(amountPattern)];

            if (transactionAmountMatchesInDescription.length > 0) {
                const lastTransactionAmountMatch = transactionAmountMatchesInDescription[transactionAmountMatchesInDescription.length - 1];
                transactionAmount = parseFloat(lastTransactionAmountMatch[0].replace(/[^\d.-]/g, ''));
                desc = contentBeforeBalance.substring(0, lastTransactionAmountMatch.index).trim();
            } else {
                // Fallback: if no other amount found, assume the second to last was the transaction amount.
                if (allAmountMatches.length >= 2) { // Ensure there's a second-to-last match
                    transactionAmount = parseFloat(allAmountMatches[allAmountMatches.length - 2][0].replace(/[^\d.-]/g, ''));
                    desc = contentAfterDate.substring(0, allAmountMatches[allAmountMatches.length - 2].index).trim();
                } else {
                    // This case should ideally be caught by the allAmountMatches.length < 2 check,
                    // but as a safeguard, skip if amount isn't properly found.
                    return;
                }
            }

        } else {
            return; // If not enough financial numbers, skip the line.
        }

        // --- Debit/Credit Determination ---
        if (previousBalance !== null) {
            const delta = +(currentBalance - previousBalance).toFixed(2);
            const formattedTransactionAmount = Math.abs(transactionAmount).toFixed(2);

            // Check if the balance decreased
            if (delta < 0 || (transactionAmount < 0) || line.endsWith('-') || line.endsWith('DR')) {
                debit = formattedTransactionAmount;
            } 
            // Check if the balance increased
            else if (delta > 0) {
                credit = formattedTransactionAmount;
            }
            // If delta is 0, we need to check other clues
            else {
                // If there's no change, but a transaction amount is found,
                // it's likely a misparsed transaction that should be a debit.
                // The original code was correctly flagging this, so let's keep that logic.
                if (transactionAmount !== 0) {
                    debit = formattedTransactionAmount;
                }
            }

        } else {
            // --- Logic for the very first transaction if previousBalance is still null ---
            // As requested, assume the first transaction is a debit if the balance is negative
            // or if the line has a debit indicator.
            if (currentBalance < 0 || line.endsWith('-') || line.endsWith('DR')) {
                debit = Math.abs(transactionAmount).toFixed(2);
            } else {
                credit = Math.abs(transactionAmount).toFixed(2);
            }
        }
        
        const row = [date, desc, debit, credit, currentBalance.toFixed(2)];
        rows.push(row);
        previousBalance = currentBalance;
    });

    if (rows.length > 0) {
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
        table.dataset.rows = JSON.stringify(rows);
        document.getElementById('toolbar').classList.add('show');

        // Call utility functions
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
        if (typeof saveState === 'function') {
            saveState();
        }
        
        displayStatusMessage('Data processed successfully!', 'success');
    } else {
        displayStatusMessage('No data parsed. Please check the input format or ensure the correct bank is selected.', 'error');
    }
}

window.processData = processData;

// Ensure window.bankUtils exists to house bank-specific utilities
window.bankUtils = window.bankUtils || {};

/**
 * Main function to process a PDF file and extract transactions.
 * It uses a FileReader to get the ArrayBuffer and then uses PDF.js to parse text.
 * @param {File} file The PDF file to process.
 * @returns {Promise<string>} A promise that resolves with the formatted transaction text.
 */
window.bankUtils.processPDFFile = async function(file) {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = async function(event) {
            const arrayBuffer = event.target.result;
            try {
                // pdfjsLib is expected to be loaded globally by index.html
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = '';
                
                // Extract text from all pages and join them
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + ' ';
                }
                
                // Process the extracted text to find transactions
                const extractedTransactions = parsePdfTransactionsNBC(fullText, file.name);
                resolve(extractedTransactions);
            } catch (error) {
                console.error("Error parsing PDF:", error);
                if (typeof displayStatusMessage === 'function') {
                    displayStatusMessage("Failed to parse PDF file. " + error.message, 'error');
                }
                reject(new Error("Failed to parse PDF file. " + error.message));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

/**
 * Parses the extracted text to find National Bank account transactions
 * and returns them as a single string.
 * This function's logic is derived from nbcparser.html
 * @param {string} text The full text extracted from the PDF.
 * @returns {string} The formatted transaction strings, joined by newlines.
 */
function parsePdfTransactionsNBC(text) {
    // Clean up the text by replacing multiple spaces with single spaces
    text = text.replace(/\s+/g, ' ').trim();
    
    const transactions = [];

    // Regex for general transaction lines from the HTML
    const transactionRegex = /(\d{2})\s+(\d{2})\s+([A-Z].*?)\s+([\d,]+\.\d{2}\s*-?)\s+([\d,]+\.\d{2}\s*-?)?\s*([\d,]+\.\d{2}\s*-?)?/gi;
    
    let match;

    // First, try to find the previous balance
    const prevBalanceMatch = text.match(/PREVIOUS BALANCE\s+([\d,]+\.\d{2}\s*-?)/i);
    let prevBalance = prevBalanceMatch ? prevBalanceMatch[1].trim() : '0.00';
    
    // Add the previous balance as the first transaction
    const dateMatch = text.match(/(\d{2})\s+(\d{2})\s+PREVIOUS BALANCE/);
    if (dateMatch) {
        transactions.push(`${dateMatch[1]} ${dateMatch[2]} PREVIOUS BALANCE ${prevBalance}`);
    }
    
    // Find all other transactions
    while ((match = transactionRegex.exec(text)) !== null) {
        const month = match[1];
        const day = match[2];
        const description = match[3].trim();
        
        // Determine which group contains the amount and balance
        let amount = '';
        let balance = '';
        
        if (match[6]) {
            // Pattern: MM DD DESCRIPTION DEBIT CREDIT BALANCE
            amount = match[4] || match[5] || '';
            balance = match[6];
        } else if (match[5]) {
            // Pattern: MM DD DESCRIPTION AMOUNT BALANCE
            amount = match[4];
            balance = match[5];
        } else {
            // Pattern: MM DD DESCRIPTION AMOUNT
            amount = match[4];
            // Since there's no balance, we can't reliably determine it from the regex
            // This is a limitation of this specific regex pattern
            balance = ''; 
        }
        
        // Clean up the values
        amount = amount.replace(/,/g, '').trim();
        balance = balance.replace(/,/g, '').trim();
        
        // Skip if this is the previous balance line (already handled)
        if (description.toUpperCase().includes('PREVIOUS BALANCE')) {
            continue;
        }
        
        transactions.push(`${month} ${day} ${description} ${amount} ${balance}`);
    }
    
    return transactions.join('\n');
}

// Re-adding this function as it was present in the original bmoAccount.js and used internally
// This is needed for displayStatusMessage calls within processPDFFile
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