function processData() {
    const input = document.getElementById('inputText').value.trim();
    const yearInput = document.getElementById('yearInput').value.trim();
    const lines = input.split('\n').filter(l => l.trim());
    const outputDiv = document.getElementById('output');
    outputDiv.innerHTML = '';

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

            // 1. Prioritize if the original transaction amount was explicitly negative.
            if (transactionAmount < 0) {
                debit = Math.abs(transactionAmount).toFixed(2);
            }
            // 2. Check if balance increased by the transaction amount (Credit)
            else if (Math.abs(delta - transactionAmount) < 0.01) {
                credit = transactionAmount.toFixed(2);
            }
            // 3. Check if balance decreased by the transaction amount (Debit)
            else if (Math.abs(delta + transactionAmount) < 0.01) {
                debit = transactionAmount.toFixed(2);
            }
            // 4. More intelligent fallback if exact match doesn't occur
            else {
                if (currentBalance < previousBalance) { // Balance decreased -> likely debit
                    debit = transactionAmount.toFixed(2);
                } else if (currentBalance > previousBalance) { // Balance increased -> likely credit
                    credit = transactionAmount.toFixed(2);
                } else {
                    // Balance unchanged: this is ambiguous for a transaction with an amount.
                    // Default to debit as a conservative approach.
                    debit = transactionAmount.toFixed(2);
                }
            }
        } else {
            // --- Logic for the very first transaction if previousBalance is still null ---
            // This means no "OPENING BALANCE" line was found or processed.
            // As requested: assume the first transaction is a debit.
            debit = Math.abs(transactionAmount).toFixed(2); // Use Math.abs in case transactionAmount is negative
        }

        const row = [date, desc, debit, credit, currentBalance.toFixed(2)];
        rows.push(row);
        previousBalance = currentBalance;
    });

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
}

window.processData = processData;