document.addEventListener('DOMContentLoaded', async () => {
  
  let history = [];
  let historyIndex = -1;
  let isUndoing = false;
  let lastSelection = { row: 0, col: 0 }; // Track last selected cell position
  const bankSelector = document.getElementById('bankSelector');
  const typeSelector = document.getElementById('typeSelector');
  const convertBtn = document.getElementById('convertBtn');
  const copyTableBtn = document.getElementById('copyTableBtn');
  const outputDiv = document.getElementById('output');

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

  const inputText = document.getElementById('inputText');
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

    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
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
      bmo: ['account', 'card', 'loc']
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

    // Skip the header row by starting from index 1
    const rows = Array.from(table.querySelectorAll('tr')).slice(1);
    const content = rows.map(row => 
      Array.from(row.cells).map(cell => cell.textContent.trim()).join('\t')
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
        
        selectCell(cell);
    });

       // Double click to edit
    table.addEventListener('dblclick', (e) => {
        const cell = e.target.closest('td');
        if (!cell || cell.tagName === 'TH') return;
        
        // If already editing, don't do anything
        if (cell.querySelector('input')) return;
        
        makeCellEditable(cell);
        e.preventDefault();
    });

    // Keyboard navigation handler
    table.addEventListener('keydown', (e) => {
        if (!selectedCell) return;

        const row = selectedCell.parentElement;
        const cellIndex = Array.from(row.cells).indexOf(selectedCell);
        const rowIndex = row.rowIndex;
        const rows = Array.from(table.rows);

        // Handle arrow keys only when not editing
        if (!selectedCell.querySelector('input')) {
            switch(e.key) {
                case 'ArrowUp':
                    if (rowIndex > 1) { // Skip header row
                        selectCell(rows[rowIndex - 1].cells[cellIndex]);
                    }
                    e.preventDefault();
                    break;
                case 'ArrowDown':
                    if (rowIndex < rows.length - 1) {
                        selectCell(rows[rowIndex + 1].cells[cellIndex]);
                    }
                    e.preventDefault();
                    break;
                case 'ArrowLeft':
                    if (cellIndex > 0) {
                        selectCell(row.cells[cellIndex - 1]);
                    }
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                    if (cellIndex < row.cells.length - 1) {
                        selectCell(row.cells[cellIndex + 1]);
                    }
                    e.preventDefault();
                    break;
            }
        }

        // Handle special keys
        switch(e.key) {
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
        if (!e.target.closest('table')) {
            if (selectedCell) {
                selectedCell.classList.remove('selected-cell');
                selectedCell = null;
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

  // Set initial widths if they're not set, and add resize handles
  headers.forEach((header, index) => {
    if (!header.style.width) {
      header.style.width = '150px'; // Default width
    }

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
    
     // Fit to content on initial load and table update
    const fitContent = () => {
        let maxWidth = 'auto';
        const tableRows = table.querySelectorAll('tr');
        tableRows.forEach(row => {
            const cell = row.cells[index];
            if (cell) {
                cell.style.width = ''; // Reset width to auto
                const cellWidth = cell.offsetWidth;
                maxWidth = Math.max(maxWidth, cellWidth);
            }
        });
        header.style.width = `${maxWidth}px`;
        tableRows.forEach(row => {
            const cell = row.cells[index];
            if (cell) {
               cell.style.width = `${maxWidth}px`;
            }
        });
    };
      fitContent();

    //Mutation Observer to detect changes in table content
    const observer = new MutationObserver(fitContent);
    observer.observe(table, {
        childList: true,
        subtree: true,
        characterData: true,
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
    if (!cell || cell.tagName === 'TH') return;
    cell.draggable = false; 

    const originalContent = cell.textContent.trim();
    cell.innerHTML = `<input type="text" value="${originalContent}" data-original="${originalContent}">`;
    const input = cell.querySelector('input');
    input.focus();
    input.select();
    
    // Handle mouse down on the input to prevent blur
    input.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // Prevent this from triggering cell selection changes
    });
    
        // Handle Enter key to save
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            input.blur(); // This will trigger the blur handler to save
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cell.textContent = originalContent;
            selectCell(cell);
        }
    });
    
    // Handle blur (click outside) to save
    input.addEventListener('blur', () => {
        cell.textContent = input.value.trim();
        cell.draggable = true;
        selectCell(cell);
        saveState();
    });
}

function moveSelection(cell) {
  const table = cell.closest('table');
  table.querySelectorAll('.selected-cell').forEach(el => {
    el.classList.remove('selected-cell');
  });
  cell.classList.add('selected-cell');
  selectedCell = cell;
  cell.focus();
}



function copyCellContent(cell) {
  if (!cell) return;
  navigator.clipboard.writeText(cell.textContent.trim())
    .then(() => showToast('Cell copied!', 'success'))
    .catch(err => console.error('Copy failed:', err));
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
}

// New helper function to handle cell selection
function selectCell(cell) {
    if (!cell) return;
    
    // Clear previous selection and save edits
    if (selectedCell) {
        selectedCell.classList.remove('selected-cell');
        const input = selectedCell.querySelector('input');
        if (input) {
            selectedCell.textContent = input.value;
        }
    }
    
    // Set new selection
    cell.classList.add('selected-cell');
    selectedCell = cell;
    cell.focus(); // This is the crucial fix for keyboard events
    
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





function setupCellDragAndDrop(table) {
    let draggedCell = null;

    // Make only data cells (not headers) draggable
    const cells = table.querySelectorAll('td');
    cells.forEach(cell => {
        // Only make draggable if it's not in the first row
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
    table.querySelectorAll('td').forEach(cell => {
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
  lastSelection = {
    row: e.target.parentElement.rowIndex,
    col: e.target.cellIndex
  };

  selectCell(e.target); // update selection visually
  showToast('Cells swapped', 'success');
  saveState();
}

            });
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

     // In the contextMenu.addEventListener('click', (e) => { ... } section
// Add this case to the switch statement:
switch(action) {
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
  case 'copy-cell':  // Add this new case
    copyCellContent(targetCell);
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
      if (selectedCell && selectedCell.tagName === 'TD') {
        saveState(); // Save before clearing
        selectedCell.textContent = '';
        showToast('Cell cleared', 'success');
      }
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

});