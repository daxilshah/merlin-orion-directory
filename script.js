import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, deleteDoc } from "firebase/firestore";
import jsPDF from "jspdf";

// Firebase config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// DOM elements
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
const flatNoSelect = document.getElementById("flatNo");
const residentTypeSelect = document.getElementById("residentType");

let currentUser = null;
let editingFlatNo = null;

// -------- Populate Flat Numbers Grouped by Floor --------
function populateFlatNumbers() {
  flatNoSelect.innerHTML = "";
  for (let floor = 1; floor <= 14; floor++) {
    const optGroup = document.createElement("optgroup");
    optGroup.label = `Floor ${floor}`;
    for (let flat = 1; flat <= 4; flat++) {
      const flatNo = `${floor}${flat.toString().padStart(2, "0")}`;
      const option = document.createElement("option");
      option.value = flatNo;
      option.textContent = flatNo;
      optGroup.appendChild(option);
    }
    flatNoSelect.appendChild(optGroup);
  }
}

// -------- Disable occupied flats --------
async function disableOccupiedFlats() {
  const querySnapshot = await getDocs(collection(db, "residents"));
  const occupiedFlats = querySnapshot.docs.map(docSnap => docSnap.id);

  document.querySelectorAll("#flatNo option").forEach(opt => {
    if (occupiedFlats.includes(opt.value) && opt.value !== editingFlatNo) {
      opt.disabled = true;
    } else {
      opt.disabled = false;
    }
  });
}

// -------- Member block builder --------
function addMember(member = {}) {
  const memberDiv = document.createElement("div");
  memberDiv.className = "member-block";
  memberDiv.innerHTML = `
    <label>Full Name *</label>
    <input type="text" name="fullName" value="${member.fullName || ""}" required>

    <label>Contact Number</label>
    <input type="text" name="contactNumber" value="${member.contactNumber || ""}">

    <label>Email</label>
    <input type="email" name="email" value="${member.email || ""}">

    <label>Gender *</label>
    <select name="gender" required>
      <option value="">--Select--</option>
      <option value="Male" ${member.gender === "Male" ? "selected" : ""}>Male</option>
      <option value="Female" ${member.gender === "Female" ? "selected" : ""}>Female</option>
    </select>

    <label>Date of Birth</label>
    <input type="date" name="dob" value="${member.dob || ""}">

    <label>Relation *</label>
    <select name="relation" required>
      <option value="">--Select--</option>
      ${["Self","Spouse","Father","Mother","Son","Daughter","Daughter In Law","Other"]
        .map(rel => `<option value="${rel}" ${member.relation === rel ? "selected" : ""}>${rel}</option>`).join("")}
    </select>

    <label>Blood Group</label>
    <select name="bloodGroup">
      ${["","A+","A-","B+","B-","O+","O-","AB+","AB-"]
        .map(bg => `<option value="${bg}" ${member.bloodGroup === bg ? "selected" : ""}>${bg}</option>`).join("")}
    </select>

    <label>Education</label>
    <input type="text" name="education" value="${member.education || ""}">

    <label>Occupation</label>
    <input type="text" name="occupation" value="${member.occupation || ""}">

    <label>City</label>
    <input type="text" name="city" value="${member.city || ""}">

    <button type="button" class="remove-member-btn">Remove</button>
  `;

  memberDiv.querySelector(".remove-member-btn").addEventListener("click", () => {
    membersContainer.removeChild(memberDiv);
  });

  membersContainer.appendChild(memberDiv);
}

// -------- Collect Member Data --------
function getMembersData() {
  const members = [];
  document.querySelectorAll(".member-block").forEach(block => {
    members.push({
      fullName: block.querySelector('input[name="fullName"]').value,
      contactNumber: block.querySelector('input[name="contactNumber"]').value,
      email: block.querySelector('input[name="email"]').value,
      gender: block.querySelector('select[name="gender"]').value,
      dob: block.querySelector('input[name="dob"]').value,
      relation: block.querySelector('select[name="relation"]').value,
      bloodGroup: block.querySelector('select[name="bloodGroup"]').value,
      education: block.querySelector('input[name="education"]').value,
      occupation: block.querySelector('input[name="occupation"]').value,
      city: block.querySelector('input[name="city"]').value
    });
  });
  return members;
}

// -------- Form Submit --------
residentForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const flatNo = flatNoSelect.value;
  const residentType = residentTypeSelect.value;
  const members = getMembersData();
  const memberEmails = members.map(m => m.email).filter(Boolean);

  if (!flatNo || !residentType || members.length === 0) {
    alert("Please fill all required fields.");
    return;
  }

  try {
    await setDoc(doc(db, "residents", flatNo), {
      flatNo,
      residentType,
      members,
      memberEmails,
      createdBy: currentUser.email
    }, { merge: true });

    alert("Details saved successfully!");
    residentForm.reset();
    membersContainer.innerHTML = "";
    editingFlatNo = null;
    addMember();
    disableOccupiedFlats();
  } catch (err) {
    console.error(err);
    alert("Error saving data.");
  }
});

// -------- Load Residents --------
async function loadResidents() {
  dataTableBody.innerHTML = "";
  const querySnapshot = await getDocs(collection(db, "residents"));
  const rows = querySnapshot.docs.map(docSnap => docSnap.data());
  rows.sort((a, b) => parseInt(a.flatNo) - parseInt(b.flatNo));

  rows.forEach(data => {
    const tr = document.createElement("tr");

    const membersInfo = data.members.map(m => {
      let ageText = "";
      if (m.dob) {
        const birthDate = new Date(m.dob);
        const age = new Date().getFullYear() - birthDate.getFullYear();
        ageText = ` (Age: ${age})`;
      }
      return `${m.fullName} - ${m.relation} - ${m.gender}${ageText}${m.email ? ` - ${m.email}` : ""}`;
    }).join("<br>");

    tr.innerHTML = `
      <td>${data.flatNo}</td>
      <td>${data.residentType}</td>
      <td>${membersInfo}</td>
      <td>
        ${(data.createdBy === currentUser?.email || data.memberEmails?.includes(currentUser?.email)) ? `
          <button class="edit-btn" data-id="${data.flatNo}">Edit</button>
          <button class="delete-btn" data-id="${data.flatNo}">Delete</button>
        ` : ""}
      </td>
    `;

    dataTableBody.appendChild(tr);
  });

  // Edit handler
  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const flatId = e.target.dataset.id;
      const docSnap = await getDoc(doc(db, "residents", flatId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        flatNoSelect.value = data.flatNo;
        residentTypeSelect.value = data.residentType;
        membersContainer.innerHTML = "";
        data.members.forEach(m => addMember(m));
        editingFlatNo = flatId;
        tableView.style.display = "none";
        formView.style.display = "block";
        disableOccupiedFlats();
      }
    });
  });

  // Delete handler
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const flatId = e.target.dataset.id;
      if (confirm("Are you sure you want to delete this record?")) {
        await deleteDoc(doc(db, "residents", flatId));
        loadResidents();
        disableOccupiedFlats();
      }
    });
  });
}

// -------- Export PDF --------
exportBtn.addEventListener("click", () => {
  const doc = new jsPDF();
  let y = 10;
  doc.text("Merlin Orion Directory", 10, y);
  y += 10;

  document.querySelectorAll("#data-table-body tr").forEach(row => {
    const cols = row.querySelectorAll("td");
    const text = `${cols[0].innerText} | ${cols[1].innerText} | ${cols[2].innerText}`;
    doc.text(text, 10, y);
    y += 10;
  });

  doc.save("residents.pdf");
});

// -------- Navigation --------
viewDataBtn.addEventListener("click", () => {
  formView.style.display = "none";
  tableView.style.display = "block";
  loadResidents();
});

backBtn.addEventListener("click", () => {
  formView.style.display = "block";
  tableView.style.display = "none";
  disableOccupiedFlats();
});

// -------- Add Member --------
addMemberBtn.addEventListener("click", () => addMember());

// -------- Google Auth --------
signInBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error(err);
    alert("Sign-in failed.");
  }
});

signOutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    signInBtn.style.display = "none";
    signOutBtn.style.display = "inline";
    userDetails.textContent = `Logged in as: ${user.email}`;
    populateFlatNumbers();
    addMember();
    disableOccupiedFlats();
  } else {
    currentUser = null;
    signInBtn.style.display = "inline";
    signOutBtn.style.display = "none";
    userDetails.textContent = "";
    membersContainer.innerHTML = "";
    flatNoSelect.innerHTML = "";
  }
});
