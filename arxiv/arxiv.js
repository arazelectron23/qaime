import { db, collection, getDocs, query, orderBy } from "../firebase.js";
// Firebase-dən silmə funksiyalarını birbaşa rəsmi CDN-dən çəkirik
import { deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// YAŞIL VƏ QIRMIZI BİLDİRİŞ FUNKSİYASI
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
        notification.style.backgroundColor = '#10b981'; // Yaşıl
        notification.style.borderLeft = '5px solid #047857';
    } else {
        notification.style.backgroundColor = '#ef4444'; // Qırmızı
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

const archiveTbody = document.getElementById('archive-tbody');
const btnFilter = document.getElementById('btn-filter');
const btnClear = document.getElementById('btn-clear');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');

// Cədvəlin başlığındakı Tarix sütununu tənzimləyirik
const dateHeader = document.querySelector('table thead tr th:nth-child(1)');
if (dateHeader) {
    dateHeader.textContent = "Tarix";
}

// Əməliyyatlar başlığını düzgün təyin edirik
const actionHeader = document.querySelector('table thead tr th:nth-child(4)');
if (actionHeader) {
    actionHeader.innerHTML = `<span id="th-delete-trigger" style="cursor:pointer; color:#ef4444; border-bottom:1px dashed #ef4444; padding-bottom:2px;">SİL</span>`;
}

let allInvoices = [];
let isSelectMode = false; // Seçim rejiminin aktiv olub-olmadığını izləyirik
let searchInput = null;   // Axtarış inputu üçün dəyişən

document.addEventListener('DOMContentLoaded', () => {
    // Tarix formatını birbaşa Y-m-d edirik ki, filtrləmədə problem yaranmasın
    flatpickr("#start-date", { locale: "az", dateFormat: "Y-m-d" });
    flatpickr("#end-date", { locale: "az", dateFormat: "Y-m-d" });
    
    initSearchInput(); 
    fetchArchiveList();
    initDeleteTrigger();
});

let totalAmountSpan = null; // Məbləğin yazıldığı element üçün qlobal dəyişən
let isAmountVisible = false; // Gözün ilkin vəziyyəti (gizli)

// ÜMUMİ MƏBLƏĞ VƏ GÖZ BÖLMƏSİNİN YARADILMASI
function initSearchInput() {
    const container = btnClear?.parentElement;
    if (!container) return;

    container.style.display = "flex";
    container.style.flexWrap = "nowrap";
    container.style.alignItems = "center";
    container.style.gap = "8px";

    searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'archive-search-input';
    searchInput.placeholder = 'Müştəri axtar...';
    
    searchInput.style.cssText = `
        background: #0f172a;
        border: 1px solid #1e293b;
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 14px;
        outline: none;
        width: 150px;
        flex-shrink: 1;
        transition: border-color 0.2s, box-shadow 0.2s;
    `;

    searchInput.addEventListener('focus', () => {
        searchInput.style.borderColor = '#5bc0be';
        searchInput.style.boxShadow = '0 0 6px rgba(91, 192, 190, 0.3)';
    });
    searchInput.addEventListener('blur', () => {
        searchInput.style.borderColor = '#1e293b';
        searchInput.style.boxShadow = 'none';
    });

    searchInput.addEventListener('input', () => {
        applyAllFilters();
    });

    container.appendChild(searchInput);

    // ÜMUMİ MƏBLƏĞ VƏ GÖZ BÖLMƏSİNİN YARADILMASI (Başlanğıcda tam bulanıq/gizli *** ilə)
    const totalBox = document.createElement('div');
    totalBox.className = 'total-amount-box';
    totalBox.innerHTML = `
        <span class="label-text">Ümumi:</span>
        <span class="amount-value" id="archive-total-value" style="filter: blur(5px); transition: filter 0.2s ease; cursor: pointer;" title="Göstərmək üçün klikləyin">********</span>
        <button class="btn-toggle-visibility" id="btn-toggle-amount" title="Göstər / Gizlət"></button>
    `;

    container.appendChild(totalBox);

    totalAmountSpan = document.getElementById('archive-total-value');
    const toggleBtn = document.getElementById('btn-toggle-amount');

    // Həm göz düyməsinə, həm də ulduzların üzərinə kliklədikdə açılıb-bağlansın
    const toggleVisibility = () => {
        isAmountVisible = !isAmountVisible;
        updateTotalDisplay(window.currentFilteredInvoices || allInvoices);
    };

    toggleBtn.addEventListener('click', toggleVisibility);
    totalAmountSpan.addEventListener('click', toggleVisibility);
}
s

async function fetchArchiveList() {
    archiveTbody.innerHTML = `
        <tr>
            <td colspan="4">
                <div class="loading-wrapper">
                    <div class="sharp-ring-loader"></div>
                </div>
            </td>
        </tr>
    `;

    try {
        let q = query(collection(db, "history_invoices"), orderBy("timestamp", "desc"));
        let snap = await getDocs(q);
        
        if(snap.empty) {
            q = query(collection(db, "invoices"), orderBy("timestamp", "desc"));
            snap = await getDocs(q);
        }

        archiveTbody.innerHTML = '';
        allInvoices = [];

        if (snap.empty) {
            archiveTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#9ca3af; padding: 25px;">Arxivdə heç bir sənəd tapılmadı.</td></tr>';
            return;
        }

        snap.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            data.id = docSnapshot.id;
            allInvoices.push(data);
        });

        renderArchiveTable(allInvoices);

    } catch (error) {
        console.error("Xəta:", error);
        archiveTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#ef4444; padding: 25px;">Məlumatlar gəlmədi. Firebase yollarını yoxlayın.</td></tr>';
    }
}

function renderArchiveTable(dataArray) {
    archiveTbody.innerHTML = '';

    if (dataArray.length === 0) {
        archiveTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#9ca3af; padding: 25px;">Axtarışa uyğun sənəd tapılmadı.</td></tr>';
        return;
    }

    dataArray.forEach((data) => {
      let dateStr = "---";
        if (data.timestamp) {
            const t = data.timestamp.toDate();
            // Yalnız tarix, saat olmadan və gün.ay.il formatında
            dateStr = String(t.getDate()).padStart(2, '0') + "." + 
                      String(t.getMonth() + 1).padStart(2, '0') + "." + 
                      t.getFullYear();
        }

        const tr = document.createElement('tr');
        tr.setAttribute('data-id', data.id);
        
        tr.innerHTML = `
            <td class="date-cell" style="white-space: nowrap;">
                <div style="display: inline-flex; align-items: center; gap: 10px;">
                    <label class="custom-checkbox-wrapper" style="display: ${isSelectMode ? 'inline-flex' : 'none'};">
                        <input type="checkbox" class="archive-select-checkbox" data-id="${data.id}">
                        <span class="checkmark"></span>
                    </label>
                    <span class="date-text">${dateStr}</span>
                </div>
            </td>
           <td style="font-weight: 700;">
    <div class="customer-name-cell">
        <span class="customer-name">${data.customerName || 'Naməlum Müştəri'}</span>
        <button class="btn-edit-name" onclick="editCustomerName(this, '${data.id}')">✏️</button>
    </div>
</td>
            <td style="text-align: right; font-weight: bold; color: #5bc0be;">${Number(data.totalAmount || 0).toFixed(2)} AZN</td>
           <td style="text-align: center; position: relative;">
                <div class="action-cell-buttons">
                    <button class="btn-view">Bax</button>
                    <button class="btn-download">Yüklə (PDF)</button>
                    <button class="btn-print-row">Çap Et</button>
                    <button class="btn-delete-archive">Sil</button>
                </div>
            </td>
        `;

        tr.querySelector('.btn-view').addEventListener('click', () => { openItemsModal(data, dateStr); });
        tr.querySelector('.btn-download').addEventListener('click', () => { exportToPDF(data, dateStr); });
        tr.querySelector('.btn-print-row').addEventListener('click', () => { printInvoice(data, dateStr); });

        const btnDelete = tr.querySelector('.btn-delete-archive');
        const actionCell = tr.querySelector('.action-cell-buttons');

        btnDelete.addEventListener('click', () => {
            btnDelete.style.display = 'none';

            const confirmBox = document.createElement('div');
            confirmBox.className = 'archive-confirm-box';
            confirmBox.innerHTML = `
                <span>Silinsin?</span>
                <button class="btn-yes">Bəli</button>
                <button class="btn-no">Xeyr</button>
            `;

            confirmBox.querySelector('.btn-yes').addEventListener('click', async () => {
                try {
                    await deleteDoc(doc(db, "history_invoices", data.id)).catch(async () => {
                        await deleteDoc(doc(db, "invoices", data.id));
                    });
                    
                    tr.remove();
                    allInvoices = allInvoices.filter(inv => inv.id !== data.id);
                    
                    showNotification("Qaimə arxivdən silindi!", "success");

                    if(allInvoices.length === 0) {
                        archiveTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#9ca3af; padding: 25px;">Arxivdə heç bir sənəd tapılmadı.</td></tr>';
                    }
                } catch (err) {
                    showNotification("Silərkən xəta baş verdi!", "error");
                    console.error(err);
                }
            });

            confirmBox.querySelector('.btn-no').addEventListener('click', () => {
                confirmBox.remove();
                btnDelete.style.display = 'inline-block';
            });

            actionCell.appendChild(confirmBox);
        });

        archiveTbody.appendChild(tr);
    });
}

function applyAllFilters() {
    const startVal = startDateInput.value; // Artıq flatpickr sayəsində "YYYY-MM-DD" formatında gələcək
    const endVal = endDateInput.value;
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : "";

    let filtered = allInvoices.filter(invoice => {
        if (startVal || endVal) {
            if (!invoice.timestamp) return false;
            
            // Firebase timestamp-ini YYYY-MM-DD formatına çeviririk
            const t = invoice.timestamp.toDate();
            const year = t.getFullYear();
            const month = String(t.getMonth() + 1).padStart(2, '0');
            const day = String(t.getDate()).padStart(2, '0');
            const checkDate = `${year}-${month}-${day}`;

            if (startVal && endVal && (checkDate < startVal || checkDate > endVal)) return false;
            if (startVal && !endVal && checkDate < startVal) return false;
            if (!startVal && endVal && checkDate > endVal) return false;
        }

        if (searchVal) {
            const customerName = (invoice.customerName || 'naməlum müştəri').toLowerCase();
            if (!customerName.includes(searchVal)) return false;
        }

        return true;
    });

    window.currentFilteredInvoices = filtered; 
    updateTotalDisplay(filtered);
    renderArchiveTable(filtered);
}

function initDeleteTrigger() {
    const trigger = document.getElementById('th-delete-trigger');
    const filterBtnContainer = btnClear?.parentElement;
    
    if (!trigger || !filterBtnContainer) return;

    let btnSelectAll = document.getElementById('btn-select-all-dynamic');
    let btnBulkDelete = document.getElementById('btn-bulk-delete') || document.getElementById('btn-bulk-delete-dynamic');
    
    if (btnSelectAll) btnSelectAll.remove();
    if (btnBulkDelete) btnBulkDelete.remove();

    btnSelectAll = document.createElement('button');
    btnSelectAll.id = 'btn-select-all-dynamic';
    btnSelectAll.textContent = 'Hamısını Seç';

    // Sətirbərəst bütün dizaynı sildik, sadəcə başlanğıcda gizli qalması hissəsini saxlayırıq
    btnSelectAll.style.display = 'none';    const bulkActionWrapper = document.createElement('div');
    bulkActionWrapper.id = 'bulk-action-wrapper';
    bulkActionWrapper.style.cssText = "display: none; vertical-align: middle; flex-shrink: 0;";

   btnBulkDelete = document.createElement('button');
   btnBulkDelete.id = 'btn-bulk-delete';
   btnBulkDelete.textContent = 'Sil';

   bulkActionWrapper.appendChild(btnBulkDelete);
   filterBtnContainer.appendChild(btnSelectAll);
   filterBtnContainer.appendChild(bulkActionWrapper);

    function updateSelectAllButtonText() {
        const checkboxes = document.querySelectorAll('.archive-select-checkbox');
        if (checkboxes.length === 0) return;
        
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        if (allChecked) {
            btnSelectAll.textContent = 'Seçimi Ləğv Et';
        } else {
            btnSelectAll.textContent = 'Hamısını Seç';
        }
    }

    trigger.addEventListener('click', () => {
        const wrappers = document.querySelectorAll('.custom-checkbox-wrapper');
        const checkboxes = document.querySelectorAll('.archive-select-checkbox');
        
        if (!isSelectMode) {
            isSelectMode = true;
            trigger.textContent = "BAĞLA ✕";
            
            wrappers.forEach(wrap => wrap.style.display = 'inline-flex');
            btnSelectAll.style.display = 'inline-block';
            bulkActionWrapper.style.display = 'inline-flex';

            checkboxes.forEach(cb => {
                cb.removeEventListener('change', updateSelectAllButtonText);
                cb.addEventListener('change', updateSelectAllButtonText);
            });
            updateSelectAllButtonText();
        } else {
            isSelectMode = false;
            trigger.textContent = "SİL";
            
            wrappers.forEach(wrap => wrap.style.display = 'none');
            checkboxes.forEach(cb => cb.checked = false);
            btnSelectAll.textContent = 'Hamısını Seç';
            btnSelectAll.style.display = 'none';
            bulkActionWrapper.style.display = 'none';
            resetBulkDeleteButton();
        }
    });

    btnSelectAll.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.archive-select-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);

        if (allChecked) {
            checkboxes.forEach(cb => cb.checked = false);
            btnSelectAll.textContent = 'Hamısını Seç';
        } else {
            checkboxes.forEach(cb => cb.checked = true);
            btnSelectAll.textContent = 'Seçimi Ləğv Et';
        }
    });

    function resetBulkDeleteButton() {
        bulkActionWrapper.innerHTML = '';
        bulkActionWrapper.appendChild(btnBulkDelete);
        btnBulkDelete.style.display = 'inline-block';
    }

    btnBulkDelete.addEventListener('click', () => {
        const checkedBoxes = document.querySelectorAll('.archive-select-checkbox:checked');
        
        if (checkedBoxes.length === 0) {
            // alert əvəzinə qırmızı xəbərdarlıq bildirişi
            return showNotification("Zəhmət olmasa silmək istədiyiniz qaimələri sol tərəfdən işarələyin!", "error");
        }

        btnBulkDelete.style.display = 'none';

        const confirmContainer = document.createElement('div');
        confirmContainer.style.cssText = "display: flex; align-items: center; justify-content: center; gap: 4px; background: #1e1b29; border: 1px solid #ef4444; padding: 4px; border-radius: 6px; width: 80px; box-sizing: border-box; flex-shrink: 0;";
        confirmContainer.innerHTML = `
            <button class="btn-bulk-yes" style="background: #ef4444; color: #fff; border: none; padding: 4px 0; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px; flex: 1; text-align: center; white-space: nowrap;">Bəli</button>
            <button class="btn-bulk-no" style="background: #27272a; color: #a1a1aa; border: 1px solid #3f3f46; padding: 4px 0; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px; flex: 1; text-align: center; white-space: nowrap;">Xeyr</button>
        `;

        confirmContainer.querySelector('.btn-bulk-yes').addEventListener('click', async () => {
            const currentChecked = document.querySelectorAll('.archive-select-checkbox:checked');
            if (currentChecked.length === 0) return;

            const totalToDelete = currentChecked.length;
            confirmContainer.innerHTML = `<span style="color: #ef4444; font-size: 11px; font-weight: bold; white-space: nowrap;">...</span>`;

            const deletePromises = Array.from(currentChecked).map(async (cb) => {
                const id = cb.getAttribute('data-id');
                return deleteDoc(doc(db, "history_invoices", id)).catch(async () => {
                    await deleteDoc(doc(db, "invoices", id));
                }).then(() => {
                    const tr = document.querySelector(`tr[data-id="${id}"]`);
                    if (tr) tr.remove();
                    allInvoices = allInvoices.filter(inv => inv.id !== id);
                });
            });

            Promise.all(deletePromises).then(() => {
                isSelectMode = false;
                trigger.textContent = "SİL";
                btnSelectAll.textContent = 'Hamısını Seç';
                
                btnSelectAll.style.display = 'none';
                bulkActionWrapper.style.display = 'none';
                resetBulkDeleteButton();
                
                const wrappers = document.querySelectorAll('.custom-checkbox-wrapper');
                wrappers.forEach(wrap => wrap.style.display = 'none');

                showNotification(`${totalToDelete} ədəd qaimə uğurla silindi!`, "success");

                if (allInvoices.length === 0) {
                    archiveTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#9ca3af; padding: 25px;">Arxivdə heç bir sənəd tapılmadı.</td></tr>';
                }
            }).catch(err => {
                showNotification("Toplu silmə zamanı xəta yarandı!", "error");
                console.error(err);
                resetBulkDeleteButton();
            });
        });

        confirmContainer.querySelector('.btn-bulk-no').addEventListener('click', () => {
            resetBulkDeleteButton();
        });

        bulkActionWrapper.appendChild(confirmContainer);
    });
}

function buildInvoiceHTML(data, dateStr) {
    let itemsHTML = '';
    if (data.items && data.items.length > 0) {
        data.items.forEach((item, index) => {
            itemsHTML += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px 5px; text-align: center; font-size: 13px;">${index + 1}</td>
                    <td style="padding: 10px 5px; text-align: left; font-size: 13px;">${item.name || '---'}</td>
                    <td style="padding: 10px 5px; text-align: center; font-size: 13px;">${item.qty}</td>
                    <td style="padding: 10px 5px; text-align: right; font-size: 13px;">${Number(item.price).toFixed(2)}</td>
                    <td style="padding: 10px 5px; text-align: right; font-weight: 700; font-size: 13px;">${(item.qty * item.price).toFixed(2)}</td>
                </tr>`;
        });
    }

    return `
        <div style="padding: 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #000; background: #fff; min-height: 842px; position: relative; box-sizing: border-box;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 45px;">
                <tr>
                    <td style="vertical-align: top; width: 50%;">
                        <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; letter-spacing: 0.5px; color: #000;">SATIŞ QAİMƏSİ</h1>
                        <div style="font-size: 10px; color: #666; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">KİMƏ (MÜŞTƏRİ):</div>
                        <div style="font-size: 15px; font-weight: 700; border-bottom: 1px solid #1e293b; padding-bottom: 4px; width: 260px; word-wrap: break-word;">
                            ${data.customerName || '_______________'}
                        </div>
                        <div style="font-size: 12px; color: #444; margin-top: 10px;">
                            <strong>Tarix:</strong> ${dateStr}
                        </div>
                    </td>
                    <td style="text-align: right; vertical-align: top; width: 50%; font-size: 12px; line-height: 1.5; color: #444;">
                        <div style="font-size: 19px; font-weight: 800; color: #000; margin-bottom: 4px; letter-spacing: 0.5px;">ARAZ ELECTRON</div>
                        <div style="font-size: 11px; color: #666; margin-bottom: 6px;">Elektronika və Texniki Dəstək Xidmətləri</div>
                        <div>📍 Beyləqan r. Magistral yol</div>
                        <div>🌐 arazelectron.com</div>
                        <div>✉️ info@arazelectron.com</div>
                        <div>📞 +994505946771</div>
                    </td>
                </tr>
            </table>

            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="border-bottom: 1.5px solid #1e293b;">
                        <th style="padding: 8px 5px; text-align: center; font-size: 11px; font-weight: 700; width: 5%;">#</th>
                        <th style="padding: 8px 5px; text-align: left; font-size: 11px; font-weight: 700; width: 50%;">MƏHSULUN ADI</th>
                        <th style="padding: 8px 5px; text-align: center; font-size: 11px; font-weight: 700; width: 15%;">MİQDAR</th>
                        <th style="padding: 8px 5px; text-align: right; font-size: 11px; font-weight: 700; width: 15%;">QİYMƏT</th>
                        <th style="padding: 8px 5px; text-align: right; font-size: 11px; font-weight: 700; width: 15%;">CƏMİ</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>

            <table style="width: 100%; border-collapse: collapse; margin-top: 50px;">
                <tr>
                    <td style="vertical-align: middle; width: 50%;">
                        <img src="../mohur.png" alt="Möhür" style="width: 120px; height: auto; opacity: 0.95;" onerror="this.style.display='none';">
                    </td>
                    <td style="text-align: right; vertical-align: middle; width: 50%;">
                        <span style="font-size: 15px; color: #333;">Yekun Ödəniş:</span>
                        <span style="font-size: 22px; font-weight: 800; color: #000; margin-left: 10px;">
                            ${Number(data.totalAmount || 0).toFixed(2)} AZN
                        </span>
                    </td>
                </tr>
            </table>

            <div style="text-align: center; font-size: 11px; color: #555; margin-top: 90px; font-weight: 600; width: 100%;">
                Bizi seçdiyiniz üçün təşəkkür edirik!
            </div>
        </div>
    `;
}

function exportToPDF(data, dateStr) {
    const element = document.createElement('div');
    element.innerHTML = buildInvoiceHTML(data, dateStr);
    html2pdf().from(element).save(`qaime-${data.customerName || 'arxiv'}.pdf`);
}

function printInvoice(data, dateStr) {
    const printContainer = document.createElement('div');
    printContainer.id = 'dynamic-print-zone';
    printContainer.innerHTML = buildInvoiceHTML(data, dateStr);
    document.body.appendChild(printContainer);

    window.print();
    printContainer.remove();
}

// Filtrləmə və təmizləmə düymələrinin işləməsi üçün təhlükəsiz dinləyici
document.addEventListener('click', (e) => {
    if (e.target && (e.target.id === 'btn-filter' || e.target.closest('#btn-filter'))) {
        applyAllFilters();
    }
    
    if (e.target && (e.target.id === 'btn-clear' || e.target.closest('#btn-clear'))) {
        if (startDateInput) startDateInput.value = '';
        if (endDateInput) endDateInput.value = '';
        if (searchInput) searchInput.value = '';
        isSelectMode = false;
        
        const trigger = document.getElementById('th-delete-trigger');
        if (trigger) trigger.textContent = "SİL";
        
        const wrappers = document.querySelectorAll('.custom-checkbox-wrapper');
        const checkboxes = document.querySelectorAll('.archive-select-checkbox');
        wrappers.forEach(wrap => wrap.style.display = 'none');
        checkboxes.forEach(cb => cb.checked = false);
        
        const btnSelectAll = document.getElementById('btn-select-all-dynamic');
        if (btnSelectAll) {
            btnSelectAll.textContent = 'Hamısını Seç';
            btnSelectAll.style.display = 'none';
        }
        
        const bulkActionWrapper = document.getElementById('bulk-action-wrapper');
        if (bulkActionWrapper) bulkActionWrapper.style.display = 'none';
        
        const mainDeleteBtn = document.getElementById('btn-bulk-delete');
        const actionWrap = document.getElementById('bulk-action-wrapper');
        if (actionWrap && mainDeleteBtn) {
            actionWrap.innerHTML = '';
            actionWrap.appendChild(mainDeleteBtn);
            mainDeleteBtn.style.display = 'inline-block';
            actionWrap.style.display = 'none';
        }
        
        renderArchiveTable(allInvoices);
        updateTotalDisplay(allInvoices);
    }
});

window.editCustomerName = function(button, docId) {
    const cell = button.parentElement;
    const nameSpan = cell.querySelector('.customer-name');
    const currentName = nameSpan.innerText;

    if (cell.querySelector('.edit-name-input')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'edit-name-input';

    nameSpan.style.display = 'none';
    button.style.display = 'none';
    cell.appendChild(input);
    input.focus();

    async function saveName() {
        const newName = input.value.trim();

        if (newName && newName !== currentName) {
            nameSpan.innerText = newName;

            try {
                await updateDoc(doc(db, "history_invoices", docId), { customerName: newName })
                .catch(async () => {
                    await updateDoc(doc(db, "invoices", docId), { customerName: newName });
                });

                allInvoices = allInvoices.map(inv => {
                    if (inv.id === docId) {
                        return { ...inv, customerName: newName };
                    }
                    return inv;
                });
                
                const tr = document.querySelector(`tr[data-id="${docId}"]`);
                if (tr) {
                    const updatedData = allInvoices.find(inv => inv.id === docId);
                    const dateText = tr.querySelector('.date-text')?.innerText || "---";

                    const btnDownload = tr.querySelector('.btn-download');
                    const btnPrint = tr.querySelector('.btn-print-row');

                    if (btnDownload && btnPrint && updatedData) {
                        const newBtnDownload = btnDownload.cloneNode(true);
                        const newBtnPrint = btnPrint.cloneNode(true);

                        btnDownload.parentNode.replaceChild(newBtnDownload, btnDownload);
                        btnPrint.parentNode.replaceChild(newBtnPrint, btnPrint);

                        newBtnDownload.addEventListener('click', () => { exportToPDF(updatedData, dateText); });
                        newBtnPrint.addEventListener('click', () => { printInvoice(updatedData, dateText); });
                    }
                }

                showNotification("Müştəri adı uğurla yeniləndi!", "success");
            } catch (err) {
                showNotification("Adı yeniləyərkən xəta baş verdi!", "error");
                console.error(err);
                nameSpan.innerText = currentName;
            }
        } else {
            nameSpan.innerText = currentName;
        }

        nameSpan.style.display = 'inline';
        button.style.display = 'inline';
        input.remove();
    }

    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            saveName();
        }
    });

    input.addEventListener('blur', () => {
        saveName();
    });
}

function openItemsModal(data, dateStr) {
    const oldOverlay = document.getElementById('archive-items-modal');
    if (oldOverlay) oldOverlay.remove();

    let itemsHTML = '';
    if (data.items && data.items.length > 0) {
        data.items.forEach((item, index) => {
            itemsHTML += `
                <tr style="border-bottom: 1px solid #1e293b;">
                    <td style="padding: 10px; text-align: center;">${index + 1}</td>
                    <td style="padding: 10px; text-align: left;">${item.name || '---'}</td>
                    <td style="padding: 10px; text-align: center;">${item.qty}</td>
                    <td style="padding: 10px; text-align: right;">${Number(item.price).toFixed(2)} AZN</td>
                    <td style="padding: 10px; text-align: right; font-weight: bold; color: #5bc0be;">${(item.qty * item.price).toFixed(2)} AZN</td>
                </tr>
            `;
        });
    } else {
        itemsHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #9ca3af;">Məhsul tapılmadı.</td></tr>`;
    }

    const overlay = document.createElement('div');
    overlay.id = 'archive-items-modal';
    overlay.className = 'archive-modal-overlay';
    
    overlay.innerHTML = `
        <div class="archive-modal-content">
            <div class="archive-modal-header">
                <div>
                    <h3 style="margin: 0; font-size: 16px; color: #5bc0be;">${data.customerName || 'Naməlum Müştəri'}</h3>
                    <span style="font-size: 12px; color: #9ca3af;">Tarix: ${dateStr}</span>
                </div>
                <button class="archive-modal-close">✕</button>
            </div>
            <div style="max-height: 300px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="border-bottom: 2px solid #334155; color: #94a3b8;">
                            <th style="padding: 8px; text-align: center;">#</th>
                            <th style="padding: 8px; text-align: left;">Məhsul</th>
                            <th style="padding: 8px; text-align: center;">Miqdar</th>
                            <th style="padding: 8px; text-align: right;">Qiymət</th>
                            <th style="padding: 8px; text-align: right;">Cəmi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 15px; text-align: right; font-size: 15px; font-weight: bold;">
                Yekun Məbləğ: <span style="color: #5bc0be; margin-left: 5px;">${Number(data.totalAmount || 0).toFixed(2)} AZN</span>
            </div>
        </div>
    `;

    overlay.querySelector('.archive-modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
}

function updateTotalDisplay(dataArray) {
    if (!totalAmountSpan) return;

    let sum = dataArray.reduce((acc, curr) => acc + Number(curr.totalAmount || 0), 0);

    totalAmountSpan.textContent = sum.toFixed(2) + " AZN";

    if (isAmountVisible) {
        totalAmountSpan.style.filter = "none";
        totalAmountSpan.style.color = "#5bc0be";
    } else {
        totalAmountSpan.style.filter = "blur(5px)";
        totalAmountSpan.style.color = "#ffffff";
    }
}