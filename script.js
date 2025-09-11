import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDocs, query, orderBy, deleteDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
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
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// DOM
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
const formView = document.getElementById("form-view");
const tableView = document.getElementById("table-view");
const residentsTableBody = document.querySelector("#residents-table tbody");

let currentUser = null;
let editingFlatId = null;

// Populate Flats
function populateFlats() {
  flatSelect.innerHTML = '<option value="" disabled selected>Select Flat Number</option>';
  for (let floor=1; floor<=14; floor++){
    for(let f=1; f<=4; f++){
      let flatNo = `${floor}0${f}`;
      flatSelect.innerHTML += `<option value="${flatNo}">${flatNo}</option>`;
    }
  }
}
populateFlats();

// Add Member Panel
function createMemberPanel(data={}) {
  const panel = document.createElement("div");
  panel.className = "resident-section";
  panel.innerHTML = `
    <button type="button" class="remove-member-btn">✕</button>
    <div class="row">
      <div class="col input-group"><label>Full Name</label><input placeholder="Full Name" value="${data.fullName||''}" required/></div>
      <div class="col input-group"><label>Gender</label><select required>
        <option value="" disabled ${!data.gender?"selected":""}>Select Gender</option>
        <option value="Male" ${data.gender==="Male"?"selected":""}>Male</option>
        <option value="Female" ${data.gender==="Female"?"selected":""}>Female</option>
      </select></div>
    </div>
    <div class="row">
      <div class="col input-group"><label>Contact Number</label><input placeholder="Contact Number" value="${data.contact||''}"/></div>
      <div class="col input-group"><label>Email</label><input type="email" placeholder="Email" value="${data.email||''}"/></div>
    </div>
    <div class="row">
      <div class="col input-group"><label>Date of Birth</label><input type="date" value="${data.dob||''}"/></div>
      <div class="col input-group"><label>Relation to Primary Contact</label><select>
        <option value="" disabled ${!data.relation?"selected":""}>Select Relation</option>
        <option value="Self" ${data.relation==="Self"?"selected":""}>Self</option>
        <option value="Spouse" ${data.relation==="Spouse"?"selected":""}>Spouse</option>
        <option value="Father" ${data.relation==="Father"?"selected":""}>Father</option>
        <option value="Mother" ${data.relation==="Mother"?"selected":""}>Mother</option>
        <option value="Son" ${data.relation==="Son"?"selected":""}>Son</option>
        <option value="Daughter" ${data.relation==="Daughter"?"selected":""}>Daughter</option>
        <option value="Daughter In Law" ${data.relation==="Daughter In Law"?"selected":""}>Daughter In Law</option>
        <option value="Other" ${data.relation==="Other"?"selected":""}>Other</option>
      </select></div>
    </div>
    <div class="row">
      <div class="col input-group"><label>Blood Group</label><select>
        <option value="" disabled ${!data.bloodGroup?"selected":""}>Select Blood Group</option>
        <option value="A+">A+</option><option value="A-">A-</option>
        <option value="B+">B+</option><option value="B-">B-</option>
        <option value="O+">O+</option><option value="O-">O-</option>
        <option value="AB+">AB+</option><option value="AB-">AB-</option>
      </select></div>
      <div class="col input-group"><label>Education</label><input placeholder="Education" value="${data.education||''}"/></div>
    </div>
    <div class="row">
      <div class="col input-group"><label>Occupation</label><input placeholder="Occupation" value="${data.occupation||''}"/></div>
      <div class="col input-group"><label>City (Applicable for NRIs)</label><input placeholder="City" value="${data.city||''}"/></div>
    </div>
  `;
  panel.querySelector(".remove-member-btn").addEventListener("click", ()=>panel.remove());
  membersContainer.appendChild(panel);
}

addMemberBtn.addEventListener("click", ()=>createMemberPanel());

// Auth
signInBtn.addEventListener("click", ()=>signInWithPopup(auth,provider));
signOutBtn.addEventListener("click", ()=>signOut(auth));
onAuthStateChanged(auth,user=>{
  currentUser = user;
  if(user){
    signInBtn.classList.add("hidden");
    signOutBtn.classList.remove("hidden");
    userDetailsSpan.textContent = `Logged in as: ${user.email}`;
  }else{
    signInBtn.classList.remove("hidden");
    signOutBtn.classList.add("hidden");
    userDetailsSpan.textContent="";
  }
});

// Submit
submitBtn.addEventListener("click", async ()=>{
  const flatNo = flatSelect.value;
  const residentType = residentTypeSelect.value;
  if(!flatNo || !residentType) return alert("Flat Number & Resident Type required");

  const members = Array.from(membersContainer.children).map(panel=>{
    return {
      fullName: panel.querySelector("input[placeholder='Full Name']").value,
      gender: panel.querySelector("select").value,
      contact: panel.querySelector("input[placeholder='Contact Number']").value,
      email: panel.querySelector("input[placeholder='Email']").value,
      dob: panel.querySelector("input[type='date']").value,
      relation: panel.querySelectorAll("select")[1].value,
      bloodGroup: panel.querySelectorAll("select")[2].value,
      education: panel.querySelectorAll("input")[2].value,
      occupation: panel.querySelectorAll("input")[3].value,
      city: panel.querySelectorAll("input")[4].value
    };
  });

  const memberEmails = members.map(m=>m.email).filter(e=>e);
  const docData = { flatNo,residentType,members,memberEmails,createdBy:currentUser?.email||null };
  await setDoc(doc(db,"residents",flatNo),docData);
  alert("Data saved");
});

// View Submitted Data
viewDataBtn.addEventListener("click", async ()=>{
  formView.style.display="none";
  tableView.style.display="block";
  residentsTableBody.innerHTML="";
  const snap = await getDocs(query(collection(db,"residents"),orderBy("flatNo")));
  snap.forEach(docSnap=>{
    const data = docSnap.data();
    const tr = document.createElement("tr");
    const memberInfo = data.members.map(m=>{
      const age = m.dob ? Math.floor((new Date() - new Date(m.dob))/31556952000) : "";
      return `${m.fullName} (${m.relation}, ${m.gender}${age?`, Age: ${age}`:""})\nContact: ${m.contact || "-"}\nEmail: ${m.email || "-"}\nBlood: ${m.bloodGroup || "-"}, Education: ${m.education || "-"}, Occupation: ${m.occupation || "-"}, City: ${m.city || "-"}`;
    }).join("\n\n");
    tr.innerHTML=`<td>${data.flatNo}</td><td>${data.residentType}</td><td>${memberInfo}</td>
      <td>
        ${currentUser&&(currentUser.email===data.createdBy || data.memberEmails.includes(currentUser.email)) ? '<button class="edit-btn btn-black">Edit</button> <button class="delete-btn btn-black">Delete</button>':""}
      </td>`;
    // Edit
    tr.querySelector(".edit-btn")?.addEventListener("click", ()=>{
      formView.style.display="block";
      tableView.style.display="none";
      flatSelect.value = data.flatNo;
      residentTypeSelect.value = data.residentType;
      membersContainer.innerHTML="";
      data.members.forEach(m=>createMemberPanel(m));
      editingFlatId = data.flatNo;
    });
    // Delete
    tr.querySelector(".delete-btn")?.addEventListener("click", async ()=>{
      if(confirm("Delete this record?")){
        await deleteDoc(doc(db,"residents",data.flatNo));
        tr.remove();
      }
    });
    residentsTableBody.appendChild(tr);
  });
});

// Go Back
backBtn.addEventListener("click",()=>{
  formView.style.display="block";
  tableView.style.display="none";
});

// Export
exportBtn.addEventListener("click",()=>{
  const doc = new jsPDF();
  const rows = [];
  document.querySelectorAll("#residents-table tbody tr").forEach(tr=>{
    rows.push([tr.children[0].innerText,tr.children[1].innerText,tr.children[2].innerText.replace(/\n/g," | ")]);
  });
  doc.autoTable({head:[["Flat No.","Resident Type","Members Info"]],body:rows});
  doc.save("residents.pdf");
});
