const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log("=== Testing Authentication & Subjects API ===\n");

  const randSuffix = Math.floor(Math.random() * 10000);
  const adminUsername = `admin_${randSuffix}`;
  const studentUsername = `student_${randSuffix}`;

  // 1. Register Admin
  console.log(`1. Registering Admin user (${adminUsername})...`);
  const regAdminRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: adminUsername, password: 'adminPassword', role: 'ADMIN' })
  });
  console.log(`   Status: ${regAdminRes.status} (${regAdminRes.statusText})`);
  const adminData = await regAdminRes.json();
  console.log("   Body:", adminData);

  // 2. Register Student
  console.log(`\n2. Registering Student user (${studentUsername})...`);
  const regStudentRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: studentUsername, password: 'studentPassword', role: 'STUDENT' })
  });
  console.log(`   Status: ${regStudentRes.status} (${regStudentRes.statusText})`);
  const studentData = await regStudentRes.json();
  console.log("   Body:", studentData);

  // 3. Login Admin
  console.log("\n3. Logging in Admin user...");
  const loginAdminRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: adminUsername, password: 'adminPassword' })
  });
  console.log(`   Status: ${loginAdminRes.status}`);
  const { accessToken: adminToken } = await loginAdminRes.json();
  console.log(`   Token retrieved: ${adminToken ? 'YES' : 'NO'}`);

  // 4. Login Student
  console.log("\n4. Logging in Student user...");
  const loginStudentRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: studentUsername, password: 'studentPassword' })
  });
  console.log(`   Status: ${loginStudentRes.status}`);
  const { accessToken: studentToken } = await loginStudentRes.json();
  console.log(`   Token retrieved: ${studentToken ? 'YES' : 'NO'}`);

  // 5. GET /me (Student)
  console.log("\n5. Fetching /me profile using Student token...");
  const meRes = await fetch(`${BASE_URL}/me`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log(`   Status: ${meRes.status}`);
  console.log("   Profile:", await meRes.json());

  // 6. GET /subjects (Student)
  console.log("\n6. Listing /subjects using Student token...");
  const subjectsRes = await fetch(`${BASE_URL}/subjects`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log(`   Status: ${subjectsRes.status}`);
  console.log("   Subjects:", await subjectsRes.json());

  // 7. POST /subjects (Student) -> Expect 403
  console.log("\n7. Attempting to create subject as Student (expecting 403)...");
  const createSubStudentRes = await fetch(`${BASE_URL}/subjects`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({ name: `History_${randSuffix}` })
  });
  console.log(`   Status: ${createSubStudentRes.status} (${createSubStudentRes.statusText})`);
  console.log("   Body:", await createSubStudentRes.json());

  // 8. POST /subjects (Admin) -> Expect 201
  console.log(`\n8. Creating subject 'History_${randSuffix}' as Admin...`);
  const createSubAdminRes = await fetch(`${BASE_URL}/subjects`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ name: `History_${randSuffix}` })
  });
  console.log(`   Status: ${createSubAdminRes.status}`);
  const newSubject = await createSubAdminRes.json();
  console.log("   Created subject:", newSubject);

  // 9. PATCH /subjects/:id (Admin)
  console.log(`\n9. Updating subject ID ${newSubject.id} to 'Modern History_${randSuffix}' as Admin...`);
  const updateSubRes = await fetch(`${BASE_URL}/subjects/${newSubject.id}`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ name: `Modern History_${randSuffix}` })
  });
  console.log(`   Status: ${updateSubRes.status}`);
  console.log("   Updated subject:", await updateSubRes.json());

  // 10. DELETE /subjects/:id (Admin)
  console.log(`\n10. Deleting subject ID ${newSubject.id} as Admin...`);
  const deleteSubRes = await fetch(`${BASE_URL}/subjects/${newSubject.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log(`   Status: ${deleteSubRes.status}`);
  console.log("   Deleted subject response:", await deleteSubRes.json());

  console.log("\n=== Testing Complete ===");
}

run().catch(console.error);
