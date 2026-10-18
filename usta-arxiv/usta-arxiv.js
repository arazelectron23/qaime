import { db, collection, getDocs, query, addDoc } from "../firebase.js";
import { where, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const container = document.getElementById('usta-archive-container');
const searchInput = document.getElementById('usta-search-input');
const btnAddUstaModal = document.getElementById('btn-add-usta-modal');
const ustaModal = document.getElementById('usta-modal');
const btnCloseUstaModal = document.getElementById('btn-close-usta-modal');
const btnSaveUsta = document.getElementById('btn-save-usta');
const newUstaNameInput = document.getElementById('new-usta-name');

// Reytinq Modal Elementləri
const btnOpenRatingModal = document.getElementById('btn-open-rating-modal');
const ratingModal = document.getElementById('rating-modal');
const btnCloseRatingModal = document.getElementById('btn-close-rating-modal');

// Dropdown Elementləri
const ustaSelectTrigger = document.getElementById('usta-select-trigger');
const ustaDropdownMenu = document.getElementById('usta-dropdown-menu');
const ustaDropdownSearch = document.getElementById('usta-dropdown-search');
const ustaDropdownList = document.getElementById('usta-dropdown-list');
const selectedUstaText = document.getElementById('selected-usta-text');

let allUstaInvoices = [];
let selectedUstaFilter = '';
let allUstalarForDropdown = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchUstaArchives();

    const amountBadge = document.getElementById('usta-total-amount-badge');
    if (amountBadge) {
        amountBadge.addEventListener('click', (e) => {
            e.stopPropagation();
            amountBadge.classList.toggle('revealed');
        });
    }
});

// Dropdown Menyu Açılıb-Bağlanması
if (ustaSelectTrigger && ustaDropdownMenu) {
    ustaSelectTrigger.addEventListener('click', async (e) => {
        e.stopPropagation();
        const isOpen = ustaDropdownMenu.style.display === 'flex';
        if (isOpen) {
            ustaDropdownMenu.style.display = 'none';
        } else {
            ustaDropdownMenu.style.display = 'flex';
            if (ustaDropdownSearch) ustaDropdownSearch.value = '';
            await loadUstalarForDropdown('');
        }
    });
}

// Reytinq Modalı Açılıb-Bağlanması
if (btnOpenRatingModal && ratingModal) {
    btnOpenRatingModal.addEventListener('click', () => {
        calculateMonthlyRanking();
        ratingModal.style.display = 'flex';
    });
}

if (btnCloseRatingModal && ratingModal) {
    btnCloseRatingModal.addEventListener('click', () => {
        ratingModal.style.display = 'none';
    });
}

// Səhifənin başqa yerinə kliklədikdə modalları bağla
window.addEventListener('click', (e) => {
    if (ustaDropdownMenu && !ustaDropdownMenu.contains(e.target) && e.target !== ustaSelectTrigger) {
        ustaDropdownMenu.style.display = 'none';
    }
    if (e.target === ustaModal) {
        ustaModal.style.display = 'none';
    }
    if (e.target === ratingModal) {
        ratingModal.style.display = 'none';
    }
    const itemsModal = document.getElementById('invoice-items-modal');
    if (e.target === itemsModal) {
        itemsModal.style.display = 'none';
    }
});

// Ustaları çəkib dropdown siyahısına yığan funksiya
async function loadUstalarForDropdown(filterText = '') {
    if (!ustaDropdownList) return;
    ustaDropdownList.innerHTML = `
    <div style="text-align: center; padding: 12px 0;">
        <div class="sharp-ring-loader2" style="width: 28px; height: 28px; margin: 0 auto;"></div>
    </div>
`;
    try {
        const snap = await getDocs(collection(db, "ustalar"));
        allUstalarForDropdown = [];
        snap.forEach(docSnap => {
            allUstalarForDropdown.push(docSnap.data().name);
        });

        renderDropdownItems(filterText);
    } catch (e) {
        console.error("Ustaları yükləmə xətası:", e);
        ustaDropdownList.innerHTML = '<div style="color: #ef4444; text-align: center; padding: 10px; font-size: 12px;">Xəta baş verdi.</div>';
    }
}

function renderDropdownItems(filterText = '') {
    if (!ustaDropdownList) return;
    ustaDropdownList.innerHTML = '';
    
    ustaDropdownList.style.display = 'flex';
    ustaDropdownList.style.flexDirection = 'column';
    ustaDropdownList.style.gap = '8px';

    const allDiv = document.createElement('div');
    allDiv.style.cssText = 'padding: 8px 10px; background: #0b132b; border: 1px solid #3a506b; border-radius: 6px; cursor: pointer; color: #fff; font-size: 13px; font-weight: 600; transition: border-color 0.2s ease;';
    allDiv.innerText = 'Hamısı';
    
    allDiv.addEventListener('mouseover', () => allDiv.style.borderColor = '#5bc0be');
    allDiv.addEventListener('mouseout', () => allDiv.style.borderColor = '#3a506b');

    allDiv.addEventListener('click', () => {
        selectedUstaFilter = '';
        if (selectedUstaText) selectedUstaText.innerText = 'Hamısı';
        ustaDropdownMenu.style.display = 'none';
        applyFilters();
    });
    ustaDropdownList.appendChild(allDiv);

    const filtered = allUstalarForDropdown.filter(name => name.toLowerCase().includes(filterText.toLowerCase()));

    filtered.forEach(name => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 8px 10px; background: #0b132b; border: 1px solid #3a506b; border-radius: 6px; cursor: pointer; color: #fff; font-size: 13px; font-weight: 600; transition: border-color 0.2s ease;';
        div.innerText = `${name}`;

        div.addEventListener('mouseover', () => div.style.borderColor = '#5bc0be');
        div.addEventListener('mouseout', () => div.style.borderColor = '#3a506b');

        div.addEventListener('click', () => {
            selectedUstaFilter = name;
            if (selectedUstaText) selectedUstaText.innerText = name;
            ustaDropdownMenu.style.display = 'none';
            applyFilters();
        });

        ustaDropdownList.appendChild(div);
    });
}

if (ustaDropdownSearch) {
    ustaDropdownSearch.addEventListener('input', (e) => {
        renderDropdownItems(e.target.value.trim());
    });
}

if (btnAddUstaModal && ustaModal) {
    btnAddUstaModal.addEventListener('click', () => {
        ustaModal.style.display = 'flex';
        if (newUstaNameInput) newUstaNameInput.value = '';
        fetchAndRenderModalUstalar(); // Modal açılanda ustaları dərhal siyahıya yığır
    });
}
if (btnCloseUstaModal && ustaModal) {
    btnCloseUstaModal.addEventListener('click', () => ustaModal.style.display = 'none');
}

if (btnSaveUsta) {
    btnSaveUsta.addEventListener('click', async () => {
        const ustaName = newUstaNameInput.value.trim();
        if (!ustaName) {
            alert("Zəhmət olmasa usta adını daxil edin!");
            return;
        }
        try {
            await addDoc(collection(db, "ustalar"), { name: ustaName });
            alert("Usta uğurla əlavə edildi!");
            ustaModal.style.display = 'none';
        } catch (e) {
            console.error("Xəta:", e);
            alert("Usta əlavə edilərkən xəta baş verdi.");
        }
    });
}

async function fetchUstaArchives() {
    try {
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div class="sharp-ring-loader2"></div>
                  <div style="color: #94a3b8; margin-top: 10px; font-size: 13px;">Yüklənir...</div>
                </div>
            `;
        }

        const q = query(collection(db, "history_invoices"), where("mode", "==", "usta"));
        const querySnapshot = await getDocs(q);
        
        allUstaInvoices = [];
        querySnapshot.forEach((docSnap) => {
            allUstaInvoices.push({ id: docSnap.id, ...docSnap.data() });
        });

        allUstaInvoices.sort((a, b) => {
            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
            return timeB - timeA;
        });

        applyFilters();
    } catch (error) {
        console.error("Usta arxivini çəkərkən xəta:", error);
        if (container) {
            container.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 20px;">Məlumatları yükləmək mümkün olmadı.</p>';
        }
    }
}

function applyFilters() {
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedDate = document.getElementById('single-date-filter')?.value.trim() || '';

    const filtered = allUstaInvoices.filter(inv => {
        const matchesUsta = !selectedUstaFilter || (inv.customerName && inv.customerName.toLowerCase() === selectedUstaFilter.toLowerCase());
        
        // Axtarış sözü uyğunluğu
        const matchesSearch = !searchVal || 
            (inv.customerName && inv.customerName.toLowerCase().includes(searchVal)) ||
            (inv.items && inv.items.some(i => i.name && i.name.toLowerCase().includes(searchVal)));

       // Tarix uyğunluğu (Gün.Ay.İl formatı üçün)
        let matchesDate = true;
        if (selectedDate) {
            let invDateStr = '';
            if (inv.invoiceDate) {
                invDateStr = inv.invoiceDate;
            } else if (inv.timestamp && typeof inv.timestamp.toDate === 'function') {
                const t = inv.timestamp.toDate();
                const y = t.getFullYear();
                const m = String(t.getMonth() + 1).padStart(2, '0');
                const d = String(t.getDate()).padStart(2, '0');
                invDateStr = `${d}.${m}.${y}`;
            }
            matchesDate = (invDateStr === selectedDate);
        }

        return matchesUsta && matchesSearch && matchesDate;
    });

    renderUstaList(filtered);
    updateSelectedUstaTotalAmount();
}

function renderUstaList(invoices) {
    if (!container) return;
    container.innerHTML = '';

    if (invoices.length === 0) {
        container.innerHTML = '<p style="color: #ff0000; text-align: center; padding: 60px;">Məlumat tapılmadı.</p>';
        return;
    }

    invoices.forEach((inv) => {
       const card = document.createElement('div');
        card.style.cssText = 'background: #1c2541; border: 1px solid #3a506b; border-radius: 8px; padding: 15px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; cursor: pointer; transition: border-color 0.2s ease;';

        card.addEventListener('mouseover', () => card.style.borderColor = '#5bc0be');
        card.addEventListener('mouseout', () => card.style.borderColor = '#3a506b');

        card.className = 'usta-archive-card'; 
        card.innerHTML = `
            <div class="usta-card-left">
                <div class="usta-card-name">${inv.customerName || 'Naməlum'}</div>
                <div class="usta-card-date">📅 ${inv.invoiceDate || '---'}</div>
            </div>
            <div class="usta-card-right">
                <div class="usta-card-meta">
                    <span class="usta-card-price">${inv.totalAmount || '0.00'} AZN</span>
                </div>
                <button class="btn-delete-archive" data-id="${inv.id}" title="Arxivdən sil">Sil</button>
            </div>
        `;

        const itemsModal = document.getElementById('invoice-items-modal');
        const closeItemsModal = document.getElementById('btn-close-items-modal');

        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-delete-archive') || e.target.closest('.btn-confirm-yes') || e.target.closest('.btn-confirm-no')) {
                return;
            }

            const modalUstaName = document.getElementById('modal-usta-name');
            const modalInvoiceDate = document.getElementById('modal-invoice-date');
            const modalTableBody = document.getElementById('modal-items-table-body');
            const modalGrandTotal = document.getElementById('modal-grand-total');

            if (modalUstaName) modalUstaName.innerText = inv.customerName || 'Naməlum';
            if (modalInvoiceDate) modalInvoiceDate.innerText = `Tarix: ${inv.invoiceDate || '---'}`;

            if (modalTableBody) {
                modalTableBody.innerHTML = '';
                let grandTotal = 0;

let itemsList = [];
const rawItems = inv.items || inv.products || inv.goods || inv.cart || [];

if (Array.isArray(rawItems)) {
    itemsList = rawItems;
} else if (rawItems) {
    itemsList = [rawItems];
}

// Əgər items massivi boşdursa (məsələn, usta ödənişi qeydisə), ancaq ümumi məbləğ varsa, onu siyahıya bir sətir kimi əlavə edirik ki, "Məhsul tapılmadı" düşməsin
if (itemsList.length === 0 && inv.totalAmount) {
    itemsList = [{
        name: inv.action === 'usta_payment_received' ? 'Usta Ödənişi' : 'Ümumi Məbləğ / Ödəniş',
        qty: 1,
        price: Number(inv.totalAmount || 0)
    }];
}
                if (itemsList.length > 0) {
                    itemsList.forEach((item, idx) => {
                        const qty = Number(item.qty || 0);
                        const price = Number(item.price || 0);
                        const rowTotal = qty * price;
                        grandTotal += rowTotal;

                        const tr = document.createElement('tr');
                        tr.style.borderBottom = '1px solid rgba(58, 80, 107, 0.4)';
                        tr.innerHTML = `
                            <td style="padding: 10px 6px; color: #94a3b8;">${idx + 1}</td>
                            <td style="padding: 10px 6px; color: #fff; font-weight: 600;">${item.name || '---'}</td>
                            <td style="padding: 10px 6px; text-align: center; color: #cbd5e1;">${qty}</td>
                            <td style="padding: 10px 6px; text-align: right; color: #cbd5e1;">${price.toFixed(2)}</td>
                            <td style="padding: 10px 6px; text-align: right; color: #5bc0be; font-weight: 700;">${rowTotal.toFixed(2)}</td>
                        `;
                        modalTableBody.appendChild(tr);
                    });
                } else {
                    modalTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">Məhsul tapılmadı.</td></tr>`;
                }

                if (modalGrandTotal) {
                    modalGrandTotal.innerText = `${Number(inv.totalAmount || grandTotal).toFixed(2)}`;
                }
            }

            if (itemsModal) itemsModal.style.display = 'flex';
        });

        if (closeItemsModal && itemsModal) {
            closeItemsModal.addEventListener('click', () => {
                itemsModal.style.display = 'none';
            });
        }

        const deleteBtn = card.querySelector('.btn-delete-archive');
        const actionArea = deleteBtn.parentElement;

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteBtn.style.display = 'none';

            const confirmBox = document.createElement('div');
            confirmBox.style.cssText = 'display: flex; gap: 6px; align-items: center;';
            confirmBox.innerHTML = `
                <span style="font-size: 12px; color: #facc15; font-weight: 600;">Silinsin?</span>
                <button class="btn-confirm-yes" style="background: #10b981; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">Bəli</button>
                <button class="btn-confirm-no" style="background: #64748b; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">Xeyr</button>
            `;

            confirmBox.querySelector('.btn-confirm-yes').addEventListener('click', async (eSub) => {
                eSub.stopPropagation();
                try {
                    await deleteDoc(doc(db, "history_invoices", inv.id));
                    card.remove();
                    if (container.children.length === 0) {
                        container.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 30px;">Usta arxivində heç bir məlumat tapılmadı.</p>';
                    }
                } catch (err) {
                    console.error("Silmə xətası:", err);
                    alert("Silmək mümkün olmadı!");
                }
            });

            confirmBox.querySelector('.btn-confirm-no').addEventListener('click', (eSub) => {
                eSub.stopPropagation();
                confirmBox.remove();
                deleteBtn.style.display = 'inline-block';
            });

            actionArea.appendChild(confirmBox);
        });

        container.appendChild(card);
    });
}

if (searchInput) {
    searchInput.addEventListener('input', () => {
        applyFilters();
    });
}

function updateSelectedUstaTotalAmount() {
    let total = 0;
    allUstaInvoices.forEach(inv => {
        const matchesUsta = !selectedUstaFilter || (inv.customerName && inv.customerName.toLowerCase() === selectedUstaFilter.toLowerCase());
        if (matchesUsta) {
            total += Number(inv.totalAmount || 0);
        }
    });

    const badge = document.getElementById('usta-total-amount-badge');
    if (badge) {
        badge.innerText = `${total.toFixed(2)} AZN`;
    }
}

const ratingMonthSelect = document.getElementById('rating-month-select');

if (btnOpenRatingModal && ratingModal) {
    btnOpenRatingModal.addEventListener('click', () => {
        populateMonthDropdown();
        ratingModal.style.display = 'flex';
    });
}

if (ratingMonthSelect) {
    ratingMonthSelect.addEventListener('change', () => {
        calculateMonthlyRanking(ratingMonthSelect.value);
    });
}

function populateMonthDropdown() {
    if (!ratingMonthSelect) return;
    ratingMonthSelect.innerHTML = '';

    const monthsSet = new Set();

    // 1. Cari ay və son 12 ayı avtomatik əlavə edirik (keçmiş ayarları seçə bilmək üçün)
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        monthsSet.add(`${mm}.${yyyy}`);
    }

    // 2. Arxivdə olan digər mövcud tarixləri də əlavə edirik (əgər 1 ildən köhnə qeyd varsa)
    allUstaInvoices.forEach(inv => {
        if (inv.invoiceDate && inv.invoiceDate.includes('.')) {
            const parts = inv.invoiceDate.split('.');
            if (parts.length === 3) {
                const mm = parts[1];
                const yyyy = parts[2];
                monthsSet.add(`${mm}.${yyyy}`);
            }
        }
    });

    // Tarixləri ən yeni aydan köhnəyə doğru sıralayırıq
    const sortedMonths = Array.from(monthsSet).sort((a, b) => {
        const [mA, yA] = a.split('.');
        const [mB, yB] = b.split('.');
        return new Date(yB, mB - 1) - new Date(yA, mA - 1);
    });

    sortedMonths.forEach(my => {
        const opt = document.createElement('option');
        opt.value = my;
        opt.innerText = formatMonthName(my);
        ratingMonthSelect.appendChild(opt);
    });

    if (sortedMonths.length > 0) {
        ratingMonthSelect.value = sortedMonths[0]; // Siyahıdan birinci (cari) ayı seçirik
        calculateMonthlyRanking(sortedMonths[0]); // Həmin ayın dəyərini göndəririk
    }
}

function formatMonthName(myStr) {
    const [m, y] = myStr.split('.');
    const monthNames = {
        "01": "Yanvar", "02": "Fevral", "03": "Mart", "04": "Aprel",
        "05": "May", "06": "İyun", "07": "İyul", "08": "Avqust",
        "09": "Sentyabr", "10": "Oktyabr", "11": "Noyabr", "12": "Dekabr"
    };
    return `${monthNames[m] || m} ${y}`;
}

function calculateMonthlyRanking(selectedMonthYear) {
    const topUstaNameEl = document.getElementById('modal-top-usta-name');
    const topUstaAmountEl = document.getElementById('modal-top-usta-amount');
    const periodLabelEl = document.getElementById('rating-period-label');

    if (!topUstaNameEl || !topUstaAmountEl) return;

    if (periodLabelEl && selectedMonthYear) {
        periodLabelEl.innerText = `${formatMonthName(selectedMonthYear)} Üzrə Birinci`;
    }

    if (allUstaInvoices.length === 0) {
        topUstaNameEl.innerText = "Məlumat yoxdur";
        topUstaAmountEl.innerText = "0.00 AZN";
        return;
    }

    const ustaTotals = {};

    allUstaInvoices.forEach(inv => {
        if (inv.invoiceDate && inv.invoiceDate.includes('.')) {
            const parts = inv.invoiceDate.split('.');
            if (parts.length === 3) {
                const invMonth = parts[1]; // Ay
                const invYear = parts[2]; // İl
                const invMY = `${invMonth}.${invYear}`;

                if (invMY === selectedMonthYear) {
                    const ustaName = inv.customerName || 'Naməlum';
                    const amount = Number(inv.totalAmount || 0);
                    ustaTotals[ustaName] = (ustaTotals[ustaName] || 0) + amount;
                }
            }
        }
    });

    let topUsta = null;
    let maxAmount = 0;

    for (const [usta, total] of Object.entries(ustaTotals)) {
        if (total > maxAmount) {
            maxAmount = total;
            topUsta = usta;
        }
    }

    if (topUsta) {
        topUstaNameEl.innerText = topUsta;
        topUstaAmountEl.innerText = `${maxAmount.toFixed(2)} AZN`;
    } else {
        topUstaNameEl.innerText = "Bu ay sifariş yoxdur";
        topUstaAmountEl.innerText = "0.00 AZN";
    }
}

async function fetchAndRenderModalUstalar() {
    const listContainer = document.getElementById('usta-list-modal-container');
    if (!listContainer) return;

    listContainer.innerHTML = `
    <div style="text-align: center; padding: 20px;">
        <div class="sharp-ring-loader2" style="width: 35px; height: 35px; margin: 0 auto;"></div>
    </div>
`;

    try {
        const querySnapshot = await getDocs(collection(db, "ustalar"));
        listContainer.innerHTML = '';

        if (querySnapshot.empty) {
            listContainer.innerHTML = '<div style="color: #94a3b8; text-align: center; font-size: 12px; padding: 10px;">Hələ usta əlavə olunmayıb.</div>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const ustaData = docSnap.data();
            const ustaId = docSnap.id;

            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: #1c2541; padding: 8px 12px; border-radius: 6px; border: 1px solid #3a506b; margin-bottom: 6px;';
            
            itemDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; flex: 1;" class="usta-name-area">
                    <span class="usta-name-text" style="color: #fff; font-size: 13px; font-weight: 600;">${ustaData.name}</span>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <button class="btn-edit-usta" title="Adı dəyiş" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">✏️</button>
                    <button class="btn-delete-usta-modal" data-id="${ustaId}" style="background: #ef4444; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">Sil</button>
                </div>
            `;

            // Qələm (Redaktə) düyməsi funksionallığı
            const editBtn = itemDiv.querySelector('.btn-edit-usta');
            const nameArea = itemDiv.querySelector('.usta-name-area');
            const actionButtonsContainer = editBtn.parentElement;

            editBtn.addEventListener('click', () => {
                nameArea.innerHTML = `<input type="text" class="edit-usta-input" value="${ustaData.name}" style="background: #0b132b; border: 1px solid #5bc0be; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 13px; font-weight: 600; outline: none; width: 100%;">`;
                
                editBtn.style.display = 'none';

                const saveCancelBox = document.createElement('div');
                saveCancelBox.style.cssText = 'display: flex; gap: 4px; align-items: center;';
                saveCancelBox.innerHTML = `
                    <button class="btn-save-edit" style="background: #10b981; color: #fff; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">Yadda saxla</button>
                    <button class="btn-cancel-edit" style="background: #64748b; color: #fff; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">Ləğv et</button>
                `;

                const inputField = nameArea.querySelector('.edit-usta-input');
                inputField.focus();

                saveCancelBox.querySelector('.btn-save-edit').addEventListener('click', async () => {
                    const newName = inputField.value.trim();
                    if (!newName) {
                        alert("Usta adı boş ola bilməz!");
                        return;
                    }
                    try {
                        await updateDoc(doc(db, "ustalar", ustaId), { name: newName });
                        fetchAndRenderModalUstalar();
                    } catch (err) {
                        console.error("Yeniləmə xətası:", err);
                        alert("Adı yeniləmək mümkün olmadı!");
                    }
                });

                saveCancelBox.querySelector('.btn-cancel-edit').addEventListener('click', () => {
                    fetchAndRenderModalUstalar();
                });

                actionButtonsContainer.prepend(saveCancelBox);
            });

            // Silmə funksionallığı
            itemDiv.querySelector('.btn-delete-usta-modal').addEventListener('click', () => {
                const deleteBtn = itemDiv.querySelector('.btn-delete-usta-modal');
                deleteBtn.style.display = 'none';

                const confirmBox = document.createElement('div');
                confirmBox.style.cssText = 'display: flex; gap: 6px; align-items: center;';
                confirmBox.innerHTML = `
                    <span style="font-size: 12px; color: #facc15; font-weight: 600;">Silinsin?</span>
                    <button class="btn-yes" style="background: #10b981; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">Bəli</button>
                    <button class="btn-no" style="background: #ef4444; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">Xeyr</button>
                `;

                confirmBox.querySelector('.btn-yes').addEventListener('click', async () => {
                    try {
                        await deleteDoc(doc(db, "ustalar", ustaId));
                        itemDiv.remove();
                        if (listContainer.children.length === 0) {
                            listContainer.innerHTML = '<div style="color: #94a3b8; text-align: center; font-size: 12px; padding: 10px;">Hələ usta əlavə olunmayıb.</div>';
                        }
                    } catch (err) {
                        console.error("Silmə xətası:", err);
                        alert("Ustanı silmək mümkün olmadı!");
                    }
                });

                confirmBox.querySelector('.btn-no').addEventListener('click', () => {
                    confirmBox.remove();
                    deleteBtn.style.display = 'inline-block';
                });

                deleteBtn.parentElement.appendChild(confirmBox);
            });

            listContainer.appendChild(itemDiv);
        });
    } catch (e) {
        console.error("Ustaları oxuyarkən xəta:", e);
        listContainer.innerHTML = '<div style="color: #ef4444; text-align: center; font-size: 12px;">Məlumatları yükləmək olmadı.</div>';
    }
}

let singleDatePicker = null; // Qlobal təqvim dəyişəni

document.addEventListener('DOMContentLoaded', () => {
    fetchUstaArchives();

    // Təqvim işə salınır (Gün.Ay.İl formatı ilə)
    singleDatePicker = flatpickr("#single-date-filter", {
        locale: flatpickr.l10ns.az,
        dateFormat: "d.m.Y", // Bura dəyişdirildi
        allowInput: true,
        onChange: function(selectedDates, dateStr) {
            applyFilters();
        }
    });

    // Tarixi sıfırlama düyməsi
    const btnResetDate = document.getElementById('btn-reset-date');
    if (btnResetDate) {
        btnResetDate.addEventListener('click', () => {
            if (singleDatePicker) singleDatePicker.clear();
            applyFilters();
        });
    }
});

// DELİGATION: Səhifənin harasında olmasından asılı olmayaraq həmin badge-ə klikləndikdə işləyəcək
document.addEventListener('click', (e) => {
    const amountBadge = e.target.closest('#usta-total-amount-badge');
    if (amountBadge) {
        e.stopPropagation();
        amountBadge.classList.toggle('revealed');
    }
});