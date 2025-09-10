import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

setLogLevel('debug');

// Use the globally provided Firebase configuration and auth token
const firebaseConfig = JSON.parse(__firebase_config);
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

let app, auth, db;
let isFirebaseReady = false;

// UI Elements
const residentForm = document.getElementById('residentForm');
const addResidentBtn = document.getElementById('addResidentBtn');
const residentsContainer = document.getElementById('residentsContainer');
const messageBox = document.getElementById('messageBox');
const formView = document.getElementById('formView');
const dataView = document.getElementById('dataView');
const showDataBtn = document.getElementById('showDataBtn');
const goBackBtn = document.getElementById('goBackBtn');
const dataTableBody = document.getElementById('dataTableBody');
const exportDataBtn = document.getElementById('exportDataBtn');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const flatNumberSelect = document.getElementById('flatNumber');
const residentNameInput = document.getElementById('residentName');
const residentStatusSelect = document.getElementById('residentStatus');
const addResidentSectionBtn = document.getElementById('addResidentSectionBtn');

// Helper function to show a message
function showMessage(message, type) {
    messageBox.textContent = message;
    messageBox.className = `mt-4 p-4 rounded-md text-sm message-box ${type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`;
    messageBox.classList.remove('hidden');
    setTimeout(() => {
        messageBox.classList.add('hidden');
    }, 5000);
}

// Function to generate flat numbers from 101 to 1000
function generateFlatNumbers() {
    for (let i = 101; i <= 1000; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Flat ${i}`;
        flatNumberSelect.appendChild(option);
    }
}

// Function to create a resident input section
function createResidentSection(name = '', status = 'Occupied') {
    const residentCount = residentsContainer.children.length;
    const residentSection = document.createElement('div');
    residentSection.className = 'resident-section mt-4 p-4 border rounded-md relative';
    residentSection.innerHTML = `
        <div class="input-group">
            <label for="residentName-${residentCount}" class="text-sm font-medium text-gray-700">Resident Name</label>
            <input type="text" id="residentName-${residentCount}" name="residentName-${residentCount}" value="${name}" placeholder="Full Name" required
                   class="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
        </div>
        <div class="input-group mt-4">
            <label for="residentStatus-${residentCount}" class="text-sm font-medium text-gray-700">Status</label>
            <select id="residentStatus-${residentCount}" name="residentStatus-${residentCount}"
                    class="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                <option value="Occupied" ${status === 'Occupied' ? 'selected' : ''}>Occupied</option>
                <option value="Vacant" ${status === 'Vacant' ? 'selected' : ''}>Vacant</option>
            </select>
        </div>
        <button type="button" class="remove-resident-btn absolute top-2 right-2 text-gray-400 hover:text-red-600 transition-colors">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    `;
    residentsContainer.appendChild(residentSection);
}

// Event listeners for resident sections
residentsContainer.addEventListener('click', (e) => {
    if (e.target.closest('.remove-resident-btn')) {
        e.target.closest('.resident-section').remove();
    }
});

addResidentSectionBtn.addEventListener('click', () => createResidentSection());

// Event listener for form submission
residentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!isFirebaseReady) {
        showMessage("Firebase is not ready yet. Please try again.", "error");
        return;
    }

    try {
        const flatNumber = flatNumberSelect.value;
        const residentSections = residentsContainer.querySelectorAll('.resident-section');
        const residentsData = [];

        residentSections.forEach(section => {
            const nameInput = section.querySelector('input[type="text"]');
            const statusSelect = section.querySelector('select');
            if (nameInput && statusSelect) {
                residentsData.push({
                    name: nameInput.value,
                    status: statusSelect.value
                });
            }
        });

        const docRef = doc(db, `artifacts/${appId}/public/data/residents`, flatNumber);
        await setDoc(docRef, {
            flatNumber: parseInt(flatNumber),
            residents: residentsData,
            lastUpdated: new Date()
        });

        residentForm.reset();
        residentsContainer.innerHTML = '';
        createResidentSection(); // Add one empty resident section back
        showMessage("Data saved successfully!", "success");

    } catch (error) {
        console.error("Error adding document: ", error);
        showMessage("An error occurred. Please try again.", "error");
    }
});

// Function to fetch and display data
async function fetchData() {
    if (!isFirebaseReady) {
        showMessage("Firebase is not ready yet. Please try again.", "error");
        return;
    }

    try {
        const residentsCollection = collection(db, `artifacts/${appId}/public/data/residents`);
        const querySnapshot = await getDocs(residentsCollection);
        const data = [];
        querySnapshot.forEach((doc) => {
            data.push(doc.data());
        });
        displayDataInTable(data);
    } catch (error) {
        console.error("Error fetching documents: ", error);
        showMessage("Failed to load data. Please try again.", "error");
    }
}

// Function to display data in the table
function displayDataInTable(data) {
    dataTableBody.innerHTML = '';
    data.sort((a, b) => a.flatNumber - b.flatNumber); // Sort data by flat number
    data.forEach(item => {
        const residentsText = item.residents.map(r => `${r.name} (${r.status})`).join(', ');
        const row = document.createElement('tr');
        row.className = 'border-b last:border-b-0';
        row.innerHTML = `
            <td class="px-6 py-4">${item.flatNumber}</td>
            <td class="px-6 py-4">${item.residents.some(r => r.status === 'Occupied') ? 'Occupied' : 'Vacant'}</td>
            <td class="px-6 py-4">${residentsText}</td>
            <td class="px-6 py-4 text-center">
                <button class="edit-btn text-indigo-600 hover:text-indigo-900" data-flat-number="${item.flatNumber}">Edit</button>
                <button class="delete-btn text-red-600 hover:text-red-900 ml-4" data-flat-number="${item.flatNumber}">Delete</button>
            </td>
        `;
        dataTableBody.appendChild(row);
    });
}

// Event listeners for data view buttons
showDataBtn.addEventListener('click', () => {
    formView.classList.add('hidden');
    dataView.classList.remove('hidden');
    fetchData();
});

goBackBtn.addEventListener('click', () => {
    dataView.classList.add('hidden');
    formView.classList.remove('hidden');
});

// Event listeners for search
searchButton.addEventListener('click', () => {
    const query = searchInput.value.toLowerCase();
    const rows = dataTableBody.querySelectorAll('tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(query)) {
            row.classList.remove('hidden');
        } else {
            row.classList.add('hidden');
        }
    });
});

// Event listener for edit and delete buttons on the table
dataTableBody.addEventListener('click', async (e) => {
    if (!isFirebaseReady) {
        showMessage("Firebase is not ready yet. Please try again.", "error");
        return;
    }

    const flatNumber = e.target.getAttribute('data-flat-number');
    if (e.target.classList.contains('delete-btn')) {
        const confirmed = confirm(`Are you sure you want to delete the data for Flat ${flatNumber}?`);
        if (confirmed) {
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/residents`, flatNumber));
                showMessage("Data deleted successfully!", "success");
                fetchData(); // Refresh the table
            } catch (error) {
                console.error("Error deleting document: ", error);
                showMessage("An error occurred during deletion. Please try again.", "error");
            }
        }
    } else if (e.target.classList.contains('edit-btn')) {
        try {
            const docRef = doc(db, `artifacts/${appId}/public/data/residents`, flatNumber);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                dataView.classList.add('hidden');
                formView.classList.remove('hidden');
                
                flatNumberSelect.value = data.flatNumber;
                residentsContainer.innerHTML = '';
                data.residents.forEach(resident => {
                    createResidentSection(resident.name, resident.status);
                });
            } else {
                showMessage("Document not found.", "error");
            }
        } catch (error) {
            console.error("Error fetching document for edit:", error);
            showMessage("An error occurred while fetching data for editing.", "error");
        }
    }
});

exportDataBtn.addEventListener('click', async () => {
    if (!isFirebaseReady) {
        showMessage("Firebase is not ready yet. Please try again.", "error");
        return;
    }
    
    try {
        const residentsCollection = collection(db, `artifacts/${appId}/public/data/residents`);
        const querySnapshot = await getDocs(residentsCollection);
        const data = [];
        querySnapshot.forEach((doc) => {
            data.push(doc.data());
        });

        if (data.length === 0) {
            showMessage("No data to export.", "error");
            return;
        }

        let csvContent = "Flat Number,Status,Residents\n";
        data.forEach(item => {
            const residentsText = item.residents.map(r => `${r.name} (${r.status})`).join('; ');
            const statusText = item.residents.some(r => r.status === 'Occupied') ? 'Occupied' : 'Vacant';
            csvContent += `${item.flatNumber},"${statusText}","${residentsText}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'merlin_orion_residents.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showMessage("Data exported successfully!", "success");

    } catch (error) {
        console.error("Error exporting data:", error);
        showMessage("An error occurred during export. Please try again.", "error");
    }
});

async function initializeFirebase() {
    if (!firebaseConfig.apiKey) {
        showMessage("Firebase configuration not found. Please check your Netlify environment variables.", "error");
        return;
    }

    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        // Sign in with the provided custom token or anonymously if not available
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log("Authenticated user:", user.uid);
                // The user is authenticated, we can proceed with other Firebase operations
            } else {
                console.log("No user is signed in.");
                try {
                    await signInAnonymously(auth);
                    console.log("Signed in anonymously.");
                } catch (e) {
                    console.error("Failed to sign in anonymously:", e);
                }
            }
        });

        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Signed in with custom token. User ID:", auth.currentUser.uid);
        } else {
            await signInAnonymously(auth);
            console.log("Signed in anonymously. User ID:", auth.currentUser.uid);
        }

        isFirebaseReady = true;
        console.log("Firebase is ready.");

        generateFlatNumbers();
        createResidentSection();

    } catch (e) {
        console.error("Failed to initialize Firebase or sign in:", e);
        showMessage("Failed to initialize Firebase. Please check your configuration.", "error");
    }
}

initializeFirebase();
