// tdinperson.js

window.processData = function() {
  const input = document.getElementById('inputText').value.trim();
  const yearInput = document.getElementById('yearInput').value.trim();
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

  // Helper to normalize date into MM/DD/YYYY
  function normalizeDate(dateStr) {
    const months = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
    };
    
    // Match formats like Sep 27, 2024 or Sep27,2024
    const m = dateStr.match(/^([A-Za-z]{3})\s?(\d{1,2}),\s?(\d{4})$/);
    if (!m) return dateStr;
    
    const mm = months[m[1]] || '01';
    const dd = m[2].padStart(2, '0');
    const yyyy = yearInput || m[3]; // Use yearInput if provided, otherwise use year from match
    return `${mm}/${dd}/${yyyy}`;
  }

  const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
  let lastBalance = null;
  let buffer = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const fullLine = buffer.join(' ');
    const dateMatch = fullLine.match(/^([A-Za-z]{3}\s?\d{1,2},\s?\d{4})/);
    if (!dateMatch) {
      buffer = [];
      return;
    }

    const rawDate = dateMatch[1];
    // Format the date to be compatible with main.js processing
    // Use a format that won't be split by the date processing logic
    const date = `${rawDate.split(' ')[0]} ${rawDate.split(' ')[1].replace(',', '')}`;

    let rest = fullLine.slice(rawDate.length).trim();

    // Balance regex
    const balanceRegex = /(?:-?\s*\$|(?:\s*\$)?-)\s*([\d,]+\.\d{2})(OD)?$/i;
    const balanceMatch = rest.match(balanceRegex);

    if (!balanceMatch) {
      buffer = [];
      return;
    }

    const balanceNumericPart = balanceMatch[1];
    const isOverdraftFlag = balanceMatch[2] ? true : false;

    let balanceNum = parseFloat(balanceNumericPart.replace(/,/g, ''));

    if (balanceMatch[0].includes('-') || isOverdraftFlag) {
      balanceNum = -Math.abs(balanceNum);
    } else {
      balanceNum = Math.abs(balanceNum);
    }

    rest = rest.slice(0, rest.lastIndexOf(balanceMatch[0])).trim();

    // Amount regex
    const amountRegex = /(-?[\d,]+\.\d{2})$/;
    const amountMatch = rest.match(amountRegex);
    if (!amountMatch) {
      buffer = [];
      return;
    }

    const amountStr = amountMatch[1];
    const amountNum = parseFloat(amountStr.replace(/,/g, ''));

    let description = rest.slice(0, rest.lastIndexOf(amountMatch[0])).trim();

    let debit = '';
    let credit = '';

    if (lastBalance === null) {
      if (description.toLowerCase().includes('opening balance') || description.toLowerCase().includes('balance forward')) {
        debit = '';
        credit = '';
      } else {
        if (amountNum < 0) {
          credit = Math.abs(amountNum).toFixed(2);
        } else {
          debit = amountNum.toFixed(2);
        }
      }
    } else {
      const delta = balanceNum - lastBalance;
      const epsilon = 0.01;

      if (Math.abs(delta - amountNum) < epsilon) {
        if (delta > 0) {
          credit = amountNum.toFixed(2);
        } else if (delta < 0) {
          debit = Math.abs(amountNum).toFixed(2);
        } else {
          debit = amountNum.toFixed(2);
        }
      } else {
        const creditKeywords = ['DEPOSIT', 'REBATE', 'ACCT BAL REBATE', 'E-TRANSFER'];
        const upperDesc = description.toUpperCase();
        const isCredit = creditKeywords.some(k => upperDesc.includes(k));
        if (isCredit) {
          credit = amountNum.toFixed(2);
        } else {
          debit = Math.abs(amountNum).toFixed(2);
        }
      }
    }

    lastBalance = balanceNum;

    const row = [date, description, debit, credit, balanceNum.toFixed(2)];
    rows.push(row);

    buffer = [];
  };

  lines.forEach(line => {
    if (/^[A-Za-z]{3}\s?\d{1,2},\s?\d{4}/.test(line)) {
      flushBuffer();
    }
    buffer.push(line);
  });

  flushBuffer();

  // Sort the rows array by date in ascending order
  rows.sort((a, b) => {
    const dateA = new Date(`${a[0]} ${yearInput || '2000'}`);
    const dateB = new Date(`${b[0]} ${yearInput || '2000'}`);
    return dateA - dateB;
  });

  // Rebuild the table with the sorted rows
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
};

// PDF processing function for TD In-Person
window.bankUtils.processPDFFile = async function(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async function(e) {
      try {
        const pdfData = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument({data: pdfData}).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const textItems = textContent.items;
          let lastY = null;
          let line = '';
          
          for (const item of textItems) {
            if (lastY !== item.transform[5]) {
              if (line.trim() !== '') {
                fullText += line + '\n';
              }
              line = item.str;
              lastY = item.transform[5];
            } else {
              line += ' ' + item.str;
            }
          }
          
          if (line.trim() !== '') {
            fullText += line + '\n';
          }
        }
        
        resolve(fullText);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = function(error) {
      reject(error);
    };
    
    reader.readAsArrayBuffer(file);
  });
};
