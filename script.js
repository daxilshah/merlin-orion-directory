import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// DOM Elements
const signinPanel = document.getElementById("signinPanel");
const panelSignInBtn = document.getElementById("panelSignInBtn");
const formContainer = document.getElementById("formContainer");
const signOutBtn = document.getElementById("signOutBtn");
const signOutSection = document.getElementById("signOutSection");
const userDetails = document.getElementById("userDetails");

const residentForm = document.getElementById("residentForm");
const flatNumber = document.getElementById("flatNumber");
const residentType = document.getElementById("residentType");
const nativePlace = document.getElementById("nativePlace");
const residentsContainer = document.getElementById("residentsContainer");
const addResidentBtn = document.getElementById("addResidentBtn");
const viewDataBtn = document.getElementById("viewDataBtn");
const dataContainer = document.getElementById("dataContainer");
const dataList = document.getElementById("dataList");
const goBackBtn = document.getElementById("goBackBtn");
const exportBtn = document.getElementById("exportBtn");

let currentUser = null;

// Toast function
function showToast(message, type = "success", duration = 3000) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `px-4 py-2 rounded shadow text-white ${
    type === "error" ? "bg-red-500" : "bg-green-500"
  }`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("opacity-0", "transition", "duration-500");
    setTimeout(() => toast.remove(), 500);
  }, duration);
}

// Initialize flat numbers
function initFlatNumbers() {
  flatNumber.innerHTML =
    '<option value="" disabled selected>Select Flat Number</option>';
  for (let floor = 1; floor <= 14; floor++) {
    for (let f = 1; f <= 4; f++) {
      const num = `${floor}${f.toString().padStart(2, "0")}`;
      const option = document.createElement("option");
      option.value = num;
      option.textContent = num;
      flatNumber.appendChild(option);
    }
  }
}

initFlatNumbers();

// Resident panel creation
function createResidentPanel(data = {}) {
  const panel = document.createElement("div");
  panel.classList.add("resident-panel");

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-btn text-red-500 mr-2";
  removeBtn.innerText = "X";
  removeBtn.onclick = () => panel.remove();
  panel.appendChild(removeBtn);

  const fields = [
    ["Full Name", "fullName", "text", null, "Enter Full Name"],
    ["Gender", "gender", "select", ["Male", "Female"], "Select Gender"],
    ["Contact Number", "contact", "text", null, "Enter Contact Number"],
    ["Email", "email", "email", null, "Enter Email Address"],
    ["Date of Birth", "dob", "date", null, "dd/mm/yyyy"],
    [
      "Relation to Primary Contact",
      "relation",
      "select",
      [
        "Self",
        "Spouse",
        "Father",
        "Mother",
        "Son",
        "Daughter",
        "Daughter In Law",
        "Other",
      ],
      "Select Relation",
    ],
    [
      "Blood Group",
      "bloodGroup",
      "select",
      ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      "Select Blood Group",
    ],
    [
      "Education",
      "education",
      "text",
      null,
      "Enter Education (e.g., B.Sc, MBA)",
    ],
    [
      "Occupation",
      "occupation",
      "text",
      null,
      "Enter Occupation (e.g., Engineer, Teacher)",
    ],
    [
      "City (Applicable for NRIs)",
      "city",
      "text",
      null,
      "Enter City (e.g., London, New York)",
    ],
  ];

  const mandatoryFields = ["fullName", "gender", "relation"];

  for (let i = 0; i < fields.length; i += 2) {
    const row = document.createElement("div");
    row.classList.add("form-row");
    for (let j = 0; j < 2; j++) {
      if (i + j >= fields.length) break;
      const [labelText, id, type, options, placeholder] = fields[i + j];
      const group = document.createElement("div");
      group.classList.add("form-group");
      const label = document.createElement("label");
      label.textContent = labelText;
      if (mandatoryFields.includes(id)) {
        const star = document.createElement("span");
        star.textContent = " *";
        star.classList.add("text-red-500");
        label.appendChild(star);
      }
      let input;
      if (type === "select") {
        input = document.createElement("select");
        if (placeholder) {
          const ph = document.createElement("option");
          ph.textContent = placeholder;
          ph.disabled = true;
          ph.selected = !data[id];
          input.appendChild(ph);
        }
        options.forEach((opt) => {
          const o = document.createElement("option");
          o.value = o.textContent = opt;
          input.appendChild(o);
        });
        if (data[id]) input.value = data[id];
      } else {
        input = document.createElement("input");
        input.type = type;
        input.value = data[id] || "";
        input.placeholder = placeholder || labelText;
      }
      input.required = mandatoryFields.includes(id);
      input.id = id;
      group.appendChild(label);
      group.appendChild(input);
      row.appendChild(group);
    }
    panel.appendChild(row);
  }
  residentsContainer.appendChild(panel);
}

// Auth
panelSignInBtn.onclick = () => {
  signInWithPopup(auth, provider);
};
signOutBtn.onclick = () => {
  signOut(auth);
};

// Auth state
auth.onAuthStateChanged((user) => {
  currentUser = user;
  console.log(user);
  if (user) {
    signinPanel.classList.add("hidden");
    formContainer.classList.remove("hidden");
    userDetails.textContent = `Logged in as: ${user.email}`;
    signOutSection.classList.remove("hidden");
  } else {
    signinPanel.classList.remove("hidden");
    formContainer.classList.add("hidden");
    signOutSection.classList.add("hidden");
  }
});
addResidentBtn.onclick = () => createResidentPanel();

// Form submit
residentForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!flatNumber.value || !residentType.value) {
    showToast("Please select Flat Number and Resident Type", "error");
    return;
  }
  const members = [];
  document.querySelectorAll(".resident-panel").forEach((panel) => {
    const member = {};
    panel.querySelectorAll("input,select").forEach((inp) => {
      member[inp.id] = inp.value;
    });
    members.push(member);
  });
  if (members.length === 0) {
    showToast("Please add at least one resident", "error");
    return;
  }

  const memberEmails = members.map((m) => m.email).filter(Boolean);
  const docRef = doc(db, "residents", flatNumber.value);
  await setDoc(docRef, {
    flatId: flatNumber.value,
    residentType: residentType.value,
    nativePlace: nativePlace.value || "",
    members,
    memberEmails,
    createdBy: currentUser.email,
  });
  showToast("Saved successfully!");
  residentForm.reset();
  residentsContainer.innerHTML = "";
};

function calculateAge(dobStr) {
  if (!dobStr) return "N/A";
  const birthDate = new Date(dobStr);
  if (isNaN(birthDate)) return "N/A";

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age + " Years";
}

async function editResident(docId, data) {
  // Hide data table and show form
  dataContainer.classList.add("hidden");
  formContainer.classList.remove("hidden");

  // Reset form
  residentForm.reset();
  residentsContainer.innerHTML = "";

  // Set Flat Number and Resident Type
  flatNumber.value = data.flatId;
  residentType.value = data.residentType;
  nativePlace.value = data.nativePlace || "";

  // Add resident panels for each member
  data.members.forEach((member) => {
    createResidentPanel(member);
  });

  // Override form submit temporarily to update existing record
  const originalSubmit = residentForm.onsubmit;
  residentForm.onsubmit = async (e) => {
    e.preventDefault();
    const members = [];
    document.querySelectorAll(".resident-panel").forEach((panel) => {
      const member = {};
      panel.querySelectorAll("input, select").forEach((inp) => {
        member[inp.id] = inp.value;
      });
      members.push(member);
    });

    if (members.length === 0) {
      showToast("Please add at least one resident", "error");
      return;
    }

    const memberEmails = members.map((m) => m.email).filter(Boolean);
    await setDoc(doc(db, "residents", docId), {
      flatId: flatNumber.value,
      residentType: residentType.value,
      members,
      memberEmails,
      createdBy: auth.currentUser.email,
    });

    showToast("Resident record updated successfully", "success");
    residentForm.reset();
    residentsContainer.innerHTML = "";

    // Restore original submit handler
    residentForm.onsubmit = originalSubmit;

    // Return to data view
    formContainer.classList.add("hidden");
    dataContainer.classList.remove("hidden");
    viewDataBtn.onclick(); // Refresh table
  };
}

// View Data
viewDataBtn.onclick = async () => {
  formContainer.classList.add("hidden");
  dataContainer.classList.remove("hidden");
  dataList.innerHTML = `
    <tr>
      <th>Flat No</th>
      <th>Resident Type</th>
      <th>Native</th>
      <th>Members</th>
      <th></th>
    </tr>
  `;

  const snapshot = await getDocs(collection(db, "residents"));
  const residentsArray = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    data: docSnap.data(),
  }));
  residentsArray.sort(
    (a, b) => parseInt(a.data.flatId) - parseInt(b.data.flatId)
  );

  residentsArray.forEach((resident) => {
    const data = resident.data;
    const tr = document.createElement("tr");
    const memberInfo = data.members
      .map((m) => {
        return `Name: ${m.fullName}\nGender: ${m.gender}\nContact No: ${
          m.contact
        }\nEmail: ${m.email}\nAge: ${calculateAge(m.dob)} (DOB: ${
          m.dob
        })\nRelation: ${m.relation}\nBlood Group: ${m.bloodGroup}\nEducation: ${
          m.education
        }\nOccupation: ${m.occupation}\nCity (If NRIs): ${m.city}`;
      })
      .join("\n\n");

    const actionsTd = document.createElement("td");
    const currentUserEmail = auth.currentUser?.email;
    const canEditOrDelete =
      data.createdBy === currentUserEmail ||
      (data.memberEmails && data.memberEmails.includes(currentUserEmail));
    if (canEditOrDelete) {
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.classList.add(
        "px-4",
        "py-2",
        "bg-gray-200",
        "text-black",
        "rounded",
        "mr-2"
      );
      editBtn.onclick = () => editResident(resident.id, data);

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.classList.add(
        "px-4",
        "py-2",
        "bg-gray-200",
        "text-black",
        "rounded"
      );
      deleteBtn.onclick = async () => {
        if (confirm("Are you sure you want to delete this record?")) {
          await deleteDoc(doc(db, "residents", resident.id));
          tr.remove();
          showToast("Record deleted successfully", "success");
        }
      };
      actionsTd.appendChild(editBtn);
      actionsTd.appendChild(deleteBtn);
    }

    tr.innerHTML = `
      <td>${data.flatId}</td>
      <td>${data.residentType}</td>
      <td>${data.nativePlace}</td>
      <td><pre>${memberInfo}</pre></td>
    `;
    tr.appendChild(actionsTd);

    dataList.appendChild(tr);
  });
};

// Go back
goBackBtn.onclick = () => {
  dataContainer.classList.add("hidden");
  formContainer.classList.remove("hidden");
};

// Export PDF
exportBtn.onclick = () => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Merlin Orion Residents Directory", 14, 20);
  const tableRows = [];
  const rows = dataList.querySelectorAll("tr");
  rows.forEach((row, index) => {
    const cols = Array.from(row.querySelectorAll("td, th"));
    const rowData = cols.slice(0, 3).map((td) => td.innerText.trim());
    tableRows.push(rowData);
  });
  const headers = tableRows.shift();
  autoTable(doc, {
    head: [headers],
    body: tableRows,
    startY: 30,
    theme: "grid",
    styles: { fontSize: 10, cellWidth: "wrap" },
    headStyles: { fillColor: [100, 100, 100] },
  });
  doc.save("MerlinOrionResidents.pdf");
};
