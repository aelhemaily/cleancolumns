// main.js - Complete content for the new file

document.addEventListener('DOMContentLoaded', async () => {

  let history = [];
  let historyIndex = -1;
  let isUndoing = false;
  let isInserting = false;
  let lastSelection = { row: 0, col: 0 }; // Track last selected cell position
  const bankSelector = document.getElementById('bankSelector');
  const typeSelector = document.getElementById('typeSelector');
  const convertBtn = document.getElementById('convertBtn');
  const copyTableBtn = document.getElementById('copyTableBtn');
  const outputDiv = document.getElementById('output');

  const pdfUploadInput = document.getElementById('pdfUploadInput');
  const pdfProcessingStatus = document.getElementById('pdfProcessingStatus');
  const inputText = document.getElementById('inputText'); // Ensure inputText is declared here

  // New variables for multi-select mode
  let isMultiSelectMode = false; // True for multi-select (plus cursor), false for drag/swap (hand cursor)
  let startCell = null; // The cell where a multi-select drag started
  let selectedCells = []; // Array to store all currently selected cells
  let isDraggingSelection = false; // Flag to indicate if a multi-cell selection drag is active
  let currentHoveredCell = null; // Track cell being hovered over during multi-select drag

  // Get the select mode toggle button
  const selectModeToggle = document.getElementById('selectModeToggle');

  if (pdfUploadInput) {
    pdfUploadInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) {
        return;
      }

      if (file.type !== 'application/pdf') {
        pdfProcessingStatus.textContent = 'Please upload a valid PDF file.';
        pdfProcessingStatus.className = 'status-message error';
        return;
      }

      pdfProcessingStatus.textContent = 'Processing PDF... Please wait.';
      pdfProcessingStatus.className = 'status-message';
      inputText.value = '';

      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const pdfBytes = new Uint8Array(e.target.result);

          const { extractTextFromPdf } = await import('./pdf.js');

          const extractedText = await extractTextFromPdf(pdfBytes);
          inputText.value = extractedText;
          pdfProcessingStatus.textContent = 'PDF processed successfully!';
          pdfProcessingStatus.className = 'status-message success';

          if (typeof processData === 'function') {
            processData();
          }
        };
        reader.readAsArrayBuffer(file);

      } catch (error) {
        console.error('Error processing PDF:', error);
        pdfProcessingStatus.textContent = `Error processing PDF: ${error.message}`;
        pdfProcessingStatus.className = 'status-message error';
      } finally {
        event.target.value = '';
      }
    });
  }

  // Sample statement functionality
  const sampleBtn = document.getElementById('sampleBtn');
  const imageModal = document.getElementById('imageModal');
  const sampleImage = document.getElementById('sampleImage');
  const closeModal = document.querySelector('.close-modal');

  function showSampleStatement() {
    const bankKey = getCombinedKey();
    sampleImage.src = `images/${bankKey}.png`;
    imageModal.classList.add('show');

    // Create magnifier element
    const magnifier = document.createElement('div');
    magnifier.className = 'magnifier';
    imageModal.querySelector('.image-modal-content').appendChild(magnifier);

    let zoomLevel = 2; // Adjust this for more/less zoom

    sampleImage.addEventListener('mousemove', (e) => {
      if (!imageModal.classList.contains('zoomed')) return;

      const rect = sampleImage.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const imgWidth = sampleImage.offsetWidth;
      const imgHeight = sampleImage.offsetHeight;

      // Position magnifier
      magnifier.style.left = e.clientX + 'px';
      magnifier.style.top = e.clientY + 'px';

      // Calculate zoomed image position
      const bgX = -(x * zoomLevel - magnifier.offsetWidth / 2);
      const bgY = -(y * zoomLevel - magnifier.offsetHeight / 2);

      // Set magnifier background
      magnifier.style.backgroundImage = `url('${sampleImage.src}')`;
      magnifier.style.backgroundSize = `${imgWidth * zoomLevel}px ${imgHeight * zoomLevel}px`;
      magnifier.style.backgroundPosition = `${bgX}px ${bgY}px`;
    });

    imageModal.addEventListener('click', () => {
      imageModal.classList.toggle('zoomed');
      if (!imageModal.classList.contains('zoomed')) {
        magnifier.style.display = 'none';
      } else {
        magnifier.style.display = 'block';
      }
    });

    // Close modal when clicking outside image
    imageModal.addEventListener('click', (e) => {
      if (e.target === imageModal) {
        closeSampleStatement();
      }
    });

    // Focus the modal for keyboard accessibility
    closeModal.focus();
  }

  function closeSampleStatement() {
    imageModal.classList.remove('show');
  }

  // Event listeners
  sampleBtn.addEventListener('click', showSampleStatement);
  closeModal.addEventListener('click', closeSampleStatement);

  // Close modal on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && imageModal.classList.contains('show')) {
      closeSampleStatement();
    }
  });

  // Close modal when clicking outside image
  imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) {
      closeSampleStatement();
    }
  });

  let selectedCell = null; // Track the currently selected cell


  if (copyTableBtn) {
    copyTableBtn.style.display = 'none';
    copyTableBtn.addEventListener('click', () => window.bankUtils.copyTable());
  }

  const exportWordBtn = document.querySelector('#exportWordBtn');
  if (exportWordBtn) {
    exportWordBtn.addEventListener('click', () => {
      const table = document.querySelector('#output table');
      if (!table) return;

      // Clone the table so we can safely modify it
      const tableClone = table.cloneNode(true);
      tableClone.style.borderCollapse = 'collapse';

      // Apply Word-friendly styles
      const cells = tableClone.querySelectorAll('th, td');
      cells.forEach(cell => {
        cell.style.border = '1px solid black';
        cell.style.padding = '6px';
        cell.style.fontFamily = 'Arial, sans-serif';
        cell.style.fontSize = '12pt';
      });

      const html = `
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            table { border-collapse: collapse; width: 100%; }
            th, td {
              border: 1px solid black;
              padding: 6px;
              font-family: Arial, sans-serif;
              font-size: 12pt;
            }
          </style>
        </head>
        <body>
          ${tableClone.outerHTML}
        </body>
      </html>
    `;

      const blob = new Blob(['ufeff' + html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'statement.doc';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }


  window.bankUtils = window.bankUtils || {};

  window.bankUtils.defaultKeywords = {
    debit: [
      "ATM W/D", "CASH WITHDRA", "WITHDRAW", "FEE", "SERVICE CHARGE",
      "MONTHLY PLAN FEE", "OVERDRAFT FEE", "O.D.P. FEE", "SEND E-TFR",
      "TFR-TO", "PAYMENT TO", "NSF FEE", "BILL PAYMENT", "PURCHASE", "PAYMENT"
    ],
    credit: [
      "DEPOSIT", "TFR-FR", "E-TRANSFER", "E-TFR", "PAYMENT - THANK YOU",
      "REFUND", "INTEREST RECEIVED", "REMITTANCE", "GC DEPOSIT",
      "TRANSFER FR", "RECEIVED", "CREDIT"
    ]
  };

  window.bankUtils.loadKeywords = async function () {
    try {
      const response = await fetch('../keywords.json');
      if (!response.ok) throw new Error('Failed to load keywords.json');
      const keywords = await response.json();
      if (keywords && Array.isArray(keywords.debit) && Array.isArray(keywords.credit)) {
        return keywords;
      }
      throw new Error('Invalid keywords.json format');
    } catch (e) {
      console.warn('Could not load keywords.json, using defaults', e);
      return this.defaultKeywords;
    }
  };

  window.bankUtils.keywords = await window.bankUtils.loadKeywords();

  function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function getCombinedKey() {
    const bank = bankSelector.value;
    const type = typeSelector.value;
    if (bank === 'td' && type === 'inPerson') {
      return 'tdinPerson';
    }
    return bank + capitalizeFirstLetter(type);
  }

  function enforceTypeRestrictions(bank) {
    const allowedTypes = {
      cdt: ['card'],
      tangerine: ['account'],
      td: ['account', 'card', 'inPerson'],
      firstontario: ['account'],
      meridian: ['account'],
      triangle: ['card'],
      bmo: ['account', 'card', 'loc'],
      rbc: ['account', 'card', 'loc']
    };

    const allTypes = {
      account: 'Account',
      card: 'Card',
      inPerson: 'In-Person',
      loc: 'LOC'
    };

    const allowed = allowedTypes[bank] || ['account', 'card'];
    typeSelector.innerHTML = '';
    allowed.forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = allTypes[type];
      typeSelector.appendChild(option);
    });
  }

  const urlParams = new URLSearchParams(window.location.search);
  const selectedBank = urlParams.get('bank') || bankSelector.value;
  bankSelector.value = selectedBank;

  enforceTypeRestrictions(selectedBank);

  const selectedType = urlParams.get('type');
  const availableTypes = Array.from(typeSelector.options).map(opt => opt.value);
  if (selectedType && availableTypes.includes(selectedType)) {
    typeSelector.value = selectedType;
  } else {
    typeSelector.value = typeSelector.options[0]?.value || '';
  }

  const combinedKey = getCombinedKey();

  function showRbcMessageIfNeeded(bankKey) {
    const existing = document.getElementById('rbc-warning');
    if (existing) existing.remove();
    if (bankKey === 'rbcAccount') {
      const warning = document.createElement('div');
      warning.id = 'rbc-warning';
      warning.textContent = '';
      warning.style.color = 'red';
      warning.style.marginTop = '15px';
      warning.style.marginBottom = '10px';
      outputDiv.parentNode.insertBefore(warning, outputDiv.nextSibling);
    }
  }

  function loadBankScript(bankKey) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `banks/${bankKey}.js`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${bankKey}.js`));
      document.body.appendChild(script);
    });
  }

  showRbcMessageIfNeeded(combinedKey);

  loadBankScript(combinedKey)
    .then(() => console.log(`${combinedKey} script loaded successfully.`))
    .catch(console.error);

  function updateURLAndReload() {
    const newBank = bankSelector.value;
    const newType = typeSelector.value;
    window.location.href = `${window.location.pathname}?bank=${newBank}&type=${newType}`;
  }

  bankSelector.addEventListener('change', () => {
    const newBank = bankSelector.value;
    enforceTypeRestrictions(newBank);
    typeSelector.value = typeSelector.options[0]?.value || '';
    updateURLAndReload();
  });

  typeSelector.addEventListener('change', updateURLAndReload);

  convertBtn.addEventListener('click', () => {
    const input = inputText.value.trim();
    if (!input) {
      showToast("Please insert bank statement data!", "error");
      return;
    }

    if (typeof processData === 'function') {
      processData();
      document.getElementById('toolbar').classList.add('show');
      createCopyColumnButtons(); // First, build the full table
      checkAndRemoveEmptyBalanceColumn(); // ✅ Now check & remove empty Balance column
      saveState();
      updateTableCursor(); // Call this after table is created
    } else {
      console.warn('Parsing script not yet loaded.');
    }
  });

  // ADD THIS NEW FUNCTION
  function checkAndRemoveEmptyBalanceColumn() {
    const table = document.querySelector('#output table');
    if (!table) return;

    // Find the Balance column index
    const headers = Array.from(table.rows[0].cells).map(cell => cell.textContent.trim());
    const balanceIndex = headers.findIndex(header => header.toLowerCase() === 'balance');

    if (balanceIndex === -1) return; // No Balance column found

    // Check if all balance cells are empty
    let hasBalanceData = false;
    for (let i = 1; i < table.rows.length; i++) {
      const balanceCell = table.rows[i].cells[balanceIndex];
      if (balanceCell && balanceCell.textContent.trim() !== '') {
        hasBalanceData = true;
        break;
      }
    }

    // Remove the column if no balance data exists
    if (!hasBalanceData) {
      Array.from(table.rows).forEach(row => {
        if (row.cells[balanceIndex]) {
          row.deleteCell(balanceIndex);
        }
      });
    }
  }

  window.bankUtils.copyColumn = function (columnIndex) {
    const table = document.querySelector('#output table');
    if (!table) return;

    const rows = Array.from(table.querySelectorAll('tr')).slice(1); // Skip header
    const columnData = rows.map(row => row.cells[columnIndex]?.textContent.trim() || '').join('\n');

    navigator.clipboard.writeText(columnData).then(() => {
      showToast('Column copied!', 'success');
    }).catch(err => {
      console.error('Copy column failed:', err);
    });
  };

  window.bankUtils.copyTable = function () {
    const table = document.querySelector('#output table');
    if (!table) return;

    const rows = Array.from(table.querySelectorAll('tr')); // Get all rows, including header

    // Find the index of the "Balance" column in the header row
    const headerCells = Array.from(rows[0].cells);
    const balanceColIndex = headerCells.findIndex(cell => cell.textContent.trim().toLowerCase() === 'balance');

    const content = rows.slice(1).map(row => // Start from the second row (skip header)
      Array.from(row.cells)
      .filter((cell, index) => {
        // Ignore the first column (#) and the balance column
        return index !== 0 && (balanceColIndex === -1 || index !== balanceColIndex);
      })
      .map(cell => cell.textContent.trim())
      .join('\t')
    ).join('\n');

    navigator.clipboard.writeText(content).then(() => {
      showToast('Table copied!', 'success');
    }).catch(err => {
      console.error('Copy table failed:', err);
    });
  };

  function showToast(message, type = 'success') {

    const toast = document.getElementById(type === 'error' ? 'error-toast' : 'toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');
    toast.classList.remove('error', 'success');

    if (type === 'error') {
      toast.classList.add('error');
      setTimeout(() => toast.classList.remove('show'), 5000);
    } else {
      toast.classList.add('success');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }
  }

  // ======== NUMBERED COLUMN FUNCTIONS ======== //
  function addNumberedColumn(table) {
    if (!table) return;

    // Skip if already has numbers
    if (table.rows[0]?.cells[0]?.textContent === '#') return;

    // Add # header
    const headerRow = table.rows[0];
    if (headerRow) {
      const th = document.createElement('th');
      th.textContent = '#';
      headerRow.insertBefore(th, headerRow.firstChild);
    }

    // Add numbers (1, 2, 3...)
    for (let i = 1; i < table.rows.length; i++) {
      const row = table.rows[i];
      const td = document.createElement('td');
      td.textContent = i;
      row.insertBefore(td, row.firstChild);
    }
  }

  function copyNumberColumn() {
    const table = document.querySelector('#output table');
    if (!table) return;

    const numbers = Array.from(table.rows)
      .slice(1) // Skip header
      .map(row => row.cells[0]?.textContent || '')
      .join('\n');

    navigator.clipboard.writeText(numbers)
      .then(() => showToast('Number column copied!', 'success'))
      .catch(err => console.error('Copy failed:', err));
  }
  // ======== END NUMBERED COLUMN ======== //

  // ======== IMPROVED UNDO/REDO SYSTEM ======== //
  function saveState() {
    if (isUndoing) return;

    const table = document.querySelector('#output table');
    if (!table) return;

    // history limit
    if (history.length > 50) { // Keep last 50 states
      history.shift();
      historyIndex--;
    }

    // Remember selection
    if (selectedCell) {
      const row = selectedCell.parentElement;
      lastSelection = {
        row: row.rowIndex,
        col: Array.from(row.cells).indexOf(selectedCell)
      };
    }

    // Store table state with headers
    const state = {
      html: table.innerHTML,
      selection: lastSelection
    };

    // Truncate history if needed
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1);
    }

    history.push(state);
    historyIndex++;

    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');

    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= history.length - 1;

    // Add visual styling classes
    if (undoBtn.disabled) {
      undoBtn.classList.add('disabled');
    } else {
      undoBtn.classList.remove('disabled');
    }

    if (redoBtn.disabled) {
      redoBtn.classList.add('disabled');
    } else {
      redoBtn.classList.remove('disabled');
    }
  }

  function undo() {
    if (historyIndex <= 0) return;

    isUndoing = true;
    historyIndex--;
    restoreState();
    isUndoing = false;
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;

    isUndoing = true;
    historyIndex++;
    restoreState();
    isUndoing = false;
  }

  function restoreState() {
    const table = document.querySelector('#output table');
    const state = history[historyIndex];
    if (!table || !state) return;

    // Restore entire table contents
    table.innerHTML = state.html;

    // Rebuild numbered column, copy buttons, interactivity
    addNumberedColumn(table);
    createCopyColumnButtons();

    requestAnimationFrame(() => {
      if (state.selection) {
        const { row, col } = state.selection;
        const targetRow = table.rows[row];
        const targetCell = targetRow?.cells[col];

        if (targetCell) {
          selectCell(targetCell); // Apply your visual/highlight selection

          // Ensure the cell is in view inside the table
          const cellRect = targetCell.getBoundingClientRect();
          const tableRect = table.getBoundingClientRect();

          if (cellRect.top < tableRect.top || cellRect.bottom > tableRect.bottom) {
            table.scrollTop = targetCell.offsetTop - table.offsetTop - 20;
          }

          // Ensure the cell is in view in the window
          const scrollY = window.scrollY;
          const absoluteCellTop = cellRect.top + scrollY;
          const viewportHeight = window.innerHeight;

          if (absoluteCellTop < 100) {
            window.scrollTo({
              top: absoluteCellTop - 100,
              behavior: 'smooth'
            });
          } else if (absoluteCellTop > scrollY + viewportHeight - 100) {
            window.scrollTo({
              top: absoluteCellTop - viewportHeight + 100,
              behavior: 'smooth'
            });
          }
        } else {
          // Fallback: select first body cell if saved cell is missing
          const fallback = table.rows[1]?.cells[1];
          if (fallback) selectCell(fallback);
        }
      } else {
        // Fallback: select first data cell
        const fallback = table.rows[1]?.cells[1];
        if (fallback) selectCell(fallback);
      }
    });

    updateUndoRedoButtons();
  }

  // ======== END UNDO/REDO ======== //

  // Function to clear all current selections
  function clearSelection() {
    // Clear visual selection for all previously selected cells
    selectedCells.forEach(cell => cell.classList.remove('selected-cell'));
    selectedCells = []; // Clear the array
    if (selectedCell) {
      selectedCell.classList.remove('selected-cell');
      selectedCell = null;
    }
  }

  function setupCellSelection(table) {
    // Make all cells focusable
    const cells = table.querySelectorAll('td, th');
    cells.forEach(cell => {
      cell.tabIndex = -1; // Make focusable but not in tab order
    });

    // Click handler for cell selection
    table.addEventListener('click', (e) => {
      // Don't handle clicks on inputs or copy buttons
      if (e.target.tagName === 'INPUT' || e.target.closest('.copy-btn')) return;

      const cell = e.target.closest('td, th');
      if (!cell) return;

      // If in multi-select mode, handle selection range
      if (isMultiSelectMode) {
        if (e.shiftKey && selectedCell) { // Shift-click to extend selection
          const tableRows = Array.from(table.rows);
          const startRowIndex = selectedCell.parentElement.rowIndex;
          const startColIndex = selectedCell.cellIndex;
          const endRowIndex = cell.parentElement.rowIndex;
          const endColIndex = cell.cellIndex;

          const minRow = Math.min(startRowIndex, endRowIndex);
          const maxRow = Math.max(startRowIndex, endRowIndex);
          const minCol = Math.min(startColIndex, endColIndex);
          const maxCol = Math.max(startColIndex, endColIndex);

          clearSelection(); // Clear existing selection before extending

          for (let r = minRow; r <= maxRow; r++) {
            const row = tableRows[r];
            if (row) {
              for (let c = minCol; c <= maxCol; c++) {
                const currentCell = row.cells[c];
                if (currentCell && !selectedCells.includes(currentCell)) {
                  selectedCells.push(currentCell);
                  currentCell.classList.add('selected-cell');
                }
              }
            }
          }
          selectedCell = cell; // The last clicked cell becomes the active one
          cell.focus();
        } else { // Single click in multi-select mode starts a new selection
          clearSelection();
          selectedCells.push(cell);
          cell.classList.add('selected-cell');
          selectedCell = cell;
          cell.focus();
        }
      } else { // Original single-select mode
        clearSelection(); // Always clear all selections in single mode
        selectCell(cell);
      }
    });

    // Double click to edit
    table.addEventListener('dblclick', (e) => {
      const cell = e.target.closest('td, th');
      if (!cell) return;

      if (cell.querySelector('input')) return;

      makeCellEditable(cell);
      e.preventDefault();
    });

    // Keyboard navigation handler
    table.addEventListener('keydown', (e) => {
      if (!selectedCell) return;

      const row = selectedCell.parentElement;
      const cellIndex = selectedCell.cellIndex; // Use cellIndex directly
      const rowIndex = row.rowIndex;
      const rows = Array.from(table.rows);

      let nextCell = null;

      // Handle arrow keys only when not editing
      if (!selectedCell.querySelector('input')) {
        switch (e.key) {
          case 'ArrowUp':
            if (rowIndex > 1) { // Skip header row
              nextCell = rows[rowIndex - 1].cells[cellIndex];
            }
            break;
          case 'ArrowDown':
            if (rowIndex < rows.length - 1) {
              nextCell = rows[rowIndex + 1].cells[cellIndex];
            }
            break;
          case 'ArrowLeft':
            if (cellIndex > 0) {
              nextCell = row.cells[cellIndex - 1];
            }
            break;
          case 'ArrowRight':
            if (cellIndex < row.cells.length - 1) {
              nextCell = row.cells[cellIndex + 1];
            }
            break;
        }

        if (nextCell) {
          if (e.shiftKey) { // Shift + Arrow key to extend selection
            if (!selectedCells.includes(nextCell)) {
              selectedCells.push(nextCell);
              nextCell.classList.add('selected-cell');
            }
            selectedCell = nextCell; // Update the active selected cell
            nextCell.focus();
          } else { // Just Arrow key to move selection
            clearSelection(); // Clear all previous selections
            selectCell(nextCell);
          }
          e.preventDefault();
        }
      }

      // Handle special keys
      switch (e.key) {
        case 'Enter':
          if (!selectedCell.querySelector('input')) {
            makeCellEditable(selectedCell);
          }
          e.preventDefault();
          break;
        case 'F2':
          makeCellEditable(selectedCell);
          e.preventDefault();
          break;
        case 'Escape':
          const input = selectedCell.querySelector('input');
          if (input) {
            selectedCell.textContent = input.dataset.original || '';
            selectCell(selectedCell);
          }
          e.preventDefault();
          break;
      }
    });

    // Click outside to deselect
    document.addEventListener('click', (e) => {
      if (!e.target.closest('table') && !e.target.closest('.context-menu')) {
        clearSelection();
      }
    });

    // Multi-select drag functionality
    table.addEventListener('mousedown', (e) => {
      if (!isMultiSelectMode || e.button !== 0) return; // Only left click in multi-select mode

      const cell = e.target.closest('td, th');
      if (!cell || cell.tagName === 'TH' && cell.cellIndex === 0) return; // Don't select header or # column

      isDraggingSelection = true;
      startCell = cell;

      if (!e.shiftKey) {
        clearSelection();
      }
      selectedCells.push(cell);
      cell.classList.add('selected-cell');
      selectedCell = cell; // Set the active selected cell
      cell.focus();
    });

    table.addEventListener('mousemove', (e) => {
      if (!isDraggingSelection || !startCell) return;

      const table = startCell.closest('table');
      const currentCell = e.target.closest('td, th');

      if (!currentCell || currentCell === currentHoveredCell) return; // Optimization
      currentHoveredCell = currentCell;

      // Clear all selections first, then re-select based on the new range
      selectedCells.forEach(c => c.classList.remove('selected-cell'));
      selectedCells = [];

      const tableRows = Array.from(table.rows);
      const startRowIndex = startCell.parentElement.rowIndex;
      const startColIndex = startCell.cellIndex;
      const endRowIndex = currentCell.parentElement.rowIndex;
      const endColIndex = currentCell.cellIndex;

      const minRow = Math.min(startRowIndex, endRowIndex);
      const maxRow = Math.max(startRowIndex, endRowIndex);
      const minCol = Math.min(startColIndex, endColIndex);
      const maxCol = Math.max(startColIndex, endColIndex);

      for (let r = minRow; r <= maxRow; r++) {
        const row = tableRows[r];
        if (row) {
          for (let c = minCol; c <= maxCol; c++) {
            const cell = row.cells[c];
            if (cell && cell.tagName !== 'TH' || (cell.tagName === 'TH' && cell.cellIndex !== 0)) { // Exclude # header
              selectedCells.push(cell);
              cell.classList.add('selected-cell'); // Apply class to the cell being added to selection
            }
          }
        }
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDraggingSelection) {
        isDraggingSelection = false;
        startCell = null;
        currentHoveredCell = null;
        if (selectedCells.length > 0) {
          saveState(); // Save state after a multi-selection drag
        }
      }
    });
  }


 function setupColumnResizing(table) {
  const headers = table.querySelectorAll('th');
  let isResizing = false;
  let currentResizeHeader = null;
  let startX = 0;
  let startWidth = 0;

  // Set fixed initial widths based on version 1 layout
  headers.forEach((header, index) => {
    // Default widths for different columns
    const columnWidths = {
      0: '40px',    // # column
      1: '80px',    // Date
      2: '120px',   // Description
      3: '80px',    // Debit
      4: '80px',    // Credit
      5: '80px'     // Balance
    };

    header.style.width = columnWidths[index] || '150px'; // Fallback width

    const resizeHandle = document.createElement('div');
    resizeHandle.classList.add('resize-handle');
    header.appendChild(resizeHandle);

    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      currentResizeHeader = header;
      startX = e.clientX;
      startWidth = header.offsetWidth;
      resizeHandle.classList.add('active');
      e.preventDefault();
      e.stopPropagation();
    });

    // Apply the same width to all cells in the column
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cell = row.cells[index];
      if (cell) {
        cell.style.width = header.style.width;
      }
    });
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const width = startWidth + (e.clientX - startX);
    currentResizeHeader.style.width = `${width}px`;

    // Update all cells in this column
    const colIndex = Array.from(currentResizeHeader.parentElement.children).indexOf(currentResizeHeader);
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cell = row.children[colIndex];
      if (cell) {
        cell.style.width = `${width}px`;
      }
    });
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.querySelectorAll('.resize-handle.active').forEach(handle => {
        handle.classList.remove('active');
      });
      saveState(); // Save the new column widths
    }
  });
}


  function moveSelection(cell) {
    if (!cell) return;

    // Clear any existing editing
    if (selectedCell) {
      const input = selectedCell.querySelector('input');
      if (input) {
        selectedCell.textContent = input.value;
      }
      selectedCell.classList.remove('selected-cell');
    }

    cell.classList.add('selected-cell');
    selectedCell = cell;
    cell.focus();
  }

  function makeCellEditable(cell) {
    if (!cell) return;
    cell.draggable = false;

    const originalContent = cell.textContent.trim();
    cell.innerHTML = `<input type="text" value="${originalContent}" data-original="${originalContent}">`;
    const input = cell.querySelector('input');
    input.focus();
    input.select();

    input.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cell.textContent = originalContent;
        selectCell(cell);
      }
    });

    input.addEventListener('blur', () => {
      cell.textContent = input.value.trim();
      cell.draggable = true;
      selectCell(cell);
      saveState();
    });
  }

  // This function is now primarily for setting the *active* selected cell
  function selectCell(cell) {
    if (!cell) return;

    // Clear previous single selection, but not multi-selection if active
    if (selectedCell && !selectedCells.includes(selectedCell)) {
      selectedCell.classList.remove('selected-cell');
      const input = selectedCell.querySelector('input');
      if (input) {
        selectedCell.textContent = input.value;
      }
    }

    // Add to selectedCells if not already there (for multi-select mode)
    if (isMultiSelectMode && !selectedCells.includes(cell)) {
      selectedCells.push(cell);
    } else if (!isMultiSelectMode) {
      // If not multi-select mode, ensure only this cell is selected
      clearSelection();
      selectedCells.push(cell);
    }

    // Set new active selection and apply class
    cell.classList.add('selected-cell');
    selectedCell = cell;
    cell.focus(); // This is crucial for keyboard events

    // Handle table scrolling if needed
    const table = cell.closest('table');
    if (table) {
      // Make table focusable if it isn't already
      if (!table.hasAttribute('tabindex')) {
        table.tabIndex = -1;
      }

      // Calculate positions for scrolling
      const cellRect = cell.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();

      // Scroll table if cell is out of view
      if (cellRect.top < tableRect.top) {
        table.scrollTop -= (tableRect.top - cellRect.top + 5);
      } else if (cellRect.bottom > tableRect.bottom) {
        table.scrollTop += (cellRect.bottom - tableRect.bottom + 5);
      }
    }

    // Handle window scrolling if needed
    const cellTop = cell.getBoundingClientRect().top;
    const cellHeight = cell.offsetHeight;
    const viewportHeight = window.innerHeight;

    if (cellTop < 100) {
      window.scrollBy(0, cellTop - 100);
    } else if (cellTop + cellHeight > viewportHeight - 50) {
      window.scrollBy(0, (cellTop + cellHeight) - (viewportHeight - 50));
    }
  }


  function copyCellContent(cell) {
    if (!cell) return;
    navigator.clipboard.writeText(cell.textContent.trim())
      .then(() => showToast('Cell copied!', 'success'))
      .catch(err => console.error('Copy failed:', err));
  }

 function copySelectedCells() {
    if (selectedCells.length === 0) {
        showToast('No cells selected to copy!', 'error');
        return;
    }

    // Sort selected cells by row and then by column for proper order
    const sortedCells = [...selectedCells].sort((a, b) => {
        const rowA = a.parentElement.rowIndex;
        const rowB = b.parentElement.rowIndex;
        const colA = a.cellIndex;
        const colB = b.cellIndex;

        if (rowA !== rowB) {
            return rowA - rowB;
        }
        return colA - colB;
    });

    let clipboardText = '';
    let currentRow = -1;

    sortedCells.forEach(cell => {
        const cellRow = cell.parentElement.rowIndex;
        if (cellRow !== currentRow) {
            if (currentRow !== -1) {
                clipboardText += '\n'; // New line for a new row
            }
            currentRow = cellRow;
        } else if (clipboardText !== '') {
            clipboardText += '\t'; // Tab for cells in the same row
        }
        clipboardText += cell.textContent.trim();
    });

    navigator.clipboard.writeText(clipboardText)
        .then(() => showToast('Selected cells copied!', 'success'))
        .catch(err => console.error('Copy selected cells failed:', err));
}

  function createCopyColumnButtons() {
    const table = document.querySelector('#output table');
    if (!table) return;

    // Remove old buttons if they exist
    const firstRow = table.rows[0];
    if (firstRow && [...firstRow.querySelectorAll('.copy-btn')].length === firstRow.cells.length) {
      table.deleteRow(0);
    }

    // Add the numbers (1, 2, 3...)
    addNumberedColumn(table);

    // Add copy buttons to each header
    const headers = table.querySelectorAll('th');
    headers.forEach((header, index) => {
      if (index === 0) return; // Skip number column

      const button = document.createElement('button');
      button.className = 'copy-btn';
      button.innerHTML = '<i class="fa-solid fa-copy"></i>';
      button.onclick = () => window.bankUtils.copyColumn(index);
      header.insertBefore(button, header.firstChild);

      // Add column menu button
      const menuBtn = document.createElement('button');
      menuBtn.className = 'column-menu-btn';
      menuBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
      menuBtn.onclick = (e) => showColumnMenu(e, index);
      header.appendChild(menuBtn);
    });

    // Make table interactive
    setupCellSelection(table);
    setupTableContextMenu(table);
    setupCellDragAndDrop(table);
    setupColumnResizing(table);

    // Select first cell
    if (table.rows.length > 1) {
      selectCell(table.rows[1].cells[0]);
    }
    updateTableCursor(); // Ensure cursor is set after table creation
  }

  function showColumnMenu(e, columnIndex) {
    e.stopPropagation();
    const table = document.querySelector('#output table');
    if (!table) return;

    // Remove any existing column menus
    const existingMenu = document.querySelector('.column-menu');
    if (existingMenu) existingMenu.remove();

    // Create the menu
    const menu = document.createElement('div');
    menu.className = 'column-menu';
    menu.style.position = 'absolute';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.style.zIndex = '1000';
    menu.style.backgroundColor = 'white';
    menu.style.border = '1px solid #ccc';
    menu.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    menu.style.padding = '5px 0';

    // Add sorting options
    const sortAZ = document.createElement('div');
    sortAZ.className = 'menu-item';
    sortAZ.textContent = 'Sort A → Z';
    sortAZ.onclick = () => sortColumn(columnIndex, 'asc');
    menu.appendChild(sortAZ);

    const sortZA = document.createElement('div');
    sortZA.className = 'menu-item';
    sortZA.textContent = 'Sort Z → A';
    sortZA.onclick = () => sortColumn(columnIndex, 'desc');
    menu.appendChild(sortZA);

    // Add divider
    const divider = document.createElement('div');
    divider.className = 'menu-divider';
    menu.appendChild(divider);

    // Add replace option
    const replaceOption = document.createElement('div');
    replaceOption.className = 'menu-item';
    replaceOption.innerHTML = `
      <div style="padding: 5px;">
        <div>Replace:</div>
        <input type="text" class="replace-from" placeholder="Find..." style="width: 100%; margin: 3px 0;">
        <input type="text" class="replace-to" placeholder="Replace with..." style="width: 100%; margin: 3px 0;">
        <button class="replace-confirm" style="width: 100%; margin: 3px 0;">Replace All</button>
      </div>
    `;
    menu.appendChild(replaceOption);

    // Add delete all instances option
    const deleteOption = document.createElement('div');
    deleteOption.className = 'menu-item';
    deleteOption.innerHTML = `
      <div style="padding: 5px;">
        <div>Delete all:</div>
        <input type="text" class="delete-text" placeholder="Text to delete..." style="width: 100%; margin: 3px 0;">
        <button class="delete-confirm" style="width: 100%; margin: 3px 0;">Delete All</button>
      </div>
    `;
    menu.appendChild(deleteOption);

    document.body.appendChild(menu);

    // Set up event listeners for the replace/delete inputs
    const replaceConfirm = menu.querySelector('.replace-confirm');
    const deleteConfirm = menu.querySelector('.delete-confirm');

    replaceConfirm.onclick = () => {
      const fromText = menu.querySelector('.replace-from').value;
      const toText = menu.querySelector('.replace-to').value;
      if (fromText) {
        replaceInColumn(columnIndex, fromText, toText);
        menu.remove();
      }
    };

    deleteConfirm.onclick = () => {
      const deleteText = menu.querySelector('.delete-text').value;
      if (deleteText) {
        replaceInColumn(columnIndex, deleteText, '');
        menu.remove();
      }
    };

    // Close menu when clicking elsewhere
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  function sortColumn(columnIndex, direction) {
    const table = document.querySelector('#output table');
    if (!table || table.rows.length <= 1) return;

    saveState(); // Save before sorting

    // Get all data rows (skip header)
    const rows = Array.from(table.rows).slice(1);
    const headerRow = table.rows[0];

    // Extract the column data with row references
    const columnData = rows.map(row => ({
      value: row.cells[columnIndex].textContent.trim(),
      row: row
    }));

    // Sort the data
    columnData.sort((a, b) => {
      // Try to parse as date first
      const dateA = parseDate(a.value);
      const dateB = parseDate(b.value);
      
      if (dateA && dateB) {
        return direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      // Fall back to string comparison
      return direction === 'asc' 
        ? a.value.localeCompare(b.value) 
        : b.value.localeCompare(a.value);
    });

    // Rebuild the table with sorted rows
    const tbody = table.querySelector('tbody') || table;
    while (tbody.rows.length > 1) {
      tbody.deleteRow(1);
    }

    columnData.forEach(item => {
      tbody.appendChild(item.row);
    });

    // Update the numbered column if it exists
    if (table.rows[0].cells[0].textContent === '#') {
      for (let i = 1; i < table.rows.length; i++) {
        table.rows[i].cells[0].textContent = i;
      }
    }

    showToast(`Column sorted ${direction === 'asc' ? 'A→Z' : 'Z→A'}`, 'success');
  }

  function parseDate(str) {
    // Try to parse common date formats
    const formats = [
      /(\w{3})\s(\d{1,2})/, // MMM DD
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/, // MM/DD/YYYY
      /(\d{1,2})-(\d{1,2})-(\d{2,4})/, // MM-DD-YYYY
    ];

    for (const format of formats) {
      const match = str.match(format);
      if (match) {
        let month, day, year;
        
        if (match[1].length === 3) { // Month abbreviation
          month = new Date(`${match[1]} 1, 2000`).getMonth();
          day = parseInt(match[2]);
          year = new Date().getFullYear(); // Default to current year
        } else {
          month = parseInt(match[1]) - 1;
          day = parseInt(match[2]);
          year = match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3]);
        }

        return new Date(year, month, day).getTime();
      }
    }
    
    return null; // Not a recognized date format
  }

  function replaceInColumn(columnIndex, fromText, toText) {
    const table = document.querySelector('#output table');
    if (!table) return;

    saveState(); // Save before replacing

    let replacementCount = 0;
    const rows = Array.from(table.rows).slice(1); // Skip header

    rows.forEach(row => {
      const cell = row.cells[columnIndex];
      if (cell) {
        const originalText = cell.textContent;
        // Fix the regex replacement syntax error
        const newText = originalText.replace(new RegExp(escapeRegExp(fromText), 'g'), toText);
        if (newText !== originalText) {
          cell.textContent = newText;
          replacementCount++;
        }
      }
    });

    if (replacementCount > 0) {
      showToast(`Replaced ${replacementCount} occurrence(s)`, 'success');
    } else {
      showToast('No matches found', 'info');
    }
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  }

  function setupCellDragAndDrop(table) {
    let draggedCell = null;

    // This function will now primarily handle the drag/drop event listeners.
    // The 'draggable' attribute and cursor styling are managed by updateTableCursor().

    // Clear any existing drag handlers first to prevent duplicates
    const cells = table.querySelectorAll('td');
    cells.forEach(cell => {
        cell.removeEventListener('dragstart', handleDragStart);
        cell.removeEventListener('dragend', handleDragEnd);
        cell.removeEventListener('dragover', handleDragOver);
        cell.removeEventListener('dragleave', handleDragLeave);
        cell.removeEventListener('drop', handleDrop);
    });

    function handleDragStart(e) {
      if (isMultiSelectMode) { // Prevent drag/drop in multi-select mode
        e.preventDefault();
        return;
      }
      draggedCell = e.target;
      setTimeout(() => {
        e.target.classList.add('dragging');
      }, 0);
    }

    function handleDragEnd(e) {
      e.target.classList.remove('dragging');
    }

    function handleDragOver(e) {
      e.preventDefault();
      if (isMultiSelectMode) return; // Prevent drag/drop in multi-select mode
      if (draggedCell && draggedCell !== e.target) {
        e.target.classList.add('drop-target');
      }
    }

    function handleDragLeave(e) {
      e.target.classList.remove('drop-target');
    }

    function handleDrop(e) {
      e.preventDefault();
      e.target.classList.remove('drop-target');

      if (isMultiSelectMode) return; // Prevent drag/drop in multi-select mode

      if (draggedCell && draggedCell !== e.target) {
        const temp = document.createElement('div');
        temp.innerHTML = e.target.innerHTML;
        e.target.innerHTML = draggedCell.innerHTML;
        draggedCell.innerHTML = temp.innerHTML;

        // Track selected cell (we land on the drop target)
        lastSelection = {
          row: e.target.parentElement.rowIndex,
          col: e.target.cellIndex
        };

        selectCell(e.target); // update selection visually
        showToast('Cells swapped', 'success');
        saveState();
      }
    }

    // Add event listeners to data cells
    cells.forEach(cell => {
      if (cell.parentElement.rowIndex > 0) { // Only data rows
        cell.addEventListener('dragstart', handleDragStart);
        cell.addEventListener('dragend', handleDragEnd);
        cell.addEventListener('dragover', handleDragOver);
        cell.addEventListener('dragleave', handleDragLeave);
        cell.addEventListener('drop', handleDrop);
      }
    });
  }

  function setupTableContextMenu(table) {
    const contextMenu = document.getElementById('tableContextMenu');
    let targetRow = null;
    let targetCell = null;
    let targetIsHeader = false;

    // Show context menu on right-click
    table.addEventListener('contextmenu', (e) => {
      // Don't show context menu if clicking in an input field
      if (e.target.tagName === 'INPUT') {
        return; // Allow default browser context menu for inputs
      }

      e.preventDefault();

      targetRow = e.target.closest('tr');
      targetCell = e.target.closest('td, th');

      if (!targetRow || !targetCell) return;

      targetIsHeader = targetRow.rowIndex === 0;

      // Position menu at cursor
      contextMenu.style.display = 'block';
      contextMenu.style.left = `${Math.min(e.pageX, window.innerWidth - 200)}px`;
      contextMenu.style.top = `${Math.min(e.pageY, window.innerHeight - 160)}px`;

      // Show/hide relevant options
      document.querySelector('[data-action="delete-row"]').style.display = targetIsHeader ? 'none' : 'flex';
      document.querySelector('[data-action="delete-col"]').style.display = targetIsHeader ? 'flex' : 'none';
      document.querySelector('[data-action="copy-row"]').style.display = targetIsHeader ? 'none' : 'flex';
      document.querySelector('[data-action="copy-col"]').style.display = targetIsHeader ? 'flex' : 'none';

      // Show/hide "Copy Selected Cells" based on selection
      const copySelectedMenuItem = document.querySelector('[data-action="copy-selected-cells"]');
      if (copySelectedMenuItem) {
        copySelectedMenuItem.style.display = selectedCells.length > 1 ? 'flex' : 'none';
      }
    });

    // Hide menu when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (e.button !== 2) { // Not right click
        contextMenu.style.display = 'none';
      }
    });

    // Handle menu actions
    contextMenu.addEventListener('click', (e) => {
      const menuItem = e.target.closest('.menu-item');
      if (!menuItem) return;

      const action = menuItem.dataset.action;
      contextMenu.style.display = 'none';

      if (!targetRow || !targetCell) return;


      if (action === 'insert-col-left') {
        if (isInserting) return;
        isInserting = true;
        setTimeout(() => { isInserting = false; }, 50);

        const table = document.querySelector('#output table');
        if (!table || !targetCell) return;

        // *** NEW: Prevent insertion to the left of the '#' column ***
        // Check if the target cell is the first column (index 0) and its content is '#'
        if (targetCell.cellIndex === 0 && targetCell.textContent.trim() === '#') {
          showToast("Cannot insert a column to the left of the '#' column.", "error");
          contextMenu.style.display = 'none'; // Hide the context menu
          return; // Stop the function execution
        }
        // *** END NEW ***

        e.stopPropagation();
        contextMenu.style.display = 'none';

        const colIndex = targetCell.cellIndex;
        const rowCount = table.rows.length;

        for (let i = 0; i < rowCount; i++) {
          const row = table.rows[i];
          const cell = i === 0 ? document.createElement('th') : document.createElement('td');
          cell.textContent = ''; // empty
          row.insertBefore(cell, row.cells[colIndex]);
        }

        createCopyColumnButtons();
        saveState();
      }

      if (action === 'insert-row-below') {
        if (isInserting) return;
        isInserting = true;
        setTimeout(() => { isInserting = false; }, 50);

        const table = document.querySelector('#output table');
        if (!table || !targetRow) return;

        const hasNumberColumn = table.rows[0]?.cells[0]?.textContent === '#';
        const colCount = table.rows[0].cells.length;
        const dataColCount = hasNumberColumn ? colCount - 1 : colCount;

        const newRow = table.insertRow(targetRow.rowIndex + 1);

        // Leave space for # column if present
        const startIndex = hasNumberColumn ? 1 : 0;
        for (let i = 0; i < colCount; i++) {
          const cell = newRow.insertCell();
          cell.textContent = '';
        }

        // ✅ Rebuild just the number column safely
        Array.from(table.rows).forEach((row, i) => {
          // If # column already exists, update it
          if (hasNumberColumn) {
            if (i === 0) {
              row.cells[0].textContent = '#';
            } else {
              row.cells[0].textContent = i;
            }
          }
        });

        // If # column is missing, insert it properly
        if (!hasNumberColumn) {
          const headerRow = table.rows[0];
          const th = document.createElement('th');
          th.textContent = '#';
          headerRow.insertBefore(th, headerRow.firstChild);

          for (let i = 1; i < table.rows.length; i++) {
            const row = table.rows[i];
            const td = document.createElement('td');
            td.textContent = i;
            row.insertBefore(td, row.firstChild);
          }
        }

        createCopyColumnButtons(); // restores resizers, styles, etc.
        saveState();
      }


      // In the contextMenu.addEventListener('click', (e) => { ... } section
      // Add this case to the switch statement:
      switch (action) {
        case 'delete-row':
          deleteTableRow(targetRow);
          break;
        case 'delete-col':
          deleteTableColumn(targetCell.cellIndex);
          break;
        case 'copy-row':
          copyTableRow(targetRow);
          break;
        case 'copy-col':
          window.bankUtils.copyColumn(targetCell.cellIndex);
          break;
        case 'copy-cell': // Add this new case
          copyCellContent(targetCell);
          break;
        case 'copy-selected-cells': // New action for copying multiple selected cells
          copySelectedCells();
          break;
      }
    });
  }

  function deleteTableRow(row) {
    saveState(); // Save BEFORE deletion
    row.style.transform = 'translateX(-100%)';
    row.style.opacity = '0';
    setTimeout(() => {
      row.remove();
      showToast('Row deleted', 'success');
    }, 300);
  }

  function deleteTableColumn(colIndex) {
    saveState(); // Save BEFORE deletion
    const table = document.querySelector('#output table');
    if (!table) return;

    Array.from(table.rows).forEach(row => {
      if (row.cells[colIndex]) {
        row.deleteCell(colIndex);
      }
    });

    showToast('Column deleted', 'success');
    updateCopyButtonIndices();
  }

  function copyTableRow(row) {
    const content = Array.from(row.cells)
      .map(cell => cell.textContent.trim())
      .join('\t');

    navigator.clipboard.writeText(content)
      .then(() => showToast('Row copied!', 'success'))
      .catch(err => console.error('Copy failed:', err));
  }

  function updateCopyButtonIndices() {
    const table = document.querySelector('#output table');
    if (!table) return;

    const headers = table.querySelectorAll('th');
    headers.forEach((header, index) => {
      const copyBtn = header.querySelector('.copy-btn');
      if (copyBtn) {
        copyBtn.onclick = () => window.bankUtils.copyColumn(index);
      }
    });
  }

  // Dark mode toggle functionality
  const darkModeToggle = document.getElementById('darkModeToggle');
  const currentTheme = localStorage.getItem('theme') || 'light';

  if (currentTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  }

  // Undo/Redo button handlers
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Only process undo/redo when not in a text input
    if (!e.target.matches('input, textarea')) {
      if (e.ctrlKey && e.key === 'z') {
        undo();
        e.preventDefault();
      } else if (e.ctrlKey && e.key === 'y') {
        redo();
        e.preventDefault();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedCells.length > 0) { // Check if any cells are selected
          saveState(); // Save before clearing
          selectedCells.forEach(cell => {
            if (cell.tagName === 'TD') { // Only clear content of data cells
              cell.textContent = '';
            }
          });
          showToast('Selected cells cleared', 'success');
          e.preventDefault(); // Prevent default browser back/forward for backspace
        } else if (selectedCell && selectedCell.tagName === 'TD') { // Fallback for single selected cell
          saveState(); // Save before clearing
          selectedCell.textContent = '';
          showToast('Cell cleared', 'success');
          e.preventDefault();
        }
      } else if (e.ctrlKey && e.key === 'c') { // Handle Ctrl+C for copy
        if (selectedCells.length > 0) {
          copySelectedCells();
        } else if (selectedCell) {
          copyCellContent(selectedCell);
        }
        e.preventDefault();
      }
    }
  });

  darkModeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
      darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
      localStorage.setItem('theme', 'dark');
    }
  });

  // Return to top functionality
  const returnToTop = document.getElementById('returnToTop');

  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
      returnToTop.classList.add('show');
    } else {
      returnToTop.classList.remove('show');
    }
  });

  returnToTop.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  // Excel Export Function
  function exportToExcel() {
    const table = document.querySelector('#output table');
    if (!table) {
      showToast("No table to export!", "error");
      return;
    }

    try {
      const workbook = XLSX.utils.table_to_book(table);
      XLSX.writeFile(workbook, 'bank_statement.xlsx');
      showToast("Exported to Excel!", "success");
    } catch (e) {
      console.error("Excel export failed:", e);
      showToast("Excel export failed", "error");
    }
  }

  // PDF Export Function
  function exportToPDF() {
    const table = document.querySelector('#output table');
    if (!table) {
      showToast("No table to export!", "error");
      return;
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // Add title
      doc.text('Bank Statement', 14, 10);

      // Convert table to array
      const rows = [];
      const headers = [];

      // Get headers
      const headerRow = table.rows[0];
      for (let i = 0; i < headerRow.cells.length; i++) {
        headers.push(headerRow.cells[i].textContent.trim());
      }

      // Get data rows
      for (let i = 1; i < table.rows.length; i++) {
        const row = table.rows[i];
        const rowData = [];
        for (let j = 0; j < row.cells.length; j++) {
          rowData.push(row.cells[j].textContent.trim());
        }
        rows.push(rowData);
      }

      // Add table to PDF
      doc.autoTable({
        head: [headers],
        body: rows,
        startY: 20,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        }
      });

      doc.save('bank_statement.pdf');
      showToast("Exported to PDF!", "success");
    } catch (e) {
      console.error("PDF export failed:", e);
      showToast("PDF export failed", "error");
    }
  }

  // Add event listeners for export buttons
  document.getElementById('exportExcelBtn')?.addEventListener('click', exportToExcel);
  document.getElementById('exportPDFBtn')?.addEventListener('click', exportToPDF);

  // Function to update the table cursor based on the current mode
  function updateTableCursor() {
    const table = document.querySelector('#output table');
    if (table) {
      const cells = table.querySelectorAll('td'); // Get all data cells
      if (isMultiSelectMode) {
        table.style.cursor = 'crosshair'; // Plus sign for multi-select on the table itself
        cells.forEach(cell => {
          cell.style.cursor = 'crosshair'; // Apply to individual data cells
          cell.draggable = false; // Disable draggable in multi-select mode
        });
      } else {
        table.style.cursor = 'grab'; // Hand for drag/swap on the table itself
        cells.forEach(cell => {
          cell.style.cursor = 'grab'; // Apply to individual data cells
          // Only make draggable if it's a data cell and not the first column (#)
          if (cell.parentElement.rowIndex > 0 && cell.cellIndex !== 0) {
            cell.draggable = true; // Enable draggable in drag/swap mode
          } else {
            cell.draggable = false; // Ensure non-data cells or # column are not draggable
          }
        });
      }
    }
  }

  // Toggle button for select mode
  selectModeToggle.addEventListener('click', () => {
    isMultiSelectMode = !isMultiSelectMode;
    if (isMultiSelectMode) {
      selectModeToggle.innerHTML = '<i class="fas fa-plus"></i>';
      selectModeToggle.title = 'Toggle Swap Mode';
      showToast('Multi-select mode enabled', 'info');
    } else {
      selectModeToggle.innerHTML = '<i class="fa-regular fa-hand"></i>';
      selectModeToggle.title = 'Toggle Multi-select Mode';
      showToast('Swap mode enabled', 'info');
    }
    clearSelection(); // Clear any existing selection when mode changes
    updateTableCursor(); // Update cursor immediately after mode change
  });

  // Initial setup for the toggle button icon
  // The actual table cursor will be set when the table is created via updateTableCursor()
  if (isMultiSelectMode) {
    selectModeToggle.innerHTML = '<i class="fas fa-plus"></i>';
    selectModeToggle.title = 'Toggle Drag/Swap Mode';
  } else {
    selectModeToggle.innerHTML = '<i class="fa-regular fa-hand"></i>';
    selectModeToggle.title = 'Toggle Multi-select Mode';
  }


  // Add the new menu item for "Copy Selected Cells" to the context menu
  const contextMenu = document.getElementById('tableContextMenu');
  const copyCellMenuItem = document.querySelector('[data-action="copy-cell"]'); // Find existing copy-cell item
  if (copyCellMenuItem) {
    const newMenuItem = document.createElement('div');
    newMenuItem.className = 'menu-item';
    newMenuItem.dataset.action = 'copy-selected-cells';
    newMenuItem.innerHTML = '<i class="fas fa-copy"></i> Copy Selected Cells';
    copyCellMenuItem.parentNode.insertBefore(newMenuItem, copyCellMenuItem.nextSibling);

    const newDivider = document.createElement('div');
    newDivider.className = 'menu-divider';
    copyCellMenuItem.parentNode.insertBefore(newDivider, newMenuItem.nextSibling);
  }

 

});