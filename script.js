import { auth, provider, db } from "./firebase.js";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let currentUser = null;
let editDocId = null;

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authSection = document.getElementById("authSection");
const formSection = document.getElementById("formSection");
const tableSection = document.getElementById("tableSection");
const residentForm = document.getElementById("residentForm");
const membersContainer = document.getElementById("membersContainer");
const addMemberBtn = document.getElementById("addMemberBtn");
const viewDataBtn = document.getElementById("viewDataBtn");
const goBackBtn = document.getElementById("goBackBtn");
const exportBtn = document.getElementById("exportBtn");
const residentsTableBody = document.getElementById("residentsTableBody");
const flatNoSelect = document.getElementById("flatNoSelect");

// ------------------ Auth ----------------------
loginBtn.addEventListener("click", async () => {
  await signInWithPopup(auth, provider);
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    authSection.style.display = "none";
    formSection.style.display = "block";
    logoutBtn.style.display = "inline-block";
    updateFlatDropdown();
  } else {
    currentUser = null;
    authSection.style.display = "block";
    formSection.style.display = "none";
    tableSection.style.display = "none";
    logoutBtn.style.display = "none";
  }
});

// ------------------ Flat Dropdown ----------------------
async function updateFlatDropdown() {
  flatNoSelect.innerHTML = "";
  const takenFlats = new Set();
  const snapshot = await getDocs(collection(db, "residents"));
  snapshot.forEach(docSnap => takenFlats.add(docSnap.data().flatNo));

  for (let floor = 1; floor <= 14; floor++) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = `Floor ${floor}`;
    for (let flat = 1; flat <= 4; flat++) {
      const flatNo = `${floor}${String(flat).padStart(2, "0")}`;
      const option = document.createElement("option");
      option.value = `${flatNo}`;
      option.textContent = `${flatNo}`;
      if (takenFlats.has(option.value) && !editDocId) {
        option.disabled = true;
      }
      optgroup.appendChild(option);
    }
    flatNoSelect.appendChild(optgroup);
  }
}

// ------------------ Members ----------------------
function updateMemberNumbers() {
  membersContainer.querySelectorAll(".member-section").forEach((div, idx) => {
    div.querySelector("h3").textContent = `Member ${idx + 1}`;
  });
}

function createMemberSection(member = {}) {
  const div = document.createElement("div");
  div.className = "member-section";
  div.innerHTML = `
    <h3>Member</h3>
    <button type="button" class="remove-member-btn">Remove</button>
    <label>Full Name* <input type="text" name="fullName" value="${member.fullName||""}" required></label>
    <label>Email <input type="email" name="email" value="${member.email||""}"></label>
    <label>Contact Number <input type="text" name="contactNumber" value="${member.contactNumber||""}"></label>
    <label>Gender* 
      <select name="gender" required>
        <option value="">Select</option>
        <option value="Male" ${member.gender==="Male"?"selected":""}>Male</option>
        <option value="Female" ${member.gender==="Female"?"selected":""}>Female</option>
      </select>
    </label>
    <label>Relation* 
      <select name="relation" required>
        <option value="">Select</option>
        <option value="Self" ${member.relation==="Self"?"selected":""}>Self</option>
        <option value="Spouse" ${member.relation==="Spouse"?"selected":""}>Spouse</option>
        <option value="Father" ${member.relation==="Father"?"selected":""}>Father</option>
        <option value="Mother" ${member.relation==="Mother"?"selected":""}>Mother</option>
        <option value="Son" ${member.relation==="Son"?"selected":""}>Son</option>
        <option value="Daughter" ${member.relation==="Daughter"?"selected":""}>Daughter</option>
        <option value="Daughter In Law" ${member.relation==="Daughter In Law"?"selected":""}>Daughter In Law</option>
        <option value="Other" ${member.relation==="Other"?"selected":""}>Other</option>
      </select>
    </label>
    <label>Date of Birth <input type="text" name="dob" placeholder="dd/mm/yyyy" value="${member.dob||""}"></label>
    <label>Blood Group 
      <select name="bloodGroup">
        <option value="">Select</option>
        <option value="A+" ${member.bloodGroup==="A+"?"selected":""}>A+</option>
        <option value="A-" ${member.bloodGroup==="A-"?"selected":""}>A-</option>
        <option value="B+" ${member.bloodGroup==="B+"?"selected":""}>B+</option>
        <option value="B-" ${member.bloodGroup==="B-"?"selected":""}>B-</option>
        <option value="O+" ${member.bloodGroup==="O+"?"selected":""}>O+</option>
        <option value="O-" ${member.bloodGroup==="O-"?"selected":""}>O-</option>
        <option value="AB+" ${member.bloodGroup==="AB+"?"selected":""}>AB+</option>
        <option value="AB-" ${member.bloodGroup==="AB-"?"selected":""}>AB-</option>
      </select>
    </label>
    <label>Education <input type="text" name="education" value="${member.education||""}"></label>
    <label>Occupation <input type="text" name="occupation" value="${member.occupation||""}"></label>
    <label>City (NRIs) <input type="text" name="city" value="${member.city||""}"></label>
  `;

  const removeBtn = div.querySelector(".remove-member-btn");
  removeBtn.addEventListener("click", () => {
    div.remove();
    updateMemberNumbers();
  });

  membersContainer.appendChild(div);
  updateMemberNumbers();
}

// Add initial member section
createMemberSection();

// Floating Add Member button
addMemberBtn.addEventListener("click", () => createMemberSection());

// ------------------ Helper: Age ----------------------
function calculateAge(dob) {
  if (!dob) return "";
  const [day, month, year] = dob.split("/").map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// ------------------ Submit ----------------------
residentForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = new FormData(residentForm);
  const flatNo = formData.get("flatNo");
  const residentType = formData.get("residentType");

  const members = Array.from(membersContainer.querySelectorAll(".member-section")).map(div => {
    return {
      fullName: div.querySelector("[name=fullName]").value,
      email: div.querySelector("[name=email]").value,
      contactNumber: div.querySelector("[name=contactNumber]").value,
      gender: div.querySelector("[name=gender]").value,
      relation: div.querySelector("[name=relation]").value,
      dob: div.querySelector("[name=dob]").value,
      bloodGroup: div.querySelector("[name=bloodGroup]").value,
      education: div.querySelector("[name=education]").value,
      occupation: div.querySelector("[name=occupation]").value,
      city: div.querySelector("[name=city]").value
    };
  });

  const data = { flatNo, residentType, members, submittedBy: currentUser.uid };

  if (editDocId) {
    await updateDoc(doc(db, "residents", editDocId), data);
    editDocId = null;
  } else {
    await addDoc(collection(db, "residents"), data);
  }

  residentForm.reset();
  membersContainer.innerHTML = "";
  createMemberSection();
  updateFlatDropdown();
  alert("Details submitted successfully!");
});

// ------------------ Table View ----------------------
viewDataBtn.addEventListener("click", () => {
  formSection.style.display = "none";
  tableSection.style.display = "block";
  loadTableData();
});

goBackBtn.addEventListener("click", () => {
  tableSection.style.display = "none";
  formSection.style.display = "block";
  updateFlatDropdown();
});

async function loadTableData() {
  residentsTableBody.innerHTML = "";
  const q = query(collection(db, "residents"), orderBy("flatNo"));
  const snapshot = await getDocs(q);

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const tr = document.createElement("tr");

    const membersInfo = data.members.map(m => {
      const age = m.dob ? calculateAge(m.dob) : "";
      return `• Name: ${m.fullName}, Gender: ${m.gender}, Relation: ${m.relation}`
           + (age ? `, Age: ${age}` : "")
           + (m.contactNumber ? `, Contact: ${m.contactNumber}` : "")
           + (m.email ? `, Email: ${m.email}` : "");
    }).join("\n");

    const canEditOrDelete =
      (currentUser && data.submittedBy === currentUser.uid) ||
      (currentUser && data.members.some(m => m.email && m.email.toLowerCase() === currentUser.email.toLowerCase()));

    tr.innerHTML = `
      <td>${data.flatNo}</td>
      <td>${data.residentType}</td>
      <td style="white-space: pre-line;">${membersInfo}</td>
      <td>
        ${canEditOrDelete ? `
          <button class="edit-btn">Edit</button>
          <button class="delete-btn">Delete</button>` : ""}
      </td>
    `;

    if (canEditOrDelete) {
      tr.querySelector(".edit-btn").addEventListener("click", () => {
        formSection.style.display = "block";
        tableSection.style.display = "none";
        document.getElementsByName("flatNo")[0].value = data.flatNo;
        document.getElementsByName("residentType")[0].value = data.residentType;
        membersContainer.innerHTML = "";
        data.members.forEach(m => createMemberSection(m));
        editDocId = docSnap.id;
      });

      tr.querySelector(".delete-btn").addEventListener("click", async () => {
        if (confirm("Are you sure you want to delete this flat record?")) {
          await deleteDoc(doc(db, "residents", docSnap.id));
          loadTableData();
        }
      });
    }

    residentsTableBody.appendChild(tr);
  });
}

// ------------------ PDF Export ----------------------
exportBtn.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let rowIndex = 10;

  doc.setFont(undefined, "bold");
  doc.text("Flat No. | Resident Type | Members", 10, rowIndex);
  doc.setFont(undefined, "normal");
  rowIndex += 10;

  residentsTableBody.querySelectorAll("tr").forEach(tr => {
    const flatNo = tr.children[0].textContent;
    const residentType = tr.children[1].textContent;
    const membersText = tr.children[2].textContent.split("\n").map(line => line.trim()).join("; ");
    const rowText = [flatNo, residentType, membersText].join(" | ");
    doc.text(rowText, 10, rowIndex);
    rowIndex += 10;
  });

  doc.save("residents.pdf");
});
