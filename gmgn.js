const { createWorker } = Tesseract;
const worker = await createWorker('eng');

var timeCanvases = null;
var leftPanelElement = null;
var saveTopPnlButton = null;
var saveTopHolderButton = null;
var fromTsInput = null;
var toTsInput = null;

// ================================================ Utils
function showToast(message, duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        Object.assign(container.style, {
            position: 'fixed',
            top: '45px',
            left: '400px',
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: '10px',
            zIndex: 9999
        });
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.innerText = message;
    Object.assign(toast.style, {
        backgroundColor: '#333',
        color: '#fff',
        padding: '10px 20px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        fontSize: '14px',
        opacity: 0,
        transition: 'opacity 0.3s ease'
    });

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = 1;
    });

    setTimeout(() => {
        toast.style.opacity = 0;
        toast.addEventListener('transitionend', () => {
            toast.remove();
            if (container.childElementCount === 0) {
                container.remove();
            }
        });
    }, duration);
}

function appendSecondToDateString(dateString, start) {
    switch (dateString.length) {
        case 7:
            if (start) {
                return dateString + '000000';
            } else {
                return dateString + '235959';
            }
        case 11:
            if (start) {
                return dateString + '00'
            } else {
                return dateString + '59'
            }
        default:
            return dateString;
    }
    
}

function convertToTimestamp(dateString) {
    const datePattern = /(\d{2})(\w{3})(\d{2})(\d{2})(\d{2})(?:(\d{2}))?/;
    const match = dateString.match(datePattern);
    if (!match) {
        console.error("Invalid date format:", dateString);
        return null;
    }
    const [_, day, month, year, hour, minute, second] = match;
    const fullYear = parseInt(year, 10) + 2000;
    const monthMap = {
        "jan": 0, "feb": 1, "mar": 2, "apr": 3, "may": 4, "jun": 5,
        "jul": 6, "aug": 7, "sep": 8, "oct": 9, "nov": 10, "dec": 11
    };
    const monthIndex = monthMap[month];
    if (monthIndex === undefined) {
        console.error("Invalid month:", month);
        return null;
    }
    const sec = second ? parseInt(second, 10) : 0;
    const date = new Date(Date.UTC(fullYear, monthIndex, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10), sec));
    date.setUTCHours(date.getUTCHours() - 7);
    return Math.floor(date.getTime() / 1000);
}

function formatDate(timestamp) {
    var date = new Date(timestamp * 1000);
    return date.toLocaleString('en-GB', { 
        timeZone: 'Asia/Ho_Chi_Minh',
        // year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

function round(value, decimals) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}

async function waitUtils(condition, timeout) {
    return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
            if (condition()) {
                clearInterval(interval);
                resolve();
            }
        }, 1000);

        setTimeout(() => {
            clearInterval(interval);
            reject(new Error('Timeout waiting for condition'));
        }, timeout);
    });
}

// ================================================ HTML Utils
function addStyleToHead(css) {
    const style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);
}

function setupLeftContainer(element) {
    // let width = '400px';
    // element.innerHTML = '';
    // element.style.width = width;
    // element.parentElement.style.width = width;
    // element.parentElement.parentElement.style.width = width;
    element.style.fontSize = '10px';
    element.style.overflowY = 'scroll';
    element.style.overflowX = 'hidden';
}

function setupHeaderStyle(element) {
    element.style.width = '100%';
    element.style.height = '30px';
    element.style.color = 'white';
    element.style.paddingLeft = '10px';
}

function createButton(id, title) {
    let button = document.createElement('button');
    button.id = id;
    button.innerHTML = title;
    button.style.border = "1px solid white";
    button.style.padding = "2px";
    return button;
}

function createInputText(id) {
    let input = document.createElement('input');
    input.id = id;
    input.type = 'text';
    input.style.border = "1px solid white";
    input.style.padding = "2px";
    input.style.width = '85px';
    input.style.height = '20px';
    input.style.color = 'white';
    input.style.backgroundColor = '#2b2d33';
    input.style.fontSize = '10px';
    input.style.marginLeft = '2px';
    input.classList.add('custom-placeholder');
    return input;
}

function createHeaderPanel() {
    let header = document.createElement('div');
    header.id = 'action-header';
    setupHeaderStyle(header);

    saveTopSoonButton = createButton('save-top-soon-btn', `💾 #Soon`)
    saveTopSoonButton.onclick = handleSaveTopSoonButton
    header.appendChild(saveTopSoonButton);

    saveTopPnlButton = createButton('save-top-pnl-btn', `💾 #PNLs`)
    saveTopPnlButton.onclick = handleSaveTopPnlButton
    header.appendChild(saveTopPnlButton);

    saveTopHolderButton = createButton('save-top-holder-btn', `💾 #Holders`)
    saveTopHolderButton.onclick = handleSaveTopHolderButton
    header.appendChild(saveTopHolderButton);

    fromTsInput = createInputText('from-ts');
    fromTsInput.placeholder = 'Type \"s\" to fill';
    header.appendChild(fromTsInput);

    toTsInput = createInputText('to-ts');
    toTsInput.placeholder = 'Type \"e\" to fill';;
    header.appendChild(toTsInput);

    let filterButton = createButton('filter-btn', `lọc`);
    filterButton.style.marginLeft = '2px';
    filterButton.onclick = handleTapCustomFilter;
    header.appendChild(filterButton);

    return header;
}

function createLeftPanel() {
    let element = document.createElement('div');
    element.id = 'left-panel';
    element.style.width = '100%';
    element.style.height = '100%';
    element.style.color = 'white';
    element.style.fontSize = '11px';
    element.style.paddingLeft = '10px';
    return element;
}

// ================================================ Networks
async function postWallets(chain, wallets) {
    let chainValue = chain === 'solana' ? 'sol' : chain;

    const formData = new URLSearchParams();
    formData.append('chain', chainValue);
    for (let i = 0; i < wallets.length; i++) {
        formData.append(`items`, wallets[i]);
    }
    try {
        const response = await fetch('https://xbase.site/wls/add-wallet-redis-manual', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.text();
        showToast(`✅ ${result} wallets saved!`);
        return result;
    } catch (error) {
        showToast(`❌ Error posting wallets: ${error}`);
        throw error;
    }
}

async function fetchTransactions(chain, tokenId, timestamp, timestampAtLater) {
    var amount = 100;
    var fetchUrl = null;
    
    if (chain === 'base' || chain == 'eth') fetchUrl = `https://gmgn.ai/api/v1/token_trades/${chain}/${tokenId}?limit=${amount}&from=${timestamp}&to=${timestampAtLater}&revert=false`;
    else fetchUrl = `https://gmgn.ai/vas/api/v1/token_trades/${chain}/${tokenId}?limit=${amount}&from=${timestamp}&to=${timestampAtLater}&revert=false`;;
    
    console.log("Fetch URL: " + fetchUrl);
    var allItems = [];
    let items = await fetch(fetchUrl).then(response => response.json()).then(data => data.data.history);
    if (items.length === 0) {
        addLog('❌ No items found');
        return [];
    }

    addLog(`+${items.length} items..`);
    allItems.push(...items);
    let toTimestamp = items[items.length - 1].timestamp;
    while (true) {

        if (chain === 'base' || chain == 'eth') fetchUrl = `https://gmgn.ai/api/v1/token_trades/${chain}/${tokenId}?limit=${amount}&from=${timestamp}&to=${toTimestamp}&revert=false`;
        else fetchUrl = `https://gmgn.ai/vas/api/v1/token_trades/${chain}/${tokenId}?limit=${amount}&from=${timestamp}&to=${toTimestamp}&revert=false`;
        items = await fetch(fetchUrl).then(response => response.json()).then(data => data.data.history);
        if (items.length === 0) {
            break;
        }
        addLog(`+${items.length} items..`);
        allItems.push(...items);
        if (toTimestamp === items[items.length - 1].timestamp) {
            break;
        }
        toTimestamp = items[items.length - 1].timestamp;
    }
    allItems = allItems.reverse();
    return allItems;
}

async function fetchTopPnlTraders(chain, tokenId) {
    const fetchUrl = `https://gmgn.ai/vas/api/v1/token_traders/${chain}/${tokenId}?limit=100&orderby=realized_profit&direction=desc`;
    const response = await fetch(fetchUrl);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log("#pnls", data);
    return data.data.list;
}

async function fetchTopHolders(chain, tokenId) {
    const fetchUrl = `https://gmgn.ai/vas/api/v1/token_holders/${chain}/${tokenId}?limit=100&cost=20&orderby=amount_percentage&direction=desc`;
    const response = await fetch(fetchUrl);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log("#holders", data);
    return data.data.list;
}

async function fetchTopSoon(chain, tokenId) {
    var fetchUrl = `https://gmgn.ai/vas/api/v1/token_trades/${chain}/${tokenId}?os=web&limit=100&maker=&revert=true`;
    if(chain == 'eth' || chain == 'base') fetchUrl = `https://gmgn.ai/api/v1/token_trades/${chain}/${tokenId}?os=web&limit=100&maker=&revert=true`;
    const response = await fetch(fetchUrl);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log("#soon", data);
    return data.data.history;
}

// ================================================ Other reusable functions
function addLog(message) {
    leftPanelElement.innerHTML += message + ' ';
}

function cropTransparent(image) {
    return new Promise((resolve) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        let top = canvas.height, bottom = 0, left = canvas.width, right = 0;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                let alpha = pixels[(y * canvas.width + x) * 4 + 3];
                if (alpha > 0) {
                    if (x < left) left = x;
                    if (x > right) right = x;
                    if (y < top) top = y;
                    if (y > bottom) bottom = y;
                }
            }
        }

        if (right < left || bottom < top) {
            resolve(null);
            return;
        }

        const newWidth = right - left + 1;
        const newHeight = bottom - top + 1;
        const croppedCanvas = document.createElement("canvas");
        const croppedCtx = croppedCanvas.getContext("2d");

        croppedCanvas.width = newWidth;
        croppedCanvas.height = newHeight;
        croppedCtx.drawImage(
            canvas,
            left, top, newWidth, newHeight,
            0, 0, newWidth, newHeight
        );

        resolve(croppedCanvas.toDataURL("image/png"));
    });
}

function extractChainAndTokenId(url) {
    const processedUrl = url.split('?')[0];
    if (processedUrl.indexOf("token") >= 0) {
        const urlParts = processedUrl.split('/');
        const tokenId = urlParts.pop().split('_').pop();
        urlParts.pop();
        const chain = urlParts.pop();
        return {
            chain: chain,
            tokenId: tokenId
        };
    }
    return null;
}

async function canvasToTextUsingTesseract(canvas) {
    const croppedCanvas = await cropTransparent(canvas);
    if (croppedCanvas === null) {
        console.error("Cropped canvas is null");
        return null;
    }
    // console.log("❇️ ❇️ ❇️", croppedCanvas);
    const { data: { text } } = await worker.recognize(croppedCanvas);
    return text;
}

function getTradingViewFrame() {
    var iframes = document.getElementsByTagName('iframe');
    for (var i = 0; i < iframes.length; i++) {
        var iframe = iframes[i];
        if (iframe.id.includes('tradingview_')) {
            return iframe;
        }
    }
    return null;
}

function renderHtmlTable(items, chain) {

    //list ví mua theo cụm
    
    bgroup = bgroup.split('\n');
    // console.log("bgroup", bgroup);


    var html = `
    <table style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
            <tr style="border-bottom: 2px solid #2b2d33;">
                <th style="border: 1px solid #2b2d33; width: 90px; padding-left: 10px;">Date</th>
                <th style="border: 1px solid #2b2d33; text-align: center;">Maker</th>
                <th style="border: 1px solid #2b2d33; text-align: center;">Type</th>
                <th style="border: 1px solid #2b2d33; text-align: right;">$Buy</th>
                <th style="border: 1px solid #2b2d33; text-align: right;">$Pnl</th>
                <th style="border: 1px solid #2b2d33; text-align: center; width: 53px;">Tx</th>
            </tr>
        </thead>
        <tbody>
    `;

    //lấy ra maker để hightlight
    const parsedUrl = new URL(window.location);
    const urlMaker = parsedUrl.searchParams.get("wl");
    const refcpy = parsedUrl.searchParams.get("ref");
    console.log("urlMaker", urlMaker);


    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        item.unrealized_profit = parseFloat(item.unrealized_profit);
        item.realized_profit = parseFloat(item.realized_profit);
        var maker = item.maker;
        var makerShort = maker.substring(0, 3) + '...' + maker.substring(maker.length - 4);
        if(maker == refcpy) makerShort+= " 👥";
        if(maker == urlMaker) makerShort+= " 🔹";
        if(bgroup.includes(maker)) makerShort+= " ⚠️"; //nếu là ví mua cụm
        var formattedDate = formatDate(item.timestamp);
        var textColor = item.realized_profit < 0 ? '#e26d81':'#5dbd6c';
        var eventTextColor = item.event == 'buy' ? 'green':'red';
        var tx = item.tx_hash;
        var baseTx = '';
        if (chain === 'bsc') {
            baseTx = 'https://bscscan.com/tx';
        }else if (chain === 'sol') {
            baseTx = 'https://solscan.io/tx';
        }else if (chain === 'eth') {
            baseTx = 'https://etherscan.io/tx';
        }else if (chain === 'base') {
            baseTx = 'https://basescan.org/tx';
        }

        html += `
            <tr style="border-bottom: 1px solid #2b2d33;">
                <td style="border: 1px solid #2b2d33; padding-left: 5px;"> ${formattedDate}</td>
                <td style="border: 1px solid #2b2d33; padding-left: 4px;">
                    <a href="https://gmgn.ai/${chain}/address/${item.maker}" target="_blank">${makerShort}</a>
                    <span style="float: right;">${replaceText(item.maker_token_tags.toString())}</span>
                </td>
                <td style="border: 1px solid #2b2d33; text-align: center; color: ${eventTextColor}; font-weight: bold;">${item.event.substring(0,1)}</td>
                <td style="border: 1px solid #2b2d33; text-align: right;">${prettyPrintNum(item.amount_usd)}</td>
                <td style="border: 1px solid #2b2d33; text-align: right; ">
                    <span style="float: left; opacity: 0.8;">${ (item.unrealized_profit != 0) ? prettyPrintNum(item.unrealized_profit) : ''}</span>
                    <span style="color: ${textColor};">${prettyPrintNum(item.realized_profit)}</span>
            
                </td>
                <td style="border: 1px solid #2b2d33; text-align: let; padding-left: 3px;">
                    <a href="${baseTx}/${tx}" target="_blank">${chain}tx</a>
                    <small style="float: right; margin: 3px 3px 0 0">`;
                        if(item.maker_tags.length > 0){
                            item.maker_tags.forEach(async (tag) => {
                                if(tag == 'gmgn') html += `<img src="/static/img/brand/gmgn_sm.png" style="width: 9px; height: 9px; float: right;"/>`;
                                if(tag == 'photon') html += `<img src="/static/img/brand/photon_sm.png" style="width: 9px; height: 9px; float: right;"/>`;
                                if(tag == 'bullx') html += `<img src="/static/img/brand/bullx_sm.png" style="width: 9px; height: 9px; float: right;"/>`;
                                if(tag == 'trojan') html += `<img src="/static/img/brand/trojan_sm.png" style="width: 9px; height: 9px; float: right;"/>`;
                            });
                        }
                    html += `</small>
                </td>
            </tr>
        `;
    }

    html += `
        </tbody>
    </table>
    `;

    return html;
}

async function getCurrentSelectedTimeOnChart() {
    if (!timeCanvases) {
        console.log('❌ timeCanvases is not ready');
        return null;
    }
    for (var i = 0; i < timeCanvases.length; i++) {
        var timeCanvas = timeCanvases[i];
        var text = await canvasToTextUsingTesseract(timeCanvas);
        if (text === null) {
            console.log("Text is null");
            continue;
        }

        console.log("Got text from canvas: " + text);

        var dateText = text.replace(/'/g, ' ');
        dateText = dateText.replace(/ /g, '').replace(/:/g, '');
        dateText = dateText.trim();
        console.log("Date text: " + dateText);

        if (dateText.length != 7 && dateText.length != 11 && dateText.length != 13) {
            console.log("Date text is invalid:", dateText, dateText.length);
            continue;
        }
        return dateText.toLowerCase();
    }
    return null;
}

async function handleTapQuickFilter() {
    leftPanelElement.innerHTML = '';
    let dateText = await getCurrentSelectedTimeOnChart();
    if (dateText === null) {
        addLog('❌ Failed to get date text from canvas');
        return;
    }
    
    var timestamp = convertToTimestamp(dateText);
    var timestampAtLater = timestamp + 3 * 60;
    var chainToken = extractChainAndTokenId(window.location.href);
    var tokenId = chainToken.tokenId;
    var chain = chainToken.chain;
    await filterTransactions(timestamp, timestampAtLater, tokenId, chain);
}

async function handleTapQuickFilterToNow() {
    leftPanelElement.innerHTML = '';
    let dateText = await getCurrentSelectedTimeOnChart();
    if (dateText === null) {
        addLog('❌ Failed to get date text from canvas');
        return;
    }
    
    var timestamp = convertToTimestamp(dateText);
    var timestampAtLater = Math.floor(Date.now() / 1000);
    var chainToken = extractChainAndTokenId(window.location.href);
    var tokenId = chainToken.tokenId;
    var chain = chainToken.chain;
    await filterTransactions(timestamp, timestampAtLater, tokenId, chain);
}

async function filterTransactions(timestamp, timestampAtLater, tokenId, chain) {
    var historyItems = await fetchTransactions(chain, tokenId, timestamp, timestampAtLater);
    let wallets = historyItems.map(item => item.maker);
    wallets = [...new Set(wallets)];

    addLog(`<br/>🔍 Found ${historyItems.length} unique transactions.`);
    addLog(`<br/>🔍 Found ${wallets.length} unique wallets &nbsp; &nbsp; `);

    // let saveButton = document.createElement('button');
    // saveButton.id = 'save-solbase-btn';
    
    // let allWallets = wallets
    // saveButton.innerHTML = `Save ${allWallets.length} to Solbase`;
    // saveButton.style.border = "1px solid white";
    // saveButton.style.padding = "2px";
    // addLog(saveButton.outerHTML);

    addLog(renderHtmlTable(historyItems, chain));

    saveButton = document.getElementById('save-solbase-btn');
    saveButton.onclick = async function() {
        const chunkSize = 999;
        const walletChunks = [];
        for (let i = 0; i < allWallets.length; i += chunkSize) {
            walletChunks.push(allWallets.slice(i, i + chunkSize));
        }
        saveButton.innerHTML = `⏳ Saving...${allWallets.length} wallets`;
        try {
            for (const chunk of walletChunks) {
                await postWallets(chain, chunk);
            }
        } catch (error) {
            addLog("❌ Error saving wallets");
        }
        saveButton.innerHTML = "✅ Saved!";
        setTimeout(() => {
            saveButton.innerHTML = "Save to Solbase";
        }, 1000);
    }
}

// ================================================ Event handlers
function registerEvents(documents) {
    documents.forEach(document => {
        document.addEventListener("keydown", handleTapFEvent);
    });
}

async function handleTapFEvent(event) {
    if (event.key === 'f') {
        await handleTapQuickFilter();
    } else if (event.key === 'd') {
        await handleTapQuickFilterToNow();
    } else if (event.key === 's') {
        console.log("On tap s")
        fromTsInput.value = 'Please wait ...';
        let dateText = await getCurrentSelectedTimeOnChart();
        if (dateText === null) {
            showToast('❌ Failed to get date text from canvas');
            return;
        }
        fromTsInput.value = appendSecondToDateString(dateText, true);
    } else if (event.key === 'e') {
        console.log("On tap e")
        toTsInput.value = 'Please wait ...';
        let dateText = await getCurrentSelectedTimeOnChart();
        if (dateText === null) {
            showToast('❌ Failed to get date text from canvas');
            return;
        }
        toTsInput.value = appendSecondToDateString(dateText, false);
    } else if (event.key === 'r') {
        console.log("On tap r")
        await handleTapCustomFilter();
    }
}

async function handleSaveTopPnlButton() {
    const chainToken = extractChainAndTokenId(window.location.href);
    const tokenId = chainToken.tokenId;
    const chain = chainToken.chain;
    let topPnlTraders = await fetchTopPnlTraders(chain, tokenId);
    let wallets = topPnlTraders.map(item => item.address);
    wallets = [...new Set(wallets)];
    saveTopPnlButton.innerHTML = `⏳ Saving...${wallets.length} wallets`;
    try {
        await postWallets(chain, wallets);
    } catch (error) {
        addLog("❌ Error saving wallets");
    }
    saveTopPnlButton.innerHTML = "✅ Saved!";
    setTimeout(() => {
        saveTopPnlButton.innerHTML = "✔ PNL";
    }, 1000);
}

async function handleSaveTopHolderButton() {
    const chainToken = extractChainAndTokenId(window.location.href);
    const tokenId = chainToken.tokenId;
    const chain = chainToken.chain;
    let traders = await fetchTopHolders(chain, tokenId);
    let wallets = traders.map(item => item.address);
    wallets = [...new Set(wallets)];
    saveTopHolderButton.innerHTML = `⏳ Saving...${wallets.length} wallets`;
    try {
        await postWallets(chain, wallets);
    } catch (error) {
        addLog("❌ Error saving wallets");
    }
    saveTopHolderButton.innerHTML = "✅ Saved!";
    setTimeout(() => {
        saveTopHolderButton.innerHTML = "✔ Holders";
    }, 1000);
}

async function handleSaveTopSoonButton() {
    const chainToken = extractChainAndTokenId(window.location.href);
    const tokenId = chainToken.tokenId;
    const chain = chainToken.chain;
    let traders = await fetchTopSoon(chain, tokenId);
    let wallets = traders.map(item => item.maker);
    wallets = [...new Set(wallets)];
    saveTopSoonButton.innerHTML = `⏳ Saving...${wallets.length} wallets`;
    try {
        await postWallets(chain, wallets);
    } catch (error) {
        addLog("❌ Error saving wallets");
    }
    saveTopSoonButton.innerHTML = "✅ Saved!";
    setTimeout(() => {
        saveTopSoonButton.innerHTML = "✔ Soon";
    }, 1000);
}

function getCurrentTimeFormat() {
    var date = new Date();
    var day = date.getDate();
    var month = date.toLocaleString('en-US', { month: 'short' }).toLowerCase();
    var year = date.getFullYear().toString().slice(-2);
    var hour = date.getHours().toString().padStart(2, '0');
    var minute = date.getMinutes().toString().padStart(2, '0');
    var seconds = date.getSeconds().toString().padStart(2, '0');
    return `${day}${month}${year}${hour}${minute}${seconds}`;
}

async function handleTapCustomFilter() {
    let fromTs = fromTsInput.value;
    if (fromTs === '') {
        showToast('❌ From timestamp is empty');
        return;
    }
    let fromTimestamp = convertToTimestamp(fromTs);
    if (fromTimestamp === null) {
        showToast('❌ From timestamp is invalid');
        return;
    }
    let toTs = toTsInput.value;
    if (toTs === '') {
        showToast('❌ To timestamp is empty');
        return
    }

    let toTimestamp = convertToTimestamp(toTs);
    if (toTimestamp === null) {
        showToast('❌ To timestamp is invalid');
        return;
    }
    if (fromTimestamp > toTimestamp) {
        showToast('❌ From timestamp is greater than to timestamp');
        return;
    }
    leftPanelElement.innerHTML = '';
    var timestamp = fromTimestamp;
    var timestampAtLater = toTimestamp;
    var chainToken = extractChainAndTokenId(window.location.href);
    var tokenId = chainToken.tokenId;
    var chain = chainToken.chain;
    await filterTransactions(timestamp, timestampAtLater, tokenId, chain);
}

// ================================================ Main function
async function main() {

    addStyleToHead(`
        #__next{padding-left: 400px;}
        #left-panel-container{width: 400px; height: 100%; left: 0; top: 10px; font-size: 12px; border-right: 1px solid #222; position: fixed; }
        .custom-placeholder::placeholder { font-size: 11px; }
    `);

    var chainToken = extractChainAndTokenId(window.location.href);
    var tokenId = chainToken.tokenId;
    var chain = chainToken.chain;
    var leftContainer;

    // Setup left panel
    var footer = document.querySelector('footer');
    if(footer) footer.innerHTML = `<div id="left-panel-container" style="position: fixed;"></div>`+ footer.innerHTML;

    await new Promise(r => setTimeout(r, 1 * 100)); 
    leftContainer = document.getElementById('left-panel-container'); console.log("leftContainer", leftContainer);
    
    setupLeftContainer(leftContainer);
    // let header = createHeaderPanel();
    // leftContainer.appendChild(header);
    
    leftPanelElement = createLeftPanel();
    leftContainer.appendChild(leftPanelElement);

    addLog('<span style="opacity: 0.8"><small>✅</small> 1/2: Left panel is ok.</span><br/>');
    

    // Getting tradingview frame
    try {
        await waitUtils(() => getTradingViewFrame() != null, 10000);
    } catch (error) {
        console.error("Error waiting for TradingView frame:", error);
        window.location.reload(true);
        return;
    }
    var tradingViewFrame = getTradingViewFrame();
    
    await waitUtils(() => tradingViewFrame.contentDocument.readyState === 'complete', 10000);
    await waitUtils(() => tradingViewFrame.contentDocument.getElementsByClassName('chart-markup-table time-axis').length > 0, 10000);
    
    addLog("<span style='opacity: 0.8'><small>✅</small> 2/2: ChartView is ok. <br/>Press \"f\" to fetch transactions.</span>");
    var timeAxisElement = tradingViewFrame.contentDocument.getElementsByClassName('chart-markup-table time-axis')[0];
    if (timeAxisElement == null) {
        addLog('❌ timeAxisElement is not ready');
        return;
    }

    timeCanvases = timeAxisElement.getElementsByTagName('canvas');
    console.log(`Found ${timeCanvases.length} canvases`);
    registerEvents([tradingViewFrame.contentDocument]);
}

// ================================================ Run the script
main();



//format eth value
function replaceText(text){
    text = text.replaceAll("dev_team", '👥');
    text = text.replaceAll("top_holder", '🏅');
    text = text.replaceAll("sniper", '⌖');
    text = text.replaceAll(",", ' ');
    return text;
}


//in số nhiều chuẩn
function prettyPrintNum(num){
    if(num < -1) return prettyNum(Math.round(num));
    if(num < 0.1) return  formatNum2(num);
    else if(num >= 0.1 && num < 1) return formatNum1(num);
    else return prettyNum(Math.round(num));
}

//format eth value
function formatNum(num){
    return Math.round( num * 1000 ) / 1000;
}

function formatNum1(num){
    return Math.round( num * 10 ) / 10;
}

function formatNum2(num){
    return Math.round( num * 100 ) / 100;
}

function prettyNum(num){
    num = Math.round(num);
    return new Intl.NumberFormat().format(num);
}

function kFormatter(num) {
    if(num > 999999999 || num < -999999999) return "tooBig";
    else if(num > 999999 || num < -999999) return Math.sign(num)*((Math.abs(num)/1000000).toFixed(1)) + 'M';
    else return Math.abs(num) > 999 ? Math.sign(num)*((Math.abs(num)/1000).toFixed(1)) + 'k' : Math.round(Math.sign(num)*Math.abs(num))
}

function prettyPeriod(duration){

    var seconds = Math.floor(duration);
    var interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " y";
    
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " d";
    
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " h";
    
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " m";
    
    return Math.floor(seconds) + "s";
}

function prettyPeroid(duration){
    if(duration < 60) return Math.round(duration)+'s';
    if(duration >= 60 && duration <3600) return Math.round(duration/60)+'m';
    if(duration >= 3600) return Math.round(duration/3600)+'h';
}

function prettyDuration(created){
            
    var seconds = Math.floor(new Date() - created*1000)/1000;

    var interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " y";
    
    //skip months
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " d";
    
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " h";

    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " m";
    
    return Math.floor(seconds) + "s";

}

