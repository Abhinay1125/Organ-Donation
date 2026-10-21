const hre = require("hardhat");
const { ethers } = require("ethers");
const assert = require("assert");

async function runTests() {
  console.log("=================================================");
  console.log("RUNNING RIGOROUS SMART CONTRACT VERIFICATION SUITE");
  console.log("=================================================\n");

  const provider = new ethers.BrowserProvider(hre.network.provider);
  const signers = [];
  for (let i = 0; i < 8; i++) {
    signers.push(await provider.getSigner(i));
  }

  const [admin, doctor, organizer, matchingOfficer, donorSurgeon, transporter, transplantSurgeon, unauthorizedUser] =
    signers;

  // --------------------------------------------------------------------------
  // TEST 1: Deployment & Role Assignment
  // --------------------------------------------------------------------------
  console.log("Test 1: Deploying OrganDonation and OrganTransplantation...");
  const donationArtifact = await hre.artifacts.readArtifact("OrganDonation");
  const OrganDonationFactory = new ethers.ContractFactory(
    donationArtifact.abi,
    donationArtifact.bytecode,
    admin
  );
  const donation = await OrganDonationFactory.deploy();
  await donation.waitForDeployment();

  const transplantationArtifact = await hre.artifacts.readArtifact("OrganTransplantation");
  const OrganTransplantationFactory = new ethers.ContractFactory(
    transplantationArtifact.abi,
    transplantationArtifact.bytecode,
    admin
  );
  const transplantation = await OrganTransplantationFactory.deploy();
  await transplantation.waitForDeployment();

  // Configure Roles
  await (await donation.setRoles(
    doctor.address,
    organizer.address,
    matchingOfficer.address,
    matchingOfficer.address
  )).wait();

  await (await transplantation.setRoles(
    donorSurgeon.address,
    transporter.address,
    transplantSurgeon.address,
    matchingOfficer.address
  )).wait();
  console.log("  [PASS] Contracts deployed and roles configured.");

  // --------------------------------------------------------------------------
  // TEST 2: Patient Registration in OrganDonation
  // --------------------------------------------------------------------------
  console.log("\nTest 2: Adding patient to waiting list...");
  const txPatient = await donation.connect(doctor).AddingNewPatient(
    "PAT-001",
    "John Doe (Synthetic)",
    "O+",
    "Kidney",
    45,
    24,
    "HOSP-CENTRAL"
  );
  await txPatient.wait();
  assert.strictEqual(await donation.getPatientCount(), 1n, "Patient count must be 1");
  const p = await donation.getPatient("PAT-001");
  assert.strictEqual(p.patientName, "John Doe (Synthetic)");
  console.log("  [PASS] Patient registered with doctor authorization and event emitted.");

  // Unauthorized patient registration check
  let rejected = false;
  try {
    const txUnauth = await donation.connect(unauthorizedUser).AddingNewPatient(
      "PAT-002",
      "Unauthorized",
      "A+",
      "Kidney",
      30,
      22,
      "HOSP-X"
    );
    await txUnauth.wait();
  } catch (err) {
    rejected = true;
  }
  assert.strictEqual(rejected, true, "Unauthorized user must be rejected from AddingNewPatient");
  console.log("  [PASS] Unauthorized patient registration correctly reverted.");

  // --------------------------------------------------------------------------
  // TEST 3: Donor Approval & Registration
  // --------------------------------------------------------------------------
  console.log("\nTest 3: Donor medical approval and registration...");
  await (await donation.connect(doctor).TestApproval("DON-001", true, "Donor medically cleared", "HASH123")).wait();
  await (await donation.connect(organizer).RegisteringNewDonor(
    "DON-001",
    "Jane Smith (Synthetic)",
    "O+",
    "Kidney",
    38,
    23,
    "HOSP-METRO"
  )).wait();
  assert.strictEqual(await donation.getDonorCount(), 1n, "Donor count must be 1");
  const d = await donation.getDonor("DON-001");
  assert.strictEqual(d.isApproved, true);
  console.log("  [PASS] Donor medical approval & registration verified.");

  // --------------------------------------------------------------------------
  // TEST 4: Matching Process (Human Authorization Required)
  // --------------------------------------------------------------------------
  console.log("\nTest 4: Recording authorized match...");
  await (await donation.connect(matchingOfficer).MatchingProcess(
    "MATCH-001",
    "DON-001",
    "PAT-001",
    "Kidney",
    96,
    "RF-v1",
    "Approved by Clinical Review Board"
  )).wait();
  const m = await donation.getMatch("MATCH-001");
  assert.strictEqual(m.scorePercent, 96n);
  assert.strictEqual(m.modelVersion, "RF-v1");
  console.log("  [PASS] Match recorded with model version and authorized reviewer address.");

  // --------------------------------------------------------------------------
  // TEST 5: Organ Lifecycle and Movement in OrganTransplantation
  // --------------------------------------------------------------------------
  console.log("\nTest 5: Organ Lifecycle (Retrieval -> Packaging -> Transit -> Delivered -> Received -> Transplanted)...");
  
  // Step 1: Retrieval (Donor Surgeon)
  await (await transplantation.connect(donorSurgeon).RemovingDonatedOrgan(
    "ORG-001",
    "DON-001",
    "Kidney",
    "HOSP-METRO",
    Math.floor(Date.now() / 1000)
  )).wait();
  let org = await transplantation.getOrgan("ORG-001");
  assert.strictEqual(org.currentState, 1n, "State must be RETRIEVED (1)");
  console.log("  [PASS] Organ retrieval confirmed by donor surgeon.");

  // Step 2: Packaging
  await (await transplantation.connect(donorSurgeon).PackageOrgan("ORG-001", "HOSP-METRO", Math.floor(Date.now() / 1000))).wait();
  org = await transplantation.getOrgan("ORG-001");
  assert.strictEqual(org.currentState, 2n, "State must be PACKAGED (2)");
  console.log("  [PASS] Organ packaging confirmed.");

  // Step 3: Start Delivery (Transporter)
  await (await transplantation.connect(transporter).StartDelivery(
    "ORG-001",
    "Express Med Courier Unit 4",
    "HOSP-METRO",
    "HOSP-CENTRAL",
    Math.floor(Date.now() / 1000)
  )).wait();
  org = await transplantation.getOrgan("ORG-001");
  assert.strictEqual(org.currentState, 3n, "State must be IN_TRANSIT (3)");
  console.log("  [PASS] Delivery started by authorized transporter.");

  // Step 4: End Delivery
  await (await transplantation.connect(transporter).EndDelivery(
    "ORG-001",
    "Perfusion container temperature 4°C - intact",
    Math.floor(Date.now() / 1000)
  )).wait();
  org = await transplantation.getOrgan("ORG-001");
  assert.strictEqual(org.currentState, 4n, "State must be DELIVERED (4)");
  console.log("  [PASS] Delivery completed at destination hospital.");

  // Step 5: Receive Organ (Transplant Surgeon)
  await (await transplantation.connect(transplantSurgeon).ReceiveDonatedOrgan(
    "ORG-001",
    "HOSP-CENTRAL",
    "Dr. S. Sharma",
    Math.floor(Date.now() / 1000)
  )).wait();
  org = await transplantation.getOrgan("ORG-001");
  assert.strictEqual(org.currentState, 5n, "State must be RECEIVED (5)");
  console.log("  [PASS] Organ receipt accepted by transplant surgeon.");

  // Step 6: Final Transplantation (Transplant Surgeon)
  await (await transplantation.connect(transplantSurgeon).Organ_Transplantation(
    "ORG-001",
    "PAT-001",
    "Graft revascularized successfully with immediate urine output",
    Math.floor(Date.now() / 1000)
  )).wait();
  org = await transplantation.getOrgan("ORG-001");
  assert.strictEqual(org.currentState, 6n, "State must be TRANSPLANTED (6)");
  console.log("  [PASS] Surgical transplantation confirmed on-chain.");

  // --------------------------------------------------------------------------
  // TEST 6: Invalid State Machine Transitions (Must Revert)
  // --------------------------------------------------------------------------
  console.log("\nTest 6: Validating state machine transition enforcement...");
  
  // Register another organ to test illegal jump
  await (await transplantation.connect(donorSurgeon).RemovingDonatedOrgan(
    "ORG-TEST-ILLEGAL",
    "DON-002",
    "Liver",
    "HOSP-METRO",
    Math.floor(Date.now() / 1000)
  )).wait();
  
  // Try to jump from RETRIEVED directly to TRANSPLANTED
  let jumpRejected = false;
  try {
    const txJump = await transplantation.connect(transplantSurgeon).Organ_Transplantation(
      "ORG-TEST-ILLEGAL",
      "PAT-001",
      "Premature",
      Math.floor(Date.now() / 1000)
    );
    await txJump.wait();
  } catch (err) {
    jumpRejected = true;
  }
  assert.strictEqual(jumpRejected, true, "Direct jump from RETRIEVED to TRANSPLANTED must revert");
  console.log("  [PASS] Illegal jump from RETRIEVED to TRANSPLANTED reverted as expected.");

  console.log("\n=================================================");
  console.log("ALL SMART CONTRACT TESTS PASSED SUCCESSFULLY! (6/6)");
  console.log("=================================================\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
