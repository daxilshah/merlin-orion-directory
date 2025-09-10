import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, getDocs, deleteDoc } from "firebase/firestore";
import { setLogLevel } from "firebase/firestore";

setLogLevel('debug');

// Access environment variables using import.meta.env
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const appId = "merlin-orion";
const initialAuthToken = null;

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
const dataTableBody = document.querySelector('#dataTable tbody');
const flatNumberSelect = document.getElementById('flatNumber');
const flatStatusSelect = document.getElementById('flatStatus');
const exportDataBtn = document.getElementById('exportDataBtn');

// Function to handle the placeholder color for select elements
const updateSelectPlaceholderColor = (selectElement) => {
    if (!selectElement) return;
    if (selectElement.value === "") {
        selectElement.classList.add('placeholder-color');
    } else {
        selectElement.classList.remove('placeholder-color');
    }
};

// Function to display messages to the user
function showMessage(message, type = "info") {
    messageBox.textContent = message;
    messageBox.classList.remove("hidden", "bg-green-100", "text-green-800", "bg-red-100", "text-red-800", "bg-sky-100", "text-sky-800");
    messageBox.classList.remove("message-box-hidden");

    if (type === "success") {
        messageBox.classList.add("bg-green-100", "text-green-800");
    } else if (type === "error") {
        messageBox.classList.add("bg-red-100", "text-red-800");
    } else {
        messageBox.classList.add("bg-sky-100", "text-sky-800");
    }

    setTimeout(() => {
        messageBox.classList.add("message-box-hidden");
    }, 3000);
    setTimeout(() => {
        messageBox.classList.add("hidden");
    }, 3300);
}

// Function to generate flat number options
const generateFlatNumbers = () => {
    const flatNumbers = [];
    for (let floor = 1; floor <= 14; floor++) {
        for (let house = 1; house <= 4; house++) {
            flatNumbers.push(`${floor}${String(house).padStart(2, '0')}`);
        }
    }
    flatNumbers.forEach(flatNum => {
        const option = document.createElement('option');
        option.value = flatNum;
        option.textContent = flatNum;
        flatNumberSelect.appendChild(option);
    });
};

// Function to create a new resident section
let residentCount = 0;
const createResidentSection = (residentData = {}) => {
    residentCount++;
    const section = document.createElement('div');
    section.className = 'resident-section relative mt-4';
    section.innerHTML = `
        <h3 class="font-bold text-gray-700 mb-4 text-lg">Resident #${residentCount}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="input-group">
                <label for="name${residentCount}" class="text-sm text-gray-600">Full Name <span class="text-red-500">*</span></label>
                <input type="text" id="name${residentCount}" placeholder="Full Name" required
                       class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm placeholder-gray-400
                              focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                       value="${residentData.name || ''}">
            </div>
            <div class="input-group">
                <label for="contact${residentCount}" class="text-sm text-gray-600">Contact Number</label>
                <input type="tel" id="contact${residentCount}" placeholder="e.g., 9876543210"
                       class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm placeholder-gray-400
                              focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                       value="${residentData.contact || ''}">
            </div>
            <div class="input-group">
                <label for="dob${residentCount}" class="text-sm text-gray-600">Date of Birth</label>
                <input type="date" id="dob${residentCount}"
                       class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm
                              focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                       value="${residentData.dob || ''}">
            </div>
            <div class="input-group relative">
                <label for="bloodGroup${residentCount}" class="text-sm text-gray-600">Blood Group</label>
                <select id="bloodGroup${residentCount}"
                       class="mt-1 block w-full pl-3 pr-10 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm
                              focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 appearance-none">
                    <option value="" disabled selected>Select blood group</option>
                    <option value="A+" ${residentData.bloodGroup === 'A+' ? 'selected' : ''}>A+</option>
                    <option value="A-" ${residentData.bloodGroup === 'A-' ? 'selected' : ''}>A-</option>
                    <option value="B+" ${residentData.bloodGroup === 'B+' ? 'selected' : ''}>B+</option>
                    <option value="B-" ${residentData.bloodGroup === 'B-' ? 'selected' : ''}>B-</option>
                    <option value="AB+" ${residentData.bloodGroup === 'AB+' ? 'selected' : ''}>AB+</option>
                    <option value="AB-" ${residentData.bloodGroup === 'AB-' ? 'selected' : ''}>AB-</option>
                    <option value="O+" ${residentData.bloodGroup === 'O+' ? 'selected' : ''}>O+</option>
                    <option value="O-" ${residentData.bloodGroup === 'O-' ? 'selected' : ''}>O-</option>
                </select>
                <div class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 mt-4 flex items-center px-2 text-gray-700">
                    <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
                    </svg>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <input type="checkbox" id="primaryContact${residentCount}"
                       class="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                       ${residentData.isPrimaryContact ? 'checked' : ''}>
                <label for="primaryContact${residentCount}" class="text-sm text-gray-600">Is this a Primary Contact?</label>
            </div>
            <div class="input-group relative">
                <label for="relation${residentCount}" class="text-sm text-gray-600">Relation to Primary Contact <span class="text-red-500">*</span></label>
                <select id="relation${residentCount}"
                       class="mt-1 block w-full pl-3 pr-10 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm
                              focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 appearance-none">
                    <option value="" disabled selected>Select relation</option>
                    <option value="Self" ${residentData.relation === 'Self' ? 'selected' : ''}>Self</option>
                    <option value="Spouse" ${residentData.relation === 'Spouse' ? 'selected' : ''}>Spouse</option>
                    <option value="Father" ${residentData.relation === 'Father' ? 'selected' : ''}>Father</option>
                    <option value="Mother" ${residentData.relation === 'Mother' ? 'selected' : ''}>Mother</option>
                    <option value="Daughter" ${residentData.relation === 'Daughter' ? 'selected' : ''}>Daughter</option>
                    <option value="Son" ${residentData.relation === 'Son' ? 'selected' : ''}>Son</option>
                    <option value="Brother" ${residentData.relation === 'Brother' ? 'selected' : ''}>Brother</option>
                    <option value="Sister" ${residentData.relation === 'Sister' ? 'selected' : ''}>Sister</option>
                    <option value="Other" ${residentData.relation === 'Other' ? 'selected' : ''}>Other</option>
                </select>
                <div class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 mt-4 flex items-center px-2 text-gray-700">
                    <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
                    </svg>
                </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:col-span-2">
              <div class="input-group">
                    <label for="education${residentCount}" class="text-sm text-gray-600">Education</label>
                    <input type="text" id="education${residentCount}" placeholder="e.g., B.Tech, M.S."
                           class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm placeholder-gray-400
                                  focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                           value="${residentData.education || ''}">
                </div>
                <div class="input-group">
                    <label for="occupation${residentCount}" class="text-sm text-gray-600">Occupation</label>
                    <input type="text" id="occupation${residentCount}" placeholder="e.g., Software Engineer"
                           class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm placeholder-gray-400
                                  focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                           value="${residentData.occupation || ''}">
                </div>
            </div>
        </div>
        <button type="button" class="remove-btn absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586l-1.293-1.293z" clip-rule="evenodd"></path></svg>
        </button>
    `;
    residentsContainer.appendChild(section);

    section.querySelector('.remove-btn').addEventListener('click', () => {
        section.remove();
        const sections = residentsContainer.querySelectorAll('.resident-section');
        residentCount = 0;
        sections.forEach((s) => {
            residentCount++;
            s.querySelector('h3').textContent = `Resident #${residentCount}`;
        });
    });

    const dobInput = section.querySelector(`#dob${residentCount}`);
    const bloodGroupSelect = section.querySelector(`#bloodGroup${residentCount}`);
    const relationSelect = section.querySelector(`#relation${residentCount}`);

    const setDateColor = () => {
        if (!dobInput.value) {
            dobInput.classList.add('placeholder-color');
        } else {
            dobInput.classList.remove('placeholder-color');
        }
    };

    const updateSelects = () => {
        updateSelectPlaceholderColor(bloodGroupSelect);
        updateSelectPlaceholderColor(relationSelect);
    };

    setDateColor();
    updateSelects();

    dobInput.addEventListener('change', setDateColor);
    bloodGroupSelect.addEventListener('change', updateSelects);
    relationSelect.addEventListener('change', updateSelects);
};

flatNumberSelect.addEventListener('change', async (e) => {
    const selectedFlatNumber = e.target.value;
    if (!isFirebaseReady || !auth.currentUser) {
         console.log("Firebase is not ready yet.");
         showMessage("Database is not ready. Please wait a moment and try again.", "info");
         return;
     }

    try {
        const docRef = doc(db, `artifacts/${appId}/public/data/residents`, selectedFlatNumber);
        const docSnap = await getDoc(docRef);

        residentsContainer.innerHTML = '';
        residentCount = 0;

        if (docSnap.exists()) {
            const data = docSnap.data();
            flatStatusSelect.value = data.flatStatus;
            const residentsArray = JSON.parse(data.residents);
            residentsArray.forEach(resident => createResidentSection(resident));
        } else {
            flatStatusSelect.value = "";
            createResidentSection();
        }
        updateSelectPlaceholderColor(flatStatusSelect);
    } catch (error) {
        console.error("Error fetching document:", error);
        showMessage("An error occurred while loading data.", "error");
    }
});


addResidentBtn.addEventListener('click', createResidentSection);

residentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!isFirebaseReady || !auth.currentUser) {
        console.error("Firebase is not initialized or user is not authenticated.");
        showMessage("Database is not ready. Please try again.", "error");
        return;
    }

    const flatNumber = document.getElementById('flatNumber').value;
    const flatStatus = document.getElementById('flatStatus').value;
    const residents = [];
    const residentSections = residentsContainer.querySelectorAll('.resident-section');

    residentSections.forEach((section, index) => {
        const name = section.querySelector(`#name${index + 1}`).value;
        const contact = section.querySelector(`#contact${index + 1}`).value;
        const dob = section.querySelector(`#dob${index + 1}`).value;
        const bloodGroup = section.querySelector(`#bloodGroup${index + 1}`).value;
        const occupation = section.querySelector(`#occupation${index + 1}`).value;
        const education = section.querySelector(`#education${index + 1}`).value;
        const isPrimaryContact = section.querySelector(`#primaryContact${index + 1}`).checked;
        const relation = section.querySelector(`#relation${index + 1}`).value;

        residents.push({
            name,
            contact,
            dob,
            bloodGroup,
            occupation,
            education,
            isPrimaryContact,
            relation
        });
    });

    const formData = {
        flatNumber,
        flatStatus,
        residents: JSON.stringify(residents),
        submissionTimestamp: new Date()
    };

    try {
        const docRef = doc(db, `artifacts/${appId}/public/data/residents`, flatNumber);
        await setDoc(docRef, formData);
        console.log("Form data saved successfully!");
        showMessage("Form submitted successfully! Thank you for providing your information.", "success");
        residentForm.reset();
        residentsContainer.innerHTML = '';
        residentCount = 0;
        createResidentSection();
    } catch (error) {
        console.error("Error writing document to Firestore: ", error);
        showMessage("An error occurred. Please try again.", "error");
    }
});

showDataBtn.addEventListener('click', () => {
    if (!isFirebaseReady || !auth.currentUser) {
         console.log("Firebase is not ready yet.");
         showMessage("Database is not ready. Please wait a moment and try again.", "info");
         return;
     }
    formView.classList.add('hidden');
    dataView.classList.remove('hidden');
    loadData();
});

goBackBtn.addEventListener('click', () => {
    formView.classList.remove('hidden');
    dataView.classList.add('hidden');
});

const loadData = () => {
    if (!db || !auth.currentUser) {
        showMessage("Database is not ready. Cannot load data.", "error");
        return;
    }

    console.log("Attempting to load data from Firestore...");
    const residentsCollection = collection(db, `artifacts/${appId}/public/data/residents`);
    onSnapshot(residentsCollection, (snapshot) => {
        console.log(`Received snapshot. Number of documents: ${snapshot.docs.length}`);
        dataTableBody.innerHTML = '';
        if (snapshot.empty) {
            const noDataRow = document.createElement('tr');
            noDataRow.innerHTML = `<td colspan="4" class="px-6 py-4 text-center text-gray-500">No data submitted yet.</td>`;
            dataTableBody.appendChild(noDataRow);
        } else {
            snapshot.forEach((doc) => {
                const data = doc.data();
                console.log("Processing document:", data);
                const residentsArray = JSON.parse(data.residents);
                const residentsHtml = residentsArray.map(r => `
                    <div class="p-2 bg-gray-50 rounded-md my-2">
                        <strong>Name:</strong> ${r.name}<br>
                        <strong>Contact:</strong> ${r.contact}<br>
                        <strong>DOB:</strong> ${r.dob}<br>
                        <strong>Blood Group:</strong> ${r.bloodGroup}<br>
                        <strong>Occupation:</strong> ${r.occupation || 'N/A'}<br>
                        <strong>Education:</strong> ${r.education || 'N/A'}<br>
                        <strong>Primary Contact:</strong> ${r.isPrimaryContact ? 'Yes' : 'No'}<br>
                        <strong>Relation:</strong> ${r.relation || 'N/A'}
                    </div>
                `).join('');

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap">${data.flatNumber}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${data.flatStatus}</td>
                    <td class="px-6 py-4">
                        ${residentsHtml}
                    </td>
                    <td class="px-6 py-4 text-center">
                        <button class="edit-btn py-2 px-4 rounded-md text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 transition-colors" data-id="${data.flatNumber}">Edit</button>
                    </td>
                `;
                dataTableBody.appendChild(row);
            });

            document.querySelectorAll('.edit-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const flatNumberToEdit = e.target.dataset.id;
                    if (flatNumberToEdit) {
                        formView.classList.remove('hidden');
                        dataView.classList.add('hidden');
                        flatNumberSelect.value = flatNumberToEdit;
                        flatNumberSelect.dispatchEvent(new Event('change'));
                    }
                });
            });
        }
    }, (error) => {
        console.error("Error fetching data from Firestore:", error);
        showMessage("Error loading data. Please try again later.", "error");
    });
};

exportDataBtn.addEventListener('click', async () => {
    if (!isFirebaseReady || !auth.currentUser) {
        showMessage("Database not ready. Cannot export data.", "error");
        return;
    }

    try {
        const residentsCollection = collection(db, `artifacts/${appId}/public/data/residents`);
        const snapshot = await getDocs(residentsCollection);

        if (snapshot.empty) {
            showMessage("No data to export.", "info");
            return;
        }

        let csvContent = "Flat Number,Status,Residents\n";
        snapshot.forEach(doc => {
            const data = doc.data();
            const residentsArray = JSON.parse(data.residents);
            const residentsString = residentsArray.map(r => {
                const name = r.name ? r.name.replace(/,/g, '') : '';
                const contact = r.contact ? r.contact.replace(/,/g, '') : '';
                const dob = r.dob ? r.dob.replace(/,/g, '') : '';
                const bloodGroup = r.bloodGroup ? r.bloodGroup.replace(/,/g, '') : '';
                const occupation = r.occupation ? r.occupation.replace(/,/g, '') : '';
                const education = r.education ? r.education.replace(/,/g, '') : '';
                const isPrimary = r.isPrimaryContact ? 'Yes' : 'No';
                const relation = r.relation ? r.relation.replace(/,/g, '') : 'N/A';
                return `(Name: ${name}, Contact: ${contact}, DOB: ${dob}, Blood Group: ${bloodGroup}, Occupation: ${occupation}, Education: ${education}, Primary: ${isPrimary}, Relation: ${relation})`;
            }).join('; ');

            const sanitizedResidents = `"${residentsString.replace(/"/g, '""')}"`;
            csvContent += `${data.flatNumber},${data.flatStatus},${sanitizedResidents}\n`;
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
        showMessage("Firebase configuration not found. Please check your .env file.", "error");
        return;
    }

    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

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
