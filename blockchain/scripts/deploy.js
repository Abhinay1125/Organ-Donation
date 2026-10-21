const hre = require("hardhat");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting Smart Contract Deployment...");

  const provider = new ethers.BrowserProvider(hre.network.provider);
  const signers = [];
  for (let i = 0; i < 8; i++) {
    signers.push(await provider.getSigner(i));
  }

  const [deployer, doctor, organizer, matchingOfficer, donorSurgeon, transporter, transplantSurgeon] = signers;

  console.log("Deployer address:", deployer.address);
  console.log("Doctor address:", doctor.address);
  console.log("Transporter address:", transporter.address);

  // 1. Deploy OrganDonation
  const donationArtifact = await hre.artifacts.readArtifact("OrganDonation");
  const OrganDonationFactory = new ethers.ContractFactory(
    donationArtifact.abi,
    donationArtifact.bytecode,
    deployer
  );
  const organDonation = await OrganDonationFactory.deploy();
  await organDonation.waitForDeployment();
  const organDonationAddress = await organDonation.getAddress();
  console.log("OrganDonation deployed to:", organDonationAddress);

  // Configure Roles in OrganDonation
  const patientDoctorAddr = doctor.address;
  const procurementOrgAddr = organizer.address;
  const transplantTeamAddr = matchingOfficer.address;
  const matchingOrgAddr = matchingOfficer.address;

  const tx1 = await organDonation.setRoles(
    patientDoctorAddr,
    procurementOrgAddr,
    transplantTeamAddr,
    matchingOrgAddr
  );
  await tx1.wait();
  console.log("OrganDonation roles configured.");

  // 2. Deploy OrganTransplantation
  const transplantationArtifact = await hre.artifacts.readArtifact("OrganTransplantation");
  const OrganTransplantationFactory = new ethers.ContractFactory(
    transplantationArtifact.abi,
    transplantationArtifact.bytecode,
    deployer
  );
  const organTransplantation = await OrganTransplantationFactory.deploy();
  await organTransplantation.waitForDeployment();
  const organTransplantationAddress = await organTransplantation.getAddress();
  console.log("OrganTransplantation deployed to:", organTransplantationAddress);

  // Configure Roles in OrganTransplantation
  const donorSurgeonAddr = donorSurgeon.address;
  const transporterAddr = transporter.address;
  const transplantSurgeonAddr = transplantSurgeon.address;

  const tx2 = await organTransplantation.setRoles(
    donorSurgeonAddr,
    transporterAddr,
    transplantSurgeonAddr,
    transplantTeamAddr
  );
  await tx2.wait();
  console.log("OrganTransplantation roles configured.");

  // 3. Export ABIs and Deployment Info
  const deploymentData = {
    network: hre.network.name,
    chainId: hre.network.config.chainId || 31337,
    deployedAt: new Date().toISOString(),
    contracts: {
      OrganDonation: {
        address: organDonationAddress,
        abi: donationArtifact.abi,
      },
      OrganTransplantation: {
        address: organTransplantationAddress,
        abi: transplantationArtifact.abi,
      },
    },
    roles: {
      admin: deployer.address,
      patientDoctor: patientDoctorAddr,
      procurementOrganizer: procurementOrgAddr,
      hospitalTransplantTeam: transplantTeamAddr,
      organMatchingOrganizer: matchingOrgAddr,
      donorSurgeon: donorSurgeonAddr,
      transporter: transporterAddr,
      transplantSurgeon: transplantSurgeonAddr,
    },
  };

  const deploymentsPath = path.join(__dirname, "../deployments.json");
  fs.writeFileSync(deploymentsPath, JSON.stringify(deploymentData, null, 2));
  console.log("Wrote deployment data to:", deploymentsPath);

  // Also write to backend contracts directory
  const backendDir = path.join(__dirname, "../../backend/app/contracts");
  if (!fs.existsSync(backendDir)) {
    fs.mkdirSync(backendDir, { recursive: true });
  }
  const backendDeploymentsPath = path.join(backendDir, "contracts.json");
  fs.writeFileSync(backendDeploymentsPath, JSON.stringify(deploymentData, null, 2));
  console.log("Synced deployment data to backend:", backendDeploymentsPath);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
