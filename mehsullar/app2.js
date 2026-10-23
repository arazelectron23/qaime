import { db, collection, getDocs, query, orderBy, addDoc, serverTimestamp } from "../firebase.js";
import { deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const prodNameInput = document.getElementById('prod-name');
const prodCategoryInput = document.getElementById('prod-category');
const prodPriceInput = document.getElementById('prod-price');
const btnAddProd = document.getElementById('btn-add-prod');
const prodTbody = document.getElementById('prod-tbody');
const prodSearch = document.getElementById('prod-search');
const filterCategory = document.getElementById('filter-category');

const selectAllCheckbox = document.getElementById('select-all-checkbox');
const bulkActionsBar = document.getElementById('bulk-actions-bar');
const selectedCountText = document.getElementById('selected-count-text');
const bulkCategorySelect = document.getElementById('bulk-category-select');
const btnBulkChangeCat = document.getElementById('btn-bulk-change-cat');
const btnBulkDelete = document.getElementById('btn-bulk-delete');

const editModal = document.getElementById('edit-modal');
const modalProdName = document.getElementById('modal-prod-name');
const modalProdCategory = document.getElementById('modal-prod-category');
const modalProdPrice = document.getElementById('modal-prod-price');
const modalBtnSave = document.getElementById('modal-btn-save');
const modalBtnCancel = document.getElementById('modal-btn-cancel');

const btnOpenCatModal = document.getElementById('btn-open-cat-modal');
const categoryModal = document.getElementById('category-modal');
const catModalClose = document.getElementById('cat-modal-close');
const newCatInput = document.getElementById('new-cat-input');
const btnAddCat = document.getElementById('btn-add-cat');
const categoryListContainer = document.getElementById('category-list-container');

let allProducts = [];
let allCategories = [];
let editingProductId = null;

document.addEventListener('DOMContentLoaded', async () => {
    await fetchCategories();
    await fetchProducts();
});

async function fetchCategories() {
    try {
        const q = query(collection(db, "categories"), orderBy("order", "asc"));
        const snap = await getDocs(q);
        let rawCategories = [];
        
        snap.forEach(d => {
            rawCategories.push({ id: d.id, ...d.data() });
        });

        if (rawCategories.length === 0) {
            await addDoc(collection(db, "categories"), { name: "Digər", order: 1, timestamp: serverTimestamp() });
            rawCategories = [{ id: "default", name: "Digər", order: 1 }];
        }

        const digerCat = rawCategories.find(c => c.name.trim().toLowerCase() === 'digər');
        const otherCats = rawCategories.filter(c => c.name.trim().toLowerCase() !== 'digər');

        if (digerCat) {
            allCategories = [digerCat, ...otherCats];
        } else {
            allCategories = rawCategories;
        }

        updateCategoryDropdowns();
    } catch (err) {
        console.error("Kateqoriya yükləmə xətası:", err);
    }
}

function updateCategoryDropdowns() {
    const dropdowns = [prodCategoryInput, filterCategory, modalProdCategory, bulkCategorySelect];
    
    dropdowns.forEach(select => {
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '';

        if (select.id === 'filter-category') {
            select.innerHTML = `<option value="all">Bütün Kateqoriyalar</option>`;
        } else if (select.id === 'bulk-category-select') {
            select.innerHTML = `<option value="" disabled selected>-- Kateqoriya seçin --</option>`;
        }

        allCategories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.name;
            opt.textContent = cat.name;
            select.appendChild(opt);
        });

        if (currentVal) {
            select.value = currentVal;
        } else if (select.id === 'prod-category') {
            select.value = 'Digər';
        }
    });
}

async function fetchProducts() {
    prodTbody.innerHTML = `
        <tr>
            <td colspan="6" style="text-align: center; padding: 30px;">
                <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
                    <div class="sharp-ring-loader"></div>
                </div>
            </td>
        </tr>
    `;
    try {
        const q = query(collection(db, "products"), orderBy("name", "asc"));
        const snap = await getDocs(q);
        allProducts = [];
        snap.forEach(d => {
            allProducts.push({ id: d.id, ...d.data() });
        });

        sortProductsByCategoryOrder();
        renderTable(allProducts);
        updateBulkActionsBar();
    } catch (err) {
        console.error(err);
        showNotification("Məhsulları yükləmək mümkün olmadı!", "error");
    }
}

function sortProductsByCategoryOrder() {
    const catOrderMap = {};
    allCategories.forEach((cat, index) => {
        catOrderMap[cat.name.trim().toLowerCase()] = cat.order !== undefined ? cat.order : index;
    });

    allProducts.sort((a, b) => {
        const catA = (a.category || 'Digər').trim().toLowerCase();
        const catB = (b.category || 'Digər').trim().toLowerCase();
        
        const orderA = catOrderMap[catA] !== undefined ? catOrderMap[catA] : 999;
        const orderB = catOrderMap[catB] !== undefined ? catOrderMap[catB] : 999;

        if (orderA !== orderB) {
            return orderA - orderB;
        }
        return a.name.localeCompare(b.name);
    });
}

function renderTable(data) {
    prodTbody.innerHTML = '';
    if (data.length === 0) {
        prodTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#9ca3af; padding: 20px;">Məhsul tapılmadı.</td></tr>';
        return;
    }
    data.forEach((p, idx) => {
        const tr = document.createElement('tr');
        const categoryName = p.category || 'Digər';

        tr.innerHTML = `
            <td style="text-align: center;"><input type="checkbox" class="product-checkbox custom-checkbox" data-id="${p.id}"></td>
            <td>${idx + 1}</td>
            <td style="font-weight:bold;">${p.name}</td>
            <td><span style="background: #1f2937; color: #5bc0be; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; border: 1px solid #374151;">${categoryName}</span></td>
            <td style="color:#5bc0be; font-weight: bold;">${Number(p.price).toFixed(2)} AZN</td>
            <td style="width: 130px; position: relative;">
                <div class="action-buttons" style="display: flex; gap: 6px;">
                    <button class="btn-edit" data-id="${p.id}" title="Redaktə et" style="background: #3b82f6; color: #fff; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer;">✏️</button>
                    <button class="btn-del" data-id="${p.id}" style="background: #ef4444; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Sil</button>
                </div>
            </td>
        `;

        tr.querySelector('.product-checkbox').addEventListener('change', updateBulkActionsBar);

        tr.querySelector('.btn-edit').addEventListener('click', () => {
            editingProductId = p.id;
            modalProdName.value = p.name;
            modalProdCategory.value = p.category || 'Digər';
            modalProdPrice.value = p.price;
            editModal.style.display = 'flex';
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
                    await deleteDoc(doc(db, "products", p.id));
                    fetchProducts();
                    showNotification("Məhsul silindi!", "success");
                } catch (err) {
                    console.error("Silmə xətası:", err);
                    showNotification("Silmək mümkün olmadı!", "error");
                }
            });

            confirmBox.querySelector('.btn-no').addEventListener('click', (e) => {
                e.stopPropagation();
                confirmBox.remove();
                actionDiv.style.visibility = 'visible';
            });

            tr.cells[5].appendChild(confirmBox);
        });

        prodTbody.appendChild(tr);
    });
}

if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = prodTbody.querySelectorAll('.product-checkbox');
        checkboxes.forEach(chk => {
            chk.checked = e.target.checked;
        });
        updateBulkActionsBar();
    });
}

function updateBulkActionsBar() {
    const checkedBoxes = prodTbody.querySelectorAll('.product-checkbox:checked');
    if (checkedBoxes.length > 0) {
        bulkActionsBar.style.display = 'flex';
        selectedCountText.textContent = `${checkedBoxes.length} məhsul seçildi`;
    } else {
        bulkActionsBar.style.display = 'none';
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
    }
}

if (btnBulkDelete) {
    btnBulkDelete.addEventListener('click', async () => {
        const checkedBoxes = prodTbody.querySelectorAll('.product-checkbox:checked');
        if (checkedBoxes.length === 0) return;

        if (confirm(`Seçilmiş ${checkedBoxes.length} məhsulu silmək istədiyinizə əminsiniz?`)) {
            try {
                for (const chk of checkedBoxes) {
                    const id = chk.dataset.id;
                    await deleteDoc(doc(db, "products", id));
                }
                await fetchProducts();
                showNotification("Seçilən məhsullar silindi!", "success");
            } catch (err) {
                console.error(err);
                showNotification("Toplu silmə zamanı xəta baş verdi!", "error");
            }
        }
    });
}

if (btnBulkChangeCat) {
    btnBulkChangeCat.addEventListener('click', async () => {
        const checkedBoxes = prodTbody.querySelectorAll('.product-checkbox:checked');
        const newCat = bulkCategorySelect.value;

        if (checkedBoxes.length === 0) return;
        if (!newCat) {
            return showNotification("Zəhmət olmasa yeni kateqoriya seçin!", "error");
        }

        try {
            for (const chk of checkedBoxes) {
                const id = chk.dataset.id;
                await updateDoc(doc(db, "products", id), { category: newCat });
            }
            bulkCategorySelect.value = '';
            await fetchProducts();
            showNotification("Seçilən məhsulların kateqoriyası dəyişdirildi!", "success");
        } catch (err) {
            console.error(err);
            showNotification("Xəta baş verdi!", "error");
        }
    });
}

modalBtnSave.addEventListener('click', async () => {
    const name = modalProdName.value.trim();
    const category = modalProdCategory.value;
    const price = parseFloat(modalProdPrice.value);

    if (!name || isNaN(price) || price < 0.01) {
        showNotification("Məlumatları düzgün daxil edin və qiymət ən azı 0.01 olmalıdır!", "error");
        return;
    }

    try {
        await updateDoc(doc(db, "products", editingProductId), { name, category, price });
        editModal.style.display = 'none';
        fetchProducts();
        showNotification("Məhsul uğurla yeniləndi!", "success");
    } catch (err) {
        console.error(err);
        showNotification("Yeniləmək mümkün olmadı!", "error");
    }
});

modalBtnCancel.addEventListener('click', () => { editModal.style.display = 'none'; });

btnAddProd.addEventListener('click', async () => {
    const name = prodNameInput.value.trim();
    const category = prodCategoryInput.value;
    const price = parseFloat(prodPriceInput.value);
    
    if (!name || !category || isNaN(price) || price < 0.01) {
        showNotification("Bütün xanaları doldurun və qiymət ən azı 0.01 olmalıdır!", "error");
        return;
    }

    const exists = allProducts.some(p => p.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) {
        showNotification("Bu adda məhsul artıq mövcuddur!", "error");
        return;
    }

    try {
        await addDoc(collection(db, "products"), { name, category, price, timestamp: serverTimestamp() });
        prodNameInput.value = '';
        prodPriceInput.value = '';
        if (prodCategoryInput) prodCategoryInput.value = 'Digər';
        fetchProducts();
        showNotification("Məhsul əlavə edildi!", "success");
    } catch (err) {
        console.error(err);
        showNotification("Məhsul əlavə olunmadı!", "error");
    }
});

function applyFilters() {
    const searchVal = prodSearch.value.toLowerCase().trim();
    const catVal = filterCategory.value;

    const filtered = allProducts.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchVal);
        const matchesCategory = (catVal === 'all') || ((p.category || 'Digər') === catVal);
        return matchesSearch && matchesCategory;
    });

    renderTable(filtered);
}

prodSearch.addEventListener('input', applyFilters);
filterCategory.addEventListener('change', applyFilters);

if (btnOpenCatModal && categoryModal) {
    btnOpenCatModal.addEventListener('click', () => {
        categoryModal.style.display = 'flex';
        renderCategoryModalList();
    });
}

if (catModalClose && categoryModal) {
    catModalClose.addEventListener('click', () => { categoryModal.style.display = 'none'; });
}

window.addEventListener('click', (e) => {
    if (e.target === editModal) editModal.style.display = 'none';
    if (e.target === categoryModal) categoryModal.style.display = 'none';
});

function renderCategoryModalList() {
    if (!categoryListContainer) return;
    categoryListContainer.innerHTML = '';

    allCategories.forEach((cat, index) => {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: #0b0f19; padding: 8px 12px; border-radius: 6px; border: 1px solid #1f2937; position: relative;';
        
        const isDiger = cat.name.trim().toLowerCase() === 'digər';

        row.innerHTML = `
            <span style="font-weight: 600; color: #fff;">${cat.name}</span>
            <div class="cat-action-buttons" style="display: flex; gap: 4px; align-items: center;">
                <button class="btn-move-up" title="Yuxarı qaldır" style="background: #374151; color: #fff; border: none; padding: 4px 7px; border-radius: 4px; cursor: pointer; font-size: 11px;" ${index === 0 ? 'disabled style="opacity: 0.3; cursor: default;"' : ''}>▲</button>
                <button class="btn-move-down" title="Aşağı endir" style="background: #374151; color: #fff; border: none; padding: 4px 7px; border-radius: 4px; cursor: pointer; font-size: 11px;" ${index === allCategories.length - 1 ? 'disabled style="opacity: 0.3; cursor: default;"' : ''}>▼</button>
                <button class="btn-edit-cat" style="background: #3b82f6; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">✏️ Dəyiş</button>
                ${!isDiger ? `<button class="btn-del-cat" style="background: #ef4444; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Sil</button>` : ''}
            </div>
        `;

        row.querySelector('.btn-move-up').addEventListener('click', async () => {
            if (index > 0) await swapCategoryOrder(index, index - 1);
        });

        row.querySelector('.btn-move-down').addEventListener('click', async () => {
            if (index < allCategories.length - 1) await swapCategoryOrder(index, index + 1);
        });

        row.querySelector('.btn-edit-cat').addEventListener('click', () => {
            const newName = prompt("Yeni kateqoriya adını daxil edin:", cat.name);
            if (newName && newName.trim() && newName.trim() !== cat.name) {
                updateCategoryName(cat.id, newName.trim());
            }
        });

        if (!isDiger) {
            const btnDel = row.querySelector('.btn-del-cat');
            const actionDiv = row.querySelector('.cat-action-buttons');

            btnDel.addEventListener('click', () => {
                btnDel.style.display = 'none';

                const confirmBox = document.createElement('div');
                confirmBox.style.cssText = 'display: flex; gap: 4px; align-items: center;';
                confirmBox.innerHTML = `
                    <span style="font-size: 11px; color: #fca5a5; font-weight: bold;">Silinsin?</span>
                    <button class="btn-cat-yes" style="background: #ef4444; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">Bəli</button>
                    <button class="btn-cat-no" style="background: #4b5563; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">Xeyr</button>
                `;

                confirmBox.querySelector('.btn-cat-yes').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        await deleteDoc(doc(db, "categories", cat.id));
                        await fetchCategories();
                        renderCategoryModalList();
                        fetchProducts();
                        showNotification("Kateqoriya silindi!", "success");
                    } catch (err) {
                        console.error(err);
                        showNotification("Silmək mümkün olmadı!", "error");
                    }
                });

                confirmBox.querySelector('.btn-cat-no').addEventListener('click', (e) => {
                    e.stopPropagation();
                    confirmBox.remove();
                    btnDel.style.display = 'inline-block';
                });

                actionDiv.appendChild(confirmBox);
            });
        }

        categoryListContainer.appendChild(row);
    });
}

async function swapCategoryOrder(index1, index2) {
    const cat1 = allCategories[index1];
    const cat2 = allCategories[index2];

    const tempOrder = cat1.order !== undefined ? cat1.order : index1;
    const newOrder1 = cat2.order !== undefined ? cat2.order : index2;
    const newOrder2 = tempOrder;

    try {
        await updateDoc(doc(db, "categories", cat1.id), { order: newOrder1 });
        await updateDoc(doc(db, "categories", cat2.id), { order: newOrder2 });

        await fetchCategories();
        renderCategoryModalList();
        fetchProducts();
        showNotification("Sıralama yeniləndi!", "success");
    } catch (err) {
        console.error(err);
        showNotification("Sıralamaq mümkün olmadı!", "error");
    }
}

if (btnAddCat) {
    btnAddCat.addEventListener('click', async () => {
        const name = newCatInput.value.trim();
        if (!name) return showNotification("Kateqoriya adını daxil edin!", "error");

        const exists = allCategories.some(c => c.name.toLowerCase() === name.toLowerCase());
        if (exists) return showNotification("Bu kateqoriya artıq mövcuddur!", "error");

        try {
            const newOrder = allCategories.length + 1;
            await addDoc(collection(db, "categories"), { name, order: newOrder, timestamp: serverTimestamp() });
            newCatInput.value = '';
            await fetchCategories();
            renderCategoryModalList();
            showNotification("Kateqoriya əlavə olundu!", "success");
        } catch (err) {
            console.error(err);
            showNotification("Xəta baş verdi!", "error");
        }
    });
}

async function updateCategoryName(catId, newName) {
    try {
        await updateDoc(doc(db, "categories", catId), { name: newName });
        await fetchCategories();
        renderCategoryModalList();
        fetchProducts();
        showNotification("Kateqoriya adı yeniləndi!", "success");
    } catch (err) {
        console.error(err);
        showNotification("Yeniləmək mümkün olmadı!", "error");
    }
}

function showNotification(message, type = 'success') {
    const oldNotification = document.getElementById('custom-notification');
    if (oldNotification) oldNotification.remove();

    const notification = document.createElement('div');
    notification.id = 'custom-notification';
    notification.innerText = message;

    Object.assign(notification.style, {
        position: 'fixed', top: '20px', right: '20px', padding: '12px 24px',
        borderRadius: '6px', color: '#ffffff', fontWeight: 'bold', fontSize: '14px',
        zIndex: '10000', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', transition: 'all 0.3s ease',
        opacity: '0', transform: 'translateY(-20px)'
    });

    if (type === 'success') {
        notification.style.backgroundColor = '#10b981';
        notification.style.borderLeft = '5px solid #047857';
    } else {
        notification.style.backgroundColor = '#ef4444';
        notification.style.borderLeft = '5px solid #b91c1c';
    }

    document.body.appendChild(notification);
    setTimeout(() => { notification.style.opacity = '1'; notification.style.transform = 'translateY(0)'; }, 10);
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}