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
  const transactionCountsDiv = document.getElementById('transactionCounts'); // New: Get the transaction counts div
  const totalCountSpan = document.getElementById('totalCount'); // New: Get the total count span
  const drCountSpan = document.getElementById('drCount'); // New: Get the debit count span
  const crCountSpan = document.getElementById('crCount'); // New: Get the credit count span
  const pdfUpload = document.getElementById('pdfUpload');
  const dropArea = document.getElementById('dropArea');
  const fileList = document.getElementById('fileList');
  const clearAllFiles = document.getElementById('clearAllFiles');
  const fileListContainer = document.getElementById('fileListContainer');
  const refreshFileListBtn = document.getElementById('refreshFileList');
  let uploadedFilesData = []; // Store file objects and their processed text
  
  const inputText = document.getElementById('inputText'); // Ensure inputText is declared here

  // New variables for multi-select mode
  let isMultiSelectMode = false; // True for multi-select (plus cursor), false for drag/swap (hand cursor)
  let startCell = null; // The cell where a multi-select drag started
  let selectedCells = []; // Array to store all currently selected data cells (TD elements) in the multi-selection range
  let isDraggingSelection = false; // Flag to indicate if a multi-cell selection drag is active
  let currentHoveredCell = null; // Track cell being hovered over during multi-select drag

  let selectionBorderDiv = null; // NEW: Global variable for the single selection border div

  // Get the select mode toggle button
  const selectModeToggle = document.getElementById('selectModeToggle');

  // Sample statement functionality
  const sampleBtn = document.getElementById('sampleBtn');
  const imageModal = document.getElementById('imageModal');
  const sampleImage = document.getElementById('sampleImage');
  const closeModal = document.querySelector('.close-modal');

// Custom select with search functionality

function setupCustomSelect() {
  const customSelect = document.querySelector('.custom-select');
  const selectSelected = document.querySelector('.select-selected');
  const selectItems = document.querySelector('.select-items');
  const bankSearch = document.getElementById('bankSearch');
  const originalSelect = document.getElementById('bankSelector');
  const bankSelectorDisplay = document.getElementById('bankSelectorDisplay');

  // Set initial display text based on current URL parameters or default
  const urlParams = new URLSearchParams(window.location.search);
  const currentBank = urlParams.get('bank') || originalSelect.value;
  
  // Find the option that matches the current bank and update display
  const currentOption = Array.from(originalSelect.options).find(opt => opt.value === currentBank);
  if (currentOption) {
    bankSelectorDisplay.textContent = currentOption.textContent;
    originalSelect.value = currentBank; // Ensure hidden select matches
  } else {
    // Fallback to first option if no match found
    const firstOption = originalSelect.options[0];
    bankSelectorDisplay.textContent = firstOption.textContent;
    originalSelect.value = firstOption.value;
  }

  // Toggle dropdown visibility
  selectSelected.addEventListener('click', function(e) {
    e.stopPropagation();
    
    // Check if the dropdown is currently open
    const isCurrentlyOpen = !selectItems.classList.contains('select-hide');

    // Close all other dropdowns
    closeAllSelect(this);

    // If the dropdown was not open, open it. If it was, close it.
    if (!isCurrentlyOpen) {
      this.classList.add('select-arrow-active');
      selectItems.classList.remove('select-hide');
      
      // Focus on search input when dropdown opens
      setTimeout(() => {
        bankSearch.focus();
      }, 10);
    } else {
      this.classList.remove('select-arrow-active');
      selectItems.classList.add('select-hide');
    }
  });

  // Filter options when typing in search
  bankSearch.addEventListener('input', function() {
    const filter = this.value.toLowerCase();
    const options = selectItems.querySelectorAll('option');
    const optgroups = selectItems.querySelectorAll('optgroup');

    let hasVisibleOptions = false;

    // Filter options
    options.forEach(option => {
      const text = option.textContent.toLowerCase();
      if (text.includes(filter)) {
        option.style.display = 'block';
        hasVisibleOptions = true;
      } else {
        option.style.display = 'none';
      }
    });

    // Show/hide optgroups based on visible options
    optgroups.forEach(optgroup => {
      const visibleOptions = Array.from(optgroup.querySelectorAll('option'))
        .some(option => option.style.display !== 'none');

      if (visibleOptions) {
        optgroup.style.display = 'block';
      } else {
        optgroup.style.display = 'none';
      }
    });
  });

  // Handle option selection - FIXED VERSION
  selectItems.addEventListener('click', function(e) {
    if (e.target.tagName === 'OPTION') {
      const value = e.target.value;
      const text = e.target.textContent;

      // Update display IMMEDIATELY
      selectSelected.textContent = text;
      bankSelectorDisplay.textContent = text;
      selectSelected.classList.remove('select-arrow-active');
      selectItems.classList.add('select-hide');

      // Update original select
      originalSelect.value = value;

      // Clear search
      bankSearch.value = '';

      // Reset all options to visible
      const options = selectItems.querySelectorAll('option');
      const optgroups = selectItems.querySelectorAll('optgroup');

      options.forEach(option => {
        option.style.display = 'block';
      });

      optgroups.forEach(optgroup => {
        optgroup.style.display = 'block';
      });

      // Add a small delay before triggering the change event and reload
      // This ensures the visual update is rendered first
      setTimeout(() => {
        // Trigger change event on original select
        const event = new Event('change');
        originalSelect.dispatchEvent(event);
      }, 50); // 50ms delay allows the visual update to render
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!customSelect.contains(e.target)) {
      selectSelected.classList.remove('select-arrow-active');
      selectItems.classList.add('select-hide');
    }
  });

  // Close dropdown on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !selectItems.classList.contains('select-hide')) {
      selectSelected.classList.remove('select-arrow-active');
      selectItems.classList.add('select-hide');
    }
  });

  // Helper function to close all select dropdowns
  function closeAllSelect(elmnt) {
    const selectItems = document.getElementsByClassName('select-items');
    const selectSelected = document.getElementsByClassName('select-selected');

    for (let i = 0; i < selectSelected.length; i++) {
      if (elmnt !== selectSelected[i]) {
        selectSelected[i].classList.remove('select-arrow-active');
      }
    }

    for (let i = 0; i < selectItems.length; i++) {
      if (elmnt !== selectItems[i]) {
        selectItems[i].classList.add('select-hide');
      }
    }
  }

  // Sync with original select changes - UPDATED VERSION
  originalSelect.addEventListener('change', function() {
    const selectedOption = this.options[this.selectedIndex];
    const newText = selectedOption.textContent;
    
    // Update both display elements
    selectSelected.textContent = newText;
    bankSelectorDisplay.textContent = newText;
  });
}



// Call this function in your DOMContentLoaded event listener
// Add this line where you initialize other components:
setupCustomSelect();

function shouldShowPDFUpload(bankKey) {
  // List of bank combinations where PDF upload should be hidden
  const restrictedBanks = [
    'rbcAccount', 'tdCard' // Add more bank keys here as needed
  ];
  return !restrictedBanks.includes(bankKey);
}

  
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
      boa: ['card'],
      cdt: ['card'],
      cra: ['history', 'payroll'],
      tangerine: ['account'],
      td: ['account', 'card', 'inPerson', 'history'],
      firstontario: ['account'],
      meridian: ['account'],
      simplii: ['account'],
      wellsfargo: ['account'],
      amex: ['card'],
      eq: ['card'],
      triangle: ['card'],
      wallmart: ['card'],
      nbc: ['account', 'card'],
      bmo: ['account', 'card', 'loc'],
      rbc: ['account', 'card', 'loc']
    };

    const allTypes = {
      account: 'Account',
      card: 'Card',
      inPerson: 'In-Person',
      loc: 'LOC',
      history: 'History',
      payroll: 'Payroll'
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
  const bankKey = newBank + capitalizeFirstLetter(newType);
  
  // Show/hide entire PDF upload section
  const pdfUploadSection = document.getElementById('pdfUploadSection');
  if (pdfUploadSection) {
    pdfUploadSection.style.display = shouldShowPDFUpload(bankKey) ? 'block' : 'none';
  }
  
  window.location.href = `${window.location.pathname}?bank=${newBank}&type=${newType}`;
}

// This will now work with the hidden select element
document.getElementById('bankSelector').addEventListener('change', () => {
  const newBank = document.getElementById('bankSelector').value;
  enforceTypeRestrictions(newBank);
  typeSelector.value = typeSelector.options[0]?.value || '';
  updateURLAndReload();
});
  typeSelector.addEventListener('change', updateURLAndReload);

 convertBtn.addEventListener('click', async () => {
  const input = inputText.value.trim();
  if (!input && uploadedFilesData.length === 0) {  // Changed from fileList.children.length to uploadedFilesData.length
    showToast("Please insert bank statement data or upload PDF files!", "error");
    return;
  }

  if (typeof processData === 'function') {
    try {
      // Show loading state
      convertBtn.disabled = true;
      convertBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
      
      await processData();
      
      document.getElementById('toolbar').classList.add('show');
      createCopyColumnButtons();
      checkAndRemoveEmptyBalanceColumn();
      saveState();
      updateTableCursor();
      updateTransactionCounts(); // New: Call the function to update transaction counts
      
      // Hide file list container if no files are uploaded
      if (uploadedFilesData.length === 0) {
        fileListContainer.style.display = 'none';
      }
    } catch (error) {
      console.error('Error during processing:', error);
      showToast("Error processing data", "error");
    } finally {
      convertBtn.disabled = false;
      convertBtn.textContent = 'Convert';
    }
  } else {
    console.warn('Parsing script not yet loaded.');
  }
});
// Handle initial PDF upload visibility
const initialBankKey = getCombinedKey();
const pdfUploadSection = document.getElementById('pdfUploadSection');
if (pdfUploadSection) {
  pdfUploadSection.style.display = shouldShowPDFUpload(initialBankKey) ? 'block' : 'none';
}



function setupFileUpload() {
    const bankKey = getCombinedKey();
  if (!shouldShowPDFUpload(bankKey)) return;
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    if (dropArea) dropArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop area when item is dragged over it
  ['dragenter', 'dragover'].forEach(eventName => {
    if (dropArea) dropArea.addEventListener(eventName, highlight, false);
    if (inputText) inputText.addEventListener(eventName, highlightInput, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    if (dropArea) dropArea.addEventListener(eventName, unhighlight, false);
    if (inputText) inputText.addEventListener(eventName, unhighlightInput, false);
  });

  // Handle dropped files
  if (dropArea) dropArea.addEventListener('drop', handleDrop, false);
  if (inputText) inputText.addEventListener('drop', handleDrop, false);
  if (pdfUpload) pdfUpload.addEventListener('change', handleFiles);
  if (clearAllFiles) clearAllFiles.addEventListener('click', clearAllUploadedFiles);
  if (refreshFileListBtn) refreshFileListBtn.addEventListener('click', refreshInputTextFromFiles);

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

  function highlightInput() {
    inputText.classList.add('drag-over');
  }

  function unhighlightInput() {
    inputText.classList.remove('drag-over');
  }

  async function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles({ target: { files } });
  }

  async function handleFiles(e) {
  const files = e.target.files;
  if (!files.length) return;

  fileListContainer.style.display = 'block'; // Remove the !important override
  let pdfFilesProcessed = false; // Flag to track if any PDF files were successfully processed

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.type !== 'application/pdf') {
      showToast("Please upload a PDF file!", "error");
      fileListContainer.style.display = 'none'; // Hide the file list container
      continue; // Skip this file
    }

    // Check if file already exists in uploadedFilesData
    const existingFile = uploadedFilesData.find(f => f.file.name === file.name && f.file.size === file.size);
    if (existingFile) {
      showToast(`File "${file.name}" is already uploaded.`, "info");
      continue; // Skip this file
    }

    const fileItem = createFileItem(file);
    fileList.appendChild(fileItem);

    try {
      const processedText = await window.bankUtils.processPDFFile(file);
      uploadedFilesData.push({ file: file, text: processedText, element: fileItem });
      pdfFilesProcessed = true; // Set flag to true as a PDF was successfully processed
    } catch (error) {
      console.error('Error processing PDF:', error);
      showToast(`Error processing ${file.name}`, "error");
      fileItem.remove(); // Remove item if processing fails
    }
  }

  // Only refresh inputText and show toast if at least one PDF was processed
  if (pdfFilesProcessed) {
    refreshInputTextFromFiles();
  }
}

  function createFileItem(file) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.draggable = true;
    fileItem.dataset.fileName = file.name;

    const fileNameSpan = document.createElement('span');
    fileNameSpan.className = 'file-item-name';
    fileNameSpan.textContent = file.name;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'file-item-actions';

    const moveUpBtn = document.createElement('button');
    moveUpBtn.className = 'file-item-btn move-up';
    moveUpBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    moveUpBtn.title = 'Move Up';
    moveUpBtn.onclick = (e) => {
      e.stopPropagation();
      moveFileItem(fileItem, -1);
    };

    const moveDownBtn = document.createElement('button');
    moveDownBtn.className = 'file-item-btn move-down';
    moveDownBtn.innerHTML = '<i class="fas fa-arrow-down"></i>';
    moveDownBtn.title = 'Move Down';
    moveDownBtn.onclick = (e) => {
      e.stopPropagation();
      moveFileItem(fileItem, 1);
    };

    const removeBtn = document.createElement('button');
    removeBtn.className = 'file-item-btn';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.title = 'Remove File';
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      removeFileItem(fileItem);
    };

    actionsDiv.appendChild(moveUpBtn);
    actionsDiv.appendChild(moveDownBtn);
    actionsDiv.appendChild(removeBtn);
    fileItem.appendChild(fileNameSpan);
    fileItem.appendChild(actionsDiv);

    return fileItem;
  }

  // In the removeFileItem function
function removeFileItem(fileItemToRemove) {
  uploadedFilesData = uploadedFilesData.filter(item => item.element !== fileItemToRemove);
  fileItemToRemove.remove();
  if (uploadedFilesData.length === 0) {  // Changed from fileList.children.length to uploadedFilesData.length
    fileListContainer.style.display = 'none';
  }
  refreshInputTextFromFiles();
}
  function moveFileItem(fileItem, direction) {
    const currentIndex = Array.from(fileList.children).indexOf(fileItem);
    const newIndex = currentIndex + direction;

    if (newIndex >= 0 && newIndex < fileList.children.length) {
      const items = Array.from(fileList.children);
      const currentItem = items[currentIndex];
      const targetItem = items[newIndex];

      // Swap elements in the DOM
      fileList.insertBefore(currentItem, direction === -1 ? targetItem : targetItem.nextSibling);

      // Update uploadedFilesData array to reflect new order
      const [removed] = uploadedFilesData.splice(currentIndex, 1);
      uploadedFilesData.splice(newIndex, 0, removed);

      refreshInputTextFromFiles();
    }
  }

// In the clearAllUploadedFiles function
function clearAllUploadedFiles() {
  fileList.innerHTML = '';
  inputText.value = '';
  uploadedFilesData = [];
  fileListContainer.style.display = 'none';  // This will hide the container
  showToast('All uploaded files cleared!', 'success');
}

  // New function to refresh inputText based on the current order of uploadedFilesData
  function refreshInputTextFromFiles() {
    let combinedText = '';
    uploadedFilesData.forEach((item, index) => {
      if (item.text) {
        combinedText += item.text;
        if (index < uploadedFilesData.length - 1) {
          combinedText += '\n\n'; // Add two newlines between file contents
        }
      }
    });
    inputText.value = combinedText;
    showToast('Input text refreshed!', 'info');
  }

  // Initialize Sortable for file list reordering
  new Sortable(fileList, {
    animation: 150,
    handle: '.file-item-name', // Only allow dragging from the file name area
    ghostClass: 'dragging',
    onEnd: (evt) => {
      // Update uploadedFilesData array to reflect the new order after drag-and-drop
      const oldIndex = evt.oldIndex;
      const newIndex = evt.newIndex;

      const [removed] = uploadedFilesData.splice(oldIndex, 1);
      uploadedFilesData.splice(newIndex, 0, removed);

      refreshInputTextFromFiles();
    }
  });
}

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

window.bankUtils = window.bankUtils || {};
window.bankUtils.processPDFFile = async function(file) {
  // This will be overridden by the bank-specific parsers
  throw new Error('PDF processing not implemented for this bank');
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
    updateTransactionCounts(); // New: Update counts after restoring state

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

  // NEW: Function to update the single selection border div
  function updateSelectionBorder() {
    const table = document.querySelector('#output table');
    // If no table or no data cells are selected, remove the border
    if (!table || selectedCells.length === 0) {
        if (selectionBorderDiv) {
            selectionBorderDiv.remove();
            selectionBorderDiv = null;
        }
        return;
    }

    // Determine min/max row and column indices from the selected data cells
    let minRow = Infinity, maxRow = -Infinity;
    let minCol = Infinity, maxCol = -Infinity;

    selectedCells.forEach(cell => {
        const row = cell.parentElement.rowIndex;
        const col = cell.cellIndex;
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
    });

    // Get the top-left cell and bottom-right cell of the selection rectangle
    const topLeftCell = table.rows[minRow]?.cells[minCol];
    const bottomRightCell = table.rows[maxRow]?.cells[maxCol];

    if (!topLeftCell || !bottomRightCell) {
        if (selectionBorderDiv) {
            selectionBorderDiv.remove();
            selectionBorderDiv = null;
        }
        return;
    }

    // Calculate positions and dimensions relative to the viewport
    const topLeftRect = topLeftCell.getBoundingClientRect();
    const bottomRightRect = bottomRightCell.getBoundingClientRect();

    // Calculate the overall bounding box
    const borderTop = topLeftRect.top;
    const borderLeft = topLeftRect.left;
    const borderRight = bottomRightRect.right;
    const borderBottom = bottomRightRect.bottom;

    const width = borderRight - borderLeft;
    const height = borderBottom - borderTop;

    if (!selectionBorderDiv) {
        selectionBorderDiv = document.createElement('div');
        selectionBorderDiv.classList.add('selection-border');
        document.body.appendChild(selectionBorderDiv); // Append to body for fixed positioning
    }

    selectionBorderDiv.style.display = 'block';
    selectionBorderDiv.style.top = `${borderTop + window.scrollY}px`;
    selectionBorderDiv.style.left = `${borderLeft + window.scrollX}px`;
    selectionBorderDiv.style.width = `${width}px`;
    selectionBorderDiv.style.height = `${height}px`;
  }


  // Function to clear all current selections
  // Replace the clearSelection function with this:
function clearSelection() {
  // Clear visual selection from the active cell
  if (selectedCell) {
    selectedCell.classList.remove('selected-cell', 'active-multi-select', 'editing');
    selectedCell = null;
  }
  
  // Remove the multi-selection border
  if (selectionBorderDiv) {
    selectionBorderDiv.remove();
    selectionBorderDiv = null;
  }
  
  selectedCells = []; // Clear the array of selected cells
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
          
          // Add all data cells (TD elements) in the range to selectedCells
          for (let r = minRow; r <= maxRow; r++) {
            const row = tableRows[r];
            if (row) {
              for (let c = minCol; c <= maxCol; c++) {
                const currentCell = row.cells[c];
                if (currentCell && currentCell.tagName === 'TD') { // ONLY add TD cells
                    selectedCells.push(currentCell);
                }
              }
            }
          }
          selectedCell = cell; // The last clicked cell becomes the active one
          selectedCell.classList.add('selected-cell'); // Apply active cell highlight
          selectedCell.classList.add('active-multi-select'); // Apply specific active multi-select highlight
          selectedCell.focus();
          updateSelectionBorder(); // Update the overall border
        } else { // Single click in multi-select mode starts a new selection
          clearSelection();
          if (cell.tagName === 'TD') { // Only add TD cells to the multi-selection range
            selectedCells.push(cell);
          }
          selectedCell = cell;
          selectedCell.classList.add('selected-cell'); // Apply active cell highlight
          selectedCell.classList.add('active-multi-select'); // Apply specific active multi-select highlight
          selectedCell.focus();
          updateSelectionBorder(); // Update the overall border
        }
      } else { // Original single-select mode
        clearSelection(); // Always clear all selections in single mode
        selectCell(cell); // This function will handle adding 'selected-cell' and clearing selectedCells array
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
            if (rowIndex > 0) { // Allow navigation to header row
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
          if (e.shiftKey && isMultiSelectMode) { // Shift + Arrow key to extend selection in multi-select mode
            if (nextCell.tagName === 'TD' && !selectedCells.includes(nextCell)) { // Only add data cells to range
              selectedCells.push(nextCell);
            }
            selectedCell.classList.remove('active-multi-select'); // Remove active class from old cell
            selectedCell = nextCell; // Update the active selected cell
            selectedCell.classList.add('selected-cell'); // Apply base selected-cell
            selectedCell.classList.add('active-multi-select'); // Apply specific active multi-select highlight
            selectedCell.focus();
            updateSelectionBorder(); // Update the overall border
          } else { // Just Arrow key to move selection or Shift+Arrow in non-multi-select mode
            clearSelection(); // Clear all previous selections and the border
            selectCell(nextCell); // This will re-apply selected-cell and update selectedCells/border
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
      if (!e.target.closest('table') && !e.target.closest('.context-menu') && !e.target.closest('.selection-border')) {
        clearSelection();
      }
    });

    // Multi-select drag functionality
    table.addEventListener('mousedown', (e) => {
      if (!isMultiSelectMode || e.button !== 0) return; // Only left click in multi-select mode

      const cell = e.target.closest('td, th');
      if (!cell || cell.tagName === 'TH') return; // Don't start drag selection on header cells

      isDraggingSelection = true;
      startCell = cell;

      if (!e.shiftKey) {
        clearSelection();
      }
      if (cell.tagName === 'TD') { // Only add TD cells to the multi-selection range
        selectedCells.push(cell);
      }
      selectedCell = cell; // Set the active selected cell
      selectedCell.classList.add('selected-cell'); // Apply active cell highlight
      selectedCell.classList.add('active-multi-select'); // Apply specific active multi-select highlight
      selectedCell.focus();
      updateSelectionBorder(); // Update the overall border
    });

    table.addEventListener('mousemove', (e) => {
      if (!isDraggingSelection || !startCell) return;

      const table = startCell.closest('table');
      const currentCell = e.target.closest('td, th');

      if (!currentCell || currentCell === currentHoveredCell) return; // Optimization
      currentHoveredCell = currentCell;

      selectedCells = []; // Clear the array first (no individual cell classes)

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
            if (cell && cell.tagName === 'TD') { // ONLY add TD cells
              selectedCells.push(cell);
            }
          }
        }
      }
      updateSelectionBorder(); // Update the overall border
    });

    document.addEventListener('mouseup', () => {
      if (isDraggingSelection) {
        isDraggingSelection = false;
        startCell = null;
        currentHoveredCell = null;
        if (selectedCells.length > 0) {
          saveState(); // Save state after a multi-selection drag
        }
        updateSelectionBorder(); // Ensure border is finalized
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
      3: '50px',    // ACC (NEWLY ADDED)
      4: '80px',    // DR
      5: '80px',    // CR
      6: '80px'     // Balance
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
      selectedCell.classList.remove('active-multi-select'); // Ensure this is removed
    }

    cell.classList.add('selected-cell');
    selectedCell = cell;
    cell.focus();
  }

 // Replace the makeCellEditable function with this:
function makeCellEditable(cell) {
  if (!cell) return;
  cell.draggable = false;

  // Add editing class and remove multi-select classes
  cell.classList.add('editing');
  cell.classList.remove('active-multi-select');
  
  // Hide selection border during editing
  if (selectionBorderDiv) {
    selectionBorderDiv.style.display = 'none';
  }

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
    cell.classList.remove('editing');
    selectCell(cell);
    saveState();
    
    // Restore selection border if needed
    if (selectedCells.length > 0) {
      updateSelectionBorder();
    }
  });
}

  // This function is now primarily for setting the *active* selected cell
 // Replace the existing selectCell function with this:
function selectCell(cell) {
  if (!cell) return;

  // Clear previous active selection
  if (selectedCell) {
    const input = selectedCell.querySelector('input');
    if (input) {
      selectedCell.textContent = input.value;
    }
    selectedCell.classList.remove('selected-cell', 'active-multi-select', 'editing');
  }

  // Set new active selection and apply class
  selectedCell = cell;
  selectedCell.classList.add('selected-cell');
  
  if (isMultiSelectMode) {
    if (selectedCells.length > 1) {
      // For multi-selection, only add active class to the last selected cell
      selectedCell.classList.add('active-multi-select');
    } else {
      // For single cell in multi-select mode, just use regular selection style
      selectedCell.classList.remove('active-multi-select');
    }
  }
  
  selectedCell.focus();

  // Update selectedCells array based on mode
  if (isMultiSelectMode) {
    if (cell.tagName === 'TD' && !selectedCells.includes(cell)) {
      selectedCells.push(cell);
    }
  } else {
    selectedCells = (cell.tagName === 'TD') ? [cell] : [];
  }
  
  updateSelectionBorder();
  
  // Handle table scrolling if needed
  const table = cell.closest('table');
  if (table) {
    if (!table.hasAttribute('tabindex')) {
      table.tabIndex = -1;
    }

    const cellRect = cell.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();

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

    // --- Start of New Column Insertion ---
    const headerRow = table.rows[0];
    // Find the index of the "Description" column
    const descriptionIndex = Array.from(headerRow.cells).findIndex(cell => cell.textContent.trim().toLowerCase() === 'description');

    // If "Description" is found, insert "ACC" after it. Otherwise, insert after # (index 1).
    const insertAtIndex = descriptionIndex !== -1 ? descriptionIndex + 1 : 2; // After # (index 1) if description not found, otherwise after description

    // Check if 'ACC' column already exists to prevent duplicates on refresh
    const accColumnExists = Array.from(headerRow.cells).some(cell => cell.textContent.trim() === 'ACC');

    if (!accColumnExists) {
        // Insert "ACC" header
        const accTh = document.createElement('th');
        accTh.textContent = 'ACC';
        headerRow.insertBefore(accTh, headerRow.cells[insertAtIndex]);

        // Insert empty "ACC" cells in all data rows
        for (let i = 1; i < table.rows.length; i++) {
            const row = table.rows[i];
            const accTd = document.createElement('td');
            accTd.textContent = ''; // Always empty
            row.insertBefore(accTd, row.cells[insertAtIndex]);
        }
    }
    // --- End of New Column Insertion ---

    // Update 'Debit' to 'DR' and 'Credit' to 'CR' in headers
    Array.from(headerRow.cells).forEach(cell => {
        if (cell.textContent.trim().toLowerCase() === 'debit') {
            cell.textContent = 'DR';
        } else if (cell.textContent.trim().toLowerCase() === 'credit') {
            cell.textContent = 'CR';
        }
    });

    // --- NEW: Process date column to keep only the first date ---
    // Find the Date column index
    const dateColIndex = Array.from(headerRow.cells).findIndex(cell => 
        cell.textContent.trim().toLowerCase() === 'date'
    );
    
    if (dateColIndex !== -1) {
        // Process all data rows
        for (let i = 1; i < table.rows.length; i++) {
            const dateCell = table.rows[i].cells[dateColIndex];
            if (dateCell) {
                const dateText = dateCell.textContent.trim();
                const dateParts = dateText.split(/\s+/);
                
                // Heuristic to check if a year exists. A year is typically a 4-digit number.
                const hasYear = dateParts.length >= 3 && /^\d{4}$/.test(dateParts[2]);

                let newDate = '';
                if (hasYear) {
                    // Keep Month Day Year
                    newDate = `${dateParts[0]} ${dateParts[1]} ${dateParts[2]}`;
                } else if (dateParts.length >= 2) {
                    // Keep only Month Day
                    newDate = `${dateParts[0]} ${dateParts[1]}`;
                }

                dateCell.textContent = newDate;
            }
        }
    }
    // --- END NEW DATE PROCESSING ---

    // Apply word wrapping to description column to prevent horizontal scrolling
    const headers = Array.from(headerRow.cells);
    const descriptionColIndex = headers.findIndex(cell => 
        cell.textContent.trim().toLowerCase() === 'description'
    );
    
    if (descriptionColIndex !== -1) {
        for (let i = 1; i < table.rows.length; i++) {
            const descriptionCell = table.rows[i].cells[descriptionColIndex];
            if (descriptionCell) {
                descriptionCell.style.wordWrap = 'break-word';
                descriptionCell.style.whiteSpace = 'normal';
                descriptionCell.style.maxWidth = '300px';
            }
        }
    }

    // Add copy buttons to each header
    const headersAll = table.querySelectorAll('th');
    headersAll.forEach((header, index) => {
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

  // Get column header text for title
  const columnHeader = table.rows[0].cells[columnIndex]?.textContent.trim() || 'Column';

  // Check if this is a numeric column
  const headerText = columnHeader.toLowerCase();
  const isNumericColumn = ['dr', 'cr', 'balance'].includes(headerText); // Changed 'debit', 'credit' to 'dr', 'cr'

  // Create the menu
  const menu = document.createElement('div');
  menu.className = 'column-menu';

  // Add title to menu
  const menuTitle = document.createElement('div');
  menuTitle.className = 'menu-title';
  menuTitle.textContent = columnHeader;
  menu.appendChild(menuTitle);

  // Add sorting options with appropriate icons
  const sortAsc = document.createElement('div');
  sortAsc.className = 'menu-item';
  sortAsc.innerHTML = isNumericColumn 
    ? '<i class="fa-solid fa-arrow-down-1-9"></i> Sort 1→9 (ascending)' 
    : '<i class="fas fa-sort-alpha-down"></i> Sort A→Z (ascending)';
  sortAsc.onclick = () => sortColumn(columnIndex, 'asc');
  menu.appendChild(sortAsc);

  const sortDesc = document.createElement('div');
  sortDesc.className = 'menu-item';
  sortDesc.innerHTML = isNumericColumn 
    ? '<i class="fa-solid fa-arrow-up-9-1"></i> Sort 9→1 (descending)' 
    : '<i class="fas fa-sort-alpha-down-alt"></i> Sort Z→A (descending)';
  sortDesc.onclick = () => sortColumn(columnIndex, 'desc');
  menu.appendChild(sortDesc);

  // Rest of your existing menu code (replace, delete sections)...
  // Add replace option
  const replaceOption = document.createElement('div');
  replaceOption.className = 'menu-item replace-section';
  replaceOption.innerHTML = `
    <div style="padding: 5px;">
      <div><i class="fas fa-exchange-alt"></i> Replace:</div>
      <input type="text" class="replace-from" placeholder="Find..." style="width: 100%; margin: 3px 0;">
      <input type="text" class="replace-to" placeholder="Replace with..." style="width: 100%; margin: 3px 0;">
      <button class="replace-confirm" style="width: 100%; margin: 3px 0;">Replace All</button>
    </div>
  `;
  menu.appendChild(replaceOption);

  // Add delete all instances option
  const deleteOption = document.createElement('div');
  deleteOption.className = 'menu-item delete-section';
  deleteOption.innerHTML = `
    <div style="padding: 5px;">
      <div><i class="fas fa-eraser"></i> Delete all:</div>
      <input type="text" class="delete-text" placeholder="Text to delete..." style="width: 100%; margin: 3px 0;">
      <button class="delete-confirm" style="width: 100%; margin: 3px 0;">Delete All</button>
    </div>
  `;
  menu.appendChild(deleteOption);

  // Append the menu to the body temporarily to measure its height
  document.body.appendChild(menu);

  // Calculate position - ensure it stays visible
  const viewportHeight = window.innerHeight;
  const menuRect = menu.getBoundingClientRect();
  const menuHeight = menuRect.height;
  const menuWidth = menuRect.width;

  let topPosition = e.clientY;
  let leftPosition = e.clientX;

  // Adjust if menu would go below viewport
  if (topPosition + menuHeight > viewportHeight - 10) {
    topPosition = viewportHeight - menuHeight - 10;
  }
  // Ensure it doesn't go above viewport
  topPosition = Math.max(10, topPosition);

  // Adjust if menu would go off the right edge of the viewport
  if (leftPosition + menuWidth > window.innerWidth - 10) {
    leftPosition = window.innerWidth - menuWidth - 10;
  }
  // Ensure it doesn't go off the left edge of the viewport
  leftPosition = Math.max(10, leftPosition);

  menu.style.position = 'fixed';
  menu.style.left = `${leftPosition}px`;
  menu.style.top = `${topPosition}px`;
  menu.style.zIndex = '1000';

  // Set up event listeners for the replace/delete inputs
  const replaceConfirm = menu.querySelector('.replace-confirm');
  const deleteConfirm = menu.querySelector('.delete-confirm');
  const replaceFrom = menu.querySelector('.replace-from');
  const replaceTo = menu.querySelector('.replace-to');
  const deleteText = menu.querySelector('.delete-text');

  function showInputError(input) {
    input.style.border = '2px solid #ef4444';
    input.style.animation = 'shake 0.5s';
    setTimeout(() => {
      input.style.border = '';
      input.style.animation = '';
    }, 500);
  }

  replaceConfirm.onclick = () => {
    if (!replaceFrom.value) {
      showInputError(replaceFrom);
      return;
    }
    replaceInColumn(columnIndex, replaceFrom.value, replaceTo.value);
    menu.remove();
  };

  deleteConfirm.onclick = () => {
    if (!deleteText.value) {
      showInputError(deleteText);
      return;
    }
    replaceInColumn(columnIndex, deleteText.value, '');
    menu.remove();
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
  
  // Check if this is a numeric column (DR, CR, or balance)
  const headerText = headerRow.cells[columnIndex]?.textContent.trim().toLowerCase();
  const isNumericColumn = ['dr', 'cr', 'balance'].includes(headerText); // Changed 'debit', 'credit' to 'dr', 'cr'

  // Extract the column data with row references
  const columnData = rows.map(row => ({
    value: row.cells[columnIndex].textContent.trim(),
    isNumeric: isNumericColumn && !isNaN(parseFloat(row.cells[columnIndex].textContent.replace(/[^0-9.-]/g, ''))),
    isEmpty: row.cells[columnIndex].textContent.trim() === '',
    row: row
  }));

  // Separate empty cells and non-empty cells
  const emptyCells = columnData.filter(item => item.isEmpty);
  const nonEmptyCells = columnData.filter(item => !item.isEmpty);

  // Sort the non-empty data
  nonEmptyCells.sort((a, b) => {
    if (isNumericColumn) {
      // For numeric columns, parse as numbers
      const numA = parseFloat(a.value.replace(/[^0-9.-]/g, '')) || 0;
      const numB = parseFloat(b.value.replace(/[^0-9.-]/g, '')) || 0;
      
      return direction === 'asc' ? numA - numB : numB - numA;
    } else {
      // For other columns, try date first, then string
      const dateA = parseDate(a.value);
      const dateB = parseDate(b.value);
      
      if (dateA && dateB) {
        return direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      // Fall back to string comparison
      return direction === 'asc' 
        ? a.value.localeCompare(b.value) 
        : b.value.localeCompare(a.value);
    }
  });

  // Recombine the sorted non-empty cells with empty cells in their original positions
  const sortedData = [];
  let emptyIndex = 0;
  let nonEmptyIndex = 0;
  
  for (let i = 0; i < columnData.length; i++) {
    if (columnData[i].isEmpty) {
      sortedData.push(emptyCells[emptyIndex++]);
    } else {
      sortedData.push(nonEmptyCells[nonEmptyIndex++]);
    }
  }

  // Rebuild the table with sorted rows
  const tbody = table.querySelector('tbody') || table;
  while (tbody.rows.length > 1) {
    tbody.deleteRow(1);
  }

  sortedData.forEach(item => {
    tbody.appendChild(item.row);
  });

  // Update the numbered column if it exists
  if (table.rows[0].cells[0].textContent === '#') {
    for (let i = 1; i < table.rows.length; i++) {
      table.rows[i].cells[0].textContent = i;
    }
  }

  // Show appropriate message based on column type
  if (isNumericColumn) {
    showToast(`Column sorted ${direction === 'asc' ? '1→9' : '9→1'}`, 'success');
  } else {
    showToast(`Column sorted ${direction === 'asc' ? 'A→Z' : 'Z→A'}`, 'success');
  }
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
    updateTransactionCounts(); // New: Update counts after replacing
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  }


function addColumnBeforeACC() {
  const table = document.querySelector('#output table');
  if (!table) return;
  
  saveState(); // Save before adding column
  
  // Find the ACC column index
  const headers = Array.from(table.rows[0].cells);
  const accIndex = headers.findIndex(cell => cell.textContent.trim() === 'ACC');
  
  if (accIndex === -1) {
    showToast("ACC column not found!", "error");
    return;
  }
  
  // Add header
  const headerRow = table.rows[0];
  const newHeader = document.createElement('th');
  newHeader.textContent = 'New';
  headerRow.insertBefore(newHeader, headerRow.cells[accIndex]);
  
  // Add empty cells in all data rows
  for (let i = 1; i < table.rows.length; i++) {
    const row = table.rows[i];
    const newCell = document.createElement('td');
    newCell.textContent = '';
    row.insertBefore(newCell, row.cells[accIndex]);
  }
  
  // Update the numbered column if it exists
  if (table.rows[0].cells[0].textContent === '#') {
    for (let i = 1; i < table.rows.length; i++) {
      table.rows[i].cells[0].textContent = i;
    }
  }
  
  createCopyColumnButtons();
  showToast("Column added before ACC", "success");
  updateTransactionCounts();
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
        updateTransactionCounts(); // New: Update counts after swap
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
        updateTransactionCounts(); // New: Update counts after insertion
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
        updateTransactionCounts(); // New: Update counts after insertion
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
      updateTransactionCounts(); // New: Update counts after deletion
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
    updateTransactionCounts(); // New: Update counts after deletion
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
// Add event listener for the add column button
document.getElementById('addColumnBtn').addEventListener('click', addColumnBeforeACC);
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
        if (selectedCells.length > 0) { // Check if any data cells are selected in the range
          saveState(); // Save before clearing
          selectedCells.forEach(cell => {
            if (cell.tagName === 'TD') { // Only clear content of data cells
              cell.textContent = '';
            }
          });
          showToast('Selected cells cleared', 'success');
          updateTransactionCounts(); // New: Update counts after clearing selected cells
          e.preventDefault(); // Prevent default browser back/forward for backspace
        } else if (selectedCell && selectedCell.tagName === 'TD') { // Fallback for single selected data cell
          saveState(); // Save before clearing
          selectedCell.textContent = '';
          showToast('Cell cleared', 'success');
          updateTransactionCounts(); // New: Update counts after clearing single cell
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

 // Initialize file upload handling
setupFileUpload();

// New: Function to calculate and update transaction counts
function updateTransactionCounts() {
    const table = document.querySelector('#output table');
    if (!table) {
        transactionCountsDiv.style.display = 'none'; // Hide if no table
        return;
    }

    transactionCountsDiv.style.display = 'flex'; // Show if table exists

    let total = 0;
    let debitCount = 0;
    let creditCount = 0;

    // Find the column indices for 'DR' and 'CR'
    const headerRow = table.rows[0];
    const headers = Array.from(headerRow.cells).map(cell => cell.textContent.trim().toLowerCase());
    const drIndex = headers.indexOf('dr');
    const crIndex = headers.indexOf('cr');

    if (drIndex === -1 && crIndex === -1) {
        // If no DR/CR columns, hide counts and return
        transactionCountsDiv.style.display = 'none';
        return;
    }

    // Iterate through data rows (skip header row)
    for (let i = 1; i < table.rows.length; i++) {
        const row = table.rows[i];
        let isTransaction = false; // Flag to check if this row represents a transaction

        if (drIndex !== -1) {
            const drCell = row.cells[drIndex];
            if (drCell && drCell.textContent.trim() !== '') {
                debitCount++;
                isTransaction = true;
            }
        }
        if (crIndex !== -1) {
            const crCell = row.cells[crIndex];
            if (crCell && crCell.textContent.trim() !== '') {
                creditCount++;
                isTransaction = true;
            }
        }
        if (isTransaction) {
            total++;
        }
    }

    totalCountSpan.textContent = total;
    drCountSpan.textContent = debitCount;
    crCountSpan.textContent = creditCount;
}
  
});
