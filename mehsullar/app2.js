import { db, collection, getDocs, query, orderBy, addDoc, serverTimestamp } from "../firebase.js";
import { deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const prodNameInput = document.getElementById('prod-name');
const prodPriceInput = document.getElementById('prod-price');
const btnAddProd = document.getElementById('btn-add-prod');
const prodTbody = document.getElementById('prod-tbody');
const prodSearch = document.getElementById('prod-search');

// Modal Elementləri
const editModal = document.getElementById('edit-modal');
const modalProdName = document.getElementById('modal-prod-name');
const modalProdPrice = document.getElementById('modal-prod-price');
const modalBtnSave = document.getElementById('modal-btn-save');
const modalBtnCancel = document.getElementById('modal-btn-cancel');

let allProducts = [];
let editingProductId = null;

async function fetchProducts() {
    prodTbody.innerHTML = `
    <tr>
            <td colspan="4" style="text-align: center; padding: 30px;">
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
        renderTable(allProducts);
    } catch (err) {
        console.error(err);
        showNotification("Məhsulları yükləmək mümkün olmadı!", "error");
    }
}

function renderTable(data) {
    prodTbody.innerHTML = '';
    if (data.length === 0) {
        prodTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#9ca3af;">Məhsul tapılmadı.</td></tr>';
        return;
    }
    data.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td style="font-weight:bold;">${p.name}</td>
            <td style="color:#5bc0be;">${Number(p.price).toFixed(2)} AZN</td>
            <td style="width: 130px; position: relative;">
                <div class="action-buttons" style="display: flex; gap: 6px;">
                    <button class="btn-edit" data-id="${p.id}" title="Redaktə et" style="background: #3b82f6; color: #fff; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer;">✏️</button>
                    <button class="btn-del" data-id="${p.id}" style="background: #ef4444; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Sil</button>
                </div>
            </td>
        `;

        // Qələm düyməsinə kliklədikdə modal açılır
        tr.querySelector('.btn-edit').addEventListener('click', () => {
            editingProductId = p.id;
            modalProdName.value = p.name;
            modalProdPrice.value = p.price;
            editModal.style.display = 'flex';
        });

        // Sil düyməsi (Bəli / Xeyr təsdiqi ilə)
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

            tr.cells[3].appendChild(confirmBox);
        });

        prodTbody.appendChild(tr);
    });
}

modalBtnSave.addEventListener('click', async () => {
    const name = modalProdName.value.trim();
    const price = parseFloat(modalProdPrice.value);

    // ➔ BURADA DA 0.01 yoxlaması edirik
    if (!name || isNaN(price) || price < 0.01) {
        showNotification("Məlumatları düzgün daxil edin və qiymət ən azı 0.01 olmalıdır!", "error");
        return;
    }

    const exists = allProducts.some(p => p.id !== editingProductId && p.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) {
        showNotification("Bu adda başqa məhsul mövcuddur!", "error");
        return;
    }

    try {
        await updateDoc(doc(db, "products", editingProductId), { name, price });
        editModal.style.display = 'none';
        fetchProducts();
        showNotification("Məhsul uğurla yeniləndi!", "success");
    } catch (err) {
        console.error(err);
        showNotification("Yeniləmək mümkün olmadı!", "error");
    }
});

// Modal daxilində "Ləğv et" düyməsi
modalBtnCancel.addEventListener('click', () => {
    editModal.style.display = 'none';
});

// Modaldan kənara kliklədikdə bağlanması
window.addEventListener('click', (e) => {
    if (e.target === editModal) {
        editModal.style.display = 'none';
    }
});

btnAddProd.addEventListener('click', async () => {
    const name = prodNameInput.value.trim();
    const price = parseFloat(prodPriceInput.value);
    
    // ➔ BURADA 0.01-dən kiçik olmasını yoxlayırıq
    if (!name || isNaN(price) || price < 0.01) {
        showNotification("Məlumatları düzgün daxil edin və qiymət ən azı 0.01 olmalıdır!", "error");
        return;
    }

    const exists = allProducts.some(p => p.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) {
        showNotification("Bu adda məhsul artıq mövcuddur!", "error");
        return;
    }

    try {
        await addDoc(collection(db, "products"), { name, price, timestamp: serverTimestamp() });
        prodNameInput.value = '';
        prodPriceInput.value = '';
        fetchProducts();
        showNotification("Məhsul əlavə edildi!", "success");
    } catch (err) {
        console.error(err);
        showNotification("Məhsul əlavə olunmadı!", "error");
    }
});

prodSearch.addEventListener('input', () => {
    const val = prodSearch.value.toLowerCase().trim();
    const filtered = allProducts.filter(p => p.name.toLowerCase().includes(val));
    renderTable(filtered);
});

// Bildiriş funksiyası
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

fetchProducts();