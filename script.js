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
const mainContainer = document.getElementById("mainContainer");
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
const goBackBtn1 = document.getElementById("goBackBtn1");
const goBackBtn2 = document.getElementById("goBackBtn2");
const exportBtn = document.getElementById("exportBtn");
const recordNewEntry = document.getElementById("recordNewEntry");
const loader = document.getElementById("loader");

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

// Loader functions
function showLoader() {
  loader.classList.remove("hidden");
}

function hideLoader() {
  loader.classList.add("hidden");
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

async function disableUsedFlats() {
  showLoader();
  const snapshot = await getDocs(collection(db, "residents"));
  const usedFlats = new Set();
  try {
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.flatId) {
        usedFlats.add(data.flatId);
      }
    });
  } finally {
    hideLoader();
  }

  [...flatNumber.options].forEach((opt, idx) => {
    if (usedFlats.has(opt.value)) {
      opt.disabled = true;
    } else if (idx !== 0) {
      opt.disabled = false;
    }
  });
}

initFlatNumbers();

function updateResidentNumbers() {
  showLoader();
  document.querySelectorAll(".resident-panel").forEach((panel, index) => {
    const title = panel.querySelector(".resident-title");
    if (title) {
      title.textContent = `Resident #${index + 1}`;
    }
  });
  hideLoader();
}

// Resident panel creation
function createResidentPanel(data = {}) {
  const panel = document.createElement("div");
  panel.classList.add("resident-panel");
  const header = document.createElement("div");
  header.className = "resident-header flex justify-between items-center mb-2";

  const title = document.createElement("h3");
  title.className = "resident-title font-semibold text-lg";
  title.textContent = "Resident";
  header.appendChild(title);

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-btn text-red-500";
  removeBtn.innerText = "X";
  removeBtn.onclick = () => {
    panel.remove();
    updateResidentNumbers(); // renumber after removal
  };
  header.appendChild(removeBtn);
  panel.appendChild(header);

  const fields = [
    ["Full Name", "fullName", "text", null, "Enter Full Name"],
    ["Gender", "gender", "select", ["Male", "Female"], "Select Gender"],
    ["Date of Birth", "dob", "date", null, "dd/mm/yyyy"],
    ["Contact Number", "contact", "text", null, "Enter Contact Number"],
    ["Email", "email", "email", null, "Enter Email Address"],
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
        "Grand Father",
        "Grand Mother",
        "Grand Son",
        "Grand Daughter",
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
      "Marital Status",
      "maritalStatus",
      "select",
      ["Single", "Married"],
      "Select Status",
    ],
    [
      "City (Applicable for NRIs)",
      "city",
      "text",
      null,
      "Enter City (e.g., London, New York)",
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
  ];

  const mandatoryFields = ["fullName", "gender", "relation"];

  const formFieldGenerator = (fields) => {
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
            ph.value = "";
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
  };
  formFieldGenerator(fields.slice(0, 1));
  formFieldGenerator(fields.slice(1, fields.length));
  residentsContainer.appendChild(panel);
  updateResidentNumbers(); // renumber after adding
}

// Auth
panelSignInBtn.onclick = () => {
  signInWithPopup(auth, provider);
};
signOutBtn.onclick = () => {
  signOut(auth);
};

// Auth state
showLoader();
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  if (user) {
    signinPanel.classList.add("hidden");
    mainContainer.classList.remove("hidden");
    userDetails.textContent = `Hi, ${user.displayName || user.email}`;
    signOutSection.classList.remove("hidden");
    await disableUsedFlats();
  } else {
    signinPanel.classList.remove("hidden");
    mainContainer.classList.add("hidden");
    signOutSection.classList.add("hidden");
    formContainer.classList.add("hidden");
    dataContainer.classList.add("hidden");
    residentForm.reset();
    residentsContainer.innerHTML = "";
  }
  hideLoader();
});
addResidentBtn.onclick = () => createResidentPanel();

// Reusable function to get and validate form data
function getResidentData() {
  if (!flatNumber.value || !residentType.value) {
    showToast("Please select Flat Number and Resident Type", "error");
    return { isValid: false };
  }
  const members = [];
  document.querySelectorAll(".resident-panel").forEach((panel) => {
    const member = {};
    panel.querySelectorAll("input, select").forEach((inp) => {
      member[inp.id] = inp.value;
    });
    members.push(member);
  });
  const missingFields = members.some((member) => {
    return !member.fullName || !member.gender || !member.relation;
  });
  if (missingFields) {
    showToast("Please fill in all mandatory fields for each members.", "error");
    return { isValid: false };
  }
  const memberEmails = members.map((m) => m.email).filter(Boolean);
  return { members, memberEmails, isValid: true };
}

// Form submit
residentForm.onsubmit = async (e) => {
  e.preventDefault();
  const { members, memberEmails, isValid } = getResidentData();
  if (!isValid) return;
  if (members.length === 0) {
    showToast("Please add at least one member", "error");
    return;
  }

  showLoader();
  try {
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
    viewDataBtn.click();
  } finally {
    hideLoader();
  }
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
  mainContainer.classList.add("hidden");
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
    const { members, memberEmails, isValid } = getResidentData();
    if (!isValid) return;

    if (members.length === 0) {
      showToast("Please add at least one member", "error");
      return;
    }
    showLoader();
    try {
      await setDoc(doc(db, "residents", docId), {
        flatId: flatNumber.value,
        residentType: residentType.value,
        nativePlace: nativePlace.value || "",
        members,
        memberEmails,
        createdBy: auth.currentUser.email,
      });
    } finally {
      hideLoader();
    }

    showToast("Resident record updated successfully", "success");
    residentForm.reset();
    residentsContainer.innerHTML = "";

    // Restore original submit handler
    residentForm.onsubmit = originalSubmit;

    // Return to data view
    formContainer.classList.add("hidden");
    mainContainer.classList.add("hidden");
    dataContainer.classList.remove("hidden");
    viewDataBtn.onclick(); // Refresh table
  };
}

recordNewEntry.onclick = async () => {
  mainContainer.classList.add("hidden");
  formContainer.classList.remove("hidden");
  dataContainer.classList.add("hidden");
};

goBackBtn1.onclick = async () => {
  dataContainer.classList.add("hidden");
  formContainer.classList.add("hidden");
  mainContainer.classList.remove("hidden");
  await disableUsedFlats();
};

goBackBtn2.onclick = async () => {
  dataContainer.classList.add("hidden");
  formContainer.classList.add("hidden");
  mainContainer.classList.remove("hidden");
  await disableUsedFlats();
};

// View Data
viewDataBtn.onclick = async () => {
  mainContainer.classList.add("hidden");
  formContainer.classList.add("hidden");
  dataContainer.classList.remove("hidden");
  await disableUsedFlats();
  showLoader();
  try {
    dataList.innerHTML = `
      <tr>
        <th>Flat No</th>
        <th>Members Detail</th>
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
      let memberMetadata = `<strong>Resident Type:</strong> ${data.residentType}\n`;
      if (data.nativePlace) {
        memberMetadata += `<strong>Native:</strong> ${data.nativePlace}\n`;
      }
      memberMetadata += `<strong>Total Members:</strong> ${data.members.length}\n\n`;
      const memberInfo =
        memberMetadata +
        data.members
          .map((m) => {
            let dataStr = ``;
            const fieldOrder = {
              fullName: "Name",
              gender: "Gender",
              contact: "Contact No.",
              email: "Email",
              maritalStatus: "Marital Status",
              dob: "DOB",
              relation: "Relation",
              bloodGroup: "Blood Group",
              education: "Education",
              occupation: "Occupation",
              city: "City (If NRIs)",
            };
            for (let key in fieldOrder) {
              if (m[key]) {
                if (key === "dob") {
                  dataStr += `<strong>Age:</strong> ${calculateAge(
                    m.dob
                  )} (<strong>DOB:</strong> ${
                    m.dob ? m.dob.split("-").reverse().join("/") : ""
                  })\n`;
                } else {
                  dataStr += `<strong>${fieldOrder[key]}:</strong> ${m[key]}\n`;
                }
              }
            }
            return dataStr;
          })
          .join("\n");

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
          "bg-black",
          "text-white",
          "rounded",
          "mr-2",
          "mb-2"
        );
        editBtn.onclick = () => editResident(resident.id, data);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.classList.add(
          "px-4",
          "py-2",
          "bg-red-500",
          "text-white",
          "rounded",
          "mb-2"
        );
        deleteBtn.onclick = async () => {
          if (confirm("Are you sure you want to delete this record?")) {
            await deleteDoc(doc(db, "residents", resident.id));
            tr.remove();
            showToast("Record deleted successfully", "success");
            await disableUsedFlats();
          }
        };
        actionsTd.appendChild(editBtn);
        actionsTd.appendChild(deleteBtn);
      }

      tr.innerHTML = `
        <td><strong>${data.flatId}</strong></td>
        <td class="details-renderer-cell"><pre class="details-renderer">${memberInfo}</pre></td>
      `;
      tr.appendChild(actionsTd);

      dataList.appendChild(tr);
    });
  } finally {
    hideLoader();
  }
};

function getFormattedDateTime() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${day}-${month}-${year}-${hours}-${minutes}-${seconds}`;
}

// Export PDF
exportBtn.onclick = () => {
  showLoader();
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Merlin Orion Residents Directory", 14, 20);
  const tableRows = [];
  const rows = dataList.querySelectorAll("tr");
  rows.forEach((row, index) => {
    const cols = Array.from(row.querySelectorAll("td, th"));
    const rowData = cols.slice(0, 2).map((td) => td.innerText.trim());
    tableRows.push(rowData);
  });
  const headers = tableRows.shift();
  autoTable(doc, {
    head: [headers],
    body: tableRows,
    startY: 30,
    theme: "grid",
    styles: { fontSize: 10, cellWidth: "wrap" },
    headStyles: { fillColor: [100, 100, 100, 100] },
    columnStyles: {
      2: { cellWidth: 80 }, // Adjust the width of the 'Members' column to provide more space
    },
  });
  doc.save(`MerlinOrionResidents-${getFormattedDateTime()}.pdf`);
  hideLoader();
  showToast("File downloaded successfully!");
};
