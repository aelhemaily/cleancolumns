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
  
let lastAmountSorterPosition = { top: 'auto', left: 'auto', right: 'auto', bottom: 'auto' };
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
  
// Add these variables at the top with other global variables
let amountSorterSection = null;
let keywordInput = null;
let sortAmountsBtn = null;
// Tool information data - pulled from your QZEE TOOLS.html
const toolDescriptions = {
  'cleancolumns': {
    title: 'Clean Columns',
    description: 'This tool is our main bank statement converter that transforms messy data into clean, organized columns ready for excel.'
  },
  'numbersorter': {
    title: 'Number Sorter', 
    description: 'This tool sorts columns containing both positive and negative numbers into two columns (credit/debit format).'
  },
  'rowcleaner': {
    title: 'Row Cleaner',
    description: 'This tool automatically removes empty rows from Excel or CSV files to clean up datasets.'
  },
  'datefilter': {
    title: 'Date Filter',
    description: 'This tool helps to edit date pairs to remove one, change year and reformat.'
  },
  'regopad': {
    title: 'Regopad',
    description: 'This tool is used to delete or control text. It can delete text before/after a keyword and much more.'
  },
  'ttrimmer': {
    title: 'Transaction Trimmer', 
    description: 'This tool finds a date with the format mm/dd or dd/mm, deletes it and the text before it.'
  }
};


// AI Prompt System
function setupAIPromptSystem() {
  const aiPromptText = document.getElementById('aiPromptText');
  const copyAiPromptBtn = document.getElementById('copyAiPrompt');
  const currentScriptName = document.getElementById('currentScriptName');
  const aiBankSelector = document.getElementById('aiBankSelector');
  
  // AI Prompts for each script
 const aiPrompts = {
  // Big 5 Banks
  'bmoAccount':
`Sep 12 Opening balance 811.05
Sep 12 Debit Card Purchase, ESSO CIRCLE K 3.72 807.33
Sep 12 Debit Card Purchase, TIM HORTONS #02 8.66 798.67
Sep 12 Debit Card Purchase, SOBEYS #4719 20.83 777.84
Sep 12 Debit Card Purchase, MCDONALD'S #405 7.10 770.74
Sep 13 INTERAC e-Transfer Sent 50.00 720.74
Sep 13 Debit Card Purchase, KABUL FARMS SUP 22.24 698.50
Sep 13 Pre-Authorized Payment, CONSUMER LOANS
LNS/PRE
175.69 522.81
Sep 16 Online Transfer, TF 0005191230231502577 150.00 372.81
Sep 16 Debit Card Purchase, KABUL FARMS SUP 44.53 328.28

Make sure to include the opening balance, but not closing balance.
`,

  'bmoCard':
`Dec 16 Dec 18 APPLE.COM/BILL 866-712-7753 ON 4.51
Dec 16 Dec 18 UBER CANADA/UBEREATS TORONTO ON 57.46
Dec 16 Dec 18 UBER CANADA/UBEREATS TORONTO ON 41.72
Dec 17 Dec 18 Amazon.ca Prime Member amazon.ca/priBC 11.29
Dec 18 Dec 18 Shelbys Oakville ON 7.10
Dec 18 Dec 19 UPS*5522302120 888-520-9090 NB 127.65
Dec 17 Dec 19 TELUS COMM. WEB EDMONTON AB 71.03
Dec 18 Dec 19 TIM HORTONS #0375 MISSISSAUGA ON 2.17
Dec 19 Dec 20 UPS*V1589RDRSNB 888-520-9090 NB 71.41
Dec 19 Dec 20 UPS*V1589RFQ4LD 888-520-9090 NB 56.24
Dec 17 Dec 20 SOBEYS #4719 MILTON ON 24.27
Dec 19 Dec 20 HALTON DSB BURLINGTON ON 46.25
Dec 20 Dec 20 Nike-ESW-CAD Vancouver BC 112.65
Dec 19 Dec 20 TRSF FROM/DE ACCT/CPT 3482-XXXX-164 1,000.00 CR
Dec 20 Dec 21 HALTON DSB BURLINGTON ON 54.00
Dec 21 Dec 22 TIM HORTONS #0375 MISSISSAUGA ON 10.95
Dec 22 Dec 22 APPLE.COM/BILL 866-712-7753 ON 3.38
Dec 22 Dec 25 LAURA/MELANIE LYNE WEB LAVAL QC 176.27 CR
`,

  'bmoLoc':
`Jan. 20 Jan. 20 AUTOMATIC PAYMENT RECEIVED - THANK YOU 200.00CR
Jan. 20 Jan. 20 PAYMENT RECEIVED - THANK YOU 200.00CR
Jan. 27 Jan. 27 PAYMENT RECEIVED - THANK YOU 200.00CR
Jan. 27 Jan. 27 PAYMENT RECEIVED - THANK YOU 500.00CR
Jan. 29 Jan. 29 PAYMENT RECEIVED - THANK YOU 500.00CR
Feb. 3 Feb. 3 AUTOMATIC PAYMENT RECEIVED - THANK YOU 200.00CR
Feb. 3 Feb. 3 PAYMENT RECEIVED - THANK YOU 200.00CR
Feb. 3 Feb. 3 PAYMENT RECEIVED - THANK YOU 300.00CR
Feb. 10 Feb. 10 PAYMENT RECEIVED - THANK YOU 200.00CR
Feb. 17 Feb. 17 PAYMENT RECEIVED - THANK YOU 200.00CR
Feb. 17 Feb. 17 AUTOMATIC PAYMENT RECEIVED - THANK YOU 200.00CR`,

  'cibcAccount':
`Dec 1 Opening balance   -$2.89

Dec 1 RETAIL PURCHASE   733415757398
TIM HORTONS #06
3.55   -6.44

Dec 4 RETAIL PURCHASE   352001001091
7 ELEVEN STORE
1.80   -8.24

Dec 5 DEPOSIT   IBB
WESTWOOD SQUARE BANKING CENTRE
35.00 26.76

Dec 5 DEPOSIT   IBB
WESTWOOD SQUARE BANKING CENTRE
33.08 59.84

Dec 5 INTERNET BILL PAY 000000285133
MASTERCARD, CAPITAL ONE
49.84 10.00

Dec 18 RETAIL PURCHASE   735012920478
COFFEE CULTURE
2.30 7.70

Dec 18 RETAIL PURCHASE   735018657131
TIM HORTONS #07
5.28 2.42

Dec 20 E-TRANSFER   100403366968
GIFTCASH INC.
80.00 82.42

Dec 20 Balance forward   $82.42

Dec 21 RETAIL PURCHASE   735421229600
SECOND CUP 9198
4.92 77.50

Make sure to include the opening balance and any balance forward, but not the closing balance.`,

  'cibcCard':
`Jul 11 Jul 12 PAYMENT THANK YOU/PAIEMENT MERCI 2,739.90
Aug 07 Aug 07 REGULAR PURCHASES 19.99% 4.28
Jul 17 Jul 19 CDN TIRE STORE #00425 LONDON ON Home and Office Improvement 146.89
Jul 22 Jul 25 CIBC AD - #46 MISSISSAUGA ON Professional and Financial Services 24.43
Jul 26 Jul 28 MANULIFE TRAVEL INS WATERLOO ON Professional and Financial Services -1,268.19
Jul 26 Jul 28 MANULIFE TRAVEL INS WATERLOO ON Professional and Financial Services -1,268.19
Jul 30 Aug 02 FOOD LANDS SUPERMARKET LONDON ON Retail and Grocery 191.92
Aug 01 Aug 03 CDN TIRE STORE #00208 LONDON ON Home and Office Improvement 175.92`,

  'rbcAccount':
`Opening balance 820.99
03 Dec Regular transaction fee 2 Drs @ 1.25 2.50
03 Dec Electronic transaction fee 9 Drs @ 0.75 6.75
04 Dec Interac purchase - 4283 WAL-MART #1061 10.88 800.86
05 Dec Interac purchase - 2093 MTO RUS-SO BRAM 120.00
05 Dec Interac purchase - 4802 FIRST CHOICE AU 160.00 520.86
07 Dec Funds transfer credit TT HUMAYUN FASI 1,985.00
07 Dec Contactless Interac purchase - 1653 SUBWAY # 43141 4.96
07 Dec Funds transfer fee TT HUMAYUN FASI 17.00 2,483.90
11 Dec Contactless Interac purchase - 5146 SHOPPERS DRUG M 2.03 2,481.87
12 Dec e-Transfer received SAMYA MIR 350.00 2,831.87
12 Dec Funds transfer credit TT HUMAYUN FASI 2,000.00
12 Dec 12 Dec Contactless Interac purchase - 0280 KWALITY SWEETS 2.36
12 Dec Funds transfer fee TT HUMAYUN FASI 17.00 4,812.51
14 Dec Online Transfer to Deposit Account-6652 3,951.00 861.51
17 Dec Funds transfer credit TT HUMAYUN FASI 2,000.00
17 Dec Contactless Interac purchase - 8462 TIM HORTONS #32 1.60
17 Dec Contactless Interac purchase - 6926 CANADIAN TIRE G 15.68

Make sure to include the opening balance, but not closing balance (but keep the running balances at the end of transactions as shown above).`,

  'rbcCard':
`JAN 04 JAN 05 BELL MOBILITY VERDUN QC 74064493004820173611692 $204.53
JAN 04 JAN 05 TIM HORTONS #1669 HORNBY ON 74703413004105279447315 $7.94
JAN 05 JAN 06 BELL CANADA (OB) MONTREAL QC 74064493005820173321309 $232.72
JAN 05 JAN 06 TIM HORTONS #1669 HORNBY ON 74703413005106053590147 $7.94
JAN 05 JAN 06 RCSS #2811 GEORGETOWN ON 74500013005463643784562 $31.56
JAN 05 JAN 23 CASH BACK REWARD 06829028651 -$249.59
JAN 06 JAN 09 TIM HORTONS #1669 HORNBY ON 74703413006106804790243 $7.94
JAN 06 JAN 09 BREAKAWAY RIVERMONT RD BRAMPTON ON 74500013007461695669903 $73.15
JAN 07 JAN 09 NESPRESSO MAPLEVIEW BURLINGTON ON 74099863007000336710133 $86.60
JAN 07 JAN 09 TIM HORTONS #1669 HORNBY ON 74703413007107571785464 $7.38
JAN 07 JAN 09 RCSS #2811 GEORGETOWN ON 74500013007463615694961 $19.00
JAN 07 JAN 11 WAL-MART SUPERCENTER#3034GEORGETOWN ON 74529003009900430595705 $18.12
JAN 07 JAN 09 PAYMENT - THANK YOU / PAIEMENT - MERCI 74510203009619987802200 -$3181.98
JAN 09 JAN 10 BEST BUY #617 TORONTO ON 74500013009617019999403 $372.89`,

  'rbcLoc':
`Jun 24 Jun 21 Withdrawal $250.00 $27,150.00
Jun 25 Jun 24 Withdrawal $750.00 $27,900.00
Jun 27 Jun 17 Reversal of Payment $2,000.00 $29,900.00
Jun 27 Jun 17 Payment -$2,000.00 $28,414.38
Jun 28 Jun 27 Withdrawal $250.00 $28,664.38
Jul 03 Jul 02 Withdrawal $1,335.62 $30,000.00
Jul 05 Jul 04 Payment -$1,250.00 $28,750.00
Jul 08 Jul 05 Withdrawal $250.00 $29,000.00
Jul 09 Jul 08 Payment -$1,000.00 $28,000.00`,

  'scotiaAccount':
`12/04/2017 TRANSFER TO 41962 05915 21 26981332 MB-TRANSFER 5,000.00 129,906.11
12/04/2017 DEBIT MEMO 26985483 MB-EMAIL MONEY TRF 259.58 129,646.53
12/04/2017 DEBIT MEMO 26988146 MB-EMAIL MONEY TRF 259.58 129,386.95
12/04/2017 SERVICE CHARGE MB-EMAIL MONEY TRF 1.00 129,385.95
12/04/2017 SERVICE CHARGE MB-EMAIL MONEY TRF 1.00 129,384.95
12/05/2017 DEPOSIT HAMILTON ON 93310 490 36336427 MB-DEP 1,448.70 130,833.65
12/05/2017 DEPOSIT HAMILTON ON 93310 490 36339715 MB-DEP 1,088.81 131,922.46
12/05/2017 DEPOSIT HAMILTON ON 93310 490 36343413 MB-DEP 1,937.20 133,859.66`,

  'scotiaCard':
`001 Mar 13 Mar 13 PAYMENT-THANK YOU SCOTIABANK TRANSIT 82362 WESTON ON 10.00-
002 Mar 20 Mar 20 INTEREST CHARGES-PURCHASE 0.41
003 Mar 10 Mar 13 MCDONALD'S F5709 EAST AURORA NY AMT 5.32 UNIT ED STATES DOL LAR 7.54
004 Mar 10 Mar 13 JOE'S KWIK MARTS #0461 ELMA NY AMT 25.44 UNIT ED STATES DOL LAR 36.15
005 Mar 10 Mar 13 SHELL C21803 LONDON ON 41.37
006 Mar 10 Mar 13 MCDONALD'S F5709 EAST AURORA NY AMT 48.58 UNIT ED STATES DOL LAR 68.91
007 Mar 13 Mar 14 GREENBELT LIQUORS GREENBELT MD AMT 1.26 UNIT ED STATES DOL LAR 1.79
008 Mar 13 Mar 14 GREENBELT LIQUORS GREENBELT MD AMT 51.21 UNIT ED STATES DOL LAR 72.78
009 Mar 14 Mar 14 SIRIUSXM.CA/ACCT 888-539-7474 ON 8.81
010 Mar 18 Mar 20 FREEDOM MOBILE 877-946-3184 ON 16.95`,

  'tdAccount':
`STARTING BALANCE JUN28 326.46OD
E-TRANSFER ***UXW 10.00 JUL02 316.46OD
GST GST 129.75 JUL05
BELL MOBILITY _V 15.00 JUL05
NON-TD ATM W/D 43.00 JUL05
BELL MOBILITY _V 22.00 JUL05
BELL MOBILITY _V 10.00 JUL05
BELL MOBILITY _V 9.68 JUL05
BELL MOBILITY _V 5.00 JUL05
BELL MOBILITY _V 5.00 JUL05
BELL MOBILITY _V 2.00 JUL05
BELL MOBILITY _V 1.50 JUL05
BELL MOBILITY _V 0.11 JUL05 300.00OD
GC 2864-DEPOSIT 20.00 JUL09
BELL MOBILITY _V 18.00 JUL09
BELL MOBILITY _V 2.00 JUL09
E-TRANSFER ***RaV 100.00 JUL09`,

  'tdCard':
`JUL 12 JUL 13 HAIR FLAIR LONDON $135.60
JUL 13 JUL 14 STAPLESPRINT.CA RICHMOND HIL $51.05
JUL 17 JUL 18 Adobe Inc 800-8336687 $29.37
JUL 17 JUL 19 GOOGLE*GOOGLE STORAGE $3.15
G.CO/HELPPAY
JUL 24 JUL 25 SHOPIFY INC/188813620 OTTAWA $308.39
FOREIGN CURRENCY 227.43 USD
@EXCHANGE RATE 1.35597
JUL 26 JUL 27 PST*happy returns 951-2344425 $29.35
FOREIGN CURRENCY 21.67 USD
@EXCHANGE RATE 1.35440
JUL 27 JUL 28 EVENTBRITE/NATESMITH SAINT JOHN $129.10
AUG 1 AUG 2 PAYMENT - THANK YOU -$2,795.02
AUG 2 AUG 3 ENCORE AUCTIONS 519-659-8725 $85.79
AUG 2 AUG 3 PAYMENT - THANK YOU -$30.00
AUG 3 AUG 4 GRAMMARLY CO4FCAOFS $82.30
GRAMMARLY.CO
FOREIGN CURRENCY 60.00 USD
@EXCHANGE RATE 1.37166
AUG 5 AUG 8 PST*happy returns 951-2344425 $81.01
FOREIGN CURRENCY 58.99 USD
@EXCHANGE RATE 1.37328`,

  'tdinPerson':
`Jan 31,2024 PAPER STMT FEE 3.00 $243,689.42
Jan 31,2024 ACCT BAL REBATE 19.00 $243,692.42
Jan 31,2024 MONTHLY PLAN FEE 19.00 $243,673.42
Jan 26, 2024 MONEY MART #629 299.99 $243,692.42
Jan 26, 2024 GC 0110-CASH WITHDRA 300.00 $243,992.41
Jan 26, 2024 GC 0110-TRANSFER 2,000.00 $244 292.41
Jan 26, 2024 CREDIT CARD PAYMENT 1,000.00 $246,292.41
Jan 26, 2024 GC 0110-DEPOSIT 6,152.86 $247,292.41
Jan 22, 2024 64068 MACS CONV 23.38 $241,139.55
Jan 22, 2024 DARRYLL & TRACY 101.12 $241,162.93
Jan 16, 2024 TRANSFER 2,000.00 $241,264.05
Jan 16, 2024 CREDIT CARD PAYMENT 422.51 $243,264.05
Jan 16, 2024 CREDIT CARD PAYMENT 1,000.00 $243,686.56`,

  'tdHistory':
`11/14/2023 E-TRANSFER ***fGC 30.00 CR 818.75
11/30/2023 MONTHLY PLAN FEE 5.00 DR 813.75
12/18/2023 E-TRANSFER ***ewr 450.00 CR 1,263.75
12/19/2023 TD ATM W/D 000152 200.00 DR 1,063.75
12/29/2023 MONTHLY PLAN FEE 5.00 DR 1,058.75
01/02/2024 TD ATM W/D 005070 300.00 DR 758.75
01/29/2024 E-TRANSFER ***yUq 500.00 CR 758.75
01/29/2024 TD ATM W/D 004782 500.00 DR 758.75
01/31/2024 MONTHLY PLAN FEE 5.00 DR 753.75
02/29/2024 MONTHLY PLAN FEE 5.00 DR 748.75
03/04/2024 E-TRANSFER ***618 250.00 CR 998.75`,

  // Other Canadian Banks
  'cdtCard':
`Dec 08 Dec 09 CDN TIRE STORE #00130 LONDON ON -1,000.00
Dec 20 Dec 21 CDN TIRE STORE #00010 BRAMPTON ON -3,000.00
Dec 30 Jan 02 CDN TIRE STORE #00104 STRATHROY ON -5,000.00
Dec 15 Dec 19 WAL-MART # 1157 LONDON ON -22.57
Dec 14 Dec 16 WAL-MART # 1157 LONDON ON 34.96
Dec 15 Dec 16 TIM HORTONS #1739 LONDON ON 2.61
Dec 17 Dec 19 CDN TIRE GASBAR #01648 LONDON ON 68.13
Dec 18 Dec 19 BATTERIES AND GADGETS BRAMPTON ON 50.84
Dec 19 Dec 19 ROGERS ******7306 888-764-3771 ON 141.40
Dec 19 Dec 20 CDN TIRE GASBAR #01331 BRAMPTON ON 70.98
Dec 19 Dec 20 TIM HORTONS #7591 CALEDONIA ON 1.59
Dec 21 Dec 21 FREEDOM MOBILE 877-946-3184 ON 107.66
Dec 20 Dec 21 407-ETR-WEB WOODBRIDGE ON 133.57
Dec 22 Dec 23 CDN TIRE GASBAR #01648 LONDON ON 71.69

Make sure to bring in ALL transactions from ALL pages and ALL sections of the statement.`,

  'coastcapitalAccount':
`01 OCT 22 Balance Forward 6,403.00
02 OCT 22 Online Transfer Out CRA Paystub Deduction 1,300.00 5,103.00
02 OCT 22 Direct Deposit DIVERSITY BUSINESS SOLUTIONS SQUARE NAD 2,626.89 7,729.89
03 OCT 22 Pre-Auth Debit BDC DIVERSITY BUSINESS SOLUTIONS BANQUE DEVELOPPEMENT DU CANADA 2,173.10 5,556.79
03 OCT 22 Pre-Auth Debit BDC DIVERSITY BUSINESS SOLUTIONS BANQUE DEVELOPPEMENT DU CANADA 1,820.47 3,736.32
03 OCT 22 Pre-Auth Debit BDC DIVERSITY BUSINESS SOLUTIONS BANQUE DEVELOPPEMENT DU CANADA 478.08 3,258.24
03 OCT 22 Pre-Auth Debit DIVERSITY BUSINESS SOLUTIONS VW CREDIT CAN 537.04 2,721.20
04 OCT 22 Cheque 386 2,999.62 -278.42
04 OCT 22 Cheque 385 3,728.83 -4,007.25
04 OCT 22 Cheque 384 2,999.62 -7,006.87`,

  'craHistory':
`May 01, 2025 Payment 732.24 CR
May 01, 2025 Payment Applied 732.24
May 01, 2025 Net Tax 732.24
May 01, 2025 Payment Applied 732.24 CR
May 01, 2025 Failure to file penalty 7.32
May 01, 2025 Arrears Interest 0.16
May 01, 2025 Administrative adjustment 7.48 CR`,

  'craPayroll':
`May 22, 2024 Interest charged on 18.13Dr 0.05 DR
May 21, 2024 Arrears payment 18.18 CR
May 10, 2024 Assessed late remitting penalty 18.13 DR
May 10, 2024 Interest charged on 101.82Dr 0.06 DR
May 09, 2024 Late year-end payment 2023 681.36 CR
May 09, 2024 Arrears payment 101.88 CR
May 06, 2024 Interest charged on 100.00Dr 1.82 DR
May 06, 2024 Assessed late filing penalty 100.00 DR
May 02, 2024 T4 Type Information Return 2023 15947.19 DR
October 06, 2023 Payment Sept 2023 800.00 CR
September 07, 2023 Payment Aug 2023 1771.91 CR
August 04, 2023 Payment July 2023 1771.91 CR
July 20, 2023 Interest charged on 154.38Dr 0.08 DR
July 19, 2023 Arrears payment 154.46 CR
July 14, 2023 Assessed late remitting penalty 635.95 DR
July 14, 2023 Late remitting penalty adjustment 481.57 CR`,

  'eqCard':
`Sep 28 PRESTO ETIK/HSR****2590, TORON -$5.60
Sep 27 MICROSOFT*STORE, MISSISSAUGA, -$1.13
Sep 27 ARHA VARIETY, HAMILTON, ON -$3.83
Sep 27 LOCMYPARCEL INFO, ESCALDEES EN -$0.75
Sep 26 ARHA VARIETY, HAMILTON, ON -$6.09
Sep 25 HASTY MARKET #4, HAMILTON, CAN -$27.09
Sep 25 Transfer from Linked account * $10.00
Sep 24 Transfer from Linked account * $10.00
Sep 24 Transfer from Linked account * $20.00
Sep 24 PC GAME SUPPLY, CALGARY, CAN -$42.76
Sep 24 Transfer from Linked account * $5.00
Sep 24 Transfer from Linked account * $30.00
Sep 24 PC GAME SUPPLY, CALGARY, CAN -$141.76
Sep 24 Transfer from Linked account * $150.00
Sep 24 PC GAME SUPPLY, CALGARY, CAN -$70.95`,

  'firstontarioAccount':
`Balance Forward: 96,699.98
Jan 10 Preauthorized Debit First Ontario 365.70 96,334.28
Jan 12 Cheque #754 1,000.00 95,334.28
Jan 16 Cheque #757 4,980.00 90,354.28
Jan 19 Cheque #755 491.55 89,862.73
Jan 19 Online Transfer Out 11.50 89,851.23
Jan 19 Online Transfer Out 3,955.00 85,896.23
Jan 26 Online Transfer In 4.50 85,900.73
Jan 26 eTransfer CERTAPAY 1,000.00 84,900.73
Jan 26 Charge - Capitalise ETRANSFER IMMEDIATE CHARGE 1.50 84,899.23
Jan 26 eTransfer CERTAPAY 2,835.12 82,064.11
Jan 26 Charge - Capitalise ETRANSFER IMMEDIATE CHARGE 1.50 82,062.61
Jan 26 eTransfer CERTAPAY 2,164.14 79,898.47
Jan 26 Charge - Capitalise ETRANSFER IMMEDIATE CHARGE 1.50 79,896.97
Jan 31 Interest - Capitalize 323.67 80,220.64

Make sure to include Balance Forward at the beginning and any subsequent balance forwards.
`,

  'meridianAccount':
`31-Dec-2022 Balance Forward 10,393.42
03-Jan-2023 Pre-Authorized # 9303 5,525.03 15,918.45
Uber Holdings C
03-Jan-2023 Pre-Authorized # 9303 -45.72 15,872.73
BELL CANADA EFT
03-Jan-2023 Cheque # 28 -3,678.53 12,194.20
04-Jan-2023 Cheque # 48 -1,000.00 11,194.20
04-Jan-2023 Cheque # 47 -2,144.55 9,049.65
05-Jan-2023 Pre-Authorized # 9205 1,572.50 10,622.15
SKIPTHEDISHES
06-Jan-2023 Service Charge -1.50
06-Jan-2023 e-Transfer Out # 204842947 -3,000.00 7,620.65
10-Jan-2023 Pre-Authorized # 9310 4,148.57 11,769.22
Uber Holdings C
12-Jan-2023 Pre-Authorized # 9212 912.89 12,682.11
SKIPTHEDISHES
16-Jan-2023 Cheque # 49 -2,291.68 10,390.43
17-Jan-2023 Pre-Authorized # 9317 3,612.35 14,002.78
Uber Holdings C

Make sure to bring balance forward in.`,

  'nbcAccount':
`07 31 PREVIOUS BALANCE 12156.02
08 01 C/PURCHASE 00105761613 LABRADOR HEALTH 14.27 12141.75
08 02 PAYROLL DEPOSIT AUGURY HEALTHCA 21390.00 33531.75
08 05 INTERAC E-TRANSFER 1000.00 32531.75
08 05 INTERAC E-TRANSFER 3000.00 29531.75
08 05 C/PURCHASE 00105761613 LABRADOR HEALTH 9.41 29522.34
08 07 INTERAC E-TRANSFER 5000.00 24522.34
08 09 C/PURCHASE 00105761613 LABRADOR HEALTH 9.46 24512.88
08 13 C/PURCHASE 00105761613 LABRADOR HEALTH 13.46 24499.42
08 14 C/PURCHASE 00105761613 LABRADOR HEALTH 8.31 24491.11
08 15 C/PURCHASE 00105761613 LABRADOR HEALTH 18.07 24473.04
08 15 C/PURCHASE 00105761613 LABRADOR HEALTH 14.33 24458.71
08 16 INTERAC E-TRANSFER 5000.00 19458.71
08 16 PAYROLL DEPOSIT AUGURY HEALTHCA 20166.25 39624.96
08 19 INTERAC E-TRANSFER 1000.00 38624.96
08 20 G/WITHDRAW 00105761613 63.00 38561.96
08 20 G/SERVICE CHARGE 2.00 38559.96
08 22 ACCOUNT PAYABLE M/CARD AFFAIRES 3064.43 35495.53
08 28 INTERAC E-TRANSFER 4000.00 31495.53
08 30 PAYROLL DEPOSIT AUGURY HEALTHCA 23589.27 55084.80

Make sure to include previous balance at the top.`,

  'nbcCard':
`07 22 I204078732 07 23 PAYMENT VIA ELECTRONIC TRANSFER 386.08-
07 02 I184386385 07 03 ANNUAL FEE 125.00
07 02 I184386386 07 03 ANNUAL FEE 50.00
07 03 U396222596 07 04 CANCO PETROLEUM #702 L LONDON ON 15.13
07 04 U036435582 07 05 WAL-MART #3049 LONDON ON 58.97
07 04 U396269598 07 05 PIONEER STN #131 LONDON ON 15.51
07 05 U396283904 07 08 FOOD BASICS 670 LONDON ON 54.93
07 07 U036451118 07 09 WAL-MART #3049 LONDON ON 240.62
07 08 U396259816 07 09 PIONEER 43368 LONDON ON 31.84
07 09 U036479690 07 11 WAL-MART #3049 LONDON ON 6.97
07 12 U036420796 07 15 WAL-MART #3049 LONDON ON 149.72
07 12 U396234540 07 15 PIONEER 43368 LONDON ON 30.73
07 13 U372672846 07 15 STORYBOOK GARDENS LONDON ON 29.38`,

  'simpliiAccount':
`Aug 28 BALANCE FORWARD 7,847.73
Aug 28 Tangerine 100.00 7,747.73
Aug 28 Tangerine 52.50 7,695.23
Aug 28 Tangerine 10.00 7,685.23
Aug 28 Tangerine 115.00 7,570.23
Sep 02 PIONEER #263 41.00 7,529.23
Sep 02 ABM WITHDRAWAL 20.00 7,509.23
Sep 02 Manulife Bank o 50.00 7,459.23
Sep 02 Manulife Bank o 50.00 7,409.23
Sep 02 Tangerine 10.00 7,399.23
Sep 02 Tangerine 10.00 7,389.23
Sep 02 Tangerine 150.00 7,239.23
Sep 02 Tangerine 10.00 7,229.23
Sep 02 Tangerine 50.00 7,179.23
Sep 02 Tangerine 10.00 7,169.23
Sep 04 MARKHAM STOUFFVILLE HOSPITAL 507.11 7,676.34
Sep 03 Tangerine 10.00 7,666.34
Sep 04 ABM WITHDRAWAL 500.00 7,166.34
Sep 04 GIANT TIGER #14 24.86 7,141.48
Sep 04 Tangerine 10.00 7,131.48
Sep 04 Brandes 50.00 7,081.48
Sep 04 Brandes 50.00 7,031.48
Sep 05 ABM DEPOSIT 450.00 7,481.48

Make sure to include BALANCE FORWARD at the top.`,

  'tangerineAccount':
`
01 Jan 2023 Opening Balance 0.00 1,272.86
03 Jan 2023 EFT Withdrawal to HYUNDAI PMNT CT 290.36 982.50
03 Jan 2023 EFT Withdrawal to MVLCC945 71.00 911.50
10 Jan 2023 EFT Withdrawal to AVIVA-HOME/AUTO 51.30 860.20
10 Jan 2023 EFT Withdrawal to FN 1,900.56 (1,040.36)
10 Jan 2023 Overdraft Fee 5.00 (1,045.36)
11 Jan 2023 EFT Withdrawal to Hydro One 101.09 (1,453.98)
13 Jan 2023 INTERAC e-Transfer From: CONOR ELLIOTT 1,200.00 (253.98)
16 Jan 2023 EFT Withdrawal to Vista Credit 55.25 (309.23)
16 Jan 2023 EFT Withdrawal to AVIVA-HOME/AUTO 137.39 (446.62)
16 Jan 2023 EFT Withdrawal to HYUNDAI PMNT CT 290.36 (736.98)
23 Jan 2023 EFT Withdrawal to Enbridge Gas 109.41 (846.39)
27 Jan 2023 INTERAC e-Transfer From: CONOR ELLIOTT 1,200.00 353.61
30 Jan 2023 EFT Withdrawal to QUADRO COMMUNIC 124.24 229.37
30 Jan 2023 EFT Withdrawal to HYUNDAI PMNT CT 290.36 (60.99)
31 Jan 2023 Overdraft Interest Charged (J anuary 2023@19.00%) 6.97 (67.96)

Make sure to include Opening Balance at the top.`,

  'triangleCard':
`Feb 16 CIBC BANK PMT/PAIEMENT BCIC  -40.00
Feb 16 FINANCE CHARGE CREDIT ADJUSTMENT  -0.03
Feb 16 MCDONALD'S #10494 STONEY CREEK ON 2.10 
Feb 16 WAL-MART # 3096 HAMILTON ON 5.09 
Feb 19 SHELL C21842 MISSISSAUGA ON 20.00 
Feb 19 J & S CONVENIENCE STONEY CREEK ON 26.15 
Feb 19 MCDONALD'S #8898 Q04 MISSISSAUGA ON 7.54 
Feb 20 GOOGLE *Gameberry Labs g.co/helppay#NS 4.73 
Feb 20 GOOGLE *Gameberry Labs g.co/helppay#NS 1.57 
Mar 13 CIBC BANK PMT/PAIEMENT BCIC  -35.00
Mar 13 CIBC BANK PMT/PAIEMENT BCIC  -55.00
Mar 16 INTEREST CHARGES 8.41 

Make sure to include ALL transactions from ALL pages and ALL sections of the statement.`,

  'walmartCard':
`1 Apr 23 Apr 24 GOOGLE *GOOGLE STORAGE $3.15
2 Apr 23 Apr 24 LHSC-UH PRESCRIPTION C LONDON ON $10.00
3 Apr 25 Apr 29 CANCO PETROLEUM #702 L LONDON ON $2.81
4 Apr 28 Apr 30 WAL-MART #3049 LONDON ON $28.42
5 Apr 29 Apr 30 LHSC-UH PRESCRIPTION C LONDON ON -$10.00 $6
6 Apr 30 May 01 PIONEER 43368 LONDON ON $25.00
7 Apr 30 May 01 EUREST-VIC HOSP-23145 LONDON ON $7.13
8 May 01 May 01 AMZN MKTP CA*L13QM64D3 $67.79
9 May 01 May 02 EUREST-VIC HOSP-23145 LONDON ON $7.80
10 May 02 May 03 LAWDEPOT 8775094398 AB $762.75
11 May 03 May 06 EUREST-VIC FAYES-23143 LONDON ON $4.03
12 May 04 May 06 EUREST-VIC FAYES-23143 LONDON ON $2.02
13 May 08 May 09 NETFLIX.COM 866-716-0414 ON $18.63
14 May 09 May 09 GOOGLE *DISNEY PLUS 650-253-0000 NS $13.55
15 May 09 May 10 EUREST-VIC HOSP-23145 LONDON ON $7.13
16 May 10 May 13 EUREST-VIC HOSP-23145 LONDON ON $7.81
17 May 13 May 14 VIRGIN PLUS VERDUN QC $215.84
18 May 13 May 14 PAYMENT - THANK YOU -$1,640.00 $195.84`,

  // US Banks
  'amexCard':
`Mar 8 Mar 8 PAYMENT RECEIVED - THANK YOU -200.00
Mar 8 Mar 8 PAYMENT RECEIVED - THANK YOU -300.00
Feb 25 Feb 27 KOODO AIRTIME KOODO AIR SCARBOROUGH 169.18
Mar 2 Mar 4 NAILSOLUTION 0848700221 GILBERT UNITED STATES DOLLAR 65.19 @1.39423 90.89
Mar 6 Mar 7 CANCO PETROLEUM #702 L LONDON 75.00
Mar 9 Mar 9 ALIBABA.COM SINGAPORE UNITED STATES DOLLAR 103.49 @1.38071 142.89
Mar 17 Mar 18 *RFBT-MASONVILLE PLACE LONDON 9.59
Mar 22 Mar 23 CANCO PETROLEUM #702 L LONDON 75.00`,

  'boaCard':
`11/01/24 Monthly Fee Business Adv Fundamentals
-16.00
11/04/24 Zelle payment from SOFTECH COMMUNICATION, LLC Conf# j9we50pyb
3,528.00
11/12/24 M MERCHANT DES:MERCH DEP ID:217201100053462 INDN:AMZMENTORS CO ID:1217422108 CCD PMT INFO:AMZMENTORS
5,850.00
11/27/24 M MERCHANT DES:MERCH DEP ID:217201100053462 INDN:AMZMENTORS CO ID:1217422108 CCD PMT INFO:AMZMENTORS
450.00
11/04/24 M MERCHANT DES:MERCH FEES ID:217201100053462 INDN:AMZMENTORS CO ID:1217422108 CCD
-225.36
11/04/24 AUTHNET GATEWAY DES:BILLING ID:XXXXXXXXX INDN:AMZ MENTORS LLC CO ID:1870568569 CCD
-25.00
11/07/24 GATEWAY SERVICES DES:WEBPAYMENT ID: INDN:AMZMENTORMAVERICK CO ID:4460522024 WEB
-89.49
11/12/24 M MERCHANT DES:DLY DISC S ID:217201100053462 INDN:AMZMENTORS CO ID:1217422108 CCD
-259.35
11/14/24 Mobile transfer to CHK 6413 Confirmation# nivwb8e9k
-1,390.00
11/27/24 Zelle payment to VISIONARY TECH DIGITALS LLC Conf# mwlruutkj
-2,120.00
11/27/24 Zelle payment to VISIONARY TECH DIGITALS LLC Conf# mwd533rkg
-1,400.00
11/27/24 M MERCHANT DES:DLY DISC S ID:217201100053462 INDN:AMZMENTORS CO ID:1217422108 CCD
-19.95
11/29/24 WIRE TYPE:FX OUT DATE:241129 TIME:0454 ET TRN:2024112900072755 FX:CAD 273.86 1.3693 BNF:11317261 CANADA LIMITED ID:30585036482 BNF BK: THE TORONTO-DOMINION BA ID:CC000430582 PMT DET:PGL GCA6EJ POP Services /FXREF/te-2-4-162678161
-200.00
11/12/24 BKOFAMERICA ATM 11/11 #000009874 WITHDRWL TONAWANDA TONAWANDA NY
-1,000.00
11/12/24 CHECKCARD 1111 UNION MART CHEEKTOWAGA NY CKCD 5541 XXXXXXXXXXXX7830 XXXX XXXX XXXX 7830
-44.99`,

  'wellsfargoAccount':
`12/18 Zelle From Phyziques LLC on 12/16 Ref # Pp0Rsslfrf December 2,600.00
12/18 WT 2023121400601953 Isybank S.P.A /Org=Iaf Network S.P.A. Srf# 2023121400601953 Trn#231218003961 Rfb# 19,970.00
12/18 Edeposit IN Branch 12/18/23 02:47:32 Pm 7290 S Durango Dr Las Vegas NV 6191 13,606.00
12/18 Wire Trans Svc Charge - Sequence: 231218003961 Srf# 2023121400601953 Trn#231218003961 Rfb# 15.00
12/18 Purchase authorized on 12/15 Lvac Tap Acct 702-7348944 NV S383349618667396 Card 6191 32.00
12/18 Purchase authorized on 12/15 Bar Zazu Las Vegas NV S463350131004544 Card 6191 253.50
12/18 Purchase authorized on 12/15 Rwlv Theaters Bars Las Vegas NV S463350153465043 Card 6191 204.61
12/18 Purchase authorized on 12/16 Uber Eats Help.Uber.Com CA S463350443007887 Card 6191 38.35
12/18 Purchase authorized on 12/16 Uber Eats Help.Uber.Com CA S303350496013159 Card 6191 6.32
12/18 Purchase authorized on 12/16 Wal-Mart Super Center Las Vegas NV P000000585274150 Card 6191 54.40
12/16 Wal-Mart Super Center Las Vegas NV P000000979155153 Card 6191 175.85
12/18 Purchase Bank Check OR Draft 3.00
12/19 Purchase authorized on 12/18 Uber Eats Help.Uber.Com CA S463352358686775 Card 6191 61.03
12/19 Purchase authorized on 12/18 Uber Eats Help.Uber.Com CA S463352420554577 Card 6191 6.82
12/20 Zelle to Shamir on 12/20 Ref #Rp0Rt3Bxv5 Medical 120.00
12/20 1001Check 16,392.50`
};

  // Initialize AI bank selector with same options as main app
  function initializeAIBankSelector() {
    const mainBankSelector = document.getElementById('bankSelector');
    aiBankSelector.innerHTML = mainBankSelector.innerHTML;
    
    // Set initial value to match current bank from main app
    const currentMainBank = mainBankSelector.value;
    const currentMainType = document.getElementById('typeSelector').value;
    
    aiBankSelector.value = currentMainBank;
    
    // Update type selector based on current bank
    updateAITypeSelector(currentMainBank);
    
    // Set type to match main app
    const aiTypeSelector = document.getElementById('aiTypeSelector');
    setTimeout(() => {
      aiTypeSelector.value = currentMainType;
      updateAIPrompt();
    }, 100);
  }

  function updateAITypeSelector(bank) {
    const aiTypeSelector = document.getElementById('aiTypeSelector');
    const allowedTypes = {
      boa: ['card'],
      cdt: ['card'],
      coastcapital: ['account'],
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
      walmart: ['card'],
      nbc: ['account', 'card'],
      bmo: ['account', 'card', 'loc'],
      rbc: ['account', 'card', 'loc'],
      cibc: ['account', 'card'],
      scotia: ['account', 'card']
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
    aiTypeSelector.innerHTML = '';
    
    allowed.forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = allTypes[type];
      aiTypeSelector.appendChild(option);
    });
  }

  function getCombinedKeyForAI() {
    const bank = aiBankSelector.value;
    const type = document.getElementById('aiTypeSelector').value;
    
    if (bank === 'td' && type === 'inPerson') {
      return 'tdinPerson';
    }
    if (bank === 'cra' && type === 'payroll') {
      return 'craPayroll';
    }
    if (bank === 'cra' && type === 'history') {
      return 'craHistory';
    }
    return bank + capitalizeFirstLetter(type);
  }

  function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

 function updateAIPrompt() {
  const combinedKey = getCombinedKeyForAI();
  const basePrompt = aiPrompts[combinedKey] || `Process this ${combinedKey} bank statement and convert it to clean columns with proper formatting.`;
  
  // Universal header that gets prepended to EVERY prompt automatically
  const universalHeader = 'Extract the transactions from the uploaded PDF File(s). No Chatting and simply produce all the transactions, make sure to include all descriptions even if they span multiple lines, in one snippet in the following format\n\n';
  
  // Combine: universal header + existing bank-specific prompt
  const fullPrompt = universalHeader + basePrompt;
  
  // Update the hidden textarea
  aiPromptText.value = fullPrompt;
  
  // Update the displayed script name
  currentScriptName.textContent = combinedKey;
  
  // Show visual feedback
  currentScriptName.style.animation = 'none';
  setTimeout(() => {
    currentScriptName.style.animation = 'highlight 0.5s ease';
  }, 10);
}

  // Copy AI Prompt functionality
  copyAiPromptBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(aiPromptText.value).then(() => {
      // Visual feedback
      const originalHTML = copyAiPromptBtn.innerHTML;
      copyAiPromptBtn.classList.add('copied');
      copyAiPromptBtn.innerHTML = '<i class="fas fa-check"></i>';
      
      setTimeout(() => {
        copyAiPromptBtn.classList.remove('copied');
        copyAiPromptBtn.innerHTML = originalHTML;
      }, 2000);
      
      showToast('AI Prompt copied!', 'success');
    }).catch(err => {
      console.error('Failed to copy AI prompt:', err);
      showToast('Failed to copy AI prompt', 'error');
    });
  });

  // Event listeners for bank/type changes
  aiBankSelector.addEventListener('change', (e) => {
    updateAITypeSelector(e.target.value);
    updateAIPrompt();
  });

  document.getElementById('aiTypeSelector').addEventListener('change', updateAIPrompt);

  // Initialize the system
  initializeAIBankSelector();

  // Set up custom select for AI bank selector
  setupAICustomSelect();
}

function setupAICustomSelect() {
  const aiCustomSelect = document.querySelector('.ai-custom-select');
  const aiSelectSelected = document.querySelector('#aiBankSelectorDisplay');
  const aiSelectItems = aiCustomSelect.querySelector('.select-items');
  const aiBankSearch = document.getElementById('aiBankSearch');
  const aiBankSelector = document.getElementById('aiBankSelector');

  // Set initial display
  const currentOption = Array.from(aiBankSelector.options).find(opt => opt.value === aiBankSelector.value);
  if (currentOption) {
    aiSelectSelected.textContent = currentOption.textContent;
  }

  // Toggle dropdown
  aiSelectSelected.addEventListener('click', function(e) {
    e.stopPropagation();
    const isCurrentlyOpen = !aiSelectItems.classList.contains('select-hide');
    closeAllSelect(this);
    
    if (!isCurrentlyOpen) {
      this.classList.add('select-arrow-active');
      aiSelectItems.classList.remove('select-hide');
      setTimeout(() => aiBankSearch.focus(), 10);
    } else {
      this.classList.remove('select-arrow-active');
      aiSelectItems.classList.add('select-hide');
    }
  });

  // Filter options
  aiBankSearch.addEventListener('input', function() {
    const filter = this.value.toLowerCase();
    const options = aiSelectItems.querySelectorAll('option');
    const optgroups = aiSelectItems.querySelectorAll('optgroup');

    options.forEach(option => {
      const text = option.textContent.toLowerCase();
      option.style.display = text.includes(filter) ? 'block' : 'none';
    });

    optgroups.forEach(optgroup => {
      const visibleOptions = Array.from(optgroup.querySelectorAll('option'))
        .some(option => option.style.display !== 'none');
      optgroup.style.display = visibleOptions ? 'block' : 'none';
    });
  });

  // Handle option selection
  aiSelectItems.addEventListener('click', function(e) {
    if (e.target.tagName === 'OPTION') {
      const value = e.target.value;
      const text = e.target.textContent;

      aiSelectSelected.textContent = text;
      aiSelectSelected.classList.remove('select-arrow-active');
      aiSelectItems.classList.add('select-hide');

      aiBankSelector.value = value;
      aiBankSearch.value = '';

      // Reset all options to visible
      const options = aiSelectItems.querySelectorAll('option');
      const optgroups = aiSelectItems.querySelectorAll('optgroup');
      options.forEach(option => option.style.display = 'block');
      optgroups.forEach(optgroup => optgroup.style.display = 'block');

      // Trigger change event
      const event = new Event('change');
      aiBankSelector.dispatchEvent(event);
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!aiCustomSelect.contains(e.target)) {
      aiSelectSelected.classList.remove('select-arrow-active');
      aiSelectItems.classList.add('select-hide');
    }
  });
}

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

// Add highlight animation
const style = document.createElement('style');
style.textContent = `
  @keyframes highlight {
    0% { background-color: transparent; }
    50% { background-color: rgba(59, 130, 246, 0.2); }
    100% { background-color: transparent; }
  }
`;
document.head.appendChild(style);

// Initialize the AI Prompt system when tools menu is shown
function initializeAIPromptWhenReady() {
  const toolsMenu = document.getElementById('toolsMenu');
  if (toolsMenu) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (toolsMenu.classList.contains('show')) {
            setupAIPromptSystem();
            observer.disconnect();
          }
        }
      });
    });
    
    observer.observe(toolsMenu, { attributes: true });
  }
}

// Call this in your DOMContentLoaded
initializeAIPromptWhenReady();

// Setup tool info functionality
function setupToolInfo() {
  const toolInfoModal = document.getElementById('toolInfoModal');
  const toolInfoTitle = document.getElementById('toolInfoTitle');
  const toolInfoDescription = document.getElementById('toolInfoDescription');
  const toolInfoClose = document.getElementById('toolInfoClose');
  
  if (!toolInfoModal) return;
  
  // Close modal when clicking X
  toolInfoClose.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent event bubbling
    toolInfoModal.classList.remove('show');
  });
  
 // Close modal when clicking outside content - FIXED: Only close if clicking the backdrop
toolInfoModal.addEventListener('click', (e) => {
  if (e.target === toolInfoModal) {
    toolInfoModal.classList.remove('show');
    // NEW: Stop the click from bubbling up to the document, which would close the tools menu.
    e.stopPropagation(); 
  }
});
  
  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toolInfoModal.classList.contains('show')) {
      toolInfoModal.classList.remove('show');
      // FIX 1: Stop event from triggering tools menu keydown listener
      e.stopImmediatePropagation(); 
    }
  });
  
  // Prevent clicks inside the modal content from closing the modal
  const toolInfoContent = toolInfoModal.querySelector('.tool-info-content');
  if (toolInfoContent) {
    toolInfoContent.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent click from bubbling to modal backdrop
    });
  }
}

// Add info buttons to tools
function addToolInfoButtons() {
  const toolItems = document.querySelectorAll('.tool-item');
  
  toolItems.forEach(toolItem => {
    // Extract tool key from href
    const link = toolItem.getAttribute('href');
    if (!link) return;
    
    const toolMatch = link.match(/github\.io\/([^\/]+)/);
    if (!toolMatch) return;
    
    const toolKey = toolMatch[1].toLowerCase();
    const toolInfo = toolDescriptions[toolKey];
    
    if (toolInfo) {
      // Create info button
      const infoBtn = document.createElement('button');
      infoBtn.className = 'tool-info-btn';
      infoBtn.innerHTML = '?';
      infoBtn.title = `Learn about ${toolInfo.title}`;
      
      // Add click event
      infoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent triggering tool link
        showToolInfo(toolInfo.title, toolInfo.description);
      });
      
      // Position relative for the absolute positioned button
      toolItem.style.position = 'relative';
      toolItem.appendChild(infoBtn);
    }
  });
}

// Show tool info modal
function showToolInfo(title, description) {
  const toolInfoModal = document.getElementById('toolInfoModal');
  const toolInfoTitle = document.getElementById('toolInfoTitle');
  const toolInfoDescription = document.getElementById('toolInfoDescription');
  
  if (toolInfoModal && toolInfoTitle && toolInfoDescription) {
    toolInfoTitle.textContent = title;
    toolInfoDescription.textContent = description;
    toolInfoModal.classList.add('show');
  }
}

// Call these functions in your DOMContentLoaded event listener
// Add these lines where you initialize other components:
setupToolInfo();

// Also call addToolInfoButtons after the tools menu is created
// You might need to call this after a short delay or when the menu is opened
setTimeout(addToolInfoButtons, 1000);

function setupToolsMenu() {
  const toolArea = document.getElementById('toolArea');
  const toolsMenu = document.getElementById('toolsMenu');
  const toolsMinimizeBtn = toolsMenu?.querySelector('.tools-minimize-btn');
  const toolsCloseBtn = toolsMenu?.querySelector('.tools-close-btn');
  
  if (!toolArea || !toolsMenu || !toolsMinimizeBtn || !toolsCloseBtn) return;
  
  // Add expanded class for the large modal style
  toolsMenu.classList.add('expanded');
  
  // Update button icons for initial state
  updateToolsMenuButtons();
  
  // Toggle tools menu when clicking the tool area
  toolArea.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleToolsMenu();
  });
  
  // Close tools menu when clicking the close button
  toolsCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeToolsMenu();
  });
  
  // Toggle minimize/expand when clicking the minimize button
  toolsMinimizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMinimizeState();
  });
  
  // Close tools menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!toolsMenu.contains(e.target) && !toolArea.contains(e.target)) {
      closeToolsMenu();
    }
  });
  
  // Close tools menu with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toolsMenu.classList.contains('show')) {
      closeToolsMenu();
    }
  });
  
  // Prevent clicks inside the menu from closing it
  toolsMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // Helper function to toggle the menu open/close
  function toggleToolsMenu() {
    if (toolsMenu.classList.contains('show')) {
      closeToolsMenu();
    } else {
      openToolsMenu();
    }
  }
  
  // Helper function to open the tools menu
  function openToolsMenu() {
    toolsMenu.classList.add('show');
    updateToolsMenuButtons();
  }
  
  // Helper function to close the tools menu
  function closeToolsMenu() {
    toolsMenu.classList.remove('show');
    updateToolsMenuButtons();
  }
  
  // Helper function to toggle between expanded and collapsed states
  function toggleMinimizeState() {
    if (toolsMenu.classList.contains('expanded')) {
      // Switch to collapsed state
      toolsMenu.classList.remove('expanded');
      toolsMenu.classList.add('collapsed');
    } else if (toolsMenu.classList.contains('collapsed')) {
      // Switch to expanded state
      toolsMenu.classList.remove('collapsed');
      toolsMenu.classList.add('expanded');
    }
    updateToolsMenuButtons();
  }
  
  // Helper function to update button icons based on menu state
  function updateToolsMenuButtons() {
    const isExpanded = toolsMenu.classList.contains('expanded');
    const isCollapsed = toolsMenu.classList.contains('collapsed');
    const isVisible = toolsMenu.classList.contains('show');
    
    // Update minimize button based on state
    if (isExpanded) {
      toolsMinimizeBtn.innerHTML = '<i class="fas fa-window-minimize"></i>';
      toolsMinimizeBtn.title = 'Minimize';
    } else if (isCollapsed) {
      toolsMinimizeBtn.innerHTML = '<i class="fas fa-window-maximize"></i>';
      toolsMinimizeBtn.title = 'Maximize';
    }
    
    // Close button always stays the same
    toolsCloseBtn.innerHTML = '<i class="fas fa-times"></i>';
    toolsCloseBtn.title = 'Close (Esc)';
    
    // Update tool area indicator
    if (isVisible) {
      toolArea.classList.add('active');
    } else {
      toolArea.classList.remove('active');
    }
  }
}

// Add instruction copy functionality
function setupInstructionCopy() {
  const copyInstructionBtn = document.querySelector('.copy-instruction-btn');
  const instructionText = document.querySelector('.instruction-text');
  
  if (copyInstructionBtn && instructionText) {
    copyInstructionBtn.addEventListener('click', () => {
      const textToCopy = instructionText.textContent.trim();
      
      navigator.clipboard.writeText(textToCopy).then(() => {
        // Visual feedback
        const originalHTML = copyInstructionBtn.innerHTML;
        copyInstructionBtn.classList.add('copied');
        
        setTimeout(() => {
          copyInstructionBtn.classList.remove('copied');
          copyInstructionBtn.innerHTML = originalHTML;
        }, 2000);
        
        showToast('Instruction copied!', 'success');
      }).catch(err => {
        console.error('Failed to copy instruction:', err);
        showToast('Failed to copy instruction', 'error');
      });
    });
  }
}

// Call this function in your DOMContentLoaded event listener
setupInstructionCopy();
// Call this function in your DOMContentLoaded event listener
setupToolsMenu();
// Add this function to initialize the amount sorter
// Enhanced Amount Sorter with Drag and Minimize functionality
function initializeAmountSorter() {
  amountSorterSection = document.getElementById('amountSorterSection');
  keywordInput = document.getElementById('keywordInput');
  sortAmountsBtn = document.getElementById('sortAmountsBtn');
  const minimizeBtn = amountSorterSection?.querySelector('.minimize-btn');
  
  if (!amountSorterSection || !keywordInput || !sortAmountsBtn || !minimizeBtn) return;
  
  // Add event listeners
  sortAmountsBtn.addEventListener('click', sortAmountsByKeyword);
  minimizeBtn.addEventListener('click', toggleMinimize);
  
  // Initialize drag functionality
  initializeDragFunctionality();
}

function initializeDragFunctionality() {
  const header = amountSorterSection.querySelector('.amount-sorter-header');
  let isDragging = false;
  let startX, startY, startLeft, startTop;

  header.addEventListener('mousedown', startDrag);
  
  function startDrag(e) {
    if (e.target.closest('.minimize-btn')) return; // Don't drag when clicking minimize button
    
    isDragging = true;
    amountSorterSection.classList.add('dragging');
    
    // Get initial positions
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseInt(getComputedStyle(amountSorterSection).left) || 0;
    startTop = parseInt(getComputedStyle(amountSorterSection).top) || 0;
    
    // Prevent text selection during drag
    e.preventDefault();
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
  }
  
  function drag(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    // Calculate new position with boundary constraints
    const newLeft = Math.max(10, Math.min(window.innerWidth - amountSorterSection.offsetWidth - 10, startLeft + deltaX));
    const newTop = Math.max(10, Math.min(window.innerHeight - amountSorterSection.offsetHeight - 10, startTop + deltaY));
    
    amountSorterSection.style.left = `${newLeft}px`;
    amountSorterSection.style.top = `${newTop}px`;
    amountSorterSection.style.right = 'auto';
    amountSorterSection.style.bottom = 'auto';
  }
  
  function stopDrag() {
    isDragging = false;
    amountSorterSection.classList.remove('dragging');
    
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
    
    // Save position to localStorage
    saveAmountSorterPosition();
  }
}



function toggleMinimize() {
  const isMinimized = amountSorterSection.classList.contains('minimized');
  const minimizeBtn = amountSorterSection.querySelector('.minimize-btn');

  if (isMinimized) {
    // Expand
    amountSorterSection.classList.remove('minimized');
    minimizeBtn.innerHTML = '<i class="fas fa-window-minimize"></i>';
    minimizeBtn.title = 'Minimize';
    
    // Restore the last known position
    amountSorterSection.style.left = lastAmountSorterPosition.left;
    amountSorterSection.style.top = lastAmountSorterPosition.top;
    amountSorterSection.style.right = lastAmountSorterPosition.right;
    amountSorterSection.style.bottom = lastAmountSorterPosition.bottom;

  } else {
    // Minimize
    
    // First, save the current position before minimizing
    lastAmountSorterPosition.left = amountSorterSection.style.left;
    lastAmountSorterPosition.top = amountSorterSection.style.top;
    lastAmountSorterPosition.right = amountSorterSection.style.right;
    lastAmountSorterPosition.bottom = amountSorterSection.style.bottom;
    
    // Now apply the minimized styles
    amountSorterSection.classList.add('minimized');
    minimizeBtn.innerHTML = '<i class="fas fa-expand"></i>';
    minimizeBtn.title = 'Expand';
    
    // Move to a fixed location when minimized
    amountSorterSection.style.right = '20px';
    amountSorterSection.style.bottom = '30px';
    amountSorterSection.style.left = 'auto';
    amountSorterSection.style.top = 'auto';
  }
}

function saveAmountSorterPosition() {
  if (amountSorterSection.classList.contains('minimized')) return;
  
  const position = {
    left: amountSorterSection.style.left,
    top: amountSorterSection.style.top,
    right: amountSorterSection.style.right,
    bottom: amountSorterSection.style.bottom
  };
  
  localStorage.setItem('amountSorterPosition', JSON.stringify(position));
}

function restoreAmountSorterPosition() {
  const savedPosition = localStorage.getItem('amountSorterPosition');
  
  if (savedPosition) {
    const position = JSON.parse(savedPosition);
    amountSorterSection.style.left = position.left;
    amountSorterSection.style.top = position.top;
    amountSorterSection.style.right = position.right;
    amountSorterSection.style.bottom = position.bottom;
  } else {
    // Default position (bottom right)
    amountSorterSection.style.right = '20px';
    amountSorterSection.style.bottom = '30px';
    amountSorterSection.style.left = 'auto';
    amountSorterSection.style.top = 'auto';
  }
}

// Update the toggleAmountSorter function to restore position
function toggleAmountSorter(show) {
  if (amountSorterSection) {
    if (show) {
      amountSorterSection.style.display = 'block';
      // Restore position when showing
      setTimeout(() => {
        restoreAmountSorterPosition();
      }, 10);
    } else {
      amountSorterSection.style.display = 'none';
    }
  }
}

// Add this function to show/hide the amount sorter
function toggleAmountSorter(show) {
  if (amountSorterSection) {
    amountSorterSection.style.display = show ? 'block' : 'none';
  }
}

// Add this function to sort amounts by keyword
function sortAmountsByKeyword() {
  const table = document.querySelector('#output table');
  if (!table) {
    showToast('No table found!', 'error');
    return;
  }
  
  const keyword = keywordInput.value.trim().toLowerCase();
  if (!keyword) {
    showToast('Please enter a keyword!', 'error');
    keywordInput.focus();
    return;
  }
  
  const amountType = document.querySelector('input[name="amountType"]:checked').value;
  
  // Find the column indices
  const headerRow = table.rows[0];
  const headers = Array.from(headerRow.cells).map(cell => cell.textContent.trim());
  const descriptionIndex = headers.findIndex(header => header.toLowerCase() === 'description');
  const drIndex = headers.findIndex(header => header === 'DR');
  const crIndex = headers.findIndex(header => header === 'CR');
  
  if (descriptionIndex === -1) {
    showToast('Description column not found!', 'error');
    return;
  }
  
  if (drIndex === -1 && crIndex === -1) {
    showToast('DR/CR columns not found!', 'error');
    return;
  }
  
  saveState(); // Save state before sorting
  
  let movedCount = 0;
  
  // Process each data row
  for (let i = 1; i < table.rows.length; i++) {
    const row = table.rows[i];
    const descriptionCell = row.cells[descriptionIndex];
    const description = descriptionCell.textContent.toLowerCase();
    
    // Check if description contains the keyword
    if (description.includes(keyword)) {
      const drCell = drIndex !== -1 ? row.cells[drIndex] : null;
      const crCell = crIndex !== -1 ? row.cells[crIndex] : null;
      
      // Get the amount value (check both DR and CR columns)
      let amount = '';
      let currentColumn = '';
      
      if (drCell && drCell.textContent.trim() !== '') {
        amount = drCell.textContent.trim();
        currentColumn = 'DR';
      } else if (crCell && crCell.textContent.trim() !== '') {
        amount = crCell.textContent.trim();
        currentColumn = 'CR';
      }
      
      // If amount exists and needs to be moved to different column
      if (amount && currentColumn !== amountType) {
        // Clear current column
        if (currentColumn === 'DR' && drCell) {
          drCell.textContent = '';
        } else if (currentColumn === 'CR' && crCell) {
          crCell.textContent = '';
        }
        
        // Move to target column
        if (amountType === 'DR' && drCell) {
          drCell.textContent = amount;
        } else if (amountType === 'CR' && crCell) {
          crCell.textContent = amount;
        }
        
        movedCount++;
      }
    }
  }
  
  if (movedCount > 0) {
    showToast(`Moved ${movedCount} transaction(s) to ${amountType}`, 'success');
    updateTransactionCounts(); // Update the transaction counts
  } else {
    showToast(`No transactions found with keyword "${keyword}" or amounts already in correct column`, 'info');
  }
}

// Add this function call to your DOMContentLoaded event listener, right after setupFileUpload():
initializeAmountSorter();

// Modify the convertBtn event listener to show the amount sorter after conversion
// Find this section in your existing code and add the toggleAmountSorter(true) call:
convertBtn.addEventListener('click', async () => {
  const input = inputText.value.trim();
  if (!input && uploadedFilesData.length === 0) {
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
      updateTransactionCounts();
      
      // Show the amount sorter after successful conversion
      toggleAmountSorter(true);
      
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

  // Fix the reversed scrolling issue
  selectItems.addEventListener('wheel', function(e) {
    // Allow normal scrolling behavior
    this.scrollTop += e.deltaY;
    
    // Prevent the event from bubbling up and causing page scroll
    e.stopPropagation();
    
    // Only prevent default if we're actually scrolling the dropdown
    if (this.scrollHeight > this.clientHeight) {
      e.preventDefault();
    }
  });
}



// Call this function in your DOMContentLoaded event listener
// Add this line where you initialize other components:
setupCustomSelect();

function shouldShowPDFUpload(bankKey) {
  // List of bank combinations where PDF upload should be hidden
  const restrictedBanks = [
      // Add more bank keys here as needed
      'tdHistory', 'tdinPerson'
  ];
  return !restrictedBanks.includes(bankKey);
}

  
function showSampleStatement() {
    const bankKey = getCombinedKey();
    sampleImage.src = `images/${bankKey}.png`;
    imageModal.classList.add('show');
    
    // Reset zoom state and styles when modal opens
    sampleImage.classList.remove('zoomed-in');
    imageModal.querySelector('.image-modal-content').classList.remove('zoomed');
    sampleImage.style.transformOrigin = '';
    sampleImage.style.transform = ''; // <-- This is the new, crucial line to reset the transform
    
    let isZoomed = false;
    let currentZoom = 2; // Initial zoom level on first click
    const minZoom = 1;
    const maxZoom = 5;
    
    const imageContent = imageModal.querySelector('.image-modal-content');

    const zoomHandler = (e) => {
      if (!isZoomed) return;
      
      const { left, top, width, height } = sampleImage.getBoundingClientRect();
      const x = (e.clientX - left) / width * 100;
      const y = (e.clientY - top) / height * 100;
      sampleImage.style.transformOrigin = `${x}% ${y}%`;
    };
    
    const clickHandler = () => {
      isZoomed = !isZoomed;
      if (isZoomed) {
        sampleImage.classList.add('zoomed-in');
        imageContent.classList.add('zoomed');
        sampleImage.style.transform = `scale(${currentZoom})`;
      } else {
        sampleImage.classList.remove('zoomed-in');
        imageContent.classList.remove('zoomed');
        sampleImage.style.transform = `scale(1)`;
      }
    };

    const scrollHandler = (e) => {
      e.preventDefault(); // Prevents page from scrolling
      if (!isZoomed) return;

      const delta = e.deltaY * -0.01; // Adjust sensitivity
      currentZoom = Math.min(Math.max(minZoom, currentZoom + delta), maxZoom);
      sampleImage.style.transform = `scale(${currentZoom})`;

      // Recalculate origin for smooth zoom
      zoomHandler(e);
    };
    
    // Add event listeners for the new functionality
    imageContent.addEventListener('mousemove', zoomHandler);
    imageContent.addEventListener('click', clickHandler);
    imageContent.addEventListener('wheel', scrollHandler);
    
    // Function to remove event listeners and clean up
    const cleanupModal = () => {
      imageContent.removeEventListener('mousemove', zoomHandler);
      imageContent.removeEventListener('click', clickHandler);
      imageContent.removeEventListener('wheel', scrollHandler);
      imageModal.removeEventListener('click', outsideClickHandler);
      document.removeEventListener('keydown', escKeyHandler);
      closeModal.removeEventListener('click', closeModalHandler);
    };

    // New event handler functions to allow cleanup
    const outsideClickHandler = (e) => {
      if (e.target === imageModal) {
        closeSampleStatement();
      }
    };
    const escKeyHandler = (e) => {
      if (e.key === 'Escape' && imageModal.classList.contains('show')) {
        closeSampleStatement();
      }
    };
    const closeModalHandler = () => {
      closeSampleStatement();
    };

    // Add new event listeners
    imageModal.addEventListener('click', outsideClickHandler);
    document.addEventListener('keydown', escKeyHandler);
    closeModal.addEventListener('click', closeModalHandler);
    
    // Override the original close function to include cleanup
    window.closeSampleStatement = () => {
      imageModal.classList.remove('show');
      cleanupModal();
    };
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
      coastcapital: ['account'],
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
      walmart: ['card'],
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
  });

  ['dragleave', 'drop'].forEach(eventName => {
    if (dropArea) dropArea.addEventListener(eventName, unhighlight, false);
  });

  // Make drop area clickable to trigger file input
  if (dropArea) {
    dropArea.addEventListener('click', () => {
      pdfUpload.click();
    });
  }

  // Handle dropped files
  if (dropArea) dropArea.addEventListener('drop', handleDrop, false);
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

  async function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles({ target: { files } });
  }

  async function handleFiles(e) {
    const files = e.target.files;
    if (!files.length) return;

    fileListContainer.style.display = 'block';
    let pdfFilesProcessed = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf') {
        showToast("Please upload a PDF file!", "error");
        fileListContainer.style.display = 'none';
        continue;
      }

      const existingFile = uploadedFilesData.find(f => f.file.name === file.name && f.file.size === file.size);
      if (existingFile) {
        showToast(`File "${file.name}" is already uploaded.`, "info");
        continue;
      }

      const fileItem = createFileItem(file);
      fileList.appendChild(fileItem);

      try {
        const processedText = await window.bankUtils.processPDFFile(file);
        uploadedFilesData.push({ file: file, text: processedText, element: fileItem });
        pdfFilesProcessed = true;
      } catch (error) {
        console.error('Error processing PDF:', error);
        showToast(`Error processing ${file.name}`, "error");
        fileItem.remove();
      }
    }

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

  function removeFileItem(fileItemToRemove) {
    uploadedFilesData = uploadedFilesData.filter(item => item.element !== fileItemToRemove);
    fileItemToRemove.remove();
    if (uploadedFilesData.length === 0) {
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

      fileList.insertBefore(currentItem, direction === -1 ? targetItem : targetItem.nextSibling);

      const [removed] = uploadedFilesData.splice(currentIndex, 1);
      uploadedFilesData.splice(newIndex, 0, removed);

      refreshInputTextFromFiles();
    }
  }

  function clearAllUploadedFiles() {
    fileList.innerHTML = '';
    inputText.value = '';
    uploadedFilesData = [];
    fileListContainer.style.display = 'none';
    showToast('All uploaded files cleared!', 'success');
  }

  function refreshInputTextFromFiles() {
    let combinedText = '';
    uploadedFilesData.forEach((item, index) => {
      if (item.text) {
        combinedText += item.text;
        if (index < uploadedFilesData.length - 1) {
          combinedText += '\n\n';
        }
      }
    });
    inputText.value = combinedText;
    showToast('Input text refreshed!', 'info');
  }

  // Initialize Sortable for file list reordering
  new Sortable(fileList, {
    animation: 150,
    handle: '.file-item-name',
    ghostClass: 'dragging',
    onEnd: (evt) => {
      const oldIndex = evt.oldIndex;
      const newIndex = evt.newIndex;

      const [removed] = uploadedFilesData.splice(oldIndex, 1);
      uploadedFilesData.splice(newIndex, 0, removed);

      refreshInputTextFromFiles();
    }
  });
}

function setupBankSpecificMessages() {
  const bankKey = getCombinedKey();
  
  // Remove any existing messages
  const existingMessage = document.querySelector('.bank-specific-message');
  if (existingMessage) {
    existingMessage.remove();
  }

  // PDF Upload Only banks
  const pdfOnlyBanks = ['boaCard', 'amexCard', 'craHistory', 'craPayroll'];
  
  // Image Script banks  
  const imageScriptBanks = ['tdHistory', 'tdinPerson', 'coastcapitalAccount'];

  if (pdfOnlyBanks.includes(bankKey)) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'bank-specific-message pdf-upload-only';
    messageDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> PDF Upload Only!';
    
    // Insert after the method indicator
    const methodIndicator = document.getElementById('methodIndicator');
    if (methodIndicator && methodIndicator.parentNode) {
      methodIndicator.parentNode.insertBefore(messageDiv, methodIndicator.nextSibling);
    }
  } else if (imageScriptBanks.includes(bankKey)) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'bank-specific-message image-script';
    messageDiv.innerHTML = '<i class="fas fa-camera"></i> Image Script - Use AI';
    
    // Insert after the method indicator
    const methodIndicator = document.getElementById('methodIndicator');
    if (methodIndicator && methodIndicator.parentNode) {
      methodIndicator.parentNode.insertBefore(messageDiv, methodIndicator.nextSibling);
    }
  }
}

// Call the function in appropriate places
setupBankSpecificMessages(); // Initial call

// Also call when bank/type changes
document.getElementById('bankSelector').addEventListener('change', setupBankSpecificMessages);
typeSelector.addEventListener('change', setupBankSpecificMessages);

// Call the function in appropriate places
setupBankSpecificMessages(); // Initial call

// Also call when bank/type changes
document.getElementById('bankSelector').addEventListener('change', setupBankSpecificMessages);
typeSelector.addEventListener('change', setupBankSpecificMessages);

// Call the function in appropriate places
setupBankSpecificMessages(); // Initial call

// Also call when bank/type changes
document.getElementById('bankSelector').addEventListener('change', setupBankSpecificMessages);
typeSelector.addEventListener('change', setupBankSpecificMessages);

// Call the function in appropriate places
setupBankSpecificMessages(); // Initial call

// Also call when bank/type changes
document.getElementById('bankSelector').addEventListener('change', setupBankSpecificMessages);
typeSelector.addEventListener('change', setupBankSpecificMessages);

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

  // Find the indices of columns to exclude
  const headerCells = Array.from(rows[0].cells);
  const balanceColIndex = headerCells.findIndex(cell => cell.textContent.trim().toLowerCase() === 'balance');
  const categoryColIndex = headerCells.findIndex(cell => cell.textContent.trim().toLowerCase() === 'category');

  const content = rows.slice(1).map(row => // Start from the second row (skip header)
    Array.from(row.cells)
    .filter((cell, index) => {
      // Ignore the first column (#), balance column, AND category column
      return index !== 0 && 
             (balanceColIndex === -1 || index !== balanceColIndex) &&
             (categoryColIndex === -1 || index !== categoryColIndex);
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

    // --- FIXED: Process date column to keep only the first date ---
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
                
                // NEW LOGIC: Handle different date formats
                let newDate = '';
                
                // Check for DD-MMM-YYYY format (like "31-Dec-2022")
                const ddMmmYyyyMatch = dateText.match(/^(\d{1,2}-[A-Za-z]{3}-\d{4})/);
                if (ddMmmYyyyMatch) {
                    newDate = ddMmmYyyyMatch[1]; // Keep "31-Dec-2022"
                } 
                // Check for MMM DD YYYY format (like "Jan 03 2023")
                else if (dateText.match(/^[A-Za-z]{3} \d{1,2} \d{4}/)) {
                    const parts = dateText.split(/\s+/);
                    newDate = `${parts[0]} ${parts[1]} ${parts[2]}`; // Keep "Jan 03 2023"
                }
                // Check for MM/DD/YYYY format
                else if (dateText.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
                    const parts = dateText.split(/\s+/);
                    newDate = parts[0]; // Keep "01/03/2023"
                }
                // Check for MMM DD format (like "Jan 03" without year)
                else if (dateText.match(/^[A-Za-z]{3} \d{1,2}/)) {
                    const parts = dateText.split(/\s+/);
                    newDate = `${parts[0]} ${parts[1]}`; // Keep "Jan 03"
                }
                // If no recognized format, keep the original text
                else {
                    newDate = dateText;
                }
                
                dateCell.textContent = newDate;
            }
        }
    }
    // --- END FIXED DATE PROCESSING ---

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

// ======== METHOD INDICATOR ======== //
window.bankUtils.allocationMethods = {
 // Big 5
 'bmoAccount':'Balance',
 'bmoCard':'CR Marker',
 'bmoLoc':'CR Marker',
 'cibcAccount':'Balance',
 'cibcCard':'-ve Marker',
 'rbcAccount':'Keywords/Balance',
 'rbcCard':'-ve Marker',
 'rbcLoc':'-ve Marker',
 'scotiaAccount':'Balance',
 'scotiaCard':'-ve Marker',
 'tdAccount':'Balance/Keywords',
 'tdCard':'-ve Marker',
 'tdinPerson':'Balance',
 'tdHistory':'DR/CR Marker',
 // Others
 'cdtCard':'-ve Marker',
 'coastcapitalAccount':'Balance',
 'craHistory':'CR Marker',
 'craPayroll':'DR/CR Marker',
 'eqCard':'-ve Marker',
 'firstontarioAccount':'Balance',
 'meridianAccount':'-ve Marker (reversed)',
 'nbcAccount':'Balance',
 'nbcCard':'-ve Marker',
 'simpliiAccount':'Balance',
 'tangerineAccount':'Brackets Marker',
 'triangleCard':'-ve Marker',
 'walmartCard':'-ve Marker',
 // U.S.
 'amexCard':'-ve Marker',
 'boaCard':'-ve Marker',
 'wellsfargoAccount':'Keywords'
};

function updateMethodIndicator() {
  const method = window.bankUtils.allocationMethods[getCombinedKey()] || 'Unknown';
  document.getElementById('methodText').textContent = method;
}

// Call this whenever bank/type changes - add these 3 lines at the very end of DOMContentLoaded
document.getElementById('bankSelector').addEventListener('change', updateMethodIndicator);
typeSelector.addEventListener('change', updateMethodIndicator);
updateMethodIndicator(); // Initial call
// ======== END METHOD INDICATOR ======== //

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

// Add this function to handle the refresh action
function setupRefreshButton() {
  const refreshBtn = document.getElementById('refreshBtn');
  const refreshModal = document.getElementById('refreshModal');
  const refreshModalClose = document.querySelector('.refresh-modal-close');
  const refreshConfirmYes = document.getElementById('refreshConfirmYes');
  const refreshConfirmNo = document.getElementById('refreshConfirmNo');

  if (!refreshBtn) return;

  // Show confirmation modal when refresh button is clicked
  refreshBtn.addEventListener('click', () => {
    refreshModal.style.display = 'flex';
    setTimeout(() => {
      refreshModal.classList.add('show');
    }, 10);
  });

  // Close modal when X is clicked
  refreshModalClose.addEventListener('click', () => {
    refreshModal.classList.remove('show');
    setTimeout(() => {
      refreshModal.style.display = 'none';
    }, 300);
  });

  // Close modal when No is clicked
  refreshConfirmNo.addEventListener('click', () => {
    refreshModal.classList.remove('show');
    setTimeout(() => {
      refreshModal.style.display = 'none';
    }, 300);
  });

  // Refresh page when Yes is clicked
  refreshConfirmYes.addEventListener('click', () => {
    // Clear any unsaved data if needed
    localStorage.removeItem('amountSorterPosition');
    
    // Perform the actual refresh
    window.location.reload();
  });

  // Close modal when clicking outside
  refreshModal.addEventListener('click', (e) => {
    if (e.target === refreshModal) {
      refreshModal.classList.remove('show');
      setTimeout(() => {
        refreshModal.style.display = 'none';
      }, 300);
    }
  });

  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && refreshModal.classList.contains('show')) {
      refreshModal.classList.remove('show');
      setTimeout(() => {
        refreshModal.style.display = 'none';
      }, 300);
    }
  });

  // Handle Enter key press to confirm (select 'Yes')
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && refreshModal.classList.contains('show')) {
      // Prevent the default action (like submitting a form if one is focused)
      e.preventDefault(); 
      // Programmatically click the 'Yes' button
      refreshConfirmYes.click();
    }
  });
}

// Call this function in your DOMContentLoaded event listener
// Add this line where you initialize other components:
setupRefreshButton();
initializeAIPromptWhenReady();

});
