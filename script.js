// script.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";

import jsPDF from "jspdf";

// Firebase config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

// DOM Elements
const signInBtn = document.getElementById("sign-in-btn");
const signOutBtn = document.getElementById("sign-out-btn");
const userDetails = document.getElementById("user-details");
const residentForm = document.getElementById("resident-form");
const addMemberBtn = document.getElementById("add-member-btn");
const membersContainer = document.getElementById("members-container");
const viewDataBtn = document.getElementById("view-data-btn");
const tableView = document.getElementById("table-view");
const formView = document.getElementById("form-view");
const backBtn = document.getElementById("back-btn");
const exportBtn = document.getElementById("export-btn");
const dataTableBody = document.getElementById("data-table-body");

// Auth handlers
signInBtn.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
});

signOutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    userDetails.textContent = `Logged in as: ${user.displayName} (${user.email})`;
    signInBtn.style.display = "none";
    signOutBtn.style.display = "inline-block";
    residentForm.style.display = "block";
  } else {
    currentUser = null;
    userDetails.textContent = "";
    signInBtn.style.display = "inline-block";
    signOutBtn.style.display = "none";
    residentForm.style.display = "none";
    tableView.style.display = "none";
  }
});

// Add member block
addMemberBtn.addEventListener("click", () => {
  const memberBlock = document.createElement("div");
  memberBlock.className = "member-block";
  memberBlock.innerHTML = `
    <label>Full Name* <input type="text" name="fullName" required></label>
    <label>Email <input type="email" name="email"></label>
    <label>Contact Number <input type="text" name="contact"></label>
    <label>Gender* 
      <select name="gender" required>
        <option value="">Select</option>
        <option>Male</option>
        <option>Female</option>
      </select>
    </label>
    <label>Date of Birth <input type="date" name="dob"></label>
    <label>Relation* 
      <select name="relation" required>
        <option value="">Select</option>
        <option>Self</option>
        <option>Spouse</option>
        <option>Father</option>
        <option>Mother</option>
        <option>Son</option>
        <option>Daughter</option>
        <option>Daughter In Law</option>
        <option>Other</option>
      </select>
    </label>
    <label>Blood Group 
      <select name="bloodGroup">
        <option value="">Select</option>
        <option>A+</option><option>A-</option>
        <option>B+</option><option>B-</option>
        <option>AB+</option><option>AB-</option>
        <option>O+</option><option>O-</option>
      </select>
    </label>
    <label>Education <input type="text" name="education"></label>
    <label>Occupation <input type="text" name="occupation"></label>
    <label>City (For NRIs) <input type="text" name="city"></label>
    <button type="button" class="remove-member-btn">Remove Member</button>
  `;
  membersContainer.appendChild(memberBlock);

  memberBlock.querySelector(".remove-member-btn").addEventListener("click", () => {
    memberBlock.remove();
  });
});

// Submit form
residentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const flatNo = document.getElementById("flatNo").value;
  const residentType = document.getElementById("residentType").value;

  const memberBlocks = document.querySelectorAll(".member-block");
  const members = Array.from(memberBlocks).map((block) => ({
    fullName: block.querySelector("[name='fullName']").value,
    email: block.querySelector("[name='email']").value || "",
    contact: block.querySelector("[name='contact']").value,
    gender: block.querySelector("[name='gender']").value,
    dob: block.querySelector("[name='dob']").value,
    relation: block.querySelector("[name='relation']").value,
    bloodGroup: block.querySelector("[name='bloodGroup']").value,
    education: block.querySelector("[name='education']").value,
    occupation: block.querySelector("[name='occupation']").value,
    city: block.querySelector("[name='city']").value,
  }));

  await addDoc(collection(db, "residents"), {
    flatNo,
    residentType,
    members,
    createdBy: currentUser.email,
    createdAt: new Date(),
  });

  alert("Resident details submitted!");
  residentForm.reset();
  membersContainer.innerHTML = "";
});

// View submitted data
viewDataBtn.addEventListener("click", async () => {
  formView.style.display = "none";
  tableView.style.display = "block";
  await loadTableData();
});

backBtn.addEventListener("click", () => {
  formView.style.display = "block";
  tableView.style.display = "none";
});

// Load table data
async function loadTableData() {
  dataTableBody.innerHTML = "";
  const q = query(collection(db, "residents"), orderBy("flatNo"));
  const snapshot = await getDocs(q);

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${data.flatNo}</td>
      <td>${data.residentType}</td>
      <td>
        ${data.members
          .map((m) => {
            const age = m.dob ? calculateAge(m.dob) : "";
            return `
              <div class="member-info">
                <strong>${m.fullName}</strong> (${m.relation})<br>
                ${m.gender}${age ? `, Age: ${age}` : ""}<br>
                ${m.email ? `Email: ${m.email}<br>` : ""}
                ${m.contact ? `Contact: ${m.contact}<br>` : ""}
                ${m.bloodGroup ? `Blood Group: ${m.bloodGroup}<br>` : ""}
                ${m.education ? `Education: ${m.education}<br>` : ""}
                ${m.occupation ? `Occupation: ${m.occupation}<br>` : ""}
                ${m.city ? `City: ${m.city}<br>` : ""}
              </div>
              <hr>
            `;
          })
          .join("")}
      </td>
      <td class="actions"></td>
    `;

    const actionsTd = tr.querySelector(".actions");

    if (
      currentUser &&
      (currentUser.email === data.createdBy ||
        data.members.some((m) => m.email && m.email.toLowerCase() === currentUser.email.toLowerCase()))
    ) {
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => editRecord(docSnap.id, data));

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => deleteRecord(docSnap.id));

      actionsTd.appendChild(editBtn);
      actionsTd.appendChild(deleteBtn);
    }

    dataTableBody.appendChild(tr);
  });
}

function calculateAge(dob) {
  const birthDate = new Date(dob);
  const diff = Date.now() - birthDate.getTime();
  const ageDt = new Date(diff);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

async function editRecord(id, data) {
  alert(`Editing record for Flat ${data.flatNo}. Implement form population logic here.`);
}

async function deleteRecord(id) {
  if (confirm("Are you sure you want to delete this record?")) {
    await deleteDoc(doc(db, "residents", id));
    alert("Record deleted!");
    await loadTableData();
  }
}

// Export table to PDF
exportBtn.addEventListener("click", () => {
  const docPdf = new jsPDF();
  let y = 10;

  docPdf.text("Merlin Orion Residents Directory", 10, y);
  y += 10;

  const rows = document.querySelectorAll("#data-table-body tr");
  rows.forEach((row) => {
    const cols = row.querySelectorAll("td");
    const flatNo = cols[0].innerText;
    const residentType = cols[1].innerText;
    const members = cols[2].innerText;

    docPdf.text(`Flat: ${flatNo}`, 10, y);
    y += 6;
    docPdf.text(`Type: ${residentType}`, 10, y);
    y += 6;
    docPdf.text(members, 10, y);
    y += 20;
  });

  docPdf.save("residents.pdf");
});
