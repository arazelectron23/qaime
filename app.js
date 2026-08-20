if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: '/qaime/' })
        .then(() => console.log("Service Worker aktivləşdirildi."))
        .catch(err => console.error("SW qeydiyyat xətası:", err));
}

import { 
    db, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy, 
    serverTimestamp 
} from "./firebase.js"; 

import { where, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const openTemplateModalBtn = document.getElementById('btn-open-template-modal'); 
const templateSelectModal = document.getElementById('template-select-modal');
const customModalClose = document.getElementById('custom-modal-close');
const templateSearchInput = document.getElementById('template-search-input');
const templateListContainer = document.getElementById('template-list-container');

// ==========================================
// BİLDİRİŞ FUNKSİYASI
// ==========================================
function showNotification(message, type = 'success') {
    const oldNotification = document.getElementById('custom-notification');
    if (oldNotification) oldNotification.remove();

    const notification = document.createElement('div');
    notification.id = 'custom-notification';
    notification.innerText = message;

    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 24px',
        borderRadius: '6px',
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: '14px',
        zIndex: '10000',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        transition: 'all 0.3s ease',
        opacity: '0',
        transform: 'translateY(-20px)'
    });

    if (type === 'success') {
        notification.style.backgroundColor = '#10b981';
        notification.style.borderLeft = '5px solid #047857';
    } else {
        notification.style.backgroundColor = '#ef4444';
        notification.style.borderLeft = '5px solid #b91c1c';
    }

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// DOM Elementləri
const itemsBody = document.getElementById('invoice-items-body');
const btnAddItem = document.getElementById('btn-add-item');
const customerInput = document.getElementById('customer-input');
const totalPriceView = document.getElementById('total-price-view');
const btnNewInvoice = document.getElementById('btn-new-invoice');

let invoiceItems = [{ name: '', qty: 1, price: 0 }];
let currentActiveDocId = null;
let allWaitingInvoices = [];
let allProductsList = [];
let allLoadedTemplates = [];

// Flatpickr Təqvimi
const datePicker = flatpickr("#flatpickr", {
    dateFormat: "d.m.Y",
    defaultDate: "today",
    locale: flatpickr.l10ns.az 
});

// İlkin Yüklənmə
document.addEventListener('DOMContentLoaded', () => {
    fetchProductsForAutocomplete();
    loadGlobalProductsAndTemplates();
    renderItems();
});

// Yeni Qaimə Düyməsi
if (btnNewInvoice) {
    btnNewInvoice.addEventListener('click', () => {
        resetForm(); 
        showNotification("Qaimə sıfırlandı", "success");
    });
}

// Məhsulları Avtomatik Tamamlama
async function fetchProductsForAutocomplete() {
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        allProductsList = [];
        querySnapshot.forEach((doc) => {
            allProductsList.push({ id: doc.id, ...doc.data() });
        });
    } catch (e) {
        console.error("Məhsulları çəkərkən xəta:", e);
    }
}

// Cədvəli Ekrana Çıxarma
function renderItems() {
    if (!itemsBody) return;
    itemsBody.innerHTML = '';
    let grandTotal = 0;

    invoiceItems.forEach((item, index) => {
        const rowTotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
        grandTotal += rowTotal;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center; font-weight: bold; color: #a5b4fc; padding-top:14px;">${index + 1}</td>
            <td><input type="text" class="item-name" value="${item.name || ''}" placeholder="Məhsulun adı"></td>
            <td><input type="number" class="item-qty text-right" value="${item.qty}" min="0"></td>
            <td><input type="number" class="item-price text-right" value="${item.price || ''}" min="0" step="0.01" placeholder="0.00"></td>
            <td style="text-align: right; font-weight: 600; padding-top:14px; min-width:80px;" class="row-total-display">${rowTotal.toFixed(2)} AZN</td>
            <td><button class="btn-delete-row">×</button></td>
        `;

        const nameInput = tr.querySelector('.item-name');
        const qtyInput = tr.querySelector('.item-qty');
        const priceInput = tr.querySelector('.item-price');
        const rowTotalDisplay = tr.querySelector('.row-total-display');
        const btnDeleteRow = tr.querySelector('.btn-delete-row');

        nameInput.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase().trim();
            item.name = e.target.value;

            document.querySelectorAll('.autocomplete-dropdown').forEach(d => d.remove());
            if (val === '') return;

            const matchedProducts = allProductsList.filter(p => p.name.toLowerCase().includes(val));
            if (matchedProducts.length === 0) return;

            const rect = nameInput.getBoundingClientRect();
            const dropdown = document.createElement('div');
            dropdown.className = 'autocomplete-dropdown';
            Object.assign(dropdown.style, {
                position: 'fixed',
                top: `${rect.bottom + 4}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                background: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '6px',
                zIndex: '99999',
                maxHeight: '180px',
                overflowY: 'auto',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            });

            matchedProducts.forEach(prod => {
                const option = document.createElement('div');
                option.innerText = `${prod.name} - ${prod.price} AZN`;
                Object.assign(option.style, {
                    padding: '10px 12px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#ffffff',
                    borderBottom: '1px solid #2d3748'
                });

                option.addEventListener('mouseover', () => option.style.background = '#374151');
                option.addEventListener('mouseout', () => option.style.background = 'transparent');

                option.addEventListener('click', () => {
                    item.name = prod.name;
                    item.price = Number(prod.price);
                    nameInput.value = prod.name;
                    priceInput.value = prod.price;

                    const newTotal = item.qty * item.price;
                    rowTotalDisplay.textContent = newTotal.toFixed(2) + " AZN";
                    fastCalculateTotal();
                    dropdown.remove();
                });

                dropdown.appendChild(option);
            });

            document.body.appendChild(dropdown);
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.item-name') && !e.target.closest('.autocomplete-dropdown')) {
                document.querySelectorAll('.autocomplete-dropdown').forEach(d => d.remove());
            }
        });
        
        qtyInput.addEventListener('input', (e) => {
            let val = parseInt(e.target.value);
            if (val < 0 || isNaN(val)) { val = 0; e.target.value = 0; }
            item.qty = val;
            rowTotalDisplay.textContent = (item.qty * item.price).toFixed(2) + " AZN";
            fastCalculateTotal();
        });

        priceInput.addEventListener('input', (e) => {
            let val = parseFloat(e.target.value);
            if (val < 0 || isNaN(val)) { val = 0; e.target.value = 0; }
            item.price = val;
            rowTotalDisplay.textContent = (item.qty * item.price).toFixed(2) + " AZN";
            fastCalculateTotal();
        });

        qtyInput.addEventListener('focus', (e) => { if(e.target.value == '0') e.target.value = ''; });
        priceInput.addEventListener('focus', (e) => { if(e.target.value == '0') e.target.value = ''; });

        btnDeleteRow.addEventListener('click', () => {
            if(invoiceItems.length === 1) {
                invoiceItems = [{ name: '', qty: 1, price: 0 }];
            } else {
                invoiceItems.splice(index, 1);
            }
            renderItems();
        });

        itemsBody.appendChild(tr);
    });

    if (totalPriceView) {
        totalPriceView.textContent = grandTotal.toFixed(2);
    }
}

function fastCalculateTotal() {
    const total = invoiceItems.reduce((sum, item) => sum + ((Number(item.qty) || 0) * (Number(item.price) || 0)), 0);
    if (totalPriceView) {
        totalPriceView.textContent = total.toFixed(2);
    }
}

if (btnAddItem) {
    btnAddItem.addEventListener('click', () => {
        invoiceItems.push({ name: '', qty: 1, price: 0 });
        renderItems();
    });
}

// Şablon Modallarının İdarə Edilməsi
if (openTemplateModalBtn && templateSelectModal) {
    openTemplateModalBtn.addEventListener('click', async () => {
        templateSelectModal.style.display = 'flex';
        if (templateSearchInput) templateSearchInput.value = '';
        
        if (templateListContainer) {
    templateListContainer.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; padding: 25px; width: 100%;">
            <div class="sharp-ring-loader"></div>
        </div>
    `;
}
        
        await loadGlobalProductsAndTemplates();
        renderTemplateModalList(allLoadedTemplates);
    });
}

if (customModalClose && templateSelectModal) {
    customModalClose.addEventListener('click', () => {
        templateSelectModal.style.display = 'none';
    });
}

if (templateSelectModal) {
    templateSelectModal.addEventListener('click', (e) => {
        if (e.target === templateSelectModal) {
            templateSelectModal.style.display = 'none';
        }
    });
}

if (templateSearchInput) {
    templateSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = allLoadedTemplates.filter(t => t.name && t.name.toLowerCase().includes(term));
        renderTemplateModalList(filtered);
    });
}

// Şablonları və Məhsulları Yükləyən Əsas Funksiya
async function loadGlobalProductsAndTemplates() {
    try {
        const prodSnapshot = await getDocs(collection(db, "products"));
        allProductsList = [];
        prodSnapshot.forEach((doc) => {
            allProductsList.push({ id: doc.id, ...doc.data() });
        });

        const tplQuery = query(collection(db, "templates"), orderBy("name", "asc"));
        const tplSnapshot = await getDocs(tplQuery);
        allLoadedTemplates = [];
        
        tplSnapshot.forEach((docSnap) => {
            const tplData = docSnap.data();
            allLoadedTemplates.push({ id: docSnap.id, ...tplData });
        });
    } catch (err) {
        console.error("Şablonları və ya məhsulları yükləmə xətası:", err);
    }
}

function renderTemplateModalList(templates) {
    const container = document.getElementById('template-list-container');
    if (!container) return;
    
    container.innerHTML = '';
    if (templates.length === 0) {
        container.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 15px;">Heç bir şablon tapılmadı.</p>';
        return;
    }

    templates.forEach(tpl => {
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = 'padding: 12px 14px; margin-bottom: 8px; background: #0b132b; border: 1px solid #233554; border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;';
        
        itemDiv.addEventListener('mouseover', () => itemDiv.style.borderColor = '#5bc0be');
        itemDiv.addEventListener('mouseout', () => itemDiv.style.borderColor = '#233554');

        let totalPrice = 0;
        if (tpl.items && Array.isArray(tpl.items)) {
            totalPrice = tpl.items.reduce((sum, i) => sum + (Number(i.qty || 0) * Number(i.price || 0)), 0);
        }

        itemDiv.innerHTML = `
            <div>
                <strong style="color: #fff; font-size: 14px;">${tpl.name}</strong>
                <div style="font-size: 12px; color: #9ca3af; margin-top: 2px;">${tpl.items ? tpl.items.length : 0} məhsul</div>
            </div>
            <span style="color: #5bc0be; font-weight: bold; font-size: 13px;">${totalPrice.toFixed(2)} AZN</span>
        `;

        itemDiv.addEventListener('click', () => {
            if (tpl.items && tpl.items.length > 0) {
                invoiceItems = tpl.items.map(item => ({
                    name: item.name || '',
                    qty: Number(item.qty) || 1,
                    price: Number(item.price) || 0
                }));
                renderItems();
                
                const selectedNameSpan = document.getElementById('selected-template-name');
                if (selectedNameSpan) {
                    selectedNameSpan.textContent = tpl.name;
                    selectedNameSpan.style.color = '#ffffff';
                }

                showNotification(`"${tpl.name}" şablonu tətbiq edildi`, "success");
            }
            if (templateSelectModal) templateSelectModal.style.display = 'none';
        });

        container.appendChild(itemDiv);
    });
}

// Digər əməliyyatlar (PDF, Çap, Gözləmə siyahısı və s.)
function prepareOfficialPrintPage() {
    const officialPrintPage = document.getElementById('official-print-page');
    if (!officialPrintPage) return;

    const customerName = customerInput.value.trim() || '_______________';
    const dateStr = document.getElementById('flatpickr').value || '---';
    
    let grandTotal = 0;
    let itemsHTML = '';
    
    invoiceItems.forEach((item, index) => {
        const rowTotal = Number(item.qty || 0) * Number(item.price || 0);
        grandTotal += rowTotal;

        itemsHTML += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 4px; text-align: center; font-size: 13px;">${index + 1}</td>
                <td style="padding: 8px 4px; text-align: left; font-size: 13px;">${item.name || '---'}</td>
                <td style="padding: 8px 4px; text-align: center; font-size: 13px;">${item.qty}</td>
                <td style="padding: 8px 4px; text-align: right; font-size: 13px;">${Number(item.price).toFixed(2)}</td>
                <td style="padding: 8px 4px; text-align: right; font-weight: 800; font-size: 13px;">${rowTotal.toFixed(2)}</td>
            </tr>`;
    });

    officialPrintPage.innerHTML = `
        <div style="padding: 0 5px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #000; background: #fff; width: 100%; box-sizing: border-box;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
                <tr>
                    <td style="vertical-align: top; width: 50%; text-align: left;">
                        <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 900; color: #000; text-align: left;">SATIŞ QAİMƏSİ</h1>
                        <div style="font-size: 11px; color: #666; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; text-align: left;">KİMƏ (MÜŞTƏRİ):</div>
                        <div style="font-size: 15px; font-weight: 800; border-bottom: 1.5px solid #000; padding-bottom: 2px; width: 100%; max-width: 260px; word-wrap: break-word; color: #000; text-align: left;">
                            ${customerName}
                        </div>
                        <div style="font-size: 12px; color: #000; margin-top: 6px; text-align: left;">
                            <strong>Tarix:</strong> ${dateStr}
                        </div>
                    </td>
                    <td style="text-align: right; vertical-align: top; width: 50%; font-size: 11px; line-height: 1.4; color: #555;">
                        <div style="font-size: 18px; font-weight: 900; color: #000; margin-bottom: 2px;">ARAZ ELECTRON</div>
                        <div style="font-size: 10px; color: #888; margin-bottom: 4px;">Elektronika satışı və Texniki Dəstək Xidməti</div>
                        <div><span style="color: #999;">📍</span> Beyləqan r. Magistral yol</div>
                        <div><span style="color: #999;">🌐</span> arazelectron.com</div>
                        <div><span style="color: #999;">✉️</span> info@arazelectron.com</div>
                        <div><span style="color: #999;">📞</span> +994505946771</div>
                    </td>
                </tr>
            </table>

           <table style="width: 100%; border-collapse: collapse; margin-top: 0;">
                <thead>
                    <tr style=" border-bottom: 1.5px solid #000;">
                        <th style="padding: 6px 4px; text-align: center; font-size: 11px; font-weight: 800; width: 5%; color: #000;">№</th>
                        <th style="padding: 6px 4px; text-align: left; font-size: 11px; font-weight: 800; width: 50%; color: #000;">MƏHSULUN ADI</th>
                        <th style="padding: 6px 4px; text-align: center; font-size: 11px; font-weight: 800; width: 15%; color: #000;">MİQDAR</th>
                        <th style="padding: 6px 4px; text-align: right; font-size: 11px; font-weight: 800; width: 15%; color: #000;">QİYMƏT</th>
                        <th style="padding: 6px 4px; text-align: right; font-size: 11px; font-weight: 800; width: 15%; color: #000;">CƏMİ</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>

            <table style="width: 100%; border-collapse: collapse; margin-top: 80px;">
                <tr>
                    <td style="vertical-align: middle; width: 40%; padding-left: 0;">
                        <img src="./mohur.png" alt="Möhür" style="width: 110px; height: auto; display: block; filter: grayscale(100%) contrast(300%) brightness(0%);" onerror="this.style.display='none';">
                    </td>
                    <td style="text-align: right; vertical-align: middle; width: 60%;">
                        <span style="font-size: 14px; color: #444;">Yekun Ödəniş:</span>
                        <span style="font-size: 22px; font-weight: 900; color: #000; margin-left: 10px;">
                            ${grandTotal.toFixed(2)} AZN
                        </span>
                    </td>
                </tr>
            </table>

            <div style="text-align: center; font-size: 11px; color: #555; margin-top: 30px; font-weight: 600; width: 100%;">
                Bizi seçdiyiniz üçün təşəkkür edirik!
            </div>
        </div>
    `;
}

const btnDownload = document.getElementById('btn-download');
if (btnDownload) {
    btnDownload.addEventListener('click', async () => {
        const customerNameClean = customerInput.value.trim();
        const isFirstItemEmpty = invoiceItems.length === 1 && !invoiceItems[0].name.trim();

        if (!customerNameClean || isFirstItemEmpty) {
            return showNotification("Müştəri adı və məhsul əlavə edin", "error");
        }

        prepareOfficialPrintPage();
        const element = document.getElementById('official-print-page');
        const customerName = customerNameClean || 'Qaime';

        const opt = {
            margin:       [10, 10, 10, 10], 
            filename:     `Araz_Electron_${customerName}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await addInvoiceToArchive('print');
        html2pdf().from(element).set(opt).save().catch(err => console.error("PDF Xətası:", err));
    });
}

const btnPrint = document.getElementById('btn-print');
if (btnPrint) {
    btnPrint.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        
        const isFirstItemEmpty = invoiceItems.length === 1 && !invoiceItems[0].name.trim();
        if (!customerInput.value.trim() || isFirstItemEmpty) {
            return showNotification("Müştəri adı və məhsul əlavə edin", "error");
        }

        prepareOfficialPrintPage();
        window.print();
    });
}

const btnWaiting = document.getElementById('btn-waiting');
if (btnWaiting) {
    btnWaiting.addEventListener('click', async () => {
        const customerName = customerInput.value.trim();
        const isFirstItemEmpty = invoiceItems.length === 1 && !invoiceItems[0].name.trim();

        if (!customerName || isFirstItemEmpty) {
            return showNotification("Müştəri adı və məhsul əlavə edin", "error");
        }

        const data = {
            customerName: customerName,
            invoiceDate: document.getElementById('flatpickr').value,
            items: invoiceItems,
            status: "waiting",
            updatedAt: new Date()
        };

        try {
            if (currentActiveDocId) {
                await updateDoc(doc(db, "waiting_invoices", currentActiveDocId), data);
                showNotification("Qaimə uğurla yeniləndi!", "success");
            } else {
                await addDoc(collection(db, "waiting_invoices"), data);
                showNotification("Qaimə gözləməyə alındı!", "success");
            }
            
            resetForm();
            await fetchWaitingListForModal();
        } catch (e) { 
            console.error("Firebase Xətası:", e); 
            showNotification("Xəta baş verdi!", "error");
        }
    });
}

function resetForm() {
    if (customerInput) customerInput.value = '';
    if (datePicker) datePicker.setDate(new Date());
    invoiceItems = [{ name: '', qty: 1, price: 0 }];
    currentActiveDocId = null;
    renderItems();

    const waitingBtn = document.getElementById('btn-waiting');
    if (waitingBtn) waitingBtn.textContent = 'Gözləməyə Al';
    
    const selectedNameSpan = document.getElementById('selected-template-name');
    if (selectedNameSpan) {
        selectedNameSpan.textContent = '-- Şablon seçilməyib --';
        selectedNameSpan.style.color = '#94a3b8';
    }
}

async function addInvoiceToArchive(actionType) {
    try {
        const customerName = customerInput.value.trim() || 'Naməlum Müştəri';
        if (invoiceItems.length === 0) return;

        let total = invoiceItems.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0);

        await addDoc(collection(db, "history_invoices"), {
            customerName: customerName,
            invoiceDate: document.getElementById('flatpickr').value,
            items: invoiceItems,
            totalAmount: total.toFixed(2),
            action: actionType,
            timestamp: serverTimestamp()
        });
    } catch (e) {
        console.error("Arxivləmə zamanı xəta: ", e);
    }
}

const btnWaitingModalOpen = document.getElementById('btn-waiting-modal-open');
const waitingModal = document.getElementById('waiting-modal');
const waitingModalList = document.getElementById('waiting-modal-list');

if (btnWaitingModalOpen && waitingModal) {
    btnWaitingModalOpen.addEventListener('click', async () => {
        waitingModal.style.display = 'flex';
        await fetchWaitingListForModal();
    });
}

window.addEventListener('click', (e) => {
    if (e.target === waitingModal) {
        waitingModal.style.display = 'none';
    }
});

async function fetchWaitingListForModal() {
    if (!waitingModalList) return;
    waitingModalList.innerHTML = `
    <div style="display: flex; justify-content: center; align-items: center; padding: 25px; width: 100%;">
        <div class="sharp-ring-loader"></div>
    </div>
`;;
    
    try {
        const q = query(collection(db, "waiting_invoices"), where("status", "==", "waiting"));
        const snap = await getDocs(q);
        
        allWaitingInvoices = [];
        snap.forEach((documentSnapshot) => {
            allWaitingInvoices.push({
                id: documentSnapshot.id,
                ...documentSnapshot.data()
            });
        });

        renderWaitingList(allWaitingInvoices);
    } catch (e) { 
        console.error(e);
        waitingModalList.innerHTML = '<p style="color:#ef4444; text-align:center;">Xəta baş verdi.</p>';
    }
}

function renderWaitingList(invoices) {
    if (!waitingModalList) return;
    waitingModalList.innerHTML = '';

    if (invoices.length === 0) {
        waitingModalList.innerHTML = '<p style="font-size:13px; color:#9ca3af; text-align:center; padding: 20px;">Gözləyən qaimə tapılmadı.</p>';
        return;
    }

    invoices.forEach((data) => {
        const docId = data.id;
        const formattedDate = data.invoiceDate || 'Tarix yoxdur';
        
        let totalAmount = 0;
        if (data.items && Array.isArray(data.items)) {
            totalAmount = data.items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0);
        }

       const div = document.createElement('div');
        div.className = 'waiting-item';
        div.innerHTML = `
            <div class="waiting-item-left">
                <strong style="color:#ffffff; font-size: 14px;">${data.customerName}</strong>
                <div style="display:flex; gap: 10px; margin-top:2px;">
                    <span style="font-size:12px; color:#5bc0be;">📅 ${formattedDate}</span>
                    <span style="font-size:12px; color:#a5b4fc;">${data.items.length} məhsul</span>
                </div>
            </div>
            <div class="waiting-item-right">
                <span class="waiting-total-badge" title="Göstərmək üçün toxunun">${totalAmount.toFixed(2)} AZN</span>
                <button class="btn-blue select-btn" style="padding: 6px 12px; font-size: 12px;">Seç</button>
                <button class="btn-delete-waiting" style="padding: 6px 10px; font-size: 12px;">Sil</button>
            </div>
        `;

        const badge = div.querySelector('.waiting-total-badge');
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            badge.classList.toggle('revealed');
        });

        div.querySelector('.select-btn').addEventListener('click', () => {
            currentActiveDocId = docId;
            customerInput.value = data.customerName;
            if (data.invoiceDate) {
                datePicker.setDate(data.invoiceDate);
            }
            invoiceItems = data.items;
            renderItems();
            
            const waitingBtn = document.getElementById('btn-waiting');
            if (waitingBtn) waitingBtn.textContent = 'Yenilə';

            waitingModal.style.display = 'none';
            showNotification("Qaimə yükləndi", "success");
        });

        const btnDelete = div.querySelector('.btn-delete-waiting');
        const actionArea = div.querySelector('.waiting-item-right');

        btnDelete.addEventListener('click', (e) => {
            e.stopPropagation();
            btnDelete.style.display = 'none';
            
            const confirmBox = document.createElement('div');
            confirmBox.className = 'waiting-item-confirm-box';
            confirmBox.innerHTML = `
                <span>Silinsin?</span>
                <button class="btn-confirm-yes">Bəli</button>
                <button class="btn-confirm-no">Xeyr</button>
            `;

            confirmBox.querySelector('.btn-confirm-yes').addEventListener('click', async (eSub) => {
                eSub.stopPropagation();
                try {
                    await deleteDoc(doc(db, "waiting_invoices", docId));
                    if (currentActiveDocId === docId) resetForm();
                    await fetchWaitingListForModal();
                    showNotification("Qaimə uğurla silindi!", "success");
                } catch (err) {
                    console.error("Silmə xətası:", err);
                    showNotification("Silmək mümkün olmadı!", "error");
                }
            });

            confirmBox.querySelector('.btn-confirm-no').addEventListener('click', (eSub) => {
                eSub.stopPropagation();
                confirmBox.remove();
                btnDelete.style.display = 'block';
            });

            actionArea.appendChild(confirmBox);
        });

        waitingModalList.appendChild(div);
    });
}

const btnCompleteInvoice = document.getElementById('btn-complete-invoice');
if (btnCompleteInvoice) {
    btnCompleteInvoice.addEventListener('click', async () => {
        const customerNameClean = customerInput.value.trim();
        const isFirstItemEmpty = invoiceItems.length === 1 && !invoiceItems[0].name.trim();

        if (!customerNameClean || isFirstItemEmpty) {
            return showNotification("Müştəri adı və məhsul əlavə edin", "error");
        }

        let grandTotal = invoiceItems.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0);

        try {
            await addDoc(collection(db, "history_invoices"), {
                customerName: customerNameClean,
                invoiceDate: document.getElementById('flatpickr').value,
                items: invoiceItems,
                totalAmount: grandTotal.toFixed(2),
                action: "completed",
                timestamp: serverTimestamp()
            });

            if (currentActiveDocId) {
                await deleteDoc(doc(db, "waiting_invoices", currentActiveDocId));
            }

            showNotification("Qaimə tamamlandı", "success");
            resetForm();
            await fetchWaitingListForModal();

        } catch (error) {
            console.error("Tamamlama xətası:", error);
            showNotification("Xəta baş verdi!", "error");
        }
    });
}

const waitingSearchInput = document.getElementById('waiting-search-input');
if (waitingSearchInput) {
    waitingSearchInput.addEventListener('input', () => {
        const searchText = waitingSearchInput.value.toLowerCase().trim();
        const filteredInvoices = allWaitingInvoices.filter(inv => inv.customerName.toLowerCase().includes(searchText));
        renderWaitingList(filteredInvoices);
    });
}

flatpickr("#waiting-date-start", { dateFormat: "d.m.Y", locale: flatpickr.l10ns.az });
flatpickr("#waiting-date-end", { dateFormat: "d.m.Y", defaultDate: "today", locale: flatpickr.l10ns.az });

// Şablon seçmək üçün pəncərəni açan funksiya
function openTemplateModal() {
    const modal = document.getElementById('templateModal');
    modal.style.display = 'flex'; // Və ya 'block' (flex ilə mərkəzləşdirmək daha rahatdır)
}

// Bağlamaq üçün
function closeTemplateModal() {
    const modal = document.getElementById('templateModal');
    modal.style.display = 'none';
}