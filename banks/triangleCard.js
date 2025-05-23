function parseLines(text, yearInput) {
  if (!text) return [];

  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const transactions = [];
  let currentTransaction = null;

  const isDateLine = (line) => /^[A-Za-z]{3} \d{1,2}$/.test(line);
  const isAmountLine = (line) => /^-?\d{1,3}(?:,\d{3})*\.\d{2}$/.test(line);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isDateLine(line)) {
      if (!currentTransaction) {
        currentTransaction = {
          dates: [line],
          descriptionParts: [],
          amount: null
        };
      } else if (currentTransaction.dates.length < 2) {
        currentTransaction.dates.push(line);
      } else {
        if (currentTransaction.amount !== null) {
          transactions.push(currentTransaction);
        }
        currentTransaction = {
          dates: [line],
          descriptionParts: [],
          amount: null
        };
      }
    } else if (isAmountLine(line)) {
      if (currentTransaction) {
        currentTransaction.amount = line.replace(/,/g, '');
      }
    } else {
      if (currentTransaction) {
        currentTransaction.descriptionParts.push(line);
      }
    }
  }

  if (currentTransaction && currentTransaction.amount !== null) {
    transactions.push(currentTransaction);
  }

  return transactions.map(t => {
    const [startDate, endDate] = t.dates;
    let fullDate = `${startDate} ${endDate}`;
    if (yearInput) {
      fullDate = `${startDate} ${yearInput} ${endDate} ${yearInput}`;
    }
    const description = t.descriptionParts.join(' ').replace(/\s+/g, ' ').trim();
    const isDebit = !t.amount.startsWith('-');
    const cleanAmount = t.amount.replace(/-/g, '');

    const row = [
      fullDate,
      description,
      isDebit ? cleanAmount : '',
      isDebit ? '' : cleanAmount
    ];

    return {
      rawDate: fullDate,
      parsedDate: parseDate(startDate, yearInput),
      row
    };
  });
}

function parseDate(dayMonth, year) {
  const [month, day] = dayMonth.split(' ');
  return new Date(`${month} ${day}, ${year}`);
}

function processTriangleCardData() {
  const yearInput = document.getElementById('yearInput').value.trim();
  const input = document.getElementById('inputText').value.trim();
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const headers = ['#', 'Date', 'Description', 'Debit', 'Credit'];
  const table = document.createElement('table');

  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;

    if (header !== '#') {
      const button = document.createElement('button');
      button.className = 'copy-btn';
      button.innerHTML = '<i class="fa-solid fa-copy"></i>';
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const colIndex = headers.indexOf(header);
        // Assuming window.bankUtils.copyColumn is available globally
        if (window.bankUtils && typeof window.bankUtils.copyColumn === 'function') {
          window.bankUtils.copyColumn(colIndex);
        }
      });
      th.insertBefore(button, th.firstChild);
    }

    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  let items = [];
  if (input) {
    items = parseLines(input, yearInput);
    if (items.length > 0) {
      items.sort((a, b) => a.parsedDate - b.parsedDate);
    }
  }

  items.forEach(({
    row
  }, index) => {
    const tr = document.createElement('tr');
    const numberCell = document.createElement('td');
    numberCell.textContent = index + 1;
    tr.appendChild(numberCell);

    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      td.draggable = true; // Make all data cells draggable
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  outputDiv.appendChild(table);

  // Set up drag and drop functionality
  setupDragAndDrop(table);

  table.dataset.rows = JSON.stringify(items.map((item, index) => [
    index + 1,
    ...item.row
  ]));

  document.getElementById('toolbar').classList.add('show');

  // Assuming window.bankUtils.saveState is available globally
  if (window.bankUtils && typeof window.bankUtils.saveState === 'function') {
    window.bankUtils.saveState();
  }
}

function setupDragAndDrop(table) {
  let draggedCell = null;

  // Make only data cells (not headers) draggable
  const cells = table.querySelectorAll('td:not(:first-child)'); // Exclude number column
  cells.forEach(cell => {
    // Only make draggable if it's not in the header row
    if (cell.parentElement.rowIndex > 0) {
      cell.draggable = true;

      cell.addEventListener('dragstart', (e) => {
        draggedCell = e.target;
        setTimeout(() => {
          e.target.classList.add('dragging');
        }, 0);
      });

      cell.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
      });
    }
  });

  // Set up drop targets (only allow dropping on data cells)
  table.querySelectorAll('td:not(:first-child)').forEach(cell => {
    // Only allow drops on cells not in header row
    if (cell.parentElement.rowIndex > 0) {
      cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedCell && draggedCell !== e.target) {
          e.target.classList.add('drop-target');
        }
      });

      cell.addEventListener('dragleave', (e) => {
        e.target.classList.remove('drop-target');
      });

      cell.addEventListener('drop', (e) => {
        e.preventDefault();
        e.target.classList.remove('drop-target');

        if (draggedCell && draggedCell !== e.target) {
          const temp = document.createElement('div');
          temp.innerHTML = e.target.innerHTML;
          e.target.innerHTML = draggedCell.innerHTML;
          draggedCell.innerHTML = temp.innerHTML;

          // Track selected cell (we land on the drop target)
          window.bankUtils.lastSelection = { // Use window.bankUtils for consistency
            row: e.target.parentElement.rowIndex,
            col: e.target.cellIndex
          };

          // Assuming window.bankUtils.selectCell and window.bankUtils.showToast are available globally
          if (window.bankUtils && typeof window.bankUtils.selectCell === 'function') {
            window.bankUtils.selectCell(e.target); // update selection visually
          }
          // Removed showToast for consistency with bmoAccount.js

          if (window.bankUtils && typeof window.bankUtils.saveState === 'function') {
            window.bankUtils.saveState();
          }
        }
      });
    }
  });
}

window.processData = processTriangleCardData;