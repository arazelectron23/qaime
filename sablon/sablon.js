import { db, collection, getDocs, query, orderBy, addDoc, serverTimestamp } from "../firebase.js";
import { deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const tplNameInput = document.getElementById('tpl-name');
const btnOpenModal = document.getElementById('btn-open-modal');
const tplTbody = document.getElementById('tpl-tbody');
const tplSearch = document.getElementById('tpl-search');
const productSelectContainer = document.getElementById('product-select-container');
const productSearchInput = document.getElementById('product-search-input');

// Modal Elementləri
const qtyModal = document.getElementById('qty-modal');
const modalTitle = document.getElementById('modal-title');
const modalQtyContainer = document.getElementById('modal-qty-container');
const modalCalculatedTotalSpan = document.getElementById('modal-calculated-total');
const modalBtnSave = document.getElementById('modal-btn-save');
const modalBtnCancel = document.getElementById('modal-btn-cancel');

let allProducts = [];
let allTemplates = [];
let editingTplId = null;
let currentSelectedQuantities = {}; 

async function fetchProductsForTemplate() {
    if (!productSelectContainer) return;
    
    productSelectContainer.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; width: 100%; padding: 20px;">
            <div class="sharp-ring-loader"></div>
        </div>
    `;
    
    try {
        const q = query(collection(db, "products"), orderBy("name", "asc"));
        const snap = await getDocs(q);
        allProducts = [];
        snap.forEach(d => {
            allProducts.push({ id: d.id, ...d.data() });
        });
        renderProductCheckboxes();
    } catch (err) {
        console.error("Məhsulları çəkmə xətası:", err);
        productSelectContainer.innerHTML = '<div style="color:#ef4444; text-align:center; padding:10px;">Xəta baş verdi!</div>';
        showNotification("Məhsulları yükləmək mümkün olmadı!", "error");
    }
}

function renderProductCheckboxes(filterText = '') {
    if (!productSelectContainer) return;
    productSelectContainer.innerHTML = '';
    
    const filteredProducts = allProducts.filter(p => p.name.toLowerCase().includes(filterText.toLowerCase()));

    if (filteredProducts.length === 0) {
        productSelectContainer.innerHTML = '<div style="color: #9ca3af; font-size: 13px; text-align: center; padding: 10px;">Məhsul tapılmadı.</div>';
        return;
    }

    filteredProducts.forEach(p => {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: #111827; padding: 8px 12px; border-radius: 6px; border: 1px solid #1f2937;';
        
        const isChecked = currentSelectedQuantities[p.id] !== undefined;

        row.innerHTML = `
            <label style="display: flex; align-items: center; gap: 10px; font-size: 13px; cursor: pointer; width: 100%;">
                <input type="checkbox" class="prod-check" data-id="${p.id}" ${isChecked ? 'checked' : ''} style="accent-color: #5bc0be; width: 16px; height: 16px; cursor: pointer;">
                <span style="color: #fff; font-weight: 500;">${p.name}</span>
                <span style="color: #5bc0be; margin-left: auto;">${Number(p.price || 0).toFixed(2)} AZN</span>
            </label>
        `;

        const checkbox = row.querySelector('.prod-check');
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                currentSelectedQuantities[p.id] = currentSelectedQuantities[p.id] || 1;
            } else {
                delete currentSelectedQuantities[p.id];
            }
        });

        productSelectContainer.appendChild(row);
    });
}

if (productSearchInput) {
    productSearchInput.addEventListener('input', (e) => {
        renderProductCheckboxes(e.target.value);
    });
}

if (btnOpenModal) {
    btnOpenModal.addEventListener('click', () => {
        const name = tplNameInput ? tplNameInput.value.trim() : '';
        if (!editingTplId && !name) {
            showNotification("Zəhmət olmasa şablon adını daxil edin!", "error");
            return;
        }

        const selectedIds = Object.keys(currentSelectedQuantities);
        if (selectedIds.length === 0) {
            showNotification("Zəhmət olmasa ən azı bir məhsul seçin!", "error");
            return;
        }

        if (modalTitle) {
            const displayName = editingTplId ? (modalTitle.dataset.tplRealName || name) : name;
            modalTitle.textContent = `Şablon: ${displayName} (Sayları təyin edin)`;
        }
        openQtyModal();
    });
}

function openQtyModal() {
    if (!modalQtyContainer) return;
    modalQtyContainer.innerHTML = '';
    
    const selectedIds = Object.keys(currentSelectedQuantities);
    if (selectedIds.length === 0) {
        showNotification("Zəhmət olmasa ən azı bir məhsul seçin!", "error");
        return;
    }

    selectedIds.forEach(prodId => {
        const prodObj = allProducts.find(p => p.id === prodId);
        if (!prodObj) return;

        const qty = currentSelectedQuantities[prodId] || 1;

        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: #111827; padding: 8px 10px; border-radius: 4px; border: 1px solid #1f2937;';
        row.innerHTML = `
            <span style="font-size: 13px; color: #fff; font-weight: 500;">${prodObj.name}</span>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="color: #5bc0be; font-size: 12px;">(${Number(prodObj.price).toFixed(2)} AZN)</span>
                <input type="number" class="modal-prod-qty" data-id="${prodId}" value="${qty}" min="1" 
                    style="background: #0b0f19; border: 1px solid #374151; color: #fff; border-radius: 4px; padding: 4px; text-align: center; width: 50px; outline: none;">
            </div>
        `;

        row.querySelector('.modal-prod-qty').addEventListener('input', (e) => {
            currentSelectedQuantities[prodId] = parseInt(e.target.value) || 1;
            calculateModalTotal();
        });

        modalQtyContainer.appendChild(row);
    });

    calculateModalTotal();
    if (qtyModal) qtyModal.style.display = 'flex';
}

function calculateModalTotal() {
    let total = 0;
    Object.keys(currentSelectedQuantities).forEach(prodId => {
        const prodObj = allProducts.find(p => p.id === prodId);
        if (prodObj) {
            const qty = currentSelectedQuantities[prodId] || 1;
            total += (Number(prodObj.price) || 0) * qty;
        }
    });
    if (modalCalculatedTotalSpan) modalCalculatedTotalSpan.textContent = total.toFixed(2);
}

if (modalBtnSave) {
    modalBtnSave.addEventListener('click', async () => {
        const nameVal = tplNameInput ? tplNameInput.value.trim() : '';
        const realName = editingTplId ? (modalTitle.dataset.tplRealName || nameVal) : nameVal;

        if (!realName) {
            showNotification("Şablon adı boş ola bilməz!", "error");
            return;
        }
        
        const items = [];
        Object.keys(currentSelectedQuantities).forEach(prodId => {
            const prodObj = allProducts.find(p => p.id === prodId);
            if (prodObj) {
                items.push({
                    productId: prodId,
                    name: prodObj.name,
                    price: prodObj.price,
                    qty: currentSelectedQuantities[prodId]
                });
            }
        });

        try {
            if (editingTplId) {
                await updateDoc(doc(db, "templates", editingTplId), {
                    name: realName,
                    items
                });
                editingTplId = null;
                showNotification("Şablon uğurla yeniləndi!", "success");
            } else {
                await addDoc(collection(db, "templates"), {
                    name: nameVal,
                    items,
                    timestamp: serverTimestamp()
                });
                if (tplNameInput) tplNameInput.value = '';
                showNotification("Şablon uğurla əlavə edildi!", "success");
            }

            if (qtyModal) qtyModal.style.display = 'none';
            currentSelectedQuantities = {};
            renderProductCheckboxes();
            fetchTemplates();
        } catch (err) {
            console.error("Yadda saxlama xətası:", err);
            showNotification("Xəta baş verdi!", "error");
        }
    });
}

if (modalBtnCancel) {
    modalBtnCancel.addEventListener('click', () => {
        if (qtyModal) qtyModal.style.display = 'none';
    });
}

async function fetchTemplates() {
    if (!tplTbody) return;
    tplTbody.innerHTML = `
    <tr>
        <td colspan="5" style="text-align: center; padding: 30px;">
            <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
                <div class="sharp-ring-loader"></div>
            </div>
        </td>
    </tr>
`;    try {
        const q = query(collection(db, "templates"), orderBy("name", "asc"));
        const snap = await getDocs(q);
        allTemplates = [];
        snap.forEach(d => {
            allTemplates.push({ id: d.id, ...d.data() });
        });
        renderTable(allTemplates);
    } catch (err) {
        console.error(err);
        showNotification("Şablonları yükləmək mümkün olmadı!", "error");
    }
}

function renderTable(data) {
    if (!tplTbody) return;
    tplTbody.innerHTML = '';
    if (data.length === 0) {
        tplTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#9ca3af;">Şablon tapılmadı.</td></tr>';
        return;
    }
    data.forEach((t, idx) => {
        let itemsText = '';
        let totalPrice = 0;

        if (t.items && Array.isArray(t.items)) {
            itemsText = t.items.map(i => `${i.name} (x${i.qty})`).join(', ');
            totalPrice = t.items.reduce((sum, i) => sum + ((Number(i.price) || 0) * i.qty), 0);
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td style="font-weight:bold;">${t.name || ''}</td>
            <td style="color: #9ca3af; font-size: 13px;">${itemsText || '-'}</td>
            <td style="color:#5bc0be; font-weight: bold;">${Number(totalPrice).toFixed(2)} AZN</td>
            <td style="width: 130px; position: relative;">
                <div class="action-buttons" style="display: flex; gap: 6px;">
                    <button class="btn-edit" title="Redaktə et" style="background: #3b82f6; color: #fff; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer;">✏️</button>
                    <button class="btn-del" style="background: #ef4444; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Sil</button>
                </div>
            </td>
        `;

        tr.querySelector('.btn-edit').addEventListener('click', () => {
            editingTplId = t.id;
            if (modalTitle) {
                modalTitle.textContent = `Şablonu Redaktə Et: ${t.name}`;
                modalTitle.dataset.tplRealName = t.name;
            }

            currentSelectedQuantities = {};
            if (t.items) {
                t.items.forEach(i => {
                    currentSelectedQuantities[i.productId] = i.qty;
                });
            }

            renderProductCheckboxes();
            openQtyModal();
        });

        const btnDel = tr.querySelector('.btn-del');
        const actionDiv = tr.querySelector('.action-buttons');

        btnDel.addEventListener('click', () => {
            actionDiv.style.visibility = 'hidden';
            
            const confirmBox = document.createElement('div');
            confirmBox.style.cssText = 'position: absolute; top: 8px; left: 12px; display: flex; gap: 4px; align-items: center; background: #111827;';
            confirmBox.innerHTML = `
                <button class="btn-yes" style="background: #10b981; color: #fff; border: none; padding: 5px 9px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">Bəli</button>
                <button class="btn-no" style="background: #ef4444; color: #fff; border: none; padding: 5px 9px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">Xeyr</button>
            `;

            confirmBox.querySelector('.btn-yes').addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    await deleteDoc(doc(db, "templates", t.id));
                    fetchTemplates();
                    showNotification("Şablon silindi!", "success");
                } catch (err) {
                    console.error("Silmə xətası:", err);
                    showNotification("Şablonu silmək mümkün olmadı!", "error");
                }
            });

            confirmBox.querySelector('.btn-no').addEventListener('click', (e) => {
                e.stopPropagation();
                confirmBox.remove();
                actionDiv.style.visibility = 'visible';
            });

            tr.cells[4].appendChild(confirmBox);
        });

        tplTbody.appendChild(tr);
    });
}

if (tplSearch) {
    tplSearch.addEventListener('input', () => {
        const val = tplSearch.value.toLowerCase().trim();
        const filtered = allTemplates.filter(t => t.name && t.name.toLowerCase().includes(val));
        renderTable(filtered);
    });
}

fetchProductsForTemplate().then(() => {
    fetchTemplates();
});

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

// Modalın çölünə (fonuna) kliklədikdə bağlanması
window.addEventListener('click', (e) => {
    if (qtyModal && e.target === qtyModal) {
        qtyModal.style.display = 'none';
    }
});