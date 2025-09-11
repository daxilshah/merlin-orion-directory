import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDocs, query, orderBy, deleteDoc, updateDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import jsPDF from "jspdf";

// Firebase configuration
const firebaseConfig = {
  apiKey: "<YOUR_API_KEY>",
  authDomain: "<YOUR_AUTH_DOMAIN>",
  projectId: "<YOUR_PROJECT_ID>",
  storageBucket: "<YOUR_STORAGE_BUCKET>",
  messagingSenderId: "<YOUR_MSG_SENDER_ID>",
  appId: "<YOUR_APP_ID>"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// DOM Elements
const formView = document.getElementById("form-view");
const tableView = document.getElementById("table-view");
const flatSelect = document.getElementById("flat-number");
const residentTypeSelect = document.getElementById("resident-type");
const membersContainer = document.getElementById("members-container");
const addMemberBtn = document.getElementById("add-member-btn");
const submitBtn = document.getElementById("submit-btn");
const viewDataBtn = document.getElementById("view-data-btn");
const backBtn = document.getElementById("back-btn");
const exportBtn = document.getElementById("export-btn");
const signInBtn = document.getElementById("sign-in-btn");
const signOutBtn = document.getElementById("sign-out-btn");
const userDetailsSpan = document.getElementById("user-details");
const residentsTableBody = document.querySelector("#residents-table tbody");

let currentUser = null;
let editingFlatId = null;

// Populate Flat Number Dropdown
function populateFlats() {
  flatSelect.innerHTML = '<option value="" disabled selected>Select Flat Number</option>';
  for (let floor = 1; floor <= 14; floor++) {
    for (let flat = 1; flat <= 4; flat++) {
      let flatNo = `${floor}0${flat}`;
      flatSelect.innerHTML += `<option value="${flatNo}">${flatNo}</option>`;
    }
  }
}

// Add Resident Panel
function createMemberPanel(memberData = {}) {
  const panel = document.createElement("div");
  panel.className = "resident-section";

  panel.innerHTML = `
    <button type="button" class="remove-member-btn">✕</button>
    <div class="row">
      <div class="col input-group">
        <label>Full Name</label>
        <input type="text" placeholder="Full Name" value="${memberData.fullName || ""}" required/>
      </div>
      <div class="col input-group">
        <label>Gender</label>
        <select required>
          <option value="" disabled ${!memberData.gender ? "selected" : ""}>Select Gender</option>
          <option value="Male" ${memberData.gender === "Male" ? "selected" : ""}>Male</option>
          <option value="Female" ${memberData.gender === "Female" ? "selected" : ""}>Female</option>
        </select>
      </div>
    </div>
    <div class="row">
      <div class="col input-group">
        <label>Contact Number</label>
        <input type="text" placeholder="Contact Number" value="${memberData.contact || ""}"/>
      </div>
      <div class="col input-group">
        <label>Email</label>
        <input type="email" placeholder="Email" value="${memberData.email || ""}"/>
      </div>
    </div>
    <div class="row">
      <div class="col input-group">
        <label>Date of Birth</label>
        <input type="date" value="${memberData.dob || ""}"/>
      </div>
      <div class="col input-group">
        <label>Relation to Primary Contact</label>
        <select>
          <option value="" disabled ${!memberData.relation ? "selected" : ""}>Select Relation</option>
          <option value="Self" ${memberData.relation === "Self" ? "selected" : ""}>Self</option>
          <option value="Spouse" ${memberData.relation === "Spouse" ? "selected" : ""}>Spouse</option>
          <option value="Father" ${memberData.relation === "Father" ? "selected" : ""}>Father</option>
          <option value="Mother" ${memberData.relation === "Mother" ? "selected" : ""}>Mother</option>
          <option value="Son" ${memberData.relation === "Son" ? "selected" : ""}>Son</option>
          <option value="Daughter" ${memberData.relation === "Daughter" ? "selected" : ""}>Daughter</option>
          <option value="Daughter In Law" ${memberData.relation === "Daughter In Law" ? "selected" : ""}>Daughter In Law</option>
          <option value="Other" ${memberData.relation === "Other" ? "selected" : ""}>Other</option>
        </select>
      </div>
    </div>
    <div class="row">
      <div class="col input-group">
        <label>Blood Group</label>
        <select>
          <option value="" disabled ${!memberData.bloodGroup ? "selected" : ""}>Select Blood Group</option>
          <option value="A+">A+</option>
          <option value="A-">A-</option>
          <option value="B+">B+</option>
          <option value="B-">B-</option>
          <option value="O+">O+</option>
          <option value="O-">O-</option>
          <option value="AB+">AB+</option>
          <option value="AB-">AB-</option>
        </select>
      </div>
      <div class="col input-group">
        <label>Education</label>
        <input type="text" placeholder="Education" value="${memberData.education || ""}"/>
      </div>
    </div>
    <div class="row">
      <div class="col input-group">
        <label>Occupation</label>
        <input type="text" placeholder="Occupation" value="${memberData.occupation || ""}"/>
      </div>
      <div class="col input-group">
        <label>City (Applicable for NRIs)</label>
        <input type="text" placeholder="City" value="${memberData.city || ""}"/>
      </div>
    </div>
  `;

  // Remove button
  panel.querySelector(".remove-member-btn").addEventListener("click", () => panel.remove());

  membersContainer.appendChild(panel);
}

// Add Member Event
addMemberBtn.addEventListener("click", () => createMemberPanel());

// Authentication
signInBtn.addEventListener("click", () => {
  signInWithPopup(auth, provider);
});

signOutBtn.addEventListener("click", () => {
  signOut(auth);
});

// Handle Auth State
onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    signInBtn.classList.add("hidden");
    signOutBtn.classList.remove("hidden");
    userDetailsSpan.textContent = `Logged in as: ${user.email}`;
  } else {
    signInBtn.classList.remove("hidden");
    signOutBtn.classList.add("hidden");
    userDetailsSpan.textContent = "";
  }
});

// Submit Form
submitBtn.addEventListener("click", async () => {
  const flatNo = flatSelect.value;
  const residentType = residentTypeSelect.value;
  if (!flatNo || !residentType) return alert("Flat Number and Resident Type are required!");

  const memberPanels = [...membersContainer.children];
  const members = memberPanels.map(panel => {
    const inputs = panel.querySelectorAll("input, select");
    return {
      fullName: inputs[0].value,
      gender: inputs[1].value,
      contact: inputs[2].value,
      email: inputs[3].value,
      dob: inputs[4].value,
      relation: inputs[5].value,
      bloodGroup: inputs[6].value,
      education: inputs[7].value,
      occupation: inputs[8].value,
      city: inputs[9].value
    };
  });

  const memberEmails = members.map(m => m.email).filter(Boolean);

  try {
    await setDoc(doc(db, "residents", flatNo), {
      flatNo,
      residentType,
      members,
      memberEmails,
      createdBy: currentUser ? currentUser.email : null
    });
    alert("Data submitted successfully!");
    flatSelect.value = "";
    residentTypeSelect.value = "";
    membersContainer.innerHTML = "";
    editingFlatId = null;
  } catch (err) {
    console.error(err);
    alert("Error submitting data");
  }
});

// View Data
viewDataBtn.addEventListener("click", async () => {
  formView.style.display = "none";
  tableView.style.display = "block";
  residentsTableBody.innerHTML = "";
  const snapshot = await getDocs(query(collection(db, "residents"), orderBy("flatNo")));
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const tr = document.createElement("tr");

    // Member info multiline
    const memberInfo = data.members.map(m => {
      const dob = m.dob ? new Date(m.dob) : null;
      const age = dob ? Math.floor((Date.now() - dob.getTime()) / (1000*60*60*24*365)) : "";
      return `<strong>${m.fullName}</strong> (${m.relation}) | ${m.gender} | ${m.contact || "-"} | ${m.email || "-"} | Age: ${age}`;
    }).join("<hr>");

    tr.innerHTML = `
      <td>${data.flatNo}</td>
      <td>${data.residentType}</td>
      <td class="member-info">${memberInfo}</td>
      <td>
        ${currentUser && (currentUser.email === data.createdBy || data.memberEmails.includes(currentUser.email)) ? `
          <button class="edit-btn">Edit</button>
          <button class="delete-btn">Delete</button>
        ` : ""}
      </td>
    `;
    // Edit
    tr.querySelector(".edit-btn")?.addEventListener("click", () => {
      formView.style.display = "block";
      tableView.style.display = "none";
      flatSelect.value = data.flatNo;
      residentTypeSelect.value = data.residentType;
      membersContainer.innerHTML = "";
      data.members.forEach(m => createMemberPanel(m));
      editingFlatId = data.flatNo;
    });
    // Delete
    tr.querySelector(".delete-btn")?.addEventListener("click", async () => {
      if(confirm("Delete this record?")) {
        await deleteDoc(doc(db, "residents", data.flatNo));
        tr.remove();
      }
    });

    residentsTableBody.appendChild(tr);
  });
});

// Go Back
backBtn.addEventListener("click", () => {
  formView.style.display = "block";
  tableView.style.display = "none";
});

// Export to PDF
exportBtn.addEventListener("click", () => {
  const doc = new jsPDF();
  const rows = [];
  document.querySelectorAll("#residents-table tbody tr").forEach(tr => {
    const row = [];
    row.push(tr.children[0].innerText); // flatNo
    row.push(tr.children[1].innerText); // residentType
    row.push(tr.children[2].innerText.replace(/\n/g, ' | ')); // members
    rows.push(row);
  });
  doc.autoTable({
    head: [["Flat No.", "Resident Type", "Members Info"]],
    body: rows
  });
  doc.save("residents.pdf");
});

// Initialize
populateFlats();
