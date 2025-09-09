function processData() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
  const lines = input.split('\n').filter(l => l.trim());
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

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

  const dateRegex = /^[A-Za-z]{3} \d{1,2} [A-Za-z]{3} \d{1,2}/;
  const seen = new Set();
  let buffer = []; // Stores multi-line transactions

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const fullLine = buffer.join(' ');
    const match = fullLine.match(dateRegex);
    if (!match) {
      buffer = [];
      return;
    }

    // Extract the two dates
    let [fullDateString, date1Part, date2Part] = match[0].match(/([A-Za-z]{3} \d{1,2})\s+([A-Za-z]{3} \d{1,2})/);

    // Append year if provided
    let formattedDate = '';
    if (yearInput) {
      formattedDate = `${date1Part} ${yearInput} ${date2Part} ${yearInput}`;
    } else {
      formattedDate = `${date1Part} ${date2Part}`;
    }

    const rest = fullLine.replace(dateRegex, '').trim();
    const amountMatch = rest.match(/-?\$[\d,]+\.\d{2}/);
    let debit = '', credit = '', balance = '';

    if (amountMatch) {
      const rawAmount = amountMatch[0];
      const amountVal = parseFloat(rawAmount.replace(/[^0-9.-]/g, ''));
      if (rawAmount.startsWith('-')) {
        credit = Math.abs(amountVal).toFixed(2);
      } else {
        debit = amountVal.toFixed(2);
      }
    }

    const desc = rest.replace(/-?\$[\d,]+\.\d{2}/, '').trim();

    // Check for duplicates
    const signature = `${desc.toLowerCase()}|${debit || credit}`;
    const isDuplicate = seen.has(signature);
    if (!isDuplicate) seen.add(signature);

    const row = [formattedDate, desc, debit, credit, balance];
    const tr = document.createElement('tr');
    if (isDuplicate) tr.style.backgroundColor = '#ffcccc';

    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });

    table.appendChild(tr);
    rows.push(row);
    buffer = [];
  };

  lines.forEach(line => {
    if (line.match(dateRegex)) {
      flushBuffer(); // Process previous transaction
      buffer.push(line);
    } else {
      buffer.push(line); // Append to current transaction
    }
  });

  flushBuffer(); // Process last transaction

  outputDiv.appendChild(table);
  table.dataset.rows = JSON.stringify(rows);
}

window.processData = processData;

// Add TD Card PDF Upload button functionality
function addTdCardPdfButton() {
  // Check if we're on the TD Card page
  const bankSelector = document.getElementById('bankSelector');
  const typeSelector = document.getElementById('typeSelector');
  
  if (bankSelector && typeSelector && 
      bankSelector.value === 'td' && 
      typeSelector.value === 'card') {
    
    // Create the button
    const pdfButton = document.createElement('button');
    pdfButton.id = 'tempPdfUploadBtn';
    pdfButton.innerHTML = '<i class="fas fa-file-pdf"></i> Upload Pdf';
    pdfButton.title = 'Upload TD Card PDF';
    
    // Add it to the top controls
    const sampleBtnContainer = document.querySelector('.sample-btn-container');
    if (sampleBtnContainer) {
      sampleBtnContainer.parentNode.insertBefore(pdfButton, sampleBtnContainer);
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'td-card-modal';
    modal.innerHTML = `
      <div class="td-card-modal-header">
        <span>TD Card PDF Template</span>
        <div>
          <button id="minimizeModal" title="Minimize">_</button>
          <button id="maximizeModal" title="Maximize">□</button>
          <button id="closeModal" title="Close">×</button>
        </div>
      </div>
      <iframe src="cardtd.html"></iframe>
    `;
    
    document.body.appendChild(modal);
    
    // Track modal state
    let modalState = 'normal'; // 'normal', 'minimized', or 'maximized'
    const originalStyles = {
      width: '90%',
      height: '80%',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    };
    
    // Button event listener
    pdfButton.addEventListener('click', () => {
      modal.style.display = 'flex';
      restoreModal();
    });
    
    // Function to restore modal to normal state
    function restoreModal() {
      Object.assign(modal.style, originalStyles);
      modal.classList.remove('minimized');
      modalState = 'normal';
      updateMaximizeButton();
    }
    
    // Function to update maximize button text
    function updateMaximizeButton() {
      const maximizeBtn = document.getElementById('maximizeModal');
      maximizeBtn.textContent = modalState === 'maximized' ? '❐' : '□';
      maximizeBtn.title = modalState === 'maximized' ? 'Restore' : 'Maximize';
    }
    
    // Modal control event listeners
    document.getElementById('closeModal').addEventListener('click', () => {
      modal.style.display = 'none';
      restoreModal(); // Reset to normal state when closed
    });
    
    document.getElementById('maximizeModal').addEventListener('click', () => {
      if (modalState === 'maximized') {
        // Restore to normal size
        restoreModal();
      } else {
        // Maximize
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.transform = 'none';
        modal.classList.remove('minimized');
        modalState = 'maximized';
        updateMaximizeButton();
      }
    });
    
    document.getElementById('minimizeModal').addEventListener('click', () => {
      if (modalState === 'minimized') {
        // Restore from minimized state
        restoreModal();
      } else {
        // Minimize
        modal.style.width = '50px';
        modal.style.height = '50px';
        modal.style.top = 'auto';
        modal.style.left = 'auto';
        modal.style.right = '20px';
        modal.style.bottom = '70px';
        modal.style.transform = 'none';
        modal.classList.add('minimized');
        modalState = 'minimized';
        updateMaximizeButton();
      }
    });
    
    // Click on minimized icon to restore
    modal.addEventListener('click', (e) => {
      if (modalState === 'minimized' && !e.target.closest('button')) {
        restoreModal();
      }
    });
    
    // Also add the button when the type changes to TD Card
    const originalTypeChange = typeSelector.onchange;
    typeSelector.onchange = function() {
      if (originalTypeChange) originalTypeChange.apply(this, arguments);
      
      // Remove existing button if any
      const existingBtn = document.getElementById('tempPdfUploadBtn');
      const existingModal = document.querySelector('.td-card-modal');
      
      if (existingBtn) existingBtn.remove();
      if (existingModal) existingModal.remove();
      
      // Add button if TD Card is selected
      if (bankSelector.value === 'td' && this.value === 'card') {
        setTimeout(addTdCardPdfButton, 100);
      }
    };
  }
}

// Call the function when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addTdCardPdfButton);
} else {
  addTdCardPdfButton();
}