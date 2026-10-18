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

// DOM Elementləri və Qlobal Dəyişənlər
const itemsBody = document.getElementById('invoice-items-body');
const btnAddItem = document.getElementById('btn-add-item');
let customerInput = document.getElementById('customer-input');
const totalPriceView = document.getElementById('total-price-view');
const btnNewInvoice = document.getElementById('btn-new-invoice');

let invoiceItems = [{ name: '', qty: '', price: '', isArchived: false, selected: false }];
let currentActiveDocId = null;
let allWaitingInvoices = [];
let allProductsList = [];
let allLoadedTemplates = [];
let invoiceMode = 'musteri'; // 'musteri' və ya 'usta'
let allUstalarList = [];

const typeMusteriBtn = document.getElementById('typeMusteriBtn');
const typeUstaBtn = document.getElementById('typeUstaBtn');

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

// Ustaların siyahısını Firebase-dən çəkmək üçün
async function fetchUstalar() {
    try {
        const snap = await getDocs(collection(db, "ustalar"));
        allUstalarList = [];
        snap.forEach(doc => {
            allUstalarList.push(doc.data().name);
        });
    } catch (e) {
        console.error("Ustaları çəkərkən xəta:", e);
    }
}

async function updateCustomerInputUI(selectedVal = '') {
    const containerWrapper = customerInput ? customerInput.parentElement : null;
    if (!containerWrapper) return;

    if (invoiceMode === 'usta') {
        if (allUstalarList.length === 0) {
            await fetchUstalar();
        }
        let selectHTML = `<select id="customer-input" style="flex: 1; padding: 12px 16px; border: 1px solid #3a506b; border-radius: 8px; font-size: 15px; background-color: #0b132b; color: #ffffff; outline: none; font-weight: 600;">
            <option value="">-- Usta seçin --</option>`;
        
        allUstalarList.forEach(usta => {
            const isSelected = usta === selectedVal ? 'selected' : '';
            selectHTML += `<option value="${usta}" ${isSelected}>${usta}</option>`;
        });
        selectHTML += `</select>`;

        const oldEl = document.getElementById('customer-input');
        if (oldEl) {
            oldEl.outerHTML = selectHTML;
        }
    } else {
        const currentElement = document.getElementById('customer-input');
        if (currentElement && currentElement.tagName === 'SELECT') {
            const inputHTML = `<input type="text" id="customer-input" value="${selectedVal}" placeholder="Müştəri adı və ya nömrə daxil edin..." style="flex: 1; padding: 12px 16px; border: 1px solid #3a506b; border-radius: 8px; font-size: 15px; background-color: #0b132b; color: #ffffff; outline: none; font-weight: 600;">`;
            currentElement.outerHTML = inputHTML;
        } else if (currentElement) {
            currentElement.value = selectedVal;
        }
    }
    customerInput = document.getElementById('customer-input');
}

// Rejim dəyişimi düymələri (Müştəri / Usta)
if (typeMusteriBtn && typeUstaBtn) {
    typeMusteriBtn.addEventListener('click', async () => {
        invoiceMode = 'musteri';
        typeMusteriBtn.classList.add('active');
        typeUstaBtn.classList.remove('active');
        await updateCustomerInputUI();
        renderItems();
    });

    typeUstaBtn.addEventListener('click', async () => {
        invoiceMode = 'usta';
        typeUstaBtn.classList.add('active');
        typeMusteriBtn.classList.remove('active');
        await updateCustomerInputUI();
        renderItems();
    });
}

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
        if (!item.isArchived) {
            grandTotal += rowTotal;
        }

        const tr = document.createElement('tr');
        if (item.isArchived) {
            tr.className = 'archived-row';
        }

        let actionButtonsHTML = `<button class="btn-delete-row" title="Sil" style="background: #ef4444; color: #fff; border: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; display: inline-flex; align-items: center; justify-content: center;">×</button>`;
        if (invoiceMode === 'usta') {
            actionButtonsHTML = `
                <div style="display: flex; gap: 6px; align-items: center; justify-content: center;">
                    <button class="archive-item-btn" title="Arxivə at" style="background: #10b981; color: #fff; border: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; display: inline-flex; align-items: center; justify-content: center;" ${item.isArchived ? 'disabled' : ''}>✓</button>
                    <button class="btn-delete-row" title="Sil" style="background: #ef4444; color: #fff; border: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; display: inline-flex; align-items: center; justify-content: center;">×</button>
                </div>
            `;
        }

        tr.innerHTML = `
            <td style="text-align: center; font-weight: bold; color: #a5b4fc; padding-top:14px;">${index + 1}</td>
            <td><input type="text" class="item-name" value="${item.name || ''}" placeholder="Məhsulun adı" ${item.isArchived ? 'disabled' : ''}></td>
            <td><input type="number" class="item-qty text-right" value="${item.qty !== undefined ? item.qty : ''}" min="0" ${item.isArchived ? 'disabled' : ''}></td>
            <td><input type="number" class="item-price text-right" value="${item.price !== undefined && item.price !== '' ? item.price : ''}" min="0" step="0.01" placeholder="" ${item.isArchived ? 'disabled' : ''}></td>
            <td style="text-align: right; font-weight: 600; padding-top:14px; min-width:80px;" class="row-total-display">${rowTotal.toFixed(2)} AZN</td>
            <td style="text-align: center;">${actionButtonsHTML}</td>
        `;

        const nameInput = tr.querySelector('.item-name');
        const qtyInput = tr.querySelector('.item-qty');
        const priceInput = tr.querySelector('.item-price');
        const rowTotalDisplay = tr.querySelector('.row-total-display');
        const btnDeleteRow = tr.querySelector('.btn-delete-row');

        if (nameInput) {
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
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.item-name') && !e.target.closest('.autocomplete-dropdown')) {
                document.querySelectorAll('.autocomplete-dropdown').forEach(d => d.remove());
            }
        });
        
        if (qtyInput) {
            qtyInput.addEventListener('input', (e) => {
                let val = e.target.value === '' ? '' : parseFloat(e.target.value);
                if (val < 0 || isNaN(val)) { val = 0; e.target.value = 0; }
                item.qty = val;
                rowTotalDisplay.textContent = ((Number(item.qty) || 0) * (Number(item.price) || 0)).toFixed(2) + " AZN";
                fastCalculateTotal();
            });
        }

        if (priceInput) {
            priceInput.addEventListener('input', (e) => {
                let val = e.target.value === '' ? '' : parseFloat(e.target.value);
                if (val < 0.01 && val !== '') { val = 0.01; e.target.value = 0.01; }
                item.price = val;
                rowTotalDisplay.textContent = ((Number(item.qty) || 0) * (Number(item.price) || 0)).toFixed(2) + " AZN";
                fastCalculateTotal();
            });
        }

        if (btnDeleteRow) {
            btnDeleteRow.addEventListener('click', () => {
                if(invoiceItems.length === 1) {
                    invoiceItems = [{ name: '', qty: '', price: '', isArchived: false }];
                } else {
                    invoiceItems.splice(index, 1);
                }
                renderItems();
            });
        }

     if (invoiceMode === 'usta') {
            const archiveBtn = tr.querySelector('.archive-item-btn');
            if (archiveBtn) {
                archiveBtn.addEventListener('click', async () => {
                    const selectedUsta = customerInput ? customerInput.value.trim() : '';

                    if (!selectedUsta || selectedUsta === '' || selectedUsta.includes('-- Usta seçin --')) {
                        return showNotification("Zəhmət olmasa əvvəlcə usta seçin!", "error");
                    }
                    if (!item.name || !item.name.trim()) {
                        return showNotification("Zəhmət olmasa əvvəlcə məhsul adını daxil edin!", "error");
                    }

                    try {
                        const rowTotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
                        const currentDateStr = document.getElementById('flatpickr').value || '---';

                        // 1. Dərhal sətri qaraldırıq
                        item.isArchived = true;
                        renderItems();

                        // 2. Yoxlayırıq: Eyni usta və eyni tarixdə artıq arxiv qeydi varmı?
                        const historyRef = collection(db, "history_invoices");
                        const q = query(
                            historyRef, 
                            where("mode", "==", "usta"),
                            where("customerName", "==", selectedUsta),
                            where("invoiceDate", "==", currentDateStr),
                            where("action", "==", "usta_item_archive")
                        );
                        const querySnapshot = await getDocs(q);

                        let existingDocId = null;
                        let existingData = null;

                        querySnapshot.forEach((docSnap) => {
                            // Sadəcə sonuncu uyğun gələn sənədi götürürük
                            existingDocId = docSnap.id;
                            existingData = docSnap.data();
                        });

                        if (existingDocId && existingData) {
                            // Əgər həmin günə aid qeyd varsa, məhsulu həmin massivə əlavə edirik
                            const updatedItems = [...(existingData.items || []), { name: item.name, qty: item.qty, price: item.price }];
                            const updatedTotal = updatedItems.reduce((sum, i) => sum + (Number(i.qty || 0) * Number(i.price || 0)), 0);

                            await updateDoc(doc(db, "history_invoices", existingDocId), {
                                items: updatedItems,
                                totalAmount: updatedTotal.toFixed(2),
                                updatedAt: serverTimestamp()
                            });
                        } else {
                            // Əgər yoxdursa, yeni sətir (qeyd) yaradırıq
                            await addDoc(historyRef, {
                                customerName: selectedUsta,
                                invoiceDate: currentDateStr,
                                items: [{ name: item.name, qty: item.qty, price: item.price }],
                                totalAmount: rowTotal.toFixed(2),
                                action: "usta_item_archive",
                                mode: "usta",
                                timestamp: serverTimestamp()
                            });
                        }

                        showNotification(`"${item.name}" uğurla Usta Arxivinə göndərildi`, "success");

                        // 3. 2 saniyə gözləyib sonra cari sətirdən silirik
                        setTimeout(async () => {
                            const allArchived = invoiceItems.every(i => i.isArchived);
                            if (allArchived) {
                                if (currentActiveDocId) {
                                    await deleteDoc(doc(db, "waiting_invoices", currentActiveDocId));
                                }
                                resetForm();
                            } else {
                                if (currentActiveDocId) {
                                    await updateDoc(doc(db, "waiting_invoices", currentActiveDocId), {
                                        items: invoiceItems,
                                        updatedAt: new Date()
                                    });
                                }
                                invoiceItems.splice(index, 1);
                                if (invoiceItems.length === 0) {
                                    invoiceItems = [{ name: '', qty: '', price: '', isArchived: false, selected: false }];
                                }
                                renderItems();
                            }
                        }, 2000);

                    } catch (err) {
                        console.error("Arxivləmə xətası:", err);
                        showNotification("Arxivə göndərilərkən xəta baş verdi!", "error");
                    }
                });
            }
        }

        itemsBody.appendChild(tr);
    });

    if (totalPriceView) {
        totalPriceView.textContent = grandTotal.toFixed(2);
    }
}

function fastCalculateTotal() {
    const total = invoiceItems.reduce((sum, item) => {
        if (item.isArchived) return sum;
        return sum + ((Number(item.qty) || 0) * (Number(item.price) || 0));
    }, 0);
    if (totalPriceView) {
        totalPriceView.textContent = total.toFixed(2);
    }
}

if (btnAddItem) {
    btnAddItem.addEventListener('click', () => {
        invoiceItems.push({ name: '', qty: '', price: '', isArchived: false, selected: false });
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
                    price: Number(item.price) || 0,
                    isArchived: false,
                    selected: false
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

function prepareOfficialPrintPage() {
    const officialPrintPage = document.getElementById('official-print-page');
    if (!officialPrintPage) return;

    const customerName = customerInput.value.trim() || '_______________';
    const dateStr = document.getElementById('flatpickr').value || '---';
    
    let grandTotal = 0;
    let itemsHTML = '';
    
    invoiceItems.forEach((item, index) => {
        if (item.isArchived) return;
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
                    <tr style="border-bottom: 1.5px solid #000;">
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
        const activeItems = invoiceItems.filter(i => !i.isArchived);
        const isFirstItemEmpty = activeItems.length === 1 && !activeItems[0].name.trim();

        // ➔ BURAYA YOXLAMA ƏLAVƏ EDİRİK: Say və ya qiymət boş olmasın
        const hasEmptyQtyOrPrice = activeItems.some(i => !i.isArchived && (i.qty === '' || i.qty === undefined || i.price === '' || i.price === undefined));

        if (!customerNameClean || isFirstItemEmpty || hasEmptyQtyOrPrice) {
            return showNotification("Müştəri adı, həmçinin hər bir məhsulun sayı və qiyməti doldurulmalıdır!", "error");
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
        
        const activeItems = invoiceItems.filter(i => !i.isArchived);
        const isFirstItemEmpty = activeItems.length === 1 && !activeItems[0].name.trim();
        
        // ➔ BURAYA YOXLAMA ƏLAVƏ EDİRİK
        const hasEmptyQtyOrPrice = activeItems.some(i => !i.isArchived && (i.qty === '' || i.qty === undefined || i.price === '' || i.price === undefined));

        if (!customerInput.value.trim() || isFirstItemEmpty || hasEmptyQtyOrPrice) {
            return showNotification("Müştəri adı, həmçinin hər bir məhsulun sayı və qiyməti doldurulmalıdır!", "error");
        }

        prepareOfficialPrintPage();
        window.print();
    });
}

const btnWaiting = document.getElementById('btn-waiting');
if (btnWaiting) {
    btnWaiting.addEventListener('click', async () => {
        const customerName = customerInput.value.trim();
        const activeItems = invoiceItems.filter(i => !i.isArchived);
        const isFirstItemEmpty = activeItems.length === 1 && !activeItems[0].name.trim();

        // ➔ BURAYA YOXLAMA ƏLAVƏ EDİRİK
        const hasEmptyQtyOrPrice = activeItems.some(i => !i.isArchived && (i.qty === '' || i.qty === undefined || i.price === '' || i.price === undefined));

        if (!customerName || isFirstItemEmpty || hasEmptyQtyOrPrice) {
            return showNotification("Müştəri adı, həmçinin hər bir məhsulun sayı və qiyməti doldurulmalıdır!", "error");
        }

        const data = {
            customerName: customerName,
            invoiceDate: document.getElementById('flatpickr').value,
            items: invoiceItems,
            status: "waiting",
            mode: invoiceMode,
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
    invoiceItems = [{ name: '', qty: 1, price: '', isArchived: false, selected: false }];
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
        const customerNameClean = customerInput.value.trim() || 'Naməlum Müştəri';
        if (invoiceItems.length === 0) return;

        let grandTotal = invoiceItems.reduce((sum, item) => {
            if (item.isArchived) return sum;
            return sum + (Number(item.qty || 0) * Number(item.price || 0));
        }, 0);

        await addDoc(collection(db, "history_invoices"), {
            customerName: customerNameClean,
            invoiceDate: document.getElementById('flatpickr').value,
            items: invoiceItems,
            totalAmount: grandTotal.toFixed(2),
            action: actionType || "completed",
            mode: invoiceMode,
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
    `;
    
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
            totalAmount = data.items.reduce((sum, item) => {
                if (item.isArchived) return sum;
                return sum + (Number(item.qty || 0) * Number(item.price || 0));
            }, 0);
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

        div.querySelector('.select-btn').addEventListener('click', async () => {
            currentActiveDocId = docId;
            if (data.invoiceDate) {
                datePicker.setDate(data.invoiceDate);
            }
            invoiceItems = data.items.map(i => ({ ...i, isArchived: !!i.isArchived, selected: !!i.selected }));
            
            // Rejimi qaiməyə uyğun tənzimləyirik
            invoiceMode = data.mode || 'musteri';
            
            if (invoiceMode === 'usta') {
                if (typeUstaBtn) typeUstaBtn.classList.add('active');
                if (typeMusteriBtn) typeMusteriBtn.classList.remove('active');
            } else {
                if (typeMusteriBtn) typeMusteriBtn.classList.add('active');
                if (typeUstaBtn) typeUstaBtn.classList.remove('active');
            }

            // Input/Select UI-ı çağırarkən birbaşa ustanın adını da ötürürük ki, seçilib düşsün
            await updateCustomerInputUI(data.customerName);

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
        const activeItems = invoiceItems.filter(i => !i.isArchived);
        const hasEmptyItemName = activeItems.length === 0 || activeItems.some(i => !i.name || !i.name.trim());
        const customerVal = customerInput ? customerInput.value.trim() : '';

        // ➔ BURAYA YOXLAMA ƏLAVƏ EDİRİK
        const hasEmptyQtyOrPrice = activeItems.some(i => !i.isArchived && (i.qty === '' || i.qty === undefined || i.price === '' || i.price === undefined));

        if (!customerVal || hasEmptyItemName || hasEmptyQtyOrPrice) {
            return showNotification("Müştəri adı, həmçinin hər bir məhsulun sayı və qiyməti doldurulmalıdır!", "error");
        }

        try {
            await addInvoiceToArchive("completed");
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


// Usta Ödəniş Modalı Məntiqi
const btnOpenUstaPayment = document.getElementById('btn-open-usta-payment');
const ustaPaymentModal = document.getElementById('usta-payment-modal');
const btnCloseUstaPayment = document.getElementById('btn-close-usta-payment');
const ustaDebtorSelect = document.getElementById('usta-debtor-select');
const ustaDebtItemsList = document.getElementById('usta-debt-items-list');
const ustaGivenAmountInput = document.getElementById('usta-given-amount');
const btnSaveUstaPayment = document.getElementById('btn-save-usta-payment');

let selectedUstaDebtsData = [];

if (btnOpenUstaPayment && ustaPaymentModal) {
    btnOpenUstaPayment.addEventListener('click', async () => {
        ustaPaymentModal.style.display = 'flex';
        ustaGivenAmountInput.value = '';
        ustaDebtItemsList.innerHTML = '<div style="color: #ef4444; text-align: center; font-size: 13px; font-weight: 600; padding: 15px;">Zəhmət olmasa usta seçin</div>';
        await loadDebtorUstalarToSelect();
    });
}

if (btnCloseUstaPayment && ustaPaymentModal) {
    btnCloseUstaPayment.addEventListener('click', () => {
        ustaPaymentModal.style.display = 'none';
    });
}

window.addEventListener('click', (e) => {
    if (e.target === ustaPaymentModal) {
        ustaPaymentModal.style.display = 'none';
    }
});

async function loadDebtorUstalarToSelect() {
    if (!ustaDebtorSelect) return;
    try {
        ustaDebtorSelect.innerHTML = '<option value="">Yüklənir...</option>';
        const ustalarSet = new Set();

        // 1. Əvvəlcə birbaşa "ustalar" kolleksiyasından qeydiyyatda olan ustaları çəkirik
        const ustalarSnap = await getDocs(collection(db, "ustalar"));
        ustalarSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.name) ustalarSet.add(data.name.trim());
        });

        // 2. Həmçinin arxivdə olan usta adlarını da əlavə edirik
        const historySnap = await getDocs(query(collection(db, "history_invoices"), where("mode", "==", "usta")));
        historySnap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.customerName) ustalarSet.add(data.customerName.trim());
        });

        // 3. Gözləmədə olan usta qaimələrini də əlavə edirik
        const waitingSnap = await getDocs(query(collection(db, "waiting_invoices"), where("mode", "==", "usta")));
        waitingSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.customerName) ustalarSet.add(data.customerName.trim());
        });

        ustaDebtorSelect.innerHTML = '<option value="">-- Usta seçin --</option>';
        Array.from(ustalarSet).sort().forEach(usta => {
            ustaDebtorSelect.innerHTML += `<option value="${usta}">${usta}</option>`;
        });
    } catch (e) {
        console.error("Usta siyahısını yükləmə xətası:", e);
        ustaDebtorSelect.innerHTML = '<option value="">-- Xəta baş verdi --</option>';
    }
}

if (ustaDebtorSelect) {
    ustaDebtorSelect.addEventListener('change', async (e) => {
        const selectedUsta = e.target.value;
        if (!selectedUsta) {
            ustaDebtItemsList.innerHTML = '<div style="color: #94a3b8; text-align: center; font-size: 12px; padding: 15px;">Əvvəlcə yuxarıdan usta seçin</div>';
            const totalView = document.getElementById('selected-items-total');
            if (totalView) totalView.innerText = '0.00';
            return;
        }

        ustaDebtItemsList.innerHTML = `
            <div style="text-align: center; padding: 15px;">
                <div class="sharp-ring-loader" style="margin: 0 auto;"></div>
            </div>
        `;
        
        try {
            selectedUstaDebtsData = [];

            // 1. Gözləmədə olan qaimələrdən malları çəkirik
            const waitingQuery = query(collection(db, "waiting_invoices"), where("mode", "==", "usta"), where("customerName", "==", selectedUsta));
            const waitingSnap = await getDocs(waitingQuery);
            waitingSnap.forEach(docSnap => {
                selectedUstaDebtsData.push({ id: docSnap.id, collectionType: "waiting_invoices", ...docSnap.data() });
            });

            // 2. Arxivdə olan qaimələrdən malları çəkirik
            const historyQuery = query(collection(db, "history_invoices"), where("mode", "==", "usta"), where("customerName", "==", selectedUsta));
            const historySnap = await getDocs(historyQuery);
            historySnap.forEach(docSnap => {
                selectedUstaDebtsData.push({ id: docSnap.id, collectionType: "history_invoices", ...docSnap.data()});
            });

            ustaDebtItemsList.innerHTML = '';
            if (selectedUstaDebtsData.length === 0) {
                ustaDebtItemsList.innerHTML = '<div style="color: #00ff0d; text-align: center; font-size: 15px; padding: 15px;">Bu ustanın adında heç bir məhsulu yoxdur.</div>';
                const totalView = document.getElementById('selected-items-total');
                if (totalView) totalView.innerText = '0.00';
                return;
            }

            const updateSelectedTotal = () => {
                let selectedSum = 0;
                const checkedBoxes = ustaDebtItemsList.querySelectorAll('.payment-item-checkbox:checked');
                
                checkedBoxes.forEach(chk => {
                    selectedSum += Number(chk.dataset.price || 0);
                });

                const totalView = document.getElementById('selected-items-total');
                if (totalView) {
                    totalView.innerText = selectedSum.toFixed(2);
                }

                // Qaytarılacaq məbləğ hesablamasını işə salırıq
                updateChangeCalculation();
            };

            selectedUstaDebtsData.forEach((inv) => {
                if (inv.items && Array.isArray(inv.items)) {
                    inv.items.forEach((item, itemIndex) => {
                        // Əgər məhsul artıq arxivləşibsə (isArchived true-dursa), göstərmirik
                        if (item.isArchived) return;

                        const itemTotalPrice = (Number(item.qty || 0) * Number(item.price || 0));

                        const rowDiv = document.createElement('div');
                        rowDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: #1c2541; padding: 8px 10px; border-radius: 6px; border: 1px solid #3a506b; font-size: 13px;';
                        rowDiv.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" class="payment-item-checkbox" data-inv-id="${inv.id}" data-col="${inv.collectionType}" data-item-idx="${itemIndex}" data-price="${itemTotalPrice}" style="width: 16px; height: 16px; cursor: pointer;">
                                <span style="color: #fff; font-weight: 600;">${item.name} (${item.qty} əd.) - <span style="font-size: 11px; color: #94a3b8;">${inv.invoiceDate || ''}</span></span>
                            </div>
                            <span style="color: #5bc0be; font-weight: bold;">${itemTotalPrice.toFixed(2)} AZN</span>
                        `;

                        // Checkbox işarələndikdə cəmi yenilə
                        const chkBox = rowDiv.querySelector('.payment-item-checkbox');
                        chkBox.addEventListener('change', updateSelectedTotal);

                        ustaDebtItemsList.appendChild(rowDiv);
                    });
                }
            });

            if (ustaDebtItemsList.children.length === 0) {
                ustaDebtItemsList.innerHTML = '<div style="color: #94a3b8; text-align: center; font-size: 12px; padding: 15px;">Bu ustanın ödənilməmiş aktiv məhsulu yoxdur.</div>';
            }

            // Hər dəfə usta dəyişəndə cəmi sıfırlayırıq
            const totalView = document.getElementById('selected-items-total');
            if (totalView) totalView.innerText = '0.00';

        } catch (err) {
            console.error("Xəta:", err);
            ustaDebtItemsList.innerHTML = '<div style="color: #ef4444; text-align: center; font-size: 12px; padding: 15px;">Məlumatı çəkmək mümkün olmadı.</div>';
        }
    });
}

// Gətirilən ödəniş dəyişdikdə və ya məhsul seçildikdə fərqi (qaytarılacaq məbləği) hesablayan funksiya
function updateChangeCalculation() {
    const totalEl = document.getElementById('selected-items-total');
    const givenInput = document.getElementById('usta-given-amount');
    const changeContainer = document.getElementById('change-amount-container');
    const changeView = document.getElementById('change-amount-view');

    if (!totalEl || !givenInput || !changeContainer || !changeView) return;

    const selectedTotal = Number(totalEl.innerText || 0);
    const givenAmount = Number(givenInput.value || 0);

    if (givenAmount > selectedTotal && selectedTotal > 0) {
        const diff = givenAmount - selectedTotal;
        changeView.innerText = diff.toFixed(2) + " AZN";
        changeContainer.style.display = 'flex';
    } else {
        changeContainer.style.display = 'none';
    }
}

// Inputa dəyər yazdıqda avtomatik işləməsi üçün
if (ustaGivenAmountInput) {
    ustaGivenAmountInput.addEventListener('input', updateChangeCalculation);
}

// Usta Ödənişini Təsdiqləmə və Seçilən Malların Bazadan Silinməsi Məntiqi
if (btnSaveUstaPayment) {
    btnSaveUstaPayment.addEventListener('click', async () => {
        const selectedUsta = ustaDebtorSelect ? ustaDebtorSelect.value : '';
        const givenAmount = Number(ustaGivenAmountInput ? ustaGivenAmountInput.value : 0);

        if (!selectedUsta) {
            showNotification("Zəhmət olmasa usta seçin!", "error");
            return;
        }

        const checkboxes = ustaDebtItemsList.querySelectorAll('.payment-item-checkbox:checked');
        if (checkboxes.length === 0) {
            showNotification("Zəhmət olmasa ödənilən məhsulları seçin!", "error");
            return;
        }

        try {
            const updatesMap = {};

            checkboxes.forEach(chk => {
                const docId = chk.dataset.invId;
                const colType = chk.dataset.col; // waiting_invoices və ya history_invoices
                const itemIdx = Number(chk.dataset.itemIdx);

                if (!updatesMap[docId]) {
                    updatesMap[docId] = {
                        colType: colType,
                        indicesToRemove: []
                    };
                }
                updatesMap[docId].indicesToRemove.push(itemIdx);
            });

            // Firebase sənədlərini yeniləyirik və ya silirik
            for (const docId in updatesMap) {
                const info = updatesMap[docId];
                const targetInv = selectedUstaDebtsData.find(d => d.id === docId);
                
                if (targetInv && targetInv.items) {
                    info.indicesToRemove.sort((a, b) => b - a);
                    
                    info.indicesToRemove.forEach(idx => {
                        targetInv.items.splice(idx, 1);
                    });

                    const docRef = doc(db, info.colType, docId);

                    if (targetInv.items.length === 0) {
                        await deleteDoc(docRef);
                    } else {
                        const newTotal = targetInv.items.reduce((sum, i) => sum + (Number(i.qty || 0) * Number(i.price || 0)), 0);
                        await updateDoc(docRef, {
                            items: targetInv.items,
                            totalAmount: newTotal.toFixed(2),
                            updatedAt: new Date()
                        });
                    }
                }
            }

            // Ödəniş qeydini arxivə əlavə edirik
            await addDoc(collection(db, "history_invoices"), {
                customerName: selectedUsta,
                invoiceDate: document.getElementById('flatpickr').value || '---',
                items: [],
                totalAmount: givenAmount.toFixed(2),
                action: "usta_payment_received",
                mode: "usta",
                timestamp: serverTimestamp()
            });

            showNotification("Usta ödənişi təsdiqləndi və seçilən mallar silindi!", "success");
            if (ustaPaymentModal) ustaPaymentModal.style.display = 'none';
            
            // Modaldakı məlumatları təmizləyirik
            ustaDebtorSelect.value = '';
            ustaDebtItemsList.innerHTML = '<div style="color: #94a3b8; text-align: center; font-size: 15px; padding: 15px;">Əvvəlcə yuxarıdan usta seçin</div>';
            ustaGivenAmountInput.value = '';
            
            const totalView = document.getElementById('selected-items-total');
            if (totalView) totalView.innerText = '0.00';
            
            const changeContainer = document.getElementById('change-amount-container');
            if (changeContainer) changeContainer.style.display = 'none';

        } catch (e) {
            console.error("Ödəniş təsdiq xətası:", e);
            showNotification("Xəta baş verdi!", "error");
        }
    });
}

