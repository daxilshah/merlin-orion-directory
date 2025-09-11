import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDocs, collection, updateDoc, deleteDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// DOM Elements
const signInBtn = document.getElementById("sign-in-btn");
const signOutBtn = document.getElementById("sign-out-btn");
const userDetails = document.getElementById("user-details");
const formView = document.getElementById("form-view");
const tableView = document.getElementById("table-view");
const flatNumberSelect = document.getElementById("flat-number");
const residentTypeSelect = document.getElementById("resident-type");
const membersContainer = document.getElementById("members-container");
const addMemberBtn = document.getElementById("add-member-btn");
const submitBtn = document.getElementById("submit-btn");
const viewDataBtn = document.getElementById("view-data-btn");
const backBtn = document.getElementById("back-btn");
const exportBtn = document.getElementById("export-btn");
const residentsTableBody = document.querySelector("#residents-table tbody");
const memberTemplate = document.getElementById("member-template").content;

let currentUser = null;
let editFlatId = null;

// Populate Flat Number Dropdown (101-104 ... 1401-1404)
function populateFlatNumbers(disabledFlats = []) {
  flatNumberSelect.innerHTML = "";
  for (let floor = 1; floor <= 14; floor++) {
    for (let flat = 1; flat <= 4; flat++) {
      const flatNo = `${floor}${flat.toString().padStart(2, "0")}`;
      const option = document.createElement("option");
      option.value = flatNo;
      option.textContent = flatNo;
      if (disabledFlats.includes(flatNo) && flatNo !== editFlatId) option.disabled = true;
      flatNumberSelect.appendChild(option);
    }
  }
}

// Add Member Panel
function addMemberPanel(data = {}) {
  const clone = memberTemplate.cloneNode(true);
  const block = clone.querySelector(".member-block");

  block.querySelector(".full-name").value = data.fullName || "";
  block.querySelector(".gender").value = data.gender || "";
  block.querySelector(".contact-number").value = data.contactNumber || "";
  block.querySelector(".email").value = data.email || "";
  block.querySelector(".dob").value = data.dob || "";
  block.querySelector(".relation").value = data.relation || "";
  block.querySelector(".blood-group").value = data.bloodGroup || "";
  block.querySelector(".education").value = data.education || "";
  block.querySelector(".occupation").value = data.occupation || "";
  block.querySelector(".city").value = data.city || "";

  // Remove panel
  block.querySelector(".remove-member-btn").addEventListener("click", () => {
    membersContainer.removeChild(block);
  });

  membersContainer.appendChild(clone);
}

// Clear Form
function clearForm() {
  flatNumberSelect.value = "";
  residentTypeSelect.value = "Owner";
  membersContainer.innerHTML = "";
  editFlatId = null;
}

// Submit Form
submitBtn.addEventListener("click", async () => {
  const flatId = flatNumberSelect.value;
  const residentType = residentTypeSelect.value;
  if (!flatId || !residentType) return alert("Flat and Resident Type are required.");

  const members = Array.from(membersContainer.children).map(block => ({
    fullName: block.querySelector(".full-name").value.trim(),
    gender: block.querySelector(".gender").value,
    contactNumber: block.querySelector(".contact-number").value.trim(),
    email: block.querySelector(".email").value.trim(),
    dob: block.querySelector(".dob").value,
    relation: block.querySelector(".relation").value,
    bloodGroup: block.querySelector(".blood-group").value,
    education: block.querySelector(".education").value,
    occupation: block.querySelector(".occupation").value,
    city: block.querySelector(".city").value
  }));

  // Validation
  if (members.some(m => !m.fullName || !m.gender || !m.relation)) {
    return alert("Full Name, Gender, and Relation are required for all members.");
  }

  const memberEmails = members.map(m => m.email).filter(Boolean);

  const docRef = doc(db, "residents", flatId);
  await setDoc(docRef, {
    flatId,
    residentType,
    members,
    memberEmails,
    createdBy: currentUser.email,
    timestamp: new Date().toISOString()
  });

  alert("Data saved successfully!");
  clearForm();
  loadTable();
  populateFlatNumbers(); // Refresh disabled flats
});

// Load Submitted Data Table
async function loadTable() {
  tableView.style.display = "block";
  formView.style.display = "none";
  residentsTableBody.innerHTML = "";

  const snapshot = await getDocs(collection(db, "residents"));
  const sortedDocs = snapshot.docs.sort((a,b) => a.id - b.id);

  const disabledFlats = [];

  sortedDocs.forEach(docSnap => {
    const data = docSnap.data();
    const tr = document.createElement("tr");

    // Members details multiline
    const membersInfo = data.members.map(m => {
      const age = m.dob ? Math.floor((new Date() - new Date(m.dob)) / (365.25*24*60*60*1000)) : "";
      return `
        <strong>${m.fullName}</strong> (${m.relation}, ${m.gender}${age ? `, Age: ${age}` : ""})
        <br>Contact: ${m.contactNumber || "-"} | Email: ${m.email || "-"}
        <br>Blood Group: ${m.bloodGroup || "-"} | Education: ${m.education || "-"}
        <br>Occupation: ${m.occupation || "-"} | City: ${m.city || "-"}
      `;
    }).join("<hr>");

    tr.innerHTML = `
      <td>${data.flatId}</td>
      <td>${data.residentType}</td>
      <td>${membersInfo}</td>
      <td></td>
    `;

    // Actions
    const actionsTd = tr.querySelector("td:last-child");
    if (currentUser && (currentUser.email === data.createdBy || data.memberEmails.includes(currentUser.email))) {
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => prefillForm(data));
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", async () => {
        if (confirm("Delete this record?")) {
          await deleteDoc(doc(db, "residents", data.flatId));
          loadTable();
          populateFlatNumbers();
        }
      });
      actionsTd.appendChild(editBtn);
      actionsTd.appendChild(deleteBtn);
    }

    residentsTableBody.appendChild(tr);
    disabledFlats.push(data.flatId);
  });

  populateFlatNumbers(disabledFlats);
}

// Prefill Form for Edit
function prefillForm(data) {
  formView.style.display = "block";
  tableView.style.display = "none";
  editFlatId = data.flatId;
  flatNumberSelect.value = data.flatId;
  residentTypeSelect.value = data.residentType;
  membersContainer.innerHTML = "";
  data.members.forEach(m => addMemberPanel(m));
}

// Add Resident Button
addMemberBtn.addEventListener("click", () => addMemberPanel());

// View Data Button
viewDataBtn.addEventListener("click", loadTable);

// Back Button
backBtn.addEventListener("click", () => {
  tableView.style.display = "none";
  formView.style.display = "block";
});

// Export Button
exportBtn.addEventListener("click", () => {
  const rows = Array.from(residentsTableBody.querySelectorAll("tr"));
  const data = rows.map(r => Array.from(r.children).slice(0,3).map(td => td.innerText));
  let csvContent = "data:text/csv;charset=utf-8," + data.map(e => e.join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "residents.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// Authentication
signInBtn.addEventListener("click", async () => {
  const result = await signInWithPopup(auth, provider);
  currentUser = result.user;
  userDetails.textContent = `Logged in as: ${currentUser.displayName || currentUser.email}`;
});

signOutBtn.addEventListener("click", async () => {
  await signOut(auth);
  currentUser = null;
  userDetails.textContent = "";
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    userDetails.textContent = `Logged in as: ${currentUser.displayName || currentUser.email}`;
  } else {
    currentUser = null;
    userDetails.textContent = "";
  }
});

// Initialize
populateFlatNumbers();
addMemberPanel();
